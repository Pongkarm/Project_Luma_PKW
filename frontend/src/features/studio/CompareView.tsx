import { useState } from 'react';
import { useT } from '../../shared/hooks/useT.ts';

/**
 * Before and after, one over the other, split by a handle.
 *
 * The handle is a native range input stretched over the picture, so it drags
 * with a finger, steps with the arrow keys and announces its value — the
 * drawn line is only decoration following it.
 */
export function CompareView({
  before,
  after,
  alt,
  checker,
}: {
  before: string;
  after: string;
  alt: string;
  /** Put the "after" on a checkerboard, for a transparent cut-out. */
  checker: boolean;
}) {
  const [split, setSplit] = useState(50);
  const t = useT();

  return (
    <div className="compare" style={{ ['--split' as string]: `${split}%` }}>
      <img className="compare__img" src={before} alt="" draggable={false} />
      <div className={`compare__after${checker ? ' checker' : ''}`}>
        <img className="compare__img" src={after} alt={alt} draggable={false} />
      </div>
      <span className="compare__line" aria-hidden="true" />
      <span className="compare__tag compare__tag--before">{t('studio.before')}</span>
      <span className="compare__tag compare__tag--after">{t('studio.after')}</span>
      <input
        className="compare__range"
        type="range"
        min={0}
        max={100}
        value={split}
        aria-label={t('studio.compareLabel')}
        onChange={(event) => setSplit(Number(event.target.value))}
      />
    </div>
  );
}
