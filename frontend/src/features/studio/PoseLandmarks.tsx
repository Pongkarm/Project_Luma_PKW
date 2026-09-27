import { useState } from 'react';
import type { PoseLandmark } from '../../contracts/tools.ts';
import { Alert } from '../../shared/ui/Alert.tsx';
import { Button } from '../../shared/ui/Button.tsx';
import { Slider } from '../../shared/ui/Slider.tsx';
import { useT } from '../../shared/hooks/useT.ts';
import { useToasts } from '../../shared/ui/Toast.tsx';

/** MediaPipe's own examples draw a point from this confidence up. */
const DEFAULT_MIN_VISIBILITY = 0.5;

/** "LEFT_SHOULDER" → "left shoulder" — the table is read, not parsed. */
const readable = (name: string) => name.toLowerCase().replaceAll('_', ' ');

export function PoseLandmarks({ landmarks }: { landmarks: PoseLandmark[] }) {
  const t = useT();
  const showToast = useToasts((state) => state.show);
  const [minVisibility, setMinVisibility] = useState(DEFAULT_MIN_VISIBILITY);

  if (landmarks.length === 0) {
    return <Alert tone="note">{t('studio.noPerson')}</Alert>;
  }

  const visible = landmarks.filter((point) => point.visibility >= minVisibility);

  return (
    <div className="field">
      <div className="label">
        <span className="eyebrow">{t('studio.landmarks')}</span>
        <span className="label__meta mono">
          {t('studio.visibleCount', { count: visible.length, total: landmarks.length })}
        </span>
      </div>

      <Slider
        label={t('studio.minConfidence')}
        value={minVisibility}
        min={0}
        max={1}
        step={0.05}
        decimals={2}
        onChange={setMinVisibility}
      />

      <div className="studio-table" role="region" aria-label={t('studio.landmarks')} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">{t('studio.point')}</th>
              <th scope="col">x</th>
              <th scope="col">y</th>
              <th scope="col">vis</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((point) => (
              <tr key={point.id}>
                <td>{readable(point.name)}</td>
                <td className="mono">{point.x.toFixed(3)}</td>
                <td className="mono">{point.y.toFixed(3)}</td>
                <td className="mono">{point.visibility.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* All 33, whatever the filter says: the filter is for reading, the JSON is data. */}
      <Button
        size="sm"
        onClick={() => {
          void navigator.clipboard?.writeText(JSON.stringify(landmarks, null, 2));
          showToast(t('studio.jsonCopied'));
        }}
      >
        {t('studio.copyJson')}
      </Button>
    </div>
  );
}
