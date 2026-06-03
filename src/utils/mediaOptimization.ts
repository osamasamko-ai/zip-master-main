const IMAGE_MAX_EDGE = 1600;
const IMAGE_QUALITY = 0.78;
const MIN_COMPRESSION_BYTES = 450 * 1024;

function supportsCanvasCompression(file: File) {
  return typeof window !== 'undefined'
    && typeof document !== 'undefined'
    && typeof createImageBitmap !== 'undefined'
    && file.type.startsWith('image/')
    && file.type !== 'image/gif'
    && file.size >= MIN_COMPRESSION_BYTES;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function optimizeImageForUpload(file: File) {
  if (!supportsCanvasCompression(file)) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, width, height);
    const outputType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
    const blob = await canvasToBlob(canvas, outputType, IMAGE_QUALITY);
    bitmap.close?.();

    if (!blob || blob.size >= file.size) return file;
    const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.${extension}`, { type: outputType, lastModified: Date.now() });
  } catch {
    return file;
  }
}

export function isVideoFile(file?: File | null) {
  return Boolean(file?.type?.startsWith('video/'));
}
