import { apiUrl, requestOk, uploadMultipart, type UploadProgress } from './apiClient.ts';
import type { ImageUploadResponse } from '../contracts/upload.ts';
import { limits } from '../config/limits.ts';

export type LocalValidationError = { code: 'type' | 'size' | 'empty'; message: string };

/**
 * Check what can be checked in the browser before spending a round trip.
 * The server re-validates everything (magic bytes, decompression bombs, EXIF),
 * and its answer always wins — this only catches the two common mistakes early.
 */
export function validateBeforeUpload(file: File): LocalValidationError | null {
  if (file.size === 0) return { code: 'empty', message: 'That file is empty.' };
  if (!(limits.upload.mimeTypes as readonly string[]).includes(file.type)) {
    return { code: 'type', message: 'LUMA reads PNG, JPEG and WebP images.' };
  }
  if (file.size > limits.upload.maxBytes) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { code: 'size', message: `That file is ${mb} MB. The limit is 10 MB.` };
  }
  return null;
}

export const uploadService = {
  /** POST /uploads — returns the stored metadata, including the `url` a generation refers to. */
  uploadImage(
    file: Blob,
    fileName: string,
    handlers: { onProgress?: (progress: UploadProgress) => void; signal?: AbortSignal } = {},
  ): Promise<ImageUploadResponse> {
    return uploadMultipart<ImageUploadResponse>('/uploads', file, fileName, handlers);
  },

  /**
   * Absolute URL for an uploaded file.
   *
   * Unlike generated output, GET /uploads/{filename} is NOT behind auth, so this
   * can be used directly as an <img src>. (That it is public at all is worth
   * raising with the backend owner — any filename is world-readable.)
   */
  publicUrl(serverPath: string): string {
    return apiUrl(serverPath);
  },

  exists(serverPath: string): Promise<boolean> {
    return requestOk(serverPath, { method: 'HEAD', auth: false });
  },
};
