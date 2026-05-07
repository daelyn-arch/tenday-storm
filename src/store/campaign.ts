import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { axialKey, neighbors, type Axial } from '../hex/coords'
import type {
  CampaignRow,
  EncounterRow,
  HexRow,
  ItemRow,
  JournalRow,
  MemberRow,
  QuestRow,
  RegionRow,
  RumorRow,
} from '../types/db'

export interface CampaignState {
  campaignId: string | null
  campaign: CampaignRow | null
  hexes: HexRow[]
  regions: RegionRow[]
  items: ItemRow[]
  rumors: RumorRow[]
  quests: QuestRow[]
  encounters: EncounterRow[]
  journal: JournalRow[]
  members: MemberRow[]
  selected: Axial | null
  loading: boolean
  error: string | null
  myRole: 'dm' | 'player' | null

  load: (id: string) => Promise<void>
  reset: () => void
  setSelected: (h: Axial | null) => void

  // DM actions
  updateHex: (q: number, r: number, patch: Partial<HexRow>) => Promise<void>
  updateCampaign: (patch: Partial<CampaignRow>) => Promise<void>
  /** Permanently deletes the campaign and (via cascade) every related row. */
  deleteCampaign: () => Promise<{ error: string | null }>
  endDay: () => Promise<void>
  moveParty: (to: Axial) => Promise<void>

  // Quest CRUD
  addQuest: (title: string, target?: Axial | null) => Promise<void>
  updateQuest: (id: string, patch: Partial<QuestRow>) => Promise<void>
  deleteQuest: (id: string) => Promise<void>

  // Rumor CRUD
  addRumor: (text: string, isTrue: boolean, target?: Axial | null) => Promise<void>
  updateRumor: (id: string, patch: Partial<RumorRow>) => Promise<void>
  deleteRumor: (id: string) => Promise<void>

  // Item CRUD
  addItem: (
    name: string,
    isReal: boolean,
    assignment?: { questId?: string | null; rumorId?: string | null } | null,
    tile?: Axial | null,
  ) => Promise<void>
  updateItem: (id: string, patch: Partial<ItemRow>) => Promise<void>
  deleteItem: (id: string) => Promise<void>

  // Encounter CRUD
  addEncounter: (text: string, target?: Axial | null) => Promise<void>
  updateEncounter: (id: string, patch: Partial<EncounterRow>) => Promise<void>
  deleteEncounter: (id: string) => Promise<void>

  // Region updates
  updateRegion: (id: string, patch: Partial<RegionRow>) => Promise<void>

  // Journal
  addJournal: (body: string, author: string, target?: Axial | null) => Promise<void>
  updateJournal: (id: string, patch: Partial<JournalRow>) => Promise<void>
  deleteJournal: (id: string) => Promise<void>

  // Internal: realtime upserts
  upsertRow: <K extends 'hexes' | 'regions' | 'items' | 'rumors' | 'quests' | 'encounters' | 'journal' | 'members'>(
    table: K,
    row: any,
  ) => void
  removeRow: (
    table: 'hexes' | 'regions' | 'items' | 'rumors' | 'quests' | 'encounters' | 'journal' | 'members',
    key: any,
  ) => void
  setCampaignRow: (c: CampaignRow) => void
}

export const useCampaign = create<CampaignState>((set, get) => ({
  campaignId: null,
  campaign: null,
  hexes: [],
  regions: [],
  items: [],
  rumors: [],
  quests: [],
  encounters: [],
  journal: [],
  members: [],
  selected: null,
  loading: false,
  error: null,
  myRole: null,

  reset: () =>
    set({
      campaignId: null,
      campaign: null,
      hexes: [],
      regions: [],
      items: [],
      rumors: [],
      quests: [],
      encounters: [],
      journal: [],
      members: [],
      selected: null,
      loading: false,
      error: null,
      myRole: null,
    }),

  setSelected: (h) => set({ selected: h }),

  load: async (id) => {
    set({ loading: true, error: null, campaignId: id })
    try {
      const { data: user } = await supabase.auth.getUser()
      const userId = user.user?.id
      const [c, hexes, regions, items, rumors, quests, encounters, journal, members] = await Promise.all([
        supabase.from('campaigns').select('*').eq('id', id).single(),
        supabase.from('hexes').select('*').eq('campaign_id', id),
        supabase.from('regions').select('*').eq('campaign_id', id),
        supabase.from('items').select('*').eq('campaign_id', id),
        supabase.from('rumors').select('*').eq('campaign_id', id),
        supabase.from('quests').select('*').eq('campaign_id', id),
        supabase.from('encounters').select('*').eq('campaign_id', id),
        supabase.from('journal_entries').select('*').eq('campaign_id', id).order('created_at', { ascending: false }),
        supabase.from('campaign_members').select('*').eq('campaign_id', id),
      ])
      if (c.error) throw c.error
      const myRole = userId
        ? ((members.data ?? []).find((m) => m.user_id === userId)?.role ?? null)
        : null
      set({
        campaign: c.data ?? null,
        hexes: hexes.data ?? [],
        regions: regions.data ?? [],
        items: items.data ?? [],
        rumors: rumors.data ?? [],
        quests: quests.data ?? [],
        // Encounters are DM-only; an empty fetch (RLS denies players) is fine.
        encounters: encounters.data ?? [],
        journal: journal.data ?? [],
        members: members.data ?? [],
        myRole,
        loading: false,
      })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  updateHex: async (q, r, patch) => {
    const id = get().campaignId
    if (!id) return
    // Optimistic
    set((s) => ({
      hexes: s.hexes.map((h) => (h.q === q && h.r === r ? { ...h, ...patch } : h)),
    }))
    const { error } = await supabase
      .from('hexes')
      .update(patch)
      .eq('campaign_id', id)
      .eq('q', q)
      .eq('r', r)
    if (error) console.error('updateHex failed', error)
  },

  updateCampaign: async (patch) => {
    const id = get().campaignId
    if (!id) return
    set((s) => (s.campaign ? { campaign: { ...s.campaign, ...patch } } : {}))
    const { error } = await supabase.from('campaigns').update(patch).eq('id', id)
    if (error) console.error('updateCampaign failed', error)
  },

  deleteCampaign: async () => {
    const id = get().campaignId
    if (!id) return { error: 'no campaign loaded' }
    const { error } = await supabase.from('campaigns').delete().eq('id', id)
    if (error) {
      console.error('deleteCampaign failed', error)
      return { error: error.message }
    }
    get().reset()
    return { error: null }
  },

  endDay: async () => {
    const c = get().campaign
    if (!c) return
    const idx = c.day // current day index in storm_path: at day 1, storm at path[0]; at day 2, path[1]; etc.
    const nextStep = c.storm_path[idx]
    const patch: Partial<CampaignRow> = {
      day: Math.min(c.max_days, c.day + 1),
    }
    if (nextStep) {
      patch.storm_q = nextStep.q
      patch.storm_r = nextStep.r
    }
    await get().updateCampaign(patch)
  },

  moveParty: async (to) => {
    const c = get().campaign
    if (!c) return
    // Reveal destination + mark party_visited.
    await get().updateHex(to.q, to.r, { revealed: true, party_visited: true })
    // Reveal neighbors at "scouted" tier — actually we said scouted is computed client-side from
    // party position, so we don't need to flip revealed. But let's also auto-reveal the destination's
    // immediate neighbors so players retain a small explored halo as the party moves on.
    for (const n of neighbors(to)) {
      const exists = get().hexes.find((h) => h.q === n.q && h.r === n.r)
      if (exists && !exists.revealed) {
        await get().updateHex(n.q, n.r, { revealed: true })
      }
    }
    await get().updateCampaign({ party_q: to.q, party_r: to.r })
  },

  addQuest: async (title, target) => {
    const id = get().campaignId
    if (!id) return
    // Client-generated id + optimistic insert so the user sees the new row
    // immediately even if the realtime echo is slow or the channel dropped.
    const newId = crypto.randomUUID()
    const optimistic: QuestRow = {
      id: newId,
      campaign_id: id,
      title,
      body: '',
      status: 'open',
      player_visible: true,
      target_q: target?.q ?? null,
      target_r: target?.r ?? null,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ quests: [...s.quests, optimistic] }))
    const { error } = await supabase.from('quests').insert(optimistic)
    if (error) {
      console.error('addQuest failed', error)
      set((s) => ({ quests: s.quests.filter((q) => q.id !== newId) }))
    }
  },
  updateQuest: async (qid, patch) => {
    set((s) => ({ quests: s.quests.map((q) => (q.id === qid ? { ...q, ...patch } : q)) }))
    const { error } = await supabase.from('quests').update(patch).eq('id', qid)
    if (error) console.error('updateQuest failed', error)
  },
  deleteQuest: async (qid) => {
    set((s) => ({ quests: s.quests.filter((q) => q.id !== qid) }))
    const { error } = await supabase.from('quests').delete().eq('id', qid)
    if (error) console.error('deleteQuest failed', error)
  },

  addRumor: async (text, isTrue, target) => {
    const id = get().campaignId
    if (!id) return
    const newId = crypto.randomUUID()
    const optimistic: RumorRow = {
      id: newId,
      campaign_id: id,
      text,
      is_true: isTrue,
      target_q: target?.q ?? null,
      target_r: target?.r ?? null,
      source_region_id: null,
      collected: false,
    }
    set((s) => ({ rumors: [...s.rumors, optimistic] }))
    const { error } = await supabase.from('rumors').insert(optimistic)
    if (error) {
      console.error('addRumor failed', error)
      set((s) => ({ rumors: s.rumors.filter((r) => r.id !== newId) }))
    }
  },
  updateRumor: async (rid, patch) => {
    set((s) => ({ rumors: s.rumors.map((r) => (r.id === rid ? { ...r, ...patch } : r)) }))
    const { error } = await supabase.from('rumors').update(patch).eq('id', rid)
    if (error) console.error('updateRumor failed', error)
  },
  deleteRumor: async (rid) => {
    set((s) => ({ rumors: s.rumors.filter((r) => r.id !== rid) }))
    const { error } = await supabase.from('rumors').delete().eq('id', rid)
    if (error) console.error('deleteRumor failed', error)
  },

  addItem: async (name, isReal, assignment, tile) => {
    const id = get().campaignId
    if (!id) return
    const newId = crypto.randomUUID()
    const optimistic: ItemRow = {
      id: newId,
      campaign_id: id,
      name,
      description: '',
      hex_q: tile?.q ?? null,
      hex_r: tile?.r ?? null,
      is_real: isReal,
      discovered: false,
      in_party_inventory: false,
      quest_id: assignment?.questId ?? null,
      rumor_id: assignment?.rumorId ?? null,
    }
    set((s) => ({ items: [...s.items, optimistic] }))
    const { error } = await supabase.from('items').insert(optimistic)
    if (error) {
      console.error('addItem failed', error)
      set((s) => ({ items: s.items.filter((it) => it.id !== newId) }))
    }
  },
  updateItem: async (iid, patch) => {
    set((s) => ({ items: s.items.map((it) => (it.id === iid ? { ...it, ...patch } : it)) }))
    const { error } = await supabase.from('items').update(patch).eq('id', iid)
    if (error) console.error('updateItem failed', error)
  },
  deleteItem: async (iid) => {
    set((s) => ({ items: s.items.filter((it) => it.id !== iid) }))
    const { error } = await supabase.from('items').delete().eq('id', iid)
    if (error) console.error('deleteItem failed', error)
  },

  addEncounter: async (text, target) => {
    const id = get().campaignId
    if (!id) return
    const newId = crypto.randomUUID()
    const optimistic: EncounterRow = {
      id: newId,
      campaign_id: id,
      text,
      target_q: target?.q ?? null,
      target_r: target?.r ?? null,
      used: false,
      created_at: new Date().toISOString(),
    }
    set((s) => ({ encounters: [...s.encounters, optimistic] }))
    const { error } = await supabase.from('encounters').insert(optimistic)
    if (error) {
      console.error('addEncounter failed', error)
      set((s) => ({ encounters: s.encounters.filter((e) => e.id !== newId) }))
    }
  },
  updateEncounter: async (eid, patch) => {
    set((s) => ({ encounters: s.encounters.map((e) => (e.id === eid ? { ...e, ...patch } : e)) }))
    const { error } = await supabase.from('encounters').update(patch).eq('id', eid)
    if (error) console.error('updateEncounter failed', error)
  },
  deleteEncounter: async (eid) => {
    set((s) => ({ encounters: s.encounters.filter((e) => e.id !== eid) }))
    const { error } = await supabase.from('encounters').delete().eq('id', eid)
    if (error) console.error('deleteEncounter failed', error)
  },

  updateRegion: async (rid, patch) => {
    set((s) => ({ regions: s.regions.map((r) => (r.id === rid ? { ...r, ...patch } : r)) }))
    const { error } = await supabase.from('regions').update(patch).eq('id', rid)
    if (error) console.error('updateRegion failed', error)
  },

  addJournal: async (body, author, target) => {
    const id = get().campaignId
    if (!id) return
    const newId = crypto.randomUUID()
    const now = new Date().toISOString()
    const optimistic: JournalRow = {
      id: newId,
      campaign_id: id,
      body,
      author,
      target_q: target?.q ?? null,
      target_r: target?.r ?? null,
      created_at: now,
      updated_at: now,
    }
    set((s) => ({ journal: [optimistic, ...s.journal] }))
    const { error } = await supabase.from('journal_entries').insert(optimistic)
    if (error) {
      console.error('addJournal failed', error)
      set((s) => ({ journal: s.journal.filter((j) => j.id !== newId) }))
    }
  },
  updateJournal: async (jid, patch) => {
    set((s) => ({ journal: s.journal.map((j) => (j.id === jid ? { ...j, ...patch } : j)) }))
    const { error } = await supabase
      .from('journal_entries')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jid)
    if (error) console.error('updateJournal failed', error)
  },
  deleteJournal: async (jid) => {
    set((s) => ({ journal: s.journal.filter((j) => j.id !== jid) }))
    const { error } = await supabase.from('journal_entries').delete().eq('id', jid)
    if (error) console.error('deleteJournal failed', error)
  },

  setCampaignRow: (c) => set({ campaign: c }),

  upsertRow: (table, row) => {
    set((s) => {
      switch (table) {
        case 'hexes': {
          const exists = s.hexes.find((h) => h.q === row.q && h.r === row.r)
          return exists
            ? { hexes: s.hexes.map((h) => (h.q === row.q && h.r === row.r ? row : h)) }
            : { hexes: [...s.hexes, row] }
        }
        case 'regions': {
          const exists = s.regions.find((x) => x.id === row.id)
          return exists
            ? { regions: s.regions.map((x) => (x.id === row.id ? row : x)) }
            : { regions: [...s.regions, row] }
        }
        case 'items': {
          const exists = s.items.find((x) => x.id === row.id)
          return exists
            ? { items: s.items.map((x) => (x.id === row.id ? row : x)) }
            : { items: [...s.items, row] }
        }
        case 'rumors': {
          const exists = s.rumors.find((x) => x.id === row.id)
          return exists
            ? { rumors: s.rumors.map((x) => (x.id === row.id ? row : x)) }
            : { rumors: [...s.rumors, row] }
        }
        case 'quests': {
          const exists = s.quests.find((x) => x.id === row.id)
          return exists
            ? { quests: s.quests.map((x) => (x.id === row.id ? row : x)) }
            : { quests: [...s.quests, row] }
        }
        case 'encounters': {
          const exists = s.encounters.find((x) => x.id === row.id)
          return exists
            ? { encounters: s.encounters.map((x) => (x.id === row.id ? row : x)) }
            : { encounters: [...s.encounters, row] }
        }
        case 'journal': {
          const exists = s.journal.find((x) => x.id === row.id)
          return exists
            ? { journal: s.journal.map((x) => (x.id === row.id ? row : x)) }
            : { journal: [row, ...s.journal] }
        }
        case 'members': {
          const exists = s.members.find((m) => m.user_id === row.user_id && m.campaign_id === row.campaign_id)
          return exists
            ? {
                members: s.members.map((m) =>
                  m.user_id === row.user_id && m.campaign_id === row.campaign_id ? row : m,
                ),
              }
            : { members: [...s.members, row] }
        }
        default:
          return {}
      }
    })
  },

  removeRow: (table, key) => {
    set((s) => {
      switch (table) {
        case 'hexes':
          return { hexes: s.hexes.filter((h) => !(h.q === key.q && h.r === key.r)) }
        case 'regions':
          return { regions: s.regions.filter((x) => x.id !== key.id) }
        case 'items':
          return { items: s.items.filter((x) => x.id !== key.id) }
        case 'rumors':
          return { rumors: s.rumors.filter((x) => x.id !== key.id) }
        case 'quests':
          return { quests: s.quests.filter((x) => x.id !== key.id) }
        case 'encounters':
          return { encounters: s.encounters.filter((x) => x.id !== key.id) }
        case 'journal':
          return { journal: s.journal.filter((x) => x.id !== key.id) }
        case 'members':
          return {
            members: s.members.filter(
              (m) => !(m.user_id === key.user_id && m.campaign_id === key.campaign_id),
            ),
          }
        default:
          return {}
      }
    })
  },
}))

// Helper to look up a hex from the store.
export function findHex(hexes: HexRow[], q: number, r: number): HexRow | undefined {
  return hexes.find((h) => h.q === q && h.r === r)
}

export function hexLookupKey(h: HexRow | Axial) {
  return axialKey(h)
}
