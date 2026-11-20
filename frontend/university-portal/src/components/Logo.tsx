/** Sceau de vérification : même dessin que le favicon (obsidienne, anneau or champagne, coche émeraude). */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false" className="logo">
      <rect width="64" height="64" rx="14" fill="#161B1A" />
      <rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="#262E2C" strokeWidth="2" />
      <circle cx="32" cy="29" r="15" fill="none" stroke="#D4B46A" strokeWidth="3.5" />
      <path d="M24.5 29.5l5.2 5.2L39.5 24" fill="none" stroke="#10B981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 42.5v11l8-4.2 8 4.2v-11" fill="none" stroke="#D4B46A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
