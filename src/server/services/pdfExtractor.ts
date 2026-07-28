import 'server-only';

/**
 * Document text extractor — handles PDF, JPEG, PNG, HEIC, WebP.
 *
 * PDF strategy:
 * 1. pdf-parse  — fast, works for digital/text-based PDFs
 * 2. Embedded image extraction + sharp validation → OpenAI vision (scanned PDFs)
 * 3. If no valid images found, helpful error with fallback instructions
 *
 * Image strategy:
 * - JPEG/PNG/WebP → direct OpenAI vision
 * - HEIC/HEIF     → heic-convert → JPEG → OpenAI vision
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

  // ── Direct image formats → OpenAI vision ─────────────────────────────────
  if (['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(type)) {
    return sendToVision([{ buffer, mimeType: type }]);
  }

  // ── iPhone HEIC/HEIF → convert to JPEG → vision ───────────────────────────
  if (['image/heic', 'image/heif'].includes(type)) {
    try {
      const heicConvert = (await import('heic-convert')).default;
      const jpeg = Buffer.from(await heicConvert({ buffer, format: 'JPEG', quality: 0.92 }));
      return sendToVision([{ buffer: jpeg, mimeType: 'image/jpeg' }]);
    } catch {
      // Try sending raw if conversion fails
      return sendToVision([{ buffer, mimeType: 'image/jpeg' }]);
    }
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  // Strategy 1: pdf-parse (works for digital PDFs with selectable text)
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(buffer);
    const text = result.text?.trim() ?? '';
    if (text.length > 100) {
      console.log(`[extractor] pdf-parse: ${text.length} chars from ${result.numpages} pages`);
      return { text, error: null, method: 'pdf-parse' };
    }
    console.log('[extractor] pdf-parse: no text found, trying image extraction…');
  } catch (err) {
    console.warn('[extractor] pdf-parse error:', err instanceof Error ? err.message : err);
  }

  // Strategy 2: Extract and validate embedded images from PDF binary
  try {
    const images = await extractAndValidateImages(buffer);

    if (images.length > 0) {
      console.log(`[extractor] Found ${images.length} valid image(s) in PDF`);
      return sendToVision(images);
    }

    // No valid images — provide helpful fallback message
    return {
      text: '',
      error:
        'This PDF appears to be scanned but no extractable images were found. ' +
        'For best results, please take a clear photo of the document with your phone and upload it as a JPG image.',
      method: 'none',
    };
  } catch (err) {
    console.warn('[extractor] Image extraction error:', err instanceof Error ? err.message : err);
    return {
      text: '',
      error: 'Could not process this PDF. Please upload a JPG photo of the document instead.',
      method: 'none',
    };
  }
}

// ─── Send images to OpenAI vision ────────────────────────────────────────────

async function sendToVision(
  images: Array<{ buffer: Buffer; mimeType: string }>,
): Promise<{ text: string; error: string | null; method: 'openai-vision' | 'none' }> {
  try {
    const { openai } = await import('@/lib/openai');

    const imageContent = images.slice(0, 10).map(img => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:${img.mimeType};base64,${img.buffer.toString('base64')}`,
        detail: 'high' as const,
      },
    }));

    const pageCount = images.length;
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 6000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: `This is an elevator compliance document (${pageCount} page${pageCount > 1 ? 's' : ''}).
Extract ALL text exactly as it appears. Include every detail:
- Property address and building name
- Owner/management company
- All violation items and codes
- Compliance deadlines and inspection dates
- Case/permit numbers
- Contact names and phone numbers
- Any other compliance information

Output only the raw extracted text. No formatting, no commentary.`,
          },
          ...imageContent,
        ],
      }],
    });

    const text = response.choices[0]?.message?.content?.trim() ?? '';
    if (text.length > 50) {
      return { text, error: null, method: 'openai-vision' };
    }
    return {
      text: '',
      error: 'Could not read text from the document. Please ensure it is clear and readable.',
      method: 'none',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[extractor] Vision API error:', msg);
    return {
      text: '',
      error: `Document reading failed: ${msg}. Please try uploading a JPG photo instead.`,
      method: 'none',
    };
  }
}

// ─── Extract and validate embedded images from PDF binary ─────────────────────

async function extractAndValidateImages(
  pdfBuffer: Buffer,
): Promise<Array<{ buffer: Buffer; mimeType: string }>> {
  const sharp = (await import('sharp')).default;
  const candidates = extractRawImageCandidates(pdfBuffer);
  const valid: Array<{ buffer: Buffer; mimeType: string }> = [];

  for (const candidate of candidates) {
    if (valid.length >= 10) break;
    try {
      // Use sharp to validate and normalize the image
      const normalized = await sharp(candidate.buffer)
        .jpeg({ quality: 90 })
        .toBuffer();
      const meta = await sharp(normalized).metadata();

      // Only accept images with reasonable dimensions (not tiny icons/thumbnails)
      if (meta.width && meta.height && meta.width >= 200 && meta.height >= 200) {
        valid.push({ buffer: normalized, mimeType: 'image/jpeg' });
      }
    } catch {
      // Invalid image data — skip
    }
  }

  return valid;
}

/**
 * Scans PDF binary for JPEG and PNG magic byte signatures.
 * Returns raw candidate buffers (not yet validated).
 */
function extractRawImageCandidates(
  buffer: Buffer,
): Array<{ buffer: Buffer; mimeType: string }> {
  const candidates: Array<{ buffer: Buffer; mimeType: string }> = [];

  // ── JPEG extraction (FF D8 FF ... FF D9) ─────────────────────────────────
  let i = 0;
  while (i < buffer.length - 3 && candidates.length < 20) {
    if (buffer[i] === 0xFF && buffer[i + 1] === 0xD8 && buffer[i + 2] === 0xFF) {
      // Must have a valid marker byte after FF D8 FF
      const marker = buffer[i + 2];
      if (marker === 0xFF) {
        const nextByte = buffer[i + 3];
        // Valid JPEG app markers: E0 (JFIF), E1 (Exif), FE (comment), DB, C0, C4 etc
        const validMarkers = [0xE0, 0xE1, 0xE2, 0xDB, 0xC0, 0xC4, 0xFE, 0xED];
        if (validMarkers.includes(nextByte)) {
          // Find end marker FF D9
          let end = i + 4;
          let found = false;
          while (end < buffer.length - 1) {
            if (buffer[end] === 0xFF && buffer[end + 1] === 0xD9) {
              end += 2;
              found = true;
              break;
            }
            end++;
          }
          if (found && end - i > 5000) { // Min 5KB — skip tiny thumbnails
            candidates.push({ buffer: buffer.slice(i, end), mimeType: 'image/jpeg' });
            i = end;
            continue;
          }
        }
      }
    }
    i++;
  }

  // ── PNG extraction (89 50 4E 47 ... 49 45 4E 44 AE 42 60 82) ─────────────
  i = 0;
  while (i < buffer.length - 8 && candidates.length < 20) {
    if (
      buffer[i] === 0x89 && buffer[i + 1] === 0x50 &&
      buffer[i + 2] === 0x4E && buffer[i + 3] === 0x47 &&
      buffer[i + 4] === 0x0D && buffer[i + 5] === 0x0A &&
      buffer[i + 6] === 0x1A && buffer[i + 7] === 0x0A
    ) {
      // Find PNG IEND chunk
      let end = i + 8;
      let found = false;
      while (end < buffer.length - 7) {
        if (
          buffer[end] === 0x49 && buffer[end + 1] === 0x45 &&
          buffer[end + 2] === 0x4E && buffer[end + 3] === 0x44
        ) {
          end += 8; // IEND (4) + CRC (4)
          found = true;
          break;
        }
        end++;
      }
      if (found && end - i > 5000) {
        candidates.push({ buffer: buffer.slice(i, end), mimeType: 'image/png' });
        i = end;
        continue;
      }
    }
    i++;
  }

  return candidates;
}
