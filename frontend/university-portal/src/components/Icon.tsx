const PATHS = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 4l9 16H3z M12 10v4 M12 17.2v.1',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 11v5 M12 7.8v.1',
  upload: 'M12 16V5 M7.5 9.5L12 5l4.5 4.5 M5 19h14',
  download: 'M12 5v11 M7.5 11.5L12 16l4.5-4.5 M5 19h14',
  share: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1 M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  copy: 'M9 9h10v11H9z M5 15V4h10',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14z M20 20l-4-4',
  refresh: 'M20 11a8 8 0 10-2.3 5.7 M20 5v6h-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  logout: 'M10 5H5v14h5 M15 8l4 4-4 4 M19 12H9',
  file: 'M7 3h7l4 4v14H7z M14 3v4h4 M9.5 13h5 M9.5 16.5h5',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4.5 20a7.5 7.5 0 0115 0',
  lock: 'M6 11h12v9H6z M8.5 11V8a3.5 3.5 0 017 0v3',
  shield: 'M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z M9 12l2.2 2.2L15.5 10',
  calendar: 'M4 6h16v15H4z M4 10h16 M8.5 3v4 M15.5 3v4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 15a3 3 0 100-6 3 3 0 000 6z',
  eyeoff: 'M3 3l18 18 M10.6 6.2A9.8 9.8 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.2 3.9 M6.6 6.7A17 17 0 002 12s4 6 10 6c1.5 0 2.8-.3 4-.8 M9.9 9.9a3 3 0 004.2 4.2',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name].split(' M').map((d, i) => (
        <path key={i} d={i === 0 ? d : `M${d}`} />
      ))}
    </svg>
  );
}
