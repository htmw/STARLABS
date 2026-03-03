import sharp from "sharp";

/**
 * preprocessing images.
 * 1024x1024 grayscale output PNG 
 * normalize OFF 
 */
export async function preprocessImage(imageBuffer, options = {}) {
  const targetWidth = options.width ?? 1024;
  const targetHeight = options.height ?? 1024;
  const targetFormat = options.format ?? "png"; 
  const doNormalize = options.normalize ?? false;

  try {
    let pipeline = sharp(imageBuffer)
      .grayscale()
      .resize({
        width: targetWidth,
        height: targetHeight,
        fit: "inside",             
        withoutEnlargement: true,   
        kernel: sharp.kernel.lanczos3, 
      });

    if (doNormalize) pipeline = pipeline.normalize();

    if (targetFormat === "jpeg") {
      pipeline = pipeline.jpeg({ quality: 95 });
    } else if (targetFormat === "webp") {
      pipeline = pipeline.webp({ quality: 95 });
    } else {
      pipeline = pipeline.png({ compressionLevel: 6 });
    }

    return await pipeline.toBuffer();
  } catch (err) {
    console.error("Image preprocessing failed:", err);
    throw new Error("Image preprocessing failed");
  }
}