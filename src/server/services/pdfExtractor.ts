import 'server-only';

export async function extractPdfText(
  input: Buffer | string,
  mimeType = 'application/pdf',
): Promise<{
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
      return { text: '', error: `Failed to download file: ${err instanceof Error ? err.message : 'unknown'}`, method: 'none' };
    }
  } else {
    buffer = input;
  }

  const type = mimeType.toLowerCase();

  // Direct images
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
    return sendToVision([{ buffer, mimeType: type }]);
  }

  // HEIC/HEIF (iPhone)
  if (['image/heic', 'image/heif'].includes(type)) {
    try {
      const heicConvert = (await import('heic-convert')).default;
      const jpeg = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.92 }));
      return sendToVision([{ buffer: jpeg, mimeType: 'image/jpeg' }]);
    } catch {
      return sendToVision([{ buffer, mimeType: 'image/jpeg' }]);
    }
  }

  // PDF - Strategy 1: pdf-parse (text-based PDFs)
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    console.log(`[extractor] pdf-parse returned ${text.length} chars from ${result.numpages} pages`);
    
    // Low threshold - even 20 chars is enough to confirm text exists
    if (text.length > 20) {
      return { text, error: null, method: 'pdf-parse' };
    }
  } catch (err) {
    console.warn('[extractor] pdf-parse error:', err instanceof Error ? err.message : err);
  }

  // PDF - Strategy 2: Extract embedded images + sharp validation
  try {
    const images = await extractAndValidateImages(buffer);
    if (images.length > 0) {
      console.log(`[extractor] Found ${images.length} valid embedded image(s)`);
      return sendToVision(images);
    }
  } catch (err) {
    console.warn('[extractor] Image extraction error:', err instanceof Error ? err.message : err);
  }

  return {
    text: '',
    error: 'Could not extract text from this PDF. Please take a clear photo of the document with your phone and upload it as a JPG.',
    method: 'none',
  };
}

async function sendToVision(
  images: Array<{ buffer: Buffer; mimeType: string }>,
): Promise<{ text: string; error: string | null; method: 'openai-vision' | 'none' }> {
  try {
    const { openai } = await import('@/lib/openai');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is an elevator compliance document. Extract ALL text exactly as it appears.
Include: property address, building name, equipment IDs/serial numbers, all violation items and codes, 
compliance deadlines, inspection dates, case numbers, permit numbers, contact names and phone numbers, 
required tests, notification requirements, and any other compliance information.
Output only the raw extracted text. No formatting, no commentary.`,
          },
          ...images.slice(0, 10).map(img => ({
            type: 'image_url' as const,
            image_url: { url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}`, detail: 'high' as const },
          })),
        ],
      }],
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    if (text.length > 20) return { text, error: null, method: 'openai-vision' };
    return { text: '', error: 'Could not read text from the document.', method: 'none' };
  } catch (err) {
    return { text: '', error: `Vision failed: ${err instanceof Error ? err.message : 'Unknown'}`, method: 'none' };
  }
}

async function extractAndValidateImages(buffer: Buffer): Promise<Array<{ buffer: Buffer; mimeType: string }>> {
  const sharp = (await import('sharp')).default;
  const candidates = extractRawCandidates(buffer);
  const valid: Array<{ buffer: Buffer; mimeType: string }> = [];

  for (const c of candidates) {
    if (valid.length >= 10) break;
    try {
      const normalized = await sharp(c.buffer).jpeg({ quality: 90 }).toBuffer();
      const meta = await sharp(normalized).metadata();
      if (meta.width && meta.height && meta.width >= 200 && meta.height >= 200) {
        valid.push({ buffer: normalized, mimeType: 'image/jpeg' });
      }
    } catch { /* skip invalid */ }
  }
  return valid;
}

function extractRawCandidates(buffer: Buffer): Array<{ buffer: Buffer; mimeType: string }> {
  const candidates: Array<{ buffer: Buffer; mimeType: string }> = [];
  const validJpegMarkers = [0xE0, 0xE1, 0xE2, 0xDB, 0xC0, 0xC4, 0xFE, 0xED];

  let i = 0;
  while (i < buffer.length - 4 && candidates.length < 20) {
    if (buffer[i] === 0xFF && buffer[i+1] === 0xD8 && buffer[i+2] === 0xFF && validJpegMarkers.includes(buffer[i+3])) {
      let end = i + 4;
      let found = false;
      while (end < buffer.length - 1) {
        if (buffer[end] === 0xFF && buffer[end+1] === 0xD9) { end += 2; found = true; break; }
        end++;
      }
      if (found && end - i > 5000) candidates.push({ buffer: buffer.slice(i, end), mimeType: 'image/jpeg' });
      i = found ? end : i + 1;
    } else {
      i++;
    }
  }
  return candidates;
}
