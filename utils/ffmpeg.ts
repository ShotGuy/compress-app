import { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpeg: FFmpeg | null = null;

const customToBlobURL = async (url: string, type: string) => {
  console.log('[Diagnostic] Mulai mengunduh:', url);
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  console.log('[Diagnostic] Selesai mengunduh:', url);
  const blob = new Blob([buffer], { type });
  return URL.createObjectURL(blob);
};

export const loadFFmpeg = async (onProgress?: (progress: number) => void): Promise<FFmpeg> => {
  if (ffmpeg) {
    return ffmpeg;
  }

  ffmpeg = new FFmpeg();
  
  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg Log]', message);
  });

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(progress);
    });
  }

  const coreBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  
  await ffmpeg.load({
    coreURL: await customToBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await customToBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
};

export interface CompressVideoOptions {
  resolution?: string; // e.g., '1280x720'
  crf?: number; // Constant Rate Factor (0-51), lower is better quality, 23 is default
  preset?: string; // e.g., 'fast', 'medium', 'slow'
}

export const compressVideoFile = async (
  file: File,
  options: CompressVideoOptions,
  onProgress?: (progress: number) => void
): Promise<File> => {
  try {
    const ffmpegInstance = await loadFFmpeg(onProgress);
    const inputFileName = 'input_' + file.name.replace(/\s+/g, '_');
    const outputFileName = 'output_' + inputFileName;

    const fileData = new Uint8Array(await file.arrayBuffer());
    await ffmpegInstance.writeFile(inputFileName, fileData);

    const ffmpegArgs = ['-i', inputFileName];

    // Add resolution scale if specified
    if (options.resolution) {
      const [width, height] = options.resolution.split('x');
      ffmpegArgs.push('-vf', `scale=${width}:${height}`);
    }

    // Add CRF and force ultrafast for browser stability
    ffmpegArgs.push('-vcodec', 'libx264');
    ffmpegArgs.push('-crf', (options.crf ?? 28).toString());
    ffmpegArgs.push('-preset', 'ultrafast');
    
    // Convert to mp4 regardless of input (safest for web)
    const finalOutputName = outputFileName.replace(/\.[^/.]+$/, ".mp4");
    ffmpegArgs.push(finalOutputName);

    await ffmpegInstance.exec(ffmpegArgs);

    const data = await ffmpegInstance.readFile(finalOutputName);
    const blob = new Blob([data as any], { type: 'video/mp4' });
    
    // Clean up
    await ffmpegInstance.deleteFile(inputFileName);
    await ffmpegInstance.deleteFile(finalOutputName);

    return new File([blob], file.name.replace(/\.[^/.]+$/, ".mp4"), {
      type: 'video/mp4',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('Error compressing video:', error);
    throw error;
  }
};
