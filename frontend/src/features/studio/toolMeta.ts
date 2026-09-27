/**
 * How each tool and each version is named on screen. Everything the UI says
 * about a tool comes from here, so the four stay consistent everywhere.
 */
import type { IconName } from '../../shared/ui/Icon.tsx';
import type { TKey } from '../../config/i18n.ts';
import type { ToolName } from '../../contracts/tools.ts';
import type { StudioVersion } from './studioStore.ts';

type Translate = (key: TKey) => string;

/** The order the picker shows them in: the quick looks first, the cut-out last. */
export const toolOrder: ToolName[] = ['sketch', 'color-splash', 'pose', 'remove-bg'];

/** Icon, short name and one-line description for each tool. */
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
export function versionLabel(versions: StudioVersion[], version: StudioVersion, t: Translate): string {
  if (!version.tool) return t('studio.original');
  return `${versions.indexOf(version)}. ${t(toolMeta[version.tool].label)}`;
}

/**
 * The setting a version was made with, ready to show: "21" for a sketch's
 * kernel, "Red" for a splash. The colour is stored as the API spells it, so it
 * is translated here rather than shown raw.
 */
export function versionDetail(version: StudioVersion, t: Translate): string | null {
  if (version.detail === null) return null;
  if (version.tool === 'color-splash') {
    return version.detail === 'red' ? t('studio.red') : t('studio.green');
  }
  return version.detail;
}
