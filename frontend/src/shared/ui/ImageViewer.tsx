import { useEffect } from 'react';
import { Icon } from './Icon.tsx';
import { useT } from '../hooks/useT.ts';

/**
 * Full-size view of a finished image. Closes on Escape or on a click anywhere
 * outside the picture, which is what people try first.
 */
export function ImageViewer({
  url,
  alt,
  meta,
  onClose,
}: {
  url: string;
  alt: string;
  meta?: string;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    // Stop the page behind from scrolling while the viewer is open.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <img
        className="viewer__img"
        src={url}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
      />
      <button type="button" className="viewer__close" aria-label={t('run.closeView')} onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
      {meta ? <span className="viewer__meta">{meta}</span> : null}
    </div>
  );
}
