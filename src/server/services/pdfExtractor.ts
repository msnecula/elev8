import 'server-only';

export async function extractPdfText(input: Buffer | string): Promise<{
  text: string;
  error: string | null;
  method: 'pdf-parse' | 'openai-vision' | 'none';
}> {
  let buffer: Buffer;

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

  // Strategy 1: pdf-parse (text-based PDFs)
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    if (text.length > 100) {
      return { text, error: null, method: 'pdf-parse' };
    }
  } catch (err) {
    console.warn('[pdfExtractor] pdf-parse failed:', err instanceof Error ? err.message : err);
  }

  // Strategy 2: OpenAI vision (scanned PDFs)
  try {
    const { openai } = await import('@/lib/openai');
    const base64Pdf = buffer.toString('base64');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract ALL text from this elevator compliance document. Include property address, violations, deadlines, dates, codes. Output raw text only.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:application/pdf;base64,${base64Pdf}`, detail: 'high' },
          },
        ],
      }],
    });
    const text = response.choices[0]?.message?.content ?? '';
    if (text.length > 50) {
      return { text, error: null, method: 'openai-vision' };
    }
  } catch (err) {
    console.warn('[pdfExtractor] Vision fallback failed:', err instanceof Error ? err.message : err);
  }

  return { text: '', error: 'Could not extract text from this PDF.', method: 'none' };
}
