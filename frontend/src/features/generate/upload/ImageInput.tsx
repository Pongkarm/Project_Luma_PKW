import { useRef, useState, type DragEvent } from 'react';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { IconButton, Button } from '../../../shared/ui/Button.tsx';
import { limits } from '../../../config/limits.ts';
import { formatBytes } from '../../../shared/utils/format.ts';
import { uploadService } from '../../../services/uploadService.ts';
import type { SourceImage } from '../draftStore.ts';
import { useImageUpload } from './useImageUpload.ts';
import { useT } from '../../../shared/hooks/useT.ts';

type Props = {
  label: string;
  value: SourceImage | null;
  onChange: (source: SourceImage | null) => void;
};

/**
 * The whole upload workflow in one control: drop or pick, watch it go up, see
 * what landed, replace it or take it away — plus the server's own error when
 * the file is not acceptable.
 */
export function ImageInput({ label, value, onChange }: Props) {
  const { state, upload, reset } = useImageUpload();
  const t = useT();
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const source = await upload(file);
    if (source) onChange(source);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFiles(event.dataTransfer.files);
  }

  const hiddenInput = (
    <input
      ref={inputRef}
      type="file"
      accept={limits.upload.accept}
      className="visually-hidden"
      onChange={(event) => {
        void handleFiles(event.target.files);
        event.target.value = '';
      }}
    />
  );

  if (value) {
    return (
      <div className="field">
        <span className="label">{label}</span>
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: 8,
            border: '1px solid var(--line)',
            borderRadius: 'var(--r)',
            background: 'var(--panel-2)',
          }}
        >
          <img
            src={uploadService.publicUrl(value.url)}
            alt=""
            width={44}
            height={44}
            style={{
              width: 44,
              height: 44,
              flex: 'none',
              objectFit: 'cover',
              borderRadius: 'var(--r-sm)',
              background: 'var(--ph-image)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
            <span
              style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 500,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={value.filename}
            >
              {value.filename}
            </span>
            <span className="mono" style={{ fontSize: 'var(--fs-2xs)', color: 'var(--ink-3)' }}>
              {value.width} × {value.height} · {formatBytes(value.sizeBytes)}
            </span>
          </div>
          <IconButton icon="upload" label={t('upload.replace')} onClick={() => inputRef.current?.click()} />
          <IconButton
            icon="trash"
            label={t('upload.remove')}
            onClick={() => {
              reset();
              onChange(null);
            }}
          />
        </div>
        {hiddenInput}
      </div>
    );
  }

  if (state.status === 'uploading') {
    return (
      <div className="field">
        <span className="label">{label}</span>
        <div className="drop drop--busy">
          <span className="mono" style={{ fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' }}>
            {state.fileName}
          </span>
          <div className="track" style={{ width: '70%' }}>
            <div className="track__fill" style={{ width: `${Math.round(state.progress * 100)}%` }} />
          </div>
          <span className="field__hint">
            {t('upload.uploading', { percent: Math.round(state.progress * 100) })}
          </span>
        </div>
        {hiddenInput}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="field">
        <span className="label">{label}</span>
        <div className="drop drop--error" role="alert">
          <Icon name="alert" size={20} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--fail)' }}>{state.error}</span>
          <Button size="sm" onClick={() => inputRef.current?.click()}>
            {t('upload.chooseAnother')}
          </Button>
        </div>
        {hiddenInput}
      </div>
    );
  }

  return (
    <div className="field">
      <span className="label">{label}</span>
      <div
        className={['drop', dragging ? 'drop--over' : ''].filter(Boolean).join(' ')}
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Icon name="upload" size={22} />
        <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 500, color: 'var(--ink)' }}>
          {t('upload.drop')}
        </span>
        <span className="field__hint">{t('upload.constraints')}</span>
      </div>
      {hiddenInput}
    </div>
  );
}
