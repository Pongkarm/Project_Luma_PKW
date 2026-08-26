import { useOutletContext } from 'react-router-dom';
import type { AdminMe } from '../../contracts/admin.ts';
import { AdminEmpty } from './AdminStates.tsx';

/** Stands in until each page is built, so the shell can be navigated and reviewed. */
export function AdminPlaceholder({ title }: { title: string }) {
  const me = useOutletContext<AdminMe>();
  return (
    <>
      <header className="adm__head">
        <h1>{title}</h1>
      </header>
      <AdminEmpty
        title={`${title} is not built yet`}
        body={`The shell, the guard and the API behind this page are in place. Signed in as ${me.username} (${me.role}).`}
      />
    </>
  );
}
