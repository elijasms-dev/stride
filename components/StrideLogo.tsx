import { STRIDE_LEAN, STRIDE_LETTERS, STRIDE_VIEWBOX } from '@/lib/brand';

/** Decorative within a link/container that supplies the accessible brand name. */
export function StrideLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`stride-logo ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={STRIDE_VIEWBOX}
      width="410"
      height="84"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <g transform={STRIDE_LEAN} fillRule="evenodd">
        {STRIDE_LETTERS.map((outline, index) => (
          <path key={index} d={outline} />
        ))}
      </g>
    </svg>
  );
}
