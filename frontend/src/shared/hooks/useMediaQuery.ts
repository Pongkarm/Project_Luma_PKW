import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Below this the controls stop being a column and become a sheet. */
export const COMPACT_QUERY = '(max-width: 1099px)';
/** The mask canvas needs a pointer and room; it is not offered below this. */
export const CANVAS_CAPABLE_QUERY = '(min-width: 768px)';
