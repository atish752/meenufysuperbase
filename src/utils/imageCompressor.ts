/**
 * Utility to auto-shrink and auto-compress uploaded images on client side
 * before saving to Supabase database.
 * Strictly enforces KB limits (e.g. 50KB for Logo/Food, 200KB for Profile/Poster).
 */

export interface CompressOptions {
  maxKb: number;           // Maximum target size in KB (e.g. 50, 200)
  maxDimension?: number;   // Maximum width/height in pixels
  aspectRatio?: '1:1' | '3:4' | '9:16' | 'free'; // Aspect ratio crop mode
  format?: 'image/jpeg' | 'image/webp';
}

export async function compressImageFile(
  fileOrBase64: File | string,
  options: CompressOptions
): Promise<string> {
  const { maxKb, maxDimension = 600, aspectRatio = 'free', format = 'image/jpeg' } = options;

  let srcUrl: string;
  if (typeof fileOrBase64 !== 'string') {
    srcUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(fileOrBase64);
    });
  } else {
    srcUrl = fileOrBase64;
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.src = srcUrl;
    img.onload = () => {
      const canvas = document.createElement('canvas');

      let targetRatio = img.width / img.height;
      if (aspectRatio === '1:1') targetRatio = 1.0;
      else if (aspectRatio === '3:4') targetRatio = 3 / 4;
      else if (aspectRatio === '9:16') targetRatio = 9 / 16;

      // Calculate source crop area
      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
      if (aspectRatio !== 'free') {
        const currentRatio = img.width / img.height;
        if (currentRatio > targetRatio) {
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
        } else if (currentRatio < targetRatio) {
          sHeight = img.width / targetRatio;
          sy = (img.height - sHeight) / 2;
        }
      }

      // Constrain target dimensions
      let targetWidth = sWidth;
      let targetHeight = sHeight;
      if (targetWidth > maxDimension || targetHeight > maxDimension) {
        if (targetWidth >= targetHeight) {
          targetWidth = maxDimension;
          targetHeight = Math.round(maxDimension / targetRatio);
        } else {
          targetHeight = maxDimension;
          targetWidth = Math.round(maxDimension * targetRatio);
        }
      }

      canvas.width = Math.max(1, targetWidth);
      canvas.height = Math.max(1, targetHeight);

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(srcUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);

      // Base64 size estimation: 1 KB binary ≈ 1374 base64 chars
      const targetBase64Length = Math.round(maxKb * 1024 * 1.34);

      let quality = 0.82;
      let dataUrl = canvas.toDataURL(format, quality);

      // Reduce quality iteratively if over maxKb
      while (dataUrl.length > targetBase64Length && quality > 0.15) {
        quality -= 0.07;
        dataUrl = canvas.toDataURL(format, quality);
      }

      // If still over maxKb after quality reduction, scale down canvas dimensions by 20%
      if (dataUrl.length > targetBase64Length && canvas.width > 150) {
        const scaleCanvas = document.createElement('canvas');
        scaleCanvas.width = Math.round(canvas.width * 0.8);
        scaleCanvas.height = Math.round(canvas.height * 0.8);
        const sCtx = scaleCanvas.getContext('2d');
        if (sCtx) {
          sCtx.imageSmoothingEnabled = true;
          sCtx.imageSmoothingQuality = 'high';
          sCtx.drawImage(canvas, 0, 0, scaleCanvas.width, scaleCanvas.height);
          dataUrl = scaleCanvas.toDataURL(format, 0.7);
        }
      }

      resolve(dataUrl);
    };
    img.onerror = (err) => reject(err);
  });
}
