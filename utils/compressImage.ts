import imageCompression from 'browser-image-compression';

export interface CompressImageOptions {
  maxSizeMB: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string; // e.g., "image/webp", "image/jpeg"
}

export const compressImageFile = async (
  file: File,
  options: CompressImageOptions,
  onProgress?: (progress: number) => void
): Promise<File> => {
  try {
    const compressionOptions = {
      maxSizeMB: options.maxSizeMB,
      maxWidthOrHeight: options.maxWidthOrHeight,
      useWebWorker: options.useWebWorker ?? true,
      fileType: options.fileType ?? file.type,
      onProgress: onProgress,
    };

    const compressedBlob = await imageCompression(file, compressionOptions);
    
    // Ensure the returned file has the correct extension based on fileType
    let newName = file.name;
    if (options.fileType) {
      const ext = options.fileType.split('/')[1];
      newName = file.name.replace(/\.[^/.]+$/, "") + `.${ext}`;
    }

    return new File([compressedBlob], newName, {
      type: compressedBlob.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
};
