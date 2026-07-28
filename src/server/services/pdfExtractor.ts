import 'server-only';

const MAX_IMAGES = 10; // Max embedded images to extract and send to vision

/**
 * Extracts text from a document (PDF, JPEG, PNG, HEIC, WebP).
 * 
 * Strategy for PDFs:
 * 1. pdf-parse — fast, free, works for text-based PDFs
 * 2. Embedded image extraction — extracts JPEG/PNG images from the PDF binary
 *    and sends them to OpenAI vision (works for scanned PDFs)
 *
 * Strategy for images (JPEG, PNG, WebP):
 * - Sent directly to OpenAI GPT-4o vision
 *
 * Strategy for HEIC/HEIF (iPhone photos):
 * - Converted to JPEG using heic-convert, then sent to OpenAI vision
 */
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

  // ── Direct image types → OpenAI vision ───────────────────────────────────
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
    return sendImageToVision(buffer, type);
  }

  // ── HEIC/HEIF (iPhone) → convert to JPEG → OpenAI vision ─────────────────
  if (['image/heic', 'image/heif'].includes(type)) {
    try {
      const heicConvert = (await import('heic-convert')).default;
      const jpegBuffer = Buffer.from(
        await heicConvert({ buffer, format: 'JPEG', quality: 0.92 })
      );
      return sendImageToVision(jpegBuffer, 'image/jpeg');
    } catch (err) {
      console.warn('[extractor] HEIC conversion failed:', err);
      // Try sending raw buffer anyway
      return sendImageToVision(buffer, 'image/jpeg');
    }
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  // Strategy 1: pdf-parse — works for digital/text-based PDFs
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    if (text.length > 100) {
      console.log(`[extractor] pdf-parse: ${text.length} chars, ${result.numpages} pages`);
      return { text, error: null, method: 'pdf-parse' };
    }
    console.log('[extractor] pdf-parse: insufficient text, trying image extraction…');
  } catch (err) {
    console.warn('[extractor] pdf-parse failed:', err instanceof Error ? err.message : err);
  }

  // Strategy 2: Extract embedded images from PDF binary → OpenAI vision
  // Most scanned PDFs are just wrappers around JPEG images
  return extractEmbeddedImagesAndOcr(buffer);
}

// ── Vision helpers ────────────────────────────────────────────────────────────

async function sendImageToVision(
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
            text: 'This is an elevator compliance document. Extract ALL visible text exactly as it appears. Include: property address, building name, violations, violation codes, deadlines, inspection dates, case numbers, names, phone numbers. Output raw text only, no commentary.',
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
    if (text.length > 50) return { text, error: null, method: 'openai-vision' };
    return { text: '', error: 'Could not extract readable text from this image.', method: 'none' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { text: '', error: `Vision extraction failed: ${msg}`, method: 'none' };
  }
}

/**
 * Extracts embedded JPEG/PNG images from a PDF binary buffer.
 * Works for scanned PDFs which are typically just wrappers around images.
 * Does NOT require pdfjs, canvas, or any system libraries.
 */
async function extractEmbeddedImagesAndOcr(
  pdfBuffer: Buffer,
): Promise<{ text: string; error: string | null; method: 'openai-vision' | 'none' }> {
  const images = extractImagesFromPdfBuffer(pdfBuffer);

  if (images.length === 0) {
    return {
      text: '',
      error: 'No readable text or embedded images found in this PDF. Please upload a photo (JPG/PNG) of the document instead.',
      method: 'none',
    };
  }

  console.log(`[extractor] Found ${images.length} embedded image(s) in PDF`);

  try {
    const { openai } = await import('@/lib/openai');

    const imageContent = images.slice(0, MAX_IMAGES).map(img => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}`,
        detail: 'high' as const,
      },
    }));

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is a scanned elevator compliance document (${images.length} page${images.length > 1 ? 's' : ''}). Extract ALL text from every page. Include: property address, building name, violations, codes, deadlines, inspection dates, case numbers, names, and phone numbers. Output raw text only.`,
          },
          ...imageContent,
        ],
      }],
    });

    const text = response.choices[0]?.message?.content ?? '';
    if (text.length > 50) {
      return { text, error: null, method: 'openai-vision' };
    }
    return {
      text: '',
      error: 'Could not extract text from this PDF. Please try uploading a JPG photo of the document.',
      method: 'none',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { text: '', error: `Vision OCR failed: ${msg}`, method: 'none' };
  }
}

/**
 * Extracts embedded JPEG and PNG images from a raw PDF buffer.
 * Uses magic byte detection — no libraries needed.
 */
function extractImagesFromPdfBuffer(
  buffer: Buffer,
): Array<{ buffer: Buffer; mimeType: string }> {
  const images: Array<{ buffer: Buffer; mimeType: string }> = [];

  // JPEG: starts with FF D8 FF, ends with FF D9
  let offset = 0;
  while (offset < buffer.length - 3) {
    // Detect JPEG start
    if (
      buffer[offset] === 0xFF &&
      buffer[offset + 1] === 0xD8 &&
      buffer[offset + 2] === 0xFF
    ) {
      // Find JPEG end marker FF D9
      let end = offset + 3;
      let found = false;
      while (end < buffer.length - 1) {
        if (buffer[end] === 0xFF && buffer[end + 1] === 0xD9) {
          end += 2;
          found = true;
          break;
        }
        end++;
      }
      if (found && end - offset > 1000) { // Skip tiny/invalid JPEGs
        images.push({
          buffer: buffer.slice(offset, end),
          mimeType: 'image/jpeg',
        });
        if (images.length >= MAX_IMAGES) break;
      }
      offset = found ? end : offset + 1;
    } else {
      offset++;
    }
  }

  // PNG: starts with 89 50 4E 47 0D 0A 1A 0A
  offset = 0;
  while (offset < buffer.length - 8 && images.length < MAX_IMAGES) {
    if (
      buffer[offset] === 0x89 &&
      buffer[offset + 1] === 0x50 &&
      buffer[offset + 2] === 0x4E &&
      buffer[offset + 3] === 0x47
    ) {
      // Find PNG IEND chunk (49 45 4E 44 AE 42 60 82)
      let end = offset + 8;
      let found = false;
      while (end < buffer.length - 8) {
        if (
          buffer[end] === 0x49 && buffer[end + 1] === 0x45 &&
          buffer[end + 2] === 0x4E && buffer[end + 3] === 0x44
        ) {
          end += 8; // IEND + CRC
          found = true;
          break;
        }
        end++;
      }
      if (found && end - offset > 1000) {
        images.push({
          buffer: buffer.slice(offset, end),
          mimeType: 'image/png',
        });
      }
      offset = found ? end : offset + 1;
    } else {
      offset++;
    }
  }

  return images;
}
