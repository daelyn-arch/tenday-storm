import { useState } from 'react'
import { useCampaign } from '../../store/campaign'

export function RumorsPanel({ readOnly = false }: { readOnly?: boolean }) {
  const { rumors, regions, addRumor, updateRumor, deleteRumor, myRole } = useCampaign()
  const [draft, setDraft] = useState('')
  const visibleRumors = readOnly ? rumors.filter((r) => r.collected) : rumors
  return (
    <div className="p-4 space-y-3 text-sm overflow-y-auto h-full">
      {!readOnly && myRole === 'dm' && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            addRumor(draft.trim(), false)
            setDraft('')
          }}
        >
          <input
            className="input"
            placeholder="New rumor (defaults to false until you flip it)…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="btn btn-primary self-end" type="submit">
            Add rumor
          </button>
        </form>
      )}
      {visibleRumors.length === 0 && (
        <div className="text-ink-300">{readOnly ? 'No rumors collected yet.' : 'No rumors.'}</div>
      )}
      <ul className="space-y-2">
        {visibleRumors.map((r) => {
          const src = r.source_region_id ? regions.find((g) => g.id === r.source_region_id) : null
          return (
            <li key={r.id} className="panel p-3 space-y-2">
              <div className="text-ink-100">{r.text}</div>
              <div className="flex items-center justify-between text-xs text-ink-300">
                <div>
                  Source: {src?.name ?? '—'}
                  {!readOnly && (
                    <span className={`ml-3 ${r.is_true ? 'text-emerald-400' : 'text-red-400'}`}>
                      {r.is_true ? 'TRUE' : 'FALSE'}
                    </span>
                  )}
                  {!readOnly && r.collected && <span className="ml-3 text-storm-400">collected</span>}
                </div>
                {!readOnly && (
                  <div className="flex gap-2">
                    <button
                      className="btn text-xs py-1 px-2"
                      onClick={() => updateRumor(r.id, { collected: !r.collected })}
                    >
                      {r.collected ? 'un-collect' : 'mark collected'}
                    </button>
                    <button
                      className="btn text-xs py-1 px-2"
                      onClick={() => updateRumor(r.id, { is_true: !r.is_true })}
                    >
                      flip truth
                    </button>
                    <button className="btn btn-danger text-xs py-1 px-2" onClick={() => deleteRumor(r.id)}>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
