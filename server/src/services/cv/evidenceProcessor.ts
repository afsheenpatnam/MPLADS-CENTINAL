import crypto from "crypto";
import sharp from "sharp";

export interface ImageAnalysis {
  fileHash: string;
  perceptualHash: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
}

/**
 * Computes a SHA-256 hash of the raw file bytes — used for exact-duplicate detection.
 */
export function computeFileHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Computes a 64-bit difference hash (dHash): resize to 9x8 grayscale, compare
 * adjacent pixel brightness left-to-right, encode as a 64-character '0'/'1' string.
 * dHash is resilient to minor recompression/resizing, which is exactly the kind of
 * "near duplicate" reuse this system needs to catch.
 */
export async function computePerceptualHash(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .grayscale()
      .resize(9, 8, { fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true });

    let hash = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const left = data[row * 9 + col];
        const right = data[row * 9 + col + 1];
        hash += left > right ? "1" : "0";
      }
    }
    return hash;
  } catch {
    // Not a raster image sharp can decode (e.g. a PDF document upload) — no perceptual hash.
    return null;
  }
}

export async function analyzeImage(buffer: Buffer): Promise<ImageAnalysis> {
  const fileHash = computeFileHash(buffer);
  const perceptualHash = await computePerceptualHash(buffer);

  let width: number | null = null;
  let height: number | null = null;
  let format: string | null = null;
  try {
    const metadata = await sharp(buffer).metadata();
    width = metadata.width ?? null;
    height = metadata.height ?? null;
    format = metadata.format ?? null;
  } catch {
    // non-image upload, leave metadata null
  }

  return { fileHash, perceptualHash, width, height, format };
}

/**
 * Hamming-distance-based similarity between two equal-length hex/binary hash strings,
 * expressed as a 0-100 percentage. 100 = identical hash.
 */
export function hashSimilarityPercent(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length || hashA.length === 0) return 0;
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) distance++;
  }
  return ((hashA.length - distance) / hashA.length) * 100;
}
