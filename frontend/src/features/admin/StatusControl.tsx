import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { adminService } from '../../services/adminService.ts';
import { Button } from '../../shared/ui/Button.tsx';
import { Alert } from '../../shared/ui/Alert.tsx';
import { isApiError } from '../../contracts/errors.ts';
import type { AdminMe, AdminUserRow } from '../../contracts/admin.ts';

/**
 * Disable or enable one account — the only thing an admin may do to somebody
 * else's account here.
 *
 * There is deliberately no way to change a user's email or password. That
 * looks like a helpful feature and is an account-takeover path: change the
 * address, request a reset, own the account.
 *
 * The reason is required, and typing it is the point. It is what makes the
 * audit log readable three weeks later, and the pause is what stops the
 * misclick — a confirm dialog you can dismiss by reflex stops nothing.
 */
export function StatusControl({ user, onDone }: { user: AdminUserRow; onDone: () => void }) {
  const me = useOutletContext<AdminMe>();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const disabling = user.is_active;
  const isSelf = me.user_id === user.id;
  const isOwner = user.admin_role === 'owner';
  const blocked = isSelf ? 'You cannot disable your own account.'
    : isOwner ? 'An owner account cannot be disabled.'
    : null;

  const mutation = useMutation({
    mutationFn: () => adminService.setUserStatus(user.id, !user.is_active, reason.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      onDone();
    },
  });

  if (!me.can_manage_users) {
    return (
      <p className="adm-soon">
        Your access level can view accounts but not change them.
      </p>
    );
  }

  return (
    <div className="adm-act">
      {mutation.isError ? (
        <Alert tone="error">
          {isApiError(mutation.error) ? mutation.error.message : 'The change was refused.'}
        </Alert>
      ) : null}

      {!open ? (
        <Button
          variant={disabling ? 'danger' : 'secondary'}
          icon={disabling ? 'lock' : 'lockOpen'}
          disabled={Boolean(blocked)}
          title={blocked ?? undefined}
          onClick={() => setOpen(true)}
        >
          {disabling ? 'Disable account' : 'Enable account'}
        </Button>
      ) : (
        <>
          <p className="adm-act__ask">
            {disabling
              ? `${user.username} will not be able to sign in until an admin enables the account again. Their images are kept.`
              : `${user.username} will be able to sign in again.`}
          </p>
          <label className="adm-act__reason">
            <span>Reason (recorded in the audit log)</span>
            <input
              className="input"
              value={reason}
              autoFocus
              onChange={(event) => setReason(event.target.value)}
              placeholder={disabling ? 'repeated failed generations' : 'issue resolved'}
            />
          </label>
          <div className="adm-act__row">
            <Button
              variant={disabling ? 'danger' : 'primary'}
              busy={mutation.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => mutation.mutate()}
            >
              {disabling ? 'Disable' : 'Enable'}
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </>
      )}

      {blocked ? <p className="adm-soon">{blocked}</p> : null}
    </div>
  );
}
