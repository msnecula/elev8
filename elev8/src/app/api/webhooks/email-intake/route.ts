import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { db } from '../../../../server/db/client';
import { notices } from '@/drizzle/schema';
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
 * Accepts either:
 *   - application/json with { from, subject, pdfBase64, pdfFilename }
 *   - multipart/form-data with text fields (from, subject, pdfFilename)
 *     and a binary file field named "pdfFile" carrying the raw PDF bytes
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

  let from = '';
  let subject = '';
  let pdfBase64 = '';
  let pdfFilename = 'notice.pdf';

  const contentType = request.headers.get('content-type') ?? '';

  try {
    if (contentType.includes('application/json')) {
      const json = await request.json() as Record<string, string>;
      from = json['from'] ?? json['From'] ?? '';
      subject = json['subject'] ?? json['Subject'] ?? '';
      pdfBase64 = json['pdfBase64'] ?? '';
      pdfFilename = json['pdfFilename'] ?? 'notice.pdf';
    } else {
      // multipart/form-data — Make sends the PDF binary as a File field named "pdfFile"
      // We cannot use String(v) on a File/Blob — it produces "[object File]".
      // Instead: detect File/Blob fields, read their bytes, and base64-encode them.
      const formData = await request.formData();
      from = String(formData.get('from') ?? formData.get('From') ?? '');
      subject = String(formData.get('subject') ?? formData.get('Subject') ?? '');
      const filenameField = formData.get('pdfFilename');
      if (filenameField) pdfFilename = String(filenameField);

      // Binary PDF field: Make maps {{7.data}} → File/Blob in multipart
      const pdfField = formData.get('pdfFile') ?? formData.get('pdfBase64');
      if (pdfField instanceof File || pdfField instanceof Blob) {
        const arrayBuffer = await pdfField.arrayBuffer();
        pdfBase64 = Buffer.from(arrayBuffer).toString('base64');
        // Use the File's own name if Make populated it and it's not a generic placeholder
        if (pdfField instanceof File && pdfField.name && pdfField.name !== 'blob') {
          pdfFilename = pdfField.name;
        }
      } else if (pdfField) {
        // Fallback: already a base64 string (e.g. from a different sender)
        pdfBase64 = String(pdfField);
      }
    }
  } catch {
    return NextResponse.json({ error: 'Could not parse request body' }, { status: 400 });
  }

  const emailMatch = from.match(/<(.+?)>/) ?? from.match(/(\S+@\S+)/);
  const senderEmail = emailMatch?.[1] ?? from;

  // All email intake routes to the unmatched queue for admin review.
  // Account assignment happens after an admin identifies the correct client
  // from the PDF content. Matching by sender email is unreliable because
  // clients forward from personal/staff addresses not stored on their account.
  const UNMATCHED_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';
  const accountId = UNMATCHED_ACCOUNT_ID;

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
    { from: senderEmail, subject, hasPdf: !!filePath },
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
