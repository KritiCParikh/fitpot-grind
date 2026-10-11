// The FitPot mark (phase 5.9): the gullak kettlebell, small version.
// A clay gullak (piggy bank) shaped like a kettlebell: lime handle, orange
// belly, coin slot. This is the simple version made for small sizes, so it
// has no coin and no painted dots. The full icon lives in public/icons and
// design/icon (see docs/BUILD_GUIDE.md, Phase 5.9).
export default function Mark({ size = 28, className = '' }) {
  return (
    <svg className={`mark ${className}`} width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <g transform="translate(256 276) scale(1.06) translate(-256 -276)">
        <path d="M164 266 C142 156 190 76 256 76 C322 76 370 156 348 266" fill="none" stroke="#c6ff3d" strokeWidth="62" strokeLinecap="round" />
        <rect x="188" y="442" width="136" height="36" rx="14" fill="#ff7a1a" />
        <circle cx="256" cy="326" r="148" fill="#ff7a1a" />
        <rect x="198" y="204" width="116" height="30" rx="15" fill="#0b0d0c" />
      </g>
    </svg>
  )
}
