import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GiftCard = {
  id: string;
  final_code: string;
  tier?: string | null;
  year?: number | null;
  batch?: string | null;
  card_value?: number | null;
  status?: string | null;
  date_generated?: string | null;
  expires_at?: string | null;
  allowed_service_ids?: string[] | null;
  allowed_service_categories?: string[] | null;
  created_by?: string | null;
  created_at?: string | null;
  redeemed_at?: string | null;
  redeemed_by?: string | null;
};

export type GiftCardFetchOptions = {
  status?: string;
  tier?: string;
  year?: number;
  limit?: number;
  offset?: number;
  orderBy?: { column: string; ascending?: boolean };
};

/**
 * Fetch gift cards with optional filters. Returns { data, error } where data is GiftCard[]
 * Note: we cast supabase to any for the new tables/RPCs until the typed client is regenerated.
 */
export async function fetchGiftCards(opts: GiftCardFetchOptions = {}) {
  const { status, tier, year, limit = 100, offset = 0, orderBy } = opts;
  try {
    let q: any = (supabase as any).from("gift_cards").select("*");
    if (status && status !== "all") q = q.eq("status", status);
    if (tier) q = q.eq("tier", tier);
    if (year) q = q.eq("year", year);
    if (orderBy) q = q.order(orderBy.column, { ascending: !!orderBy.ascending });
    q = q.range(offset, offset + Math.max(0, limit - 1));
    const { data, error } = await q;
    if (error) throw error;
    return { data: (data as GiftCard[]) || [], error: null };
  } catch (error: any) {
    return { data: [] as GiftCard[], error };
  }
}

/**
 * Import gift cards via the RPC. Accepts an array of objects matching the RPC expectations.
 * Returns { data, error } where data is the RPC result (array of rows with status per row).
 */
export async function importGiftCards(rows: Record<string, any>[]) {
  try {
    const { data, error } = await supabase    //@ts-ignore
      .from('gift_cards')    //@ts-ignore
      .insert(rows);

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

/**
 * Redeem a gift card via RPC. Returns { data, error }. data is the rpc_redeem_gift_card return table.
 */
export async function redeemGiftCard(...args: any[]) {
  try {
    // Support either positional args or a single named-object param.
    // Positional: (code, bookingId, clientId, staffId, serviceIds)
    // Named: { code, booking_id, client_id, staff_id, service_ids }
    let code: string | undefined;
    let bookingId: string | null = null;
    let clientId: string | null = null;
    let staffId: string | null = null;
    let serviceIds: string[] | null = null;

    if (args.length === 1 && typeof args[0] === "object" && args[0] !== null) {
      const p = args[0];
      code = p.code ?? p.p_code ?? p.pCode;
      bookingId = p.booking_id ?? p.bookingId ?? p.p_booking_id ?? null;
      clientId = p.client_id ?? p.clientId ?? p.p_client_id ?? null;
      staffId = p.staff_id ?? p.staffId ?? p.p_staff_id ?? null;
      serviceIds = p.service_ids ?? p.serviceIds ?? p.p_service_ids ?? null;
    } else {
      code = args[0];
      bookingId = args[1] ?? null;
      clientId = args[2] ?? null;
      staffId = args[3] ?? null;
      serviceIds = args[4] ?? null;
    }

    if (!code) throw new Error("code is required");

  // Use positional args array to avoid PostgREST named-object key mismatches across migration versions.
  // Order: p_code, p_booking_id, p_client_id, p_staff_id, p_service_ids
  const rpcArgs: any[] = [code, bookingId, clientId, staffId ?? null, serviceIds ?? null];

  const { data, error } = await (supabase as any).rpc("rpc_redeem_gift_card", rpcArgs as any);
    if (error) throw error;
    return { data: data || [], error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

/**
 * Validate a gift card code using the defensive RPC. Returns { data, error } where data is the rpc_validate_gift_card return table
 */
export async function validateGiftCard(code: string) {
  try {
    if (!code) return { data: null, error: new Error("code required") };
  // Use positional args for validate RPC to avoid object-key mismatches: (p_code, p_service_id)
  const { data, error } = await (supabase as any).rpc("rpc_validate_gift_card", [code] as any);
    if (error) throw error;
    // rpc_validate_gift_card returns TABLE(valid boolean, message text, gift_card jsonb)
    const row = Array.isArray(data) ? data[0] : data;
    return { data: row || null, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Check which of the provided codes already exist in DB. Returns array of existing final_code strings.
 */
export async function checkExistingGiftCards(codes: string[]) {
  try {
    if (!codes || codes.length === 0) return { data: [] as string[], error: null };
    const { data, error } = await (supabase as any)
      .from('gift_cards')
      .select('final_code')
      .in('final_code', codes);
    if (error) throw error;
    return { data: (data || []).map((r: any) => r.final_code as string), error: null };
  } catch (error: any) {
    return { data: [] as string[], error };
  }
}

export async function voidGiftCard(id: string) {
  try {
    // call RPC which handles auth and audit
    const { data, error } = await (supabase as any).rpc('rpc_void_gift_card', [id, 'Voided by admin']);
    if (error) throw error;
    // rpc returns table rows; consider success when first row.success is true
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.success) return { success: true, data: row };
    return { success: false, data: row };
  } catch (error: any) {
    return { success: false, error };
  }
}

export async function expireGiftCard(id: string) {
  try {
    const { data, error } = await (supabase as any).rpc('rpc_expire_gift_card', [id, 'Expired by admin']);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.success) return { success: true, data: row };
    return { success: false, data: row };
  } catch (error: any) {
    return { success: false, error };
  }
}

export async function deleteGiftCard(id: string) {
  try {
    const { data, error } = await (supabase as any).rpc('rpc_delete_gift_card', [id]);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.success) return { success: true, data: row };
    return { success: false, data: row };
  } catch (error: any) {
    return { success: false, error };
  }
}

/**
 * Lookup a gift card by its code (case-insensitive). Returns single GiftCard or null.
 */
export async function getGiftCardByCode(code: string) {
  if (!code) return { data: null as GiftCard | null, error: new Error("code required") };
  try {
    // normalize code matching by upper-case final_code
    const { data, error } = await (supabase as any)
      .from("gift_cards")
      .select("*")
      .ilike("final_code", code)
      .limit(1)
      .single();
    if (error) {
      // If not found, Supabase returns 406 or 404 depending on settings; handle gracefully
      if ((error.status === 406 || error.status === 404) && !data) return { data: null, error: null };
      throw error;
    }
    return { data: data as GiftCard, error: null };
  } catch (err: any) {
    return { data: null as GiftCard | null, error: err };
  }
}

/**
 * React hook wrapping fetchGiftCards for simple admin lists. Supports basic filters and refresh.
 */
export function useGiftCards(initialOpts: GiftCardFetchOptions = {}) {
  const [opts, setOpts] = useState<GiftCardFetchOptions>(initialOpts);
  const [items, setItems] = useState<GiftCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const load = useCallback(async (override?: GiftCardFetchOptions) => {
    setLoading(true);
    setError(null);
    const merged = { ...opts, ...(override || {}) };
    try {
      const res = await fetchGiftCards(merged);
      if (res.error) throw res.error;
      setItems(res.data || []);
    } catch (err: any) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [opts]);

  useEffect(() => {
    void load();
  }, [opts, load]);

  return {
    items,
    loading,
    error,
    refresh: () => load(),
    setFilters: (next: GiftCardFetchOptions) => setOpts((s) => ({ ...s, ...next })),
  } as const;
}

export default useGiftCards;
