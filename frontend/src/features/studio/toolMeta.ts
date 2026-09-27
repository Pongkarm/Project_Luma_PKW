import type { IconName } from '../../shared/ui/Icon.tsx';
import type { TKey } from '../../config/i18n.ts';
import type { ToolName } from '../../contracts/tools.ts';
import type { StudioVersion } from './studioStore.ts';

/** The order the picker shows them in: the quick looks first, the cut-out last. */
export const toolOrder: ToolName[] = ['sketch', 'color-splash', 'pose', 'remove-bg'];

export const toolMeta: Record<ToolName, { icon: IconName; label: TKey; about: TKey }> = {
  sketch: { icon: 'pencil', label: 'studio.toolSketch', about: 'studio.aboutSketch' },
  'color-splash': { icon: 'droplet', label: 'studio.toolSplash', about: 'studio.aboutSplash' },
  pose: { icon: 'pose', label: 'studio.toolPose', about: 'studio.aboutPose' },
  'remove-bg': { icon: 'scissors', label: 'studio.toolCutout', about: 'studio.aboutCutout' },
};

/**
 * "Original", or the tool with its place in the list: "3. Sketch". The number
 * is what tells two sketches apart once there is more than one.
 */
export function versionLabel(
  versions: StudioVersion[],
  version: StudioVersion,
  t: (key: TKey) => string,
): string {
  if (!version.tool) return t('studio.original');
  return `${versions.indexOf(version)}. ${t(toolMeta[version.tool].label)}`;
}
