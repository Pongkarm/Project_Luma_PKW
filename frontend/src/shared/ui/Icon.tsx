/**
 * One stroke-based icon set, drawn on a 24px grid.
 * No emoji and no icon font: these scale and recolour with the text.
 */
const paths = {
  generate: ['M12 3.5 13.7 8 18.2 9.7 13.7 11.4 12 16 10.3 11.4 5.8 9.7 10.3 8z', 'm18.6 15.4.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z'],
  image: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z', 'm21 15-5-5L5 21'],
  layers: ['m12 3 9 5-9 5-9-5 9-5', 'm3 13 9 5 9-5'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7v5.2l3 1.8'],
  user: ['M12 11.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z', 'M4.8 20.5a7.5 7.5 0 0 1 14.4 0'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronLeft: ['m14 6-6 6 6 6'],
  chevronRight: ['m10 6 6 6-6 6'],
  download: ['M12 4v10m0 0 4-4m-4 4-4-4', 'M4 20h16'],
  refresh: ['M12 3a9 9 0 1 0 9 9', 'M21 3v6h-6'],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 11.5v5M12 8h.01'],
  alert: ['M12 4 2.5 20h19z', 'M12 10v4M12 17h.01'],
  checkCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'm8.5 12.5 2.5 2.5 4.5-5'],
  xCircle: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'm9 9 6 6M15 9l-6 6'],
  queue: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z'],
  upload: ['M12 16V4m0 0-4 4m4-4 4 4', 'M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'],
  trash: ['M4 7h16M9 7V5h6v2', 'm6.5 7 1 13h9l1-13'],
  brush: ['M4 20s3.5 1 5.5-1 1.8-3.8 1.8-3.8', 'm11.5 15 8-8a2.1 2.1 0 0 0-3-3l-8 8'],
  eraser: ['m6 16 7-7 5 5-4 4H8z', 'M4 20h16'],
  undo: ['M9 14 4 9l5-5', 'M4 9h10a5.5 5.5 0 0 1 0 11h-3'],
  redo: ['m15 14 5-5-5-5', 'M20 9H10a5.5 5.5 0 0 0 0 11h3'],
  eye: ['M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z', 'M12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6z'],
  swap: ['M4 8h13m0 0-3-3m3 3-3 3', 'M20 16H7m0 0 3-3m-3 3 3 3'],
  lockOpen: ['M6 10.5h12a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2z', 'M8 10.5V7.5a4 4 0 0 1 7.5-1.9'],
  lock: ['M6 10.5h12a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5.5a2 2 0 0 1 2-2z', 'M8 10.5V7.5a4 4 0 0 1 8 0v3'],
  sliders: ['M4 8h9M17 8h3M4 16h3M11 16h9', 'M15 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z', 'M9 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  sun: ['M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9z', 'M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4'],
  moon: ['M20 13.5A8.2 8.2 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5z'],
  close: ['M6 6l12 12M18 6 6 18'],
  node: ['M5 4h14a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 19 10H5a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 5 4z', 'M5 14h14a1.5 1.5 0 0 1 1.5 1.5v3A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-3A1.5 1.5 0 0 1 5 14z', 'M7 7h.01M7 17h.01'],
  grip: ['M8 10h8M8 14h8'],
  menu: ['M4 7h16M4 12h16M4 17h16'],
} as const;

export type IconName = keyof typeof paths;

type Props = {
  name: IconName;
  size?: number;
  className?: string;
  /** Decorative by default; pass a label when the icon is the only content. */
  label?: string;
  strokeDasharray?: string;
};

export function Icon({ name, size = 16, className, label, strokeDasharray }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ flex: 'none' }}
    >
      {paths[name].map((d) => (
        <path key={d} d={d} strokeDasharray={strokeDasharray} />
      ))}
    </svg>
  );
}
