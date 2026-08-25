import { Dialog } from '../../../shared/ui/Dialog.tsx';
import { Button } from '../../../shared/ui/Button.tsx';
import { Icon } from '../../../shared/ui/Icon.tsx';
import { useT } from '../../../shared/hooks/useT.ts';

/**
 * Deletion here is permanent — the file leaves the disk and the row leaves the
 * database — so it asks first, and the destructive choice is never the one the
 * dialog opens focused on.
 */
export function DeleteRunDialog({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();

  return (
    <Dialog open={open} title={t('run.deleteTitle')} onDismiss={busy ? undefined : onCancel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Icon name="alert" size={18} />
        <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 600 }}>{t('run.deleteTitle')}</h2>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink-3)', lineHeight: 1.55 }}>
          {t('run.deleteBody')}
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button onClick={onCancel} disabled={busy} style={{ flex: 1 }}>
          {t('run.cancel')}
        </Button>
        <Button variant="danger" busy={busy} onClick={onConfirm} style={{ flex: 1 }}>
          {t('run.deleteConfirm')}
        </Button>
      </div>
    </Dialog>
  );
}
