import { Icon } from '../../shared/ui/Icon.tsx';
import { useT } from '../../shared/hooks/useT.ts';
import { useStudio } from './studioStore.ts';
import { toolMeta, versionDetail, versionLabel } from './toolMeta.ts';

/**
 * Every version made in this session, oldest first. Picking one makes it the
 * image the next tool runs on — which is how an edit is undone, and how two
 * different looks are tried from the same starting point.
 */
export function VersionStrip() {
  const versions = useStudio((state) => state.versions);
  const currentId = useStudio((state) => state.currentId);
  const select = useStudio((state) => state.select);
  const t = useT();

  return (
    <div className="vstrip" aria-label={t('studio.versions')} role="group">
      <span className="eyebrow">{t('studio.versions')}</span>
      <div className="vstrip__row">
        {versions.map((version) => {
          const name = versionLabel(versions, version, t);
          const detail = versionDetail(version, t);
          return (
            <button
              key={version.id}
              type="button"
              className="vstrip__item"
              aria-current={version.id === currentId}
              onClick={() => select(version.id)}
              title={detail ? `${name} · ${detail}` : name}
            >
              {/* The thumb itself is inert; the whole item is the button. */}
              <span className={`thumb${version.tool === 'remove-bg' ? ' checker' : ''}`}>
                <img src={version.url} alt="" />
              </span>
              <span className="vstrip__caption">
                {version.tool ? <Icon name={toolMeta[version.tool].icon} size={11} /> : null}
                {name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
