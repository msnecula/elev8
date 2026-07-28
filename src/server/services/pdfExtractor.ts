import 'server-only';

const SUPPORTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const MAX_PDF_PAGES = 10; // Process up to 10 pages

export async function extractPdfText(
  input: Buffer | string,
  mimeType = 'application/pdf',
): Promise<{
  text: string;
  error: string | null;
  method: 'pdf-parse' | 'openai-vision' | 'none';
}> {
  let buffer: Buffer;

  // Download from Supabase if file path given
  if (typeof input === 'string') {
    try {
      const { createServiceClient } = await import('@/lib/supabase/server');
      const supabase = createServiceClient();
      const bucket = 'notices';
      const { data, error } = await supabase.storage.from(bucket).download(input);
      if (error || !data) throw new Error(error?.message ?? 'Download failed');
      buffer = Buffer.from(await data.arrayBuffer());
    } catch (err) {
      return {
        text: '',
        error: `Failed to download file: ${err instanceof Error ? err.message : 'unknown'}`,
        method: 'none',
      };
    }
  } else {
    buffer = input;
  }

  const type = mimeType.toLowerCase();

  // ── Images: send directly to OpenAI vision ───────────────────────────────
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
    return extractFromImage(buffer, type);
  }

  // ── HEIC/HEIF (iPhone photos): convert to JPEG first ─────────────────────
  if (['image/heic', 'image/heif'].includes(type)) {
    try {
      const heicConvert = (await import('heic-convert')).default;
      const jpegBuffer = Buffer.from(
        await heicConvert({ buffer, format: 'JPEG', quality: 0.95 })
      );
      return extractFromImage(jpegBuffer, 'image/jpeg');
    } catch (err) {
      console.warn('[extractor] HEIC conversion failed, trying direct vision:', err);
      return extractFromImage(buffer, 'image/jpeg');
    }
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  // Strategy 1: pdf-parse (fast, free — works for text-based PDFs)
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    if (text.length > 100) {
      console.log(`[extractor] pdf-parse: extracted ${text.length} chars from ${result.numpages} pages`);
      return { text, error: null, method: 'pdf-parse' };
    }
    console.log('[extractor] pdf-parse found no text, trying vision fallback…');
  } catch (err) {
    console.warn('[extractor] pdf-parse failed:', err instanceof Error ? err.message : err);
  }

  // Strategy 2: Render PDF pages to PNG → OpenAI vision (handles scanned PDFs)
  return extractFromPdfViaVision(buffer);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function extractFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ text: string; error: string | null; method: 'openai-vision' | 'none' }> {
  try {
    const { openai } = await import('@/lib/openai');
    const base64 = buffer.toString('base64');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is an elevator compliance document image (Order to Comply / inspection notice).
Extract ALL visible text exactly as it appears.
Include: property address, building name, violation items, violation codes, deadlines, inspection dates, case numbers, names, phone numbers, and any other relevant compliance information.
Output only the raw extracted text with no formatting or commentary.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
              detail: 'high',
            },
          },
        ],
      }],
    });

    const text = response.choices[0]?.message?.content ?? '';
    if (text.length > 50) {
      return { text, error: null, method: 'openai-vision' };
    }
    return { text: '', error: 'Could not extract readable text from this image.', method: 'none' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { text: '', error: `Vision extraction failed: ${message}`, method: 'none' };
  }
}

async function extractFromPdfViaVision(
  buffer: Buffer,
): Promise<{ text: string; error: string | null; method: 'openai-vision' | 'none' }> {
  try {
    const images = await renderPdfToImages(buffer);

    if (images.length === 0) {
      return { text: '', error: 'Could not render PDF pages to images.', method: 'none' };
    }

    const { openai } = await import('@/lib/openai');

    console.log(`[extractor] Sending ${images.length} PDF page(s) to OpenAI vision…`);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is a scanned elevator compliance document (${images.length} page${images.length > 1 ? 's' : ''}).
Extract ALL visible text from every page exactly as it appears.
Include: property address, building name, violation items, violation codes, deadlines, inspection dates, case numbers, names, phone numbers, and any other relevant compliance information.
Output only the raw extracted text with no formatting or commentary.`,
          },
          ...images.map(base64 => ({
            type: 'image_url' as const,
            image_url: {
              url: `data:image/png;base64,${base64}`,
              detail: 'high' as const,
            },
          })),
        ],
      }],
    });

    const text = response.choices[0]?.message?.content ?? '';
    if (text.length > 50) {
      return { text, error: null, method: 'openai-vision' };
    }
    return { text: '', error: 'Could not extract readable text from this PDF.', method: 'none' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn('[extractor] PDF vision fallback failed:', message);
    return { text: '', error: `Could not extract text from this PDF: ${message}`, method: 'none' };
  }
}

async function renderPdfToImages(buffer: Buffer): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  const { createCanvas } = await import('canvas');

  const pdfDocument = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;

  const images: string[] = [];
  const totalPages = pdfDocument.numPages;
  const pagesToProcess = Math.min(totalPages, MAX_PDF_PAGES);

  console.log(`[extractor] PDF has ${totalPages} page(s), processing ${pagesToProcess}`);

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 }); // 2x for better OCR

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const base64 = canvas.toBuffer('image/png').toString('base64');
    images.push(base64);
  }

  return images;
}
