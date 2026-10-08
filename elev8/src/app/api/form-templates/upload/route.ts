// POST /api/form-templates/upload
//
// Plain Next.js Route Handler — returns JSON only, zero RSC pipeline.
//
// WHY NOT A SERVER ACTION: Next.js 15 always generates an RSC route re-render
// as part of every server action response (even without revalidatePath).  On
// /settings/forms that RSC payload hits React 19's "Maximum array nesting
// exceeded" limit.  A Route Handler returns pure JSON — no RSC, no nesting.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const BUCKET = 'form-templates';

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let formType: string;
  let base64: string;
  let fileName: string;
  try {
    ({ formType, base64, fileName } = await req.json());
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!formType || !base64 || !fileName) {
    return NextResponse.json({ success: false, error: 'Missing required fields: formType, base64, fileName' }, { status: 400 });
  }

  // ── Supabase client ───────────────────────────────────────────────────────
  const { createServiceClient } = await import('@/lib/supabase/server');
  const supabase = createServiceClient();

  // ── Decode base64 ─────────────────────────────────────────────────────────
  const rawBuffer = Buffer.from(base64, 'base64');

  // ── PDF repair ────────────────────────────────────────────────────────────
  // California DIR PDFs are often encrypted with a null owner password and
  // have non-standard cross-reference structures that pdf-lib cannot traverse.
  // Strategy 1: qpdf --decrypt  (Linux servers; not available on Windows dev or Vercel)
  // Strategy 2: python3 + pypdf  (most POSIX environments; pure-Python, no native deps)
  // Fallback:   original buffer  (upload still succeeds; warn user to pre-decrypt)
  let buffer = rawBuffer;
  try {
    const { spawnSync } = await import('child_process');
    const os   = await import('os');
    const path = await import('path');
    const fs   = await import('fs');

    // Strategy 1: qpdf
    const hasQpdf = spawnSync('which', ['qpdf'], { timeout: 3_000 }).status === 0
                 || spawnSync('where', ['qpdf'], { timeout: 3_000 }).status === 0;

    if (hasQpdf) {
      const stamp  = Date.now();
      const tmpIn  = path.join(os.tmpdir(), `elev8-${stamp}-in.pdf`);
      const tmpOut = path.join(os.tmpdir(), `elev8-${stamp}-out.pdf`);
      try {
        fs.writeFileSync(tmpIn, rawBuffer);
        const r = spawnSync('qpdf', ['--decrypt', tmpIn, tmpOut], { timeout: 15_000 });
        if (r.status === 0) {
          buffer = fs.readFileSync(tmpOut);
          console.log(`[upload/route] qpdf repair OK for ${formType}`);
        } else {
          console.warn('[upload/route] qpdf non-zero:', r.stderr?.toString());
        }
      } finally {
        try { fs.unlinkSync(tmpIn);  } catch { /* ignore */ }
        try { fs.unlinkSync(tmpOut); } catch { /* ignore */ }
      }
    }

    // Strategy 2: python3 + pypdf
    if (buffer === rawBuffer) {
      const pyScript = [
        'import sys, io',
        'try:',
        '    from pypdf import PdfReader, PdfWriter',
        'except ImportError:',
        '    from PyPDF2 import PdfReader, PdfWriter',
        'inp = sys.stdin.buffer.read()',
        'reader = PdfReader(io.BytesIO(inp), strict=False)',
        'writer = PdfWriter()',
        'writer.clone_reader_document_root(reader)',
        'out = io.BytesIO()',
        'writer.write(out)',
        'sys.stdout.buffer.write(out.getvalue())',
      ].join('\n');

      const r = spawnSync('python3', ['-c', pyScript], {
        input: rawBuffer,
        timeout: 15_000,
        maxBuffer: 50 * 1024 * 1024,
      });
      if (r.status === 0 && r.stdout && r.stdout.length > 100) {
        buffer = r.stdout;
        console.log(`[upload/route] python3/pypdf repair OK for ${formType}`);
      } else {
        console.warn('[upload/route] python3 repair failed:', r.stderr?.toString().slice(0, 200));
      }
    }

    if (buffer === rawBuffer) {
      console.warn(`[upload/route] No PDF repair available for ${formType} — storing original.`);
    }
  } catch (err) {
    console.warn('[upload/route] PDF repair error:', (err as Error).message);
  }

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(`${formType}.pdf`, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ success: false, error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  // ── Inspect PDF ───────────────────────────────────────────────────────────
  const { inspectPdf, fingerprintPdf } = await import('@/server/services/formTemplateService');
  let fields: Array<{ name: string; type: string; value: string }> = [];
  let isXfa = false;
  let fingerprint = '';

  try {
    const inspection = await inspectPdf(buffer);
    fields = inspection.fields;
    isXfa = inspection.isXfa;
    fingerprint = await fingerprintPdf(buffer);
  } catch (err) {
    console.warn('[upload/route] PDF inspection failed:', err);
  }

  // ── dosh100 metadata sidecar ──────────────────────────────────────────────
  if (formType === 'dosh100' && fingerprint) {
    const meta = JSON.stringify({
      fingerprint,
      uploadedAt: new Date().toISOString(),
      hasAcroFormFields: fields.length > 0,
      isXfa,
      fileName,
    });
    await supabase.storage
      .from(BUCKET)
      .upload('dosh100_meta.json', Buffer.from(meta), {
        contentType: 'application/json',
        upsert: true,
      });
  }

  return NextResponse.json({ success: true, data: { fields, isXfa, fingerprint } });
}
