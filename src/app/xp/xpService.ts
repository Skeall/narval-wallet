"use client";
import { supabase } from "@/utils/supabaseClient";
import { XP_VALUES, XP_THRESHOLD, XpEventType, XpStateRow } from "./xpRules";
import { createPendingReward } from "./rewardService";

const toDayStr = (d: Date = new Date()) => d.toISOString().slice(0, 10);

async function ensureState(userId: string): Promise<XpStateRow> {
  const { data: row } = await supabase
    .from("user_xp_state")
    .select("user_id,xp,last_daily_xp_at,last_login_xp_at")
    .eq("user_id", userId)
    .single();
  if (row) return row as XpStateRow;
  const init: XpStateRow = { user_id: userId, xp: 0, last_daily_xp_at: null, last_login_xp_at: null };
  await supabase.from("user_xp_state").upsert(init, { onConflict: "user_id" });
  return init;
}

export async function getUserXpState(userId: string): Promise<XpStateRow | null> {
  try {
    return await ensureState(userId);
  } catch {
    return null;
  }
}

async function logEvent(userId: string, type: XpEventType, value: number, metadata: any = {}) {
  await supabase.from("xp_events").insert({ user_id: userId, type, value, metadata, created_at: new Date().toISOString() });
}

export async function grantXp(
  userId: string,
  type: Exclude<XpEventType, "REWARD_GRANTED">,
  value: number,
  metadata: any = {},
  dedupeKey?: string
): Promise<XpStateRow> {
  const st = await ensureState(userId);
  if (dedupeKey) {
    const { data: exists } = await supabase
      .from("xp_events")
      .select("id")
      .eq("user_id", userId)
      .eq("type", type)
      .contains("metadata", { dedupe: dedupeKey })
      .limit(1);
    if (exists && exists.length > 0) {
      return st;
    }
    metadata = { ...metadata, dedupe: dedupeKey };
  }
  const nextXp = (st.xp || 0) + value;
  await supabase.from("user_xp_state").upsert({ user_id: userId, xp: nextXp }, { onConflict: "user_id" });
  await logEvent(userId, type, value, metadata);
  const updated: XpStateRow = { ...st, xp: nextXp };
  await checkAndGrantRewards(userId, updated);
  return (await ensureState(userId));
}

export async function applyDailyPassiveXp(userId: string): Promise<XpStateRow> {
  const st = await ensureState(userId);
  const today = toDayStr();
  const last = st.last_daily_xp_at ? st.last_daily_xp_at.slice(0, 10) : null;
  if (last === today) return st;
  // number of days to grant: from (last+1) to today inclusive; if last null -> 1 (today)
  let startDate = new Date();
  if (last) {
    const [y, m, d] = last.split("-").map(Number);
    startDate = new Date(y, (m || 1) - 1, (d || 1) + 1);
  }
  const endDate = new Date();
  const days = Math.max(1, Math.floor((endDate.setHours(0,0,0,0) as any) / 86400000) - Math.floor((startDate.setHours(0,0,0,0) as any) / 86400000) + 1);
  const total = days * XP_VALUES.DAILY_PASSIVE;
  const nextXp = (st.xp || 0) + total;
  await supabase.from("user_xp_state").upsert({ user_id: userId, xp: nextXp, last_daily_xp_at: today }, { onConflict: "user_id" });
  await logEvent(userId, "DAILY_PASSIVE", total, { days, from: toDayStr(new Date(startDate)), to: today });
  const updated: XpStateRow = { ...st, xp: nextXp, last_daily_xp_at: today };
  await checkAndGrantRewards(userId, updated);
  return (await ensureState(userId));
}

export async function applyLoginXp(userId: string): Promise<XpStateRow> {
  const st = await ensureState(userId);
  const today = toDayStr();
  const last = st.last_login_xp_at ? st.last_login_xp_at.slice(0, 10) : null;
  if (last === today) return st;
  const inc = XP_VALUES.LOGIN;
  const nextXp = (st.xp || 0) + inc;
  await supabase
    .from("user_xp_state")
    .upsert({ user_id: userId, xp: nextXp, last_login_xp_at: today }, { onConflict: "user_id" });
  await logEvent(userId, "LOGIN", inc, {});
  const updated: XpStateRow = { ...st, xp: nextXp, last_login_xp_at: today };
  await checkAndGrantRewards(userId, updated);
  return (await ensureState(userId));
}

export async function checkAndGrantRewards(userId: string, stateIn?: XpStateRow) {
  let st = stateIn || await ensureState(userId);
  let changed = false;
  while ((st.xp || 0) >= XP_THRESHOLD) {
    st.xp = (st.xp || 0) - XP_THRESHOLD;
    await supabase.from("user_xp_state").upsert({ user_id: userId, xp: st.xp }, { onConflict: "user_id" });
    const amount = 1 + Math.floor(Math.random() * 3);
    await createPendingReward(userId, amount);
    await logEvent(userId, "REWARD_GRANTED", 0, { amount, status: 'pending' });
    changed = true;
  }
  if (changed) {
    st = await ensureState(userId);
  }
  return st;
}
