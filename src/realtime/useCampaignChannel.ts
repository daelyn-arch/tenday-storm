import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useCampaign } from '../store/campaign'

export function useCampaignChannel(campaignId: string | null) {
  const upsertRow = useCampaign((s) => s.upsertRow)
  const removeRow = useCampaign((s) => s.removeRow)
  const setCampaignRow = useCampaign((s) => s.setCampaignRow)

  useEffect(() => {
    if (!campaignId) return
    const filter = `campaign_id=eq.${campaignId}`
    const channel = supabase
      .channel(`campaign:${campaignId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${campaignId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return
          if (payload.new) setCampaignRow(payload.new as never)
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hexes', filter }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const old = payload.old as { q?: number; r?: number }
          if (old.q != null && old.r != null) removeRow('hexes', { q: old.q, r: old.r })
        } else if (payload.new) {
          upsertRow('hexes', payload.new)
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'regions', filter }, (payload) => {
        if (payload.eventType === 'DELETE') removeRow('regions', payload.old)
        else if (payload.new) upsertRow('regions', payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'items', filter }, (payload) => {
        if (payload.eventType === 'DELETE') removeRow('items', payload.old)
        else if (payload.new) upsertRow('items', payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rumors', filter }, (payload) => {
        if (payload.eventType === 'DELETE') removeRow('rumors', payload.old)
        else if (payload.new) upsertRow('rumors', payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quests', filter }, (payload) => {
        if (payload.eventType === 'DELETE') removeRow('quests', payload.old)
        else if (payload.new) upsertRow('quests', payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'journal_entries', filter }, (payload) => {
        if (payload.eventType === 'DELETE') removeRow('journal', payload.old)
        else if (payload.new) upsertRow('journal', payload.new)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaign_members', filter }, (payload) => {
        if (payload.eventType === 'DELETE') removeRow('members', payload.old)
        else if (payload.new) upsertRow('members', payload.new)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [campaignId, upsertRow, removeRow, setCampaignRow])
}
