import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../shared/ui/Button.tsx';
import { Icon, type IconName } from '../../shared/ui/Icon.tsx';

/**
 * Every state the console can be in, designed rather than defaulted.
 *
 * An admin who cannot tell "no users exist" from "the request failed" from
 * "you are not allowed" will assume the tool is broken, which is the one
 * impression an internal tool cannot afford.
 */
export function AdminNotice({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="adm-notice">
      <Icon name={icon} size={22} />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function AdminForbidden() {
  return (
    <AdminNotice
      icon="lock"
      title="You do not have access to the admin console"
      body={
        <>
          Your account is signed in but holds no admin role. An owner can grant
          one from Admin management.
        </>
      }
      action={
        <Link to="/generate">
          <Button variant="secondary">Back to LUMA</Button>
        </Link>
      }
    />
  );
}

export function AdminUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <AdminNotice
      icon="alert"
      title="The admin service did not answer"
      body="The backend is unreachable or returned an error. Nothing has changed."
      action={<Button icon="refresh" onClick={onRetry}>Try again</Button>}
    />
  );
}

/** Rows at the real height of the table they stand in, so nothing jumps. */
export function AdminSkeletonRows({ rows = 8, height = 40 }: { rows?: number; height?: number }) {
  return (
    <div className="adm-skel">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

export function AdminEmpty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <AdminNotice icon="info" title={title} body={body} action={action} />;
}
