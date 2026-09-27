/**
 * Getting pictures into a studio session.
 *
 * Plain functions, no React: the page, the quick-edit bar and the tool runner
 * all need them, and none of that should pull in the Generate page's stores.
 */
import { generationService } from '../../services/generationService.ts';
import { useStudio, type StudioVersion } from './studioStore.ts';

/** Pixel size of an image blob. Rejects anything the browser cannot decode. */
export async function measureImage(blob: Blob): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(blob);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * Start a session on a finished run and return its original version.
 *
 * The bytes are fetched once, here; every tool after that works from memory.
 * The run id is kept as the session's origin, which is how the result stage
 * knows to show this session's edits in place of the run's own image.
 */
export async function openRunInStudio(runId: string): Promise<StudioVersion> {
  const blob = await generationService.fetchImageBlob(runId);
  const size = await measureImage(blob);
  return useStudio.getState().open(blob, size, `Result ${runId.slice(0, 8)}`, runId);
}
