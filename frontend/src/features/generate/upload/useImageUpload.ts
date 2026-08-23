import { useCallback, useRef, useState } from 'react';
import { uploadService, validateBeforeUpload } from '../../../services/uploadService.ts';
import { isApiError } from '../../../contracts/errors.ts';
import { toSourceImage, type SourceImage } from '../draftStore.ts';

type UploadState = {
  status: 'idle' | 'uploading' | 'error';
  progress: number;
  error: string | null;
  fileName: string | null;
};

const idle: UploadState = { status: 'idle', progress: 0, error: null, fileName: null };

export function useImageUpload() {
  const [state, setState] = useState<UploadState>(idle);
  const controller = useRef<AbortController | null>(null);

  const upload = useCallback(async (file: File): Promise<SourceImage | null> => {
    const localProblem = validateBeforeUpload(file);
    if (localProblem) {
      setState({ status: 'error', progress: 0, error: localProblem.message, fileName: file.name });
      return null;
    }

    controller.current?.abort();
    controller.current = new AbortController();
    setState({ status: 'uploading', progress: 0, error: null, fileName: file.name });

    try {
      const response = await uploadService.uploadImage(file, file.name, {
        signal: controller.current.signal,
        onProgress: ({ ratio }) =>
          setState((current) => ({ ...current, progress: ratio })),
      });
      setState(idle);
      return toSourceImage(response, file.name);
    } catch (error) {
      // The server re-checks everything; its answer is the one shown.
      const message = isApiError(error) ? error.message : 'That upload did not go through.';
      setState({ status: 'error', progress: 0, error: message, fileName: file.name });
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    controller.current?.abort();
    setState(idle);
  }, []);

  return { state, upload, reset };
}
