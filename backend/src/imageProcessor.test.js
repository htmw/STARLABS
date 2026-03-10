import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { preprocessImage } from "./imageProcessor.js";

describe("preprocessImage", () => {
  const samples = [
    ["landscape-2000x1200", 2000, 1200],
    ["portrait-1200x2000", 1200, 2000],
    ["square-3000x3000", 3000, 3000],
    ["wide-4000x800", 4000, 800],
    ["tall-800x4000", 800, 4000],
    ["near-target-wide-1300x1000", 1300, 1000],
    ["near-target-tall-1000x1300", 1000, 1300],
    ["odd-1973x1111", 1973, 1111],
    ["odd-1111x1973", 1111, 1973],
    ["large-2500x1600", 2500, 1600],
    ["large-1600x2500", 1600, 2500],
    ["extreme-wide-5000x600", 5000, 600],
  ];

  it.each(samples)(
    "resizes within 1024x1024 (fit inside) and outputs PNG - %s",
    async (_name, w, h) => {
      const inputJpeg = await sharp({
        create: {
          width: w,
          height: h,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg({ quality: 95 })
        .toBuffer();

      const outBuf = await preprocessImage(inputJpeg, {
        width: 1024,
        height: 1024,
        format: "png",
        normalize: false,
      });

      expect(outBuf).toBeTruthy();
      expect(outBuf.length).toBeGreaterThan(50);
      const meta = await sharp(outBuf).metadata();

      expect(meta.format).toBe("png");

      expect(meta.width).toBeLessThanOrEqual(1024);
      expect(meta.height).toBeLessThanOrEqual(1024);

      expect(meta.width).toBeLessThanOrEqual(w);
      expect(meta.height).toBeLessThanOrEqual(h);

      if (w > 1024 || h > 1024) {
        expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(1024);
      }
    }
  );

  it("does not enlarge smaller images (withoutEnlargement)", async () => {
    const smallPng = await sharp({
      create: {
        width: 400,
        height: 300,
        channels: 3,
        background: { r: 200, g: 200, b: 200 },
      },
    })
      .png()
      .toBuffer();

    const outBuf = await preprocessImage(smallPng, {
      width: 1024,
      height: 1024,
      format: "png",
      normalize: false,
    });

    const meta = await sharp(outBuf).metadata();
    expect(meta.format).toBe("png");


    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });
});