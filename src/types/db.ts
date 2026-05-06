// Hand-written types matching supabase/migrations/0001_init.sql.
// Regenerate with `supabase gen types` once the user has the CLI installed.

export type Biome =
  | 'ocean'
  | 'coast'
  | 'plains'
  | 'forest'
  | 'hills'
  | 'mountain'
  | 'desert'
  | 'swamp'
  | 'tundra'

export type Role = 'dm' | 'player'

export interface CampaignRow {
  id: string
  name: string
  seed: number
  width: number
  height: number
  day: number
  max_days: number
  party_q: number
  party_r: number
  storm_q: number
  storm_r: number
  storm_radius: number
  storm_path: { q: number; r: number }[]
  players_see_storm_next: boolean
  final_boss_q: number | null
  final_boss_r: number | null
  invite_code: string
  created_at: string
}

export type LocationType =
  | 'village'
  | 'city'
  | 'temple'
  | 'ruin'
  | 'cave'
  | 'dungeon'
  | 'fortress'
  | 'arcane_tower'

export const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: 'village', label: 'Village' },
  { value: 'city', label: 'City' },
  { value: 'temple', label: 'Temple' },
  { value: 'ruin', label: 'Ruin' },
  { value: 'cave', label: 'Cave' },
  { value: 'dungeon', label: 'Dungeon' },
  { value: 'fortress', label: 'Fortress' },
  { value: 'arcane_tower', label: 'Arcane Tower' },
]

export interface HexRow {
  campaign_id: string
  q: number
  r: number
  biome: Biome
  region_id: string | null
  generated: { features?: string[]; encounters?: { weight: number; text: string }[] }
  dm_notes: string
  revealed: boolean
  party_visited: boolean
  location_type: LocationType | null
}

export interface RegionRow {
  id: string
  campaign_id: string
  name: string
  color: string
  kingdom_lore: string
  dm_lore: string
  is_homeland: boolean
}

export interface QuestRow {
  id: string
  campaign_id: string
  title: string
  body: string
  status: 'open' | 'completed' | 'failed'
  player_visible: boolean
  target_q: number | null
  target_r: number | null
  created_at: string
}

export interface EncounterRow {
  id: string
  campaign_id: string
  text: string
  target_q: number | null
  target_r: number | null
  used: boolean
  created_at: string
}

export interface RumorRow {
  id: string
  campaign_id: string
  text: string
  is_true: boolean
  target_q: number | null
  target_r: number | null
  source_region_id: string | null
  collected: boolean
}

export interface ItemRow {
  id: string
  campaign_id: string
  name: string
  description: string
  hex_q: number | null
  hex_r: number | null
  is_real: boolean
  discovered: boolean
  in_party_inventory: boolean
  /** Optional link to a quest the item belongs to. */
  quest_id: string | null
  /** Optional link to a rumor the item belongs to. Mutually exclusive with quest_id by convention, not constraint. */
  rumor_id: string | null
}

export interface JournalRow {
  id: string
  campaign_id: string
  author: string
  body: string
  target_q: number | null
  target_r: number | null
  created_at: string
  updated_at: string
}

export interface MemberRow {
  campaign_id: string
  user_id: string
  role: Role
  display_name: string
}

type Rels = []

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: {
      join_by_code: {
        Args: { code: string; name: string }
        Returns: string
      }
    }
    Tables: {
      campaigns: {
        Row: CampaignRow
        Insert: Omit<Partial<CampaignRow>, 'name' | 'seed' | 'width' | 'height' | 'invite_code' | 'party_q' | 'party_r' | 'storm_q' | 'storm_r'> &
          Pick<CampaignRow, 'name' | 'seed' | 'width' | 'height' | 'invite_code' | 'party_q' | 'party_r' | 'storm_q' | 'storm_r'>
        Update: Partial<CampaignRow>
        Relationships: Rels
      }
      hexes: { Row: HexRow; Insert: HexRow; Update: Partial<HexRow>; Relationships: Rels }
      regions: { Row: RegionRow; Insert: Omit<RegionRow, 'id'> & { id?: string }; Update: Partial<RegionRow>; Relationships: Rels }
      quests: {
        Row: QuestRow
        Insert: Omit<Partial<QuestRow>, 'campaign_id' | 'title'> & Pick<QuestRow, 'campaign_id' | 'title'>
        Update: Partial<QuestRow>
        Relationships: Rels
      }
      rumors: { Row: RumorRow; Insert: Omit<RumorRow, 'id'> & { id?: string }; Update: Partial<RumorRow>; Relationships: Rels }
      items: { Row: ItemRow; Insert: Omit<ItemRow, 'id'> & { id?: string }; Update: Partial<ItemRow>; Relationships: Rels }
      encounters: { Row: EncounterRow; Insert: Omit<EncounterRow, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<EncounterRow>; Relationships: Rels }
      journal_entries: {
        Row: JournalRow
        Insert: Omit<Partial<JournalRow>, 'campaign_id' | 'body' | 'author'> &
          Pick<JournalRow, 'campaign_id' | 'body' | 'author'>
        Update: Partial<JournalRow>
        Relationships: Rels
      }
      campaign_members: { Row: MemberRow; Insert: MemberRow; Update: Partial<MemberRow>; Relationships: Rels }
    }
  }
}
