/** Quiet, deterministic ink marks; these never encode or distort a data value. */
export function DrawnUnderline({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`drawn-underline ${className}`}
      viewBox="0 0 240 12"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 7C59 3 132 10 237 5M9 10C82 6 164 11 227 8" />
    </svg>
  );
}

export function DrawnBracket({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`drawn-bracket ${className}`}
      viewBox="0 0 16 100"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path d="M13 2L4 3L3 96L13 98" />
    </svg>
  );
}

export function DrawnSelection({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`drawn-selection ${className}`}
      viewBox="0 0 160 80"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path d="M7 5L152 3L156 73L5 77L3 7L13 5" />
    </svg>
  );
}
