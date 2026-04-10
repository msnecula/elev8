import 'server-only';

/**
 * Extracts text from a PDF buffer.
 *
 * Strategy:
 * 1. Try pdf-parse (fast, free — works for text-based PDFs)
 * 2. If no text found, fall back to OpenAI GPT-4o vision (handles scanned PDFs)
 */
export async function extractPdfText(input: Buffer | string): Promise<{
  text: string;
  error: string | null;
  method: 'pdf-parse' | 'openai-vision' | 'none';
}> {
  let buffer: Buffer;

  // If a file path string is passed, download from Supabase Storage
  if (typeof input === 'string') {
    try {
      const { createServiceClient } = await import('@/lib/supabase/server');
      const supabase = createServiceClient();
      const { data, error } = await supabase.storage.from('notices').download(input);
      if (error || !data) throw new Error(error?.message ?? 'Download failed');
      buffer = Buffer.from(await data.arrayBuffer());
    } catch (err) {
      return { text: '', error: `Failed to download PDF: ${err instanceof Error ? err.message : 'unknown'}`, method: 'none' };
    }
  } else {
    buffer = input;
  }

  // ── Strategy 1: pdf-parse ─────────────────────────────────────────────────
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';

    if (text.length > 100) {
      return { text, error: null, method: 'pdf-parse' };
    }
    console.log('[pdfExtractor] pdf-parse found insufficient text, trying vision fallback…');
  } catch (err) {
    console.warn('[pdfExtractor] pdf-parse failed:', err instanceof Error ? err.message : err);
  }

  // ── Strategy 2: OpenAI vision (scanned / image-based PDFs) ───────────────
  try {
    const text = await extractWithVision(buffer);
    if (text && text.length > 50) {
      return { text, error: null, method: 'openai-vision' };
    }
    return { text: '', error: 'Could not extract readable text from this PDF.', method: 'none' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[pdfExtractor] Vision fallback failed:', message);
    return {
      text: '',
      error: `Could not extract text from this PDF. ${message}`,
      method: 'none',
    };
  }
}

async function extractWithVision(buffer: Buffer): Promise<string> {
  const { openai } = await import('@/lib/openai');

  const base64Pdf = buffer.toString('base64');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is a scanned PDF document — likely an elevator Order to Comply or CAL/OSHA inspection notice.
Extract ALL visible text from this document exactly as it appears.
Include: property address, violation items, deadlines, inspection dates, violation codes, case numbers, names, phone numbers.
Output only the raw extracted text with no formatting or commentary.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:application/pdf;base64,${base64Pdf}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}
