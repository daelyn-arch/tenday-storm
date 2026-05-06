import type { LocationType } from '../types/db'

// Hand-drawn glyphs centered on (0, 0) within a roughly 22-unit box, designed
// to read at small map scale. Filled in cream over a dark stroke so they pop
// against any biome.

interface Props {
  type: LocationType
  cx: number
  cy: number
}

const FILL = '#fff8e0'
const STROKE = '#1a1407'
const STROKE_W = 0.7

export function LocationIcon({ type, cx, cy }: Props) {
  return (
    <g transform={`translate(${cx} ${cy})`} pointerEvents="none">
      {render(type)}
    </g>
  )
}

function render(type: LocationType) {
  switch (type) {
    case 'village':
      // Three small house silhouettes in a row.
      return (
        <>
          <path
            d="M-10,5 L-10,0 L-7,-3 L-4,0 L-4,5 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          <path
            d="M-2,5 L-2,-1 L1.5,-5 L5,-1 L5,5 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          <path
            d="M5,5 L5,0 L7.5,-3 L10,0 L10,5 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
        </>
      )
    case 'city':
      // Wide crenellated wall flanked by two tall towers.
      return (
        <>
          {/* Left tower */}
          <path
            d="M-11,7 L-11,-7 L-9,-7 L-9,-9 L-7,-9 L-7,-7 L-5,-7 L-5,7 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          {/* Curtain wall + crenels */}
          <path
            d="M-5,7 L-5,-3 L-3,-3 L-3,-5 L-1,-5 L-1,-3 L1,-3 L1,-5 L3,-5 L3,-3 L5,-3 L5,7 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          {/* Right tower */}
          <path
            d="M5,7 L5,-7 L7,-7 L7,-9 L9,-9 L9,-7 L11,-7 L11,7 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
        </>
      )
    case 'temple':
      // Pediment triangle on three columns.
      return (
        <>
          <path
            d="M-9,-2 L0,-8 L9,-2 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          <rect x={-9} y={-2} width={18} height={2} fill={FILL} stroke={STROKE} strokeWidth={STROKE_W} />
          <rect x={-7.5} y={0} width={2.5} height={6} fill={FILL} stroke={STROKE} strokeWidth={STROKE_W} />
          <rect x={-1.25} y={0} width={2.5} height={6} fill={FILL} stroke={STROKE} strokeWidth={STROKE_W} />
          <rect x={5} y={0} width={2.5} height={6} fill={FILL} stroke={STROKE} strokeWidth={STROKE_W} />
          <rect x={-9} y={6} width={18} height={1.5} fill={FILL} stroke={STROKE} strokeWidth={STROKE_W} />
        </>
      )
    case 'ruin':
      // Broken column stub + collapsed arch fragment.
      return (
        <>
          {/* Broken jagged top of column */}
          <path
            d="M-7,7 L-7,-2 L-5,-4 L-3.5,-2 L-2.5,-3.5 L-1,-1 L1,-3 L2.5,-1 L4,-2 L5,-1 L7,-3 L7,7 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          {/* Fallen capital block */}
          <rect x={-9} y={5} width={18} height={2.5} fill={FILL} stroke={STROKE} strokeWidth={STROKE_W} />
        </>
      )
    case 'cave':
      // Mountain silhouette with dark arched opening.
      return (
        <>
          <path
            d="M-11,7 L-5,-6 L-1,1 L3,-7 L11,7 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          <path d="M-4,7 L-4,2 A4,4 0 0 1 4,2 L4,7 Z" fill={STROKE} />
        </>
      )
    case 'dungeon':
      // Trapdoor / pit with descending steps.
      return (
        <>
          <rect
            x={-9}
            y={-5}
            width={18}
            height={12}
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            rx={1}
          />
          <line x1={-7.5} y1={-1.5} x2={7.5} y2={-1.5} stroke={STROKE} strokeWidth={1.2} />
          <line x1={-7.5} y1={1.5} x2={7.5} y2={1.5} stroke={STROKE} strokeWidth={1.2} />
          <line x1={-7.5} y1={4.5} x2={7.5} y2={4.5} stroke={STROKE} strokeWidth={1.2} />
        </>
      )
    case 'fortress':
      // Single tall tower with crenellations and a door.
      return (
        <>
          <path
            d="M-6,8 L-6,-6 L-4,-6 L-4,-8 L-2,-8 L-2,-6 L0,-6 L0,-8 L2,-8 L2,-6 L4,-6 L4,-8 L6,-8 L6,-6 L6,8 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          <path d="M-1.8,8 L-1.8,4 A1.8,1.8 0 0 1 1.8,4 L1.8,8 Z" fill={STROKE} />
        </>
      )
    case 'arcane_tower':
      // Slim tower with conical roof and a glowing star.
      return (
        <>
          {/* Conical roof */}
          <path
            d="M-3.5,-3 L0,-9 L3.5,-3 Z"
            fill={FILL}
            stroke={STROKE}
            strokeWidth={STROKE_W}
            strokeLinejoin="round"
          />
          {/* Tower body */}
          <rect x={-3} y={-3} width={6} height={11} fill={FILL} stroke={STROKE} strokeWidth={STROKE_W} />
          {/* Window */}
          <rect x={-1} y={-1} width={2} height={2.5} fill={STROKE} />
          {/* Star above */}
          <path
            d="M0,-12 L0.9,-10.2 L2.8,-9.9 L1.4,-8.6 L1.7,-6.7 L0,-7.6 L-1.7,-6.7 L-1.4,-8.6 L-2.8,-9.9 L-0.9,-10.2 Z"
            fill="#ffd84a"
            stroke={STROKE}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
        </>
      )
    default:
      return null
  }
}
