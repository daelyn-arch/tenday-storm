import type { ReactNode, SVGProps } from 'react'

// ─── Display + small-caps eyebrow ─────────────────────────────────────

interface DisplayProps {
  as?: 'h1' | 'h2' | 'h3' | 'div' | 'span'
  className?: string
  children: ReactNode
}
export function Display({ as: Tag = 'h2', className = '', children }: DisplayProps) {
  return <Tag className={`font-display font-semibold tracking-wide text-ink-50 ${className}`}>{children}</Tag>
}

export function Eyebrow({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`eyebrow ${className}`}>{children}</div>
}

// ─── Panel ────────────────────────────────────────────────────────────
// The chest-frame .panel from index.css plus a lighter .panel-iron
// variant with 4 corner studs (this React version adds the 3rd + 4th
// studs the bare CSS class can't render via ::before/::after).

export function PanelIron({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`panel-iron ${className}`}>
      {/* bottom-left and bottom-right studs (top two come from .panel-iron::before/::after) */}
      <span aria-hidden="true" className="absolute bottom-1 left-1 w-2.5 h-2.5 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle at 30% 30%, #6b5436, #1a120a 70%)', boxShadow: '0 1px 1px rgba(0,0,0,.6)' }} />
      <span aria-hidden="true" className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle at 30% 30%, #6b5436, #1a120a 70%)', boxShadow: '0 1px 1px rgba(0,0,0,.6)' }} />
      {children}
    </div>
  )
}

// ─── DayRing ──────────────────────────────────────────────────────────
// Gold ring with tick marks; arc fills clockwise as days progress.

interface DayRingProps {
  day: number
  max: number
  size?: number
  className?: string
}
export function DayRing({ day, max, size = 72, className = '' }: DayRingProps) {
  const stroke = size * 0.1
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, day / max))
  return (
    <div className={`relative inline-block ${className}`} style={{ width: size, height: size }} role="img" aria-label={`Day ${day} of ${max}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="dayRingGold" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#f0c878" />
            <stop offset="1" stopColor="#a87838" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#dayRingGold)"
          strokeWidth={stroke}
          strokeDasharray={`${C * pct} ${C}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        {Array.from({ length: max }).map((_, i) => {
          const a = (i / max) * 2 * Math.PI - Math.PI / 2
          const inner = r - stroke / 2 + 1
          const outer = r + stroke / 2 - 1
          return (
            <line
              key={i}
              x1={size / 2 + outer * Math.cos(a)}
              y1={size / 2 + outer * Math.sin(a)}
              x2={size / 2 + inner * Math.cos(a)}
              y2={size / 2 + inner * Math.sin(a)}
              stroke={i < day ? '#1a120c' : 'rgba(0,0,0,.5)'}
              strokeWidth={1}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="font-display font-bold leading-none text-gold-400" style={{ fontSize: size * 0.36 }}>{day}</span>
        <span className="eyebrow mt-0.5" style={{ fontSize: Math.max(9, size * 0.13) }}>of {max}</span>
      </div>
    </div>
  )
}

// ─── StatusPill ───────────────────────────────────────────────────────
// Icon + text + tone. Always paired with an icon — never color alone.

type Tone = 'safe' | 'caution' | 'danger' | 'storm' | 'neutral'

const TONE_STYLES: Record<Tone, { bg: string; fg: string; ring: string }> = {
  safe:    { bg: 'rgba(107,191,122,.14)', fg: '#9be6c4', ring: 'rgba(107,191,122,.4)' },
  caution: { bg: 'rgba(217,122,74,.18)',  fg: '#ffba8a', ring: 'rgba(217,122,74,.45)' },
  danger:  { bg: 'rgba(168,56,56,.22)',   fg: '#ffbcbc', ring: 'rgba(168,56,56,.5)' },
  storm:   { bg: 'rgba(154,127,191,.18)', fg: '#cfb6f0', ring: 'rgba(154,127,191,.4)' },
  neutral: { bg: 'rgba(217,168,90,.12)',  fg: '#f0c878', ring: 'rgba(217,168,90,.35)' },
}

interface StatusPillProps {
  tone: Tone
  icon?: ReactNode
  children: ReactNode
  className?: string
}
export function StatusPill({ tone, icon, children, className = '' }: StatusPillProps) {
  const t = TONE_STYLES[tone]
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-display text-[11px] uppercase tracking-[0.1em] font-medium ${className}`}
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.ring}` }}
    >
      {icon}
      {children}
    </span>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────
// Minimal inline SVG icons used by the Forged-Iron chrome. All currentColor.
// Pair with text — never icon-only for status.

function I({ children, size = 16, fill = 'none', sw = 1.6, ...rest }: SVGProps<SVGSVGElement> & { size?: number; sw?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
      {...rest}
    >
      {children}
    </svg>
  )
}

export const Icons = {
  Storm: (p: SVGProps<SVGSVGElement> & { size?: number }) => (
    <I {...p}><path d="M13 2 4 14h6l-1 8 9-12h-6z" fill="currentColor" stroke="none" /></I>
  ),
  Crown:  (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M3 8l3 9h12l3-9-5 4-4-7-4 7z" /></I>),
  Sword:  (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M14 4h6v6L9 21l-3-3z M14 11l-4-4 M5 16l3 3" /></I>),
  Hex:    (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M12 3 20 7.5v9L12 21 4 16.5v-9z" /></I>),
  Plus:   (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M12 4v16M4 12h16" /></I>),
  Wind:   (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M3 8h11a3 3 0 1 0-3-3 M3 16h15a3 3 0 1 1-3 3 M3 12h17" /></I>),
  Flame:  (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M12 3s5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 1-6 1-9z" /></I>),
  Check:  (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M4 12.5 9.5 18 20 6" /></I>),
  X:      (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M5 5l14 14M19 5 5 19" /></I>),
  Eye:    (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></I>),
  Pin:    (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M12 22V14 M7 4h10l-1 6a4 4 0 0 1-8 0z" /></I>),
  Compass:(p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5 13 13l-4.5 2.5L11 11z" /></I>),
  Scroll: (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M7 4h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z M4 7h3 M20 17h-3" /></I>),
  Copy:   (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></I>),
  Bag:    (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M6 8h12l1 12H5z M9 8V6a3 3 0 0 1 6 0v2" /></I>),
  Map:    (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z M9 4v14 M15 6v14" /></I>),
  Book:   (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z M18 18H7a2 2 0 0 0-2 2" /></I>),
  Globe:  (p: SVGProps<SVGSVGElement> & { size?: number }) => (<I {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18 M12 3a14 14 0 0 1 0 18 M12 3a14 14 0 0 0 0 18" /></I>),
}
