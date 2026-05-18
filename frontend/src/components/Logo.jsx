/**
 * Logo AdManager — símbolo de "tag de anúncio" com gradiente brand.
 */
export default function Logo({ size = 36, withText = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="adGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {/* Background rounded square */}
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#adGrad)" />
        {/* Tag/Price icon — uma "etiqueta" estilizada */}
        <g transform="translate(32 32)">
          <path d="M-14 -10 L4 -10 L14 0 L4 10 L-14 10 Z" fill="white" fillOpacity="0.95" />
          <circle cx="6" cy="0" r="3" fill="url(#adGrad)" />
        </g>
      </svg>
      {withText && (
        <div className="leading-tight">
          <div className="font-bold tracking-tight">Ad<span className="text-gradient">Manager</span></div>
        </div>
      )}
    </div>
  );
}
