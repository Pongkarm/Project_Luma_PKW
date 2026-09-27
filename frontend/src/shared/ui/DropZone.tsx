import { useRef, useState, type DragEvent } from 'react';
import { Icon } from './Icon.tsx';
import { limits } from '../../config/limits.ts';

type Props = {
  /** The main line: "Drop an image here, or click to choose one". */
  label: string;
  /** The small line under it, usually the accepted types and sizes. */
  hint?: string;
  onFile: (file: File) => void;
};

/**
 * An area that takes an image by drag-and-drop, click, or Enter/Space.
 *
 * Only hands back the first file; checking what it is stays with the caller,
 * which knows what it will do with it.
 */
export function DropZone({ label, hint, onFile }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const choose = () => inputRef.current?.click();

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <>
      <div
        className={`drop${dragging ? ' drop--over' : ''}`}
        role="button"
        tabIndex={0}
        onClick={choose}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            choose();
          }
        }}
        // preventDefault on dragover is what makes the element a drop target.
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" size={22} />
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--ink)' }}>{label}</span>
        {hint ? <span className="field__hint">{hint}</span> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={limits.upload.accept}
        className="visually-hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          // Cleared so choosing the same file again still fires onChange.
          event.target.value = '';
        }}
      />
    </>
  );
}
