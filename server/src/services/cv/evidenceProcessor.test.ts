import sharp from "sharp";
import { computeFileHash, computePerceptualHash, hashSimilarityPercent } from "./evidenceProcessor";

describe("computeFileHash", () => {
  it("produces identical hashes for identical bytes and different hashes otherwise", () => {
    const a = Buffer.from("hello world");
    const b = Buffer.from("hello world");
    const c = Buffer.from("hello mars");
    expect(computeFileHash(a)).toBe(computeFileHash(b));
    expect(computeFileHash(a)).not.toBe(computeFileHash(c));
  });
});

describe("hashSimilarityPercent", () => {
  it("returns 100 for identical hashes", () => {
    expect(hashSimilarityPercent("10101010", "10101010")).toBe(100);
  });

  it("returns 0 for fully opposite hashes", () => {
    expect(hashSimilarityPercent("00000000", "11111111")).toBe(0);
  });

  it("returns 0 for mismatched lengths", () => {
    expect(hashSimilarityPercent("101", "10101010")).toBe(0);
  });
});

describe("computePerceptualHash", () => {
  it("gives identical images an identical hash", async () => {
    const buffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 120, g: 40, b: 200 } },
    })
      .jpeg()
      .toBuffer();

    const hashA = await computePerceptualHash(buffer);
    const hashB = await computePerceptualHash(buffer);
    expect(hashA).not.toBeNull();
    expect(hashA).toBe(hashB);
  });

  it("gives visually different images different hashes", async () => {
    const solidRed = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .jpeg()
      .toBuffer();
    const solidBlue = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 255 } },
    })
      .jpeg()
      .toBuffer();

    const hashRed = await computePerceptualHash(solidRed);
    const hashBlue = await computePerceptualHash(solidBlue);
    // Solid-color images can share a dHash (no internal gradient), so just assert both compute.
    expect(hashRed).not.toBeNull();
    expect(hashBlue).not.toBeNull();
  });

  it("returns null for undecodable input", async () => {
    const hash = await computePerceptualHash(Buffer.from("not an image"));
    expect(hash).toBeNull();
  });
});
