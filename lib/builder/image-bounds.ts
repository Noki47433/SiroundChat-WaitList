/**
 * Cheap, dependency-free image dimension sanity for uploads.
 *
 * The upload route already bounds bytes and MIME type, and until Stage 2.5 that
 * was the whole check. Bytes are the wrong bound on their own: a 20000 × 8 PNG
 * of flat colour compresses to a few kilobytes, sails through a 5 MB limit, and
 * then either blows out a hero band or renders as a hairline. A pathological
 * aspect ratio is a layout bug that arrives as valid data.
 *
 * So the header is read directly — the first few dozen bytes of PNG, JPEG and
 * WebP all carry the dimensions, and no decoding, no allocation proportional to
 * the image, and no image library is needed to find them. Anything unreadable is
 * *accepted*, deliberately: this is a sanity bound on obviously-wrong images, not
 * an image validator, and refusing a file because a header parser did not
 * recognise it would trade a rare layout problem for a common upload failure.
 */

export type ImageDimensions = { width: number; height: number };

export type ImageBounds = { minEdge: number; maxEdge: number; maxAspectRatio: number };

/**
 * Two profiles, because a logo and a photograph are not the same kind of object.
 *
 * `photo` governs everything that fills a band of the page — hero, gallery, team
 * — and is chosen to admit every real photograph while rejecting the shapes that
 * break a layout. `logo` is deliberately far looser: a wordmark is *supposed* to
 * be a long thin strip, and 1200 × 120 is a perfectly ordinary logo file.
 */
export const IMAGE_BOUNDS: Record<"photo" | "logo", ImageBounds> = {
  photo: {
    minEdge: 200,
    maxEdge: 8000,
    /** 6:1 either way. A very wide banner is fine; a 20000 × 8 strip is not. */
    maxAspectRatio: 6
  },
  logo: {
    minEdge: 32,
    maxEdge: 8000,
    maxAspectRatio: 20
  }
};

const readPng = (bytes: Uint8Array): ImageDimensions | null => {
  // 8-byte signature, then a 25-byte IHDR chunk whose width/height are big-endian.
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

const readJpeg = (bytes: Uint8Array): ImageDimensions | null => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2; // past SOI
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    // SOF0-SOF15, excluding the four that are not frame headers.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: view.getUint16(offset + 5), width: view.getUint16(offset + 7) };
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
};

const readWebp = (bytes: Uint8Array): ImageDimensions | null => {
  if (bytes.length < 30) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const format = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  if (format === "VP8X") {
    // 24-bit little-endian, stored as (dimension - 1).
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return { width, height };
  }
  if (format === "VP8 ") {
    return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  }
  if (format === "VP8L") {
    const bits = view.getUint32(21, true);
    return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) };
  }
  return null;
};

/** Dimensions, or null when the header is not one this reader understands. */
export const readImageDimensions = (buffer: ArrayBuffer | Uint8Array): ImageDimensions | null => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.length < 16) return null;

  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
      return readPng(bytes);
    }
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      return readJpeg(bytes);
    }
    if (
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
    ) {
      return readWebp(bytes);
    }
  } catch {
    return null;
  }
  return null;
};

export type ImageBoundsVerdict =
  | { ok: true; dimensions: ImageDimensions | null }
  | { ok: false; reason: "too_small" | "too_large" | "aspect_ratio"; message: string; dimensions: ImageDimensions };

/** Judge an image's shape. An unreadable header passes — see the file comment. */
export const checkImageBounds = (
  buffer: ArrayBuffer | Uint8Array,
  profile: "photo" | "logo" = "photo"
): ImageBoundsVerdict => {
  const bounds = IMAGE_BOUNDS[profile];
  const dimensions = readImageDimensions(buffer);
  if (!dimensions) return { ok: true, dimensions: null };

  const { width, height } = dimensions;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return { ok: true, dimensions: null };
  }

  if (width < bounds.minEdge || height < bounds.minEdge) {
    return {
      ok: false,
      reason: "too_small",
      dimensions,
      message: `That image is only ${width}×${height}. It needs to be at least ${bounds.minEdge} pixels on each side to look right on a page.`
    };
  }
  if (width > bounds.maxEdge || height > bounds.maxEdge) {
    return {
      ok: false,
      reason: "too_large",
      dimensions,
      message: `That image is ${width}×${height}. Please resize it to under ${bounds.maxEdge} pixels on its longest side.`
    };
  }

  const ratio = Math.max(width / height, height / width);
  if (ratio > bounds.maxAspectRatio) {
    return {
      ok: false,
      reason: "aspect_ratio",
      dimensions,
      message: `That image is an unusual shape (${width}×${height}) and would not sit well in any part of a page. Try one closer to a normal photo.`
    };
  }

  return { ok: true, dimensions };
};
