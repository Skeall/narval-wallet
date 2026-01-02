import { supabase } from "@/utils/supabaseClient";

// debug: create a pending reward (to be opened manually later)
export async function createPendingReward(userId: string, amount: number) {
  await supabase.from('xp_rewards').insert({ user_id: userId, amount, status: 'pending', created_at: new Date().toISOString() });
}

export async function getPendingRewardsCount(userId: string): Promise<number> {
  try {
    const { data } = await supabase.from('xp_rewards').select('id').eq('user_id', userId).eq('status', 'pending');
    return (data || []).length;
  } catch {
    return 0;
  }
}

// debug: claim the oldest pending reward -> credit wallet + log transaction
export async function claimNextReward(userId: string): Promise<{ amount: number } | null> {
  try {
    const { data: rows } = await supabase
      .from('xp_rewards')
      .select('id,amount')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);
    const row = rows && rows[0];
    if (!row) return null;
    const amount = Number(row.amount || 0);
    // credit wallet
    const { data: uRow } = await supabase.from('users').select('solde').eq('uid', userId).single();
    const current = Number(uRow?.solde || 0);
    await supabase.from('users').update({ solde: current + amount }).eq('uid', userId);
    await supabase.from('transactions').insert({
      type: 'xp_reward',
      from: null,
      to: userId,
      montant: amount,
      description: `Cadeau XP (+${amount})`,
      date: new Date().toISOString(),
    });
    await supabase.from('xp_rewards').update({ status: 'claimed', claimed_at: new Date().toISOString() }).eq('id', row.id);
    return { amount };
  } catch (e) {
    console.debug('[XP][reward][claim] error', e);
    return null;
  }
}

// legacy helper kept for compatibility (creates immediate credit); unused in new flow
export async function grantXpReward(userId: string): Promise<{ amount: number }> {
  const res = await claimNextReward(userId);
  return { amount: res?.amount || 0 };
}
