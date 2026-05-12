/**
 * Logo Naju Beauty Club — SVG inline, escalável.
 * Visual: gradiente + flor estilizada (beleza/feminino).
 */
export default function Logo({ size = 36, withText = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoGrad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
          <linearGradient id="logoGrad2" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="100%" stopColor="#fb7185" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#logoGrad)" />
        {/* Pétalas (4 elipses giradas) */}
        <g transform="translate(32 32)">
          <ellipse rx="6" ry="14" fill="white" fillOpacity="0.95" transform="rotate(0)" />
          <ellipse rx="6" ry="14" fill="white" fillOpacity="0.95" transform="rotate(45)" />
          <ellipse rx="6" ry="14" fill="white" fillOpacity="0.95" transform="rotate(90)" />
          <ellipse rx="6" ry="14" fill="white" fillOpacity="0.95" transform="rotate(135)" />
          <circle r="5" fill="url(#logoGrad2)" />
        </g>
      </svg>
      {withText && (
        <div className="leading-tight">
          <div className="font-bold tracking-tight">Naju<span className="text-gradient">Groups</span></div>
          <div className="text-[10px] uppercase tracking-widest text-muted">Beauty Club</div>
        </div>
      )}
      <style>{`
        .text-muted { color: rgb(var(--text-muted)); }
      `}</style>
    </div>
  );
}
