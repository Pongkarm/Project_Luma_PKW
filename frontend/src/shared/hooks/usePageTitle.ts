import { useEffect } from 'react';

/**
 * Names the browser tab after the page. Without this every tab and every
 * history entry read "LUMA", which is unhelpful the moment someone has two
 * open — and the tab title is the label screen readers announce on navigation.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · LUMA`;
    return () => {
      document.title = 'LUMA';
    };
  }, [title]);
}
