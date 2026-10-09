import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { db } from '../../../../server/db/client';
import { notices, accounts } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { logNoticeActivity } from '../../../../server/services/activityLogger';
import { parseNoticeBackground } from '@/server/actions/notices';
import { createServiceClient } from '@/lib/supabase/server';
import { STORAGE_BUCKET_NOTICES } from '@/lib/constants';
import { documents } from '@/drizzle/schema';

/**
 * POST /api/webhooks/email-intake
 * Receives inbound email payloads forwarded by Make.com from Gmail.
 * Protected by EMAIL_INTAKE_WEBHOOK_SECRET header.
 *
 * Expects JSON body:
 *   - from: string          — sender address
 *   - subject: string       — email subject
 *   - pdfBase64: string     — base64-encoded PDF attachment (the Cal/OSHA notice)
 *   - pdfFilename: string   — original filename of the PDF
 *
 * The PDF is uploaded to Supabase Storage and the filePath stored on the notice.
 * `after()` then fires `parseNoticeBackground` which downloads the PDF,
 * extracts its text, runs the AI parser, creates a job, and drafts a proposal.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('x-webhook-secret');
  if (authHeader !== process.env.EMAIL_INTAKE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: Record<string, string> = {};
  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else {
      const formData = await request.formData();
      payload = Object.fromEntries(Array.from(formData.entries()).map(([k, v]) => [k, String(v)]));
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse request body' }, { status: 400 });
  }

  const from = payload['from'] ?? payload['From'] ?? '';
  const subject = payload['subject'] ?? payload['Subject'] ?? '';
  const pdfBase64 = payload['pdfBase64'] ?? '';
  const pdfFilename = payload['pdfFilename'] ?? 'notice.pdf';
  const emailMatch = from.match(/<(.+?)>/) ?? from.match(/(\S+@\S+)/);
  const senderEmail = emailMatch?.[1] ?? from;

  // Try to find a matching account
  const matchedAccount = await db.query.accounts.findFirst({
    where: eq(accounts.isActive, true),
    columns: { id: true },
  });

  const UNMATCHED_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';
  const accountId = matchedAccount?.id ?? UNMATCHED_ACCOUNT_ID;

  // Upload the PDF attachment to Supabase Storage
  let filePath: string | null = null;
  if (pdfBase64) {
    try {
      const supabase = createServiceClient();
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const ext = pdfFilename.split('.').pop()?.toLowerCase() ?? 'pdf';
      const storageKey = `${accountId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET_NOTICES)
        .upload(storageKey, pdfBuffer, { contentType: 'application/pdf', upsert: false });

      if (!uploadError && uploadData) {
        filePath = uploadData.path;
      } else {
        console.error('[email-intake] PDF upload failed:', uploadError?.message);
      }
    } catch (err) {
      console.error('[email-intake] PDF upload error:', err);
    }
  }

  if (!filePath && !pdfBase64) {
    // No PDF provided at all — reject rather than create an unparseable notice
    return NextResponse.json(
      { error: 'No PDF attachment found. Forward the Cal/OSHA notice email with the PDF attached.' },
      { status: 422 },
    );
  }

  const [notice] = await db
    .insert(notices)
    .values({
      accountId,
      submittedBy: null,
      intakeMethod: 'email_intake',
      status: 'received',
      rawText: null,           // Will be populated by extractPdfText during parsing
      filePath,
      fileName: pdfFilename || subject || 'Email Notice',
      mimeType: 'application/pdf',
    })
    .returning({ id: notices.id });

  await logNoticeActivity(
    notice.id,
    'notice_received',
    `Notice received via email from ${senderEmail}: "${subject}" (PDF: ${pdfFilename})`,
    null,
    { from: senderEmail, subject, accountMatched: !!matchedAccount, hasPdf: !!filePath },
  );

  // Record the notice PDF in the document vault
  if (filePath) {
    await db.insert(documents).values({
      accountId,
      noticeId: notice.id,
      documentType: 'notice_pdf',
      storageBucket: STORAGE_BUCKET_NOTICES,
      storagePath: filePath,
      fileName: pdfFilename,
      mimeType: 'application/pdf',
    }).onConflictDoNothing();
  }

  // Fire AI parse + proposal generation after the response is sent.
  // `after()` keeps the serverless function alive until the promise resolves
  // without blocking the 200 response the webhook sender needs.
  after(() => parseNoticeBackground(notice.id));

  return NextResponse.json({ received: true, noticeId: notice.id });
}
