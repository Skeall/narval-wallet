import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// debug: API route to save push subscription to Supabase
// Uses service role key for server-side operations (not exposed to client)

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  console.debug('[API][Push][Subscribe] Received subscription request');

  try {
    const body = await request.json();
    const { user_uid, subscription } = body;

    // Validation
    if (!user_uid || !subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      console.debug('[API][Push][Subscribe] Invalid payload:', { user_uid: !!user_uid, endpoint: !!subscription?.endpoint });
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // debug: check env vars
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[API][Push][Subscribe] Missing Supabase env vars');
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    // Utilise le service role key pour l'accès server-side
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert: si l'endpoint existe déjà pour cet user, on update
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          user_uid,
          endpoint: subscription.endpoint,
          keys_p256dh: subscription.keys.p256dh,
          keys_auth: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_uid,endpoint' }
      );

    if (error) {
      console.error('[API][Push][Subscribe] Supabase upsert error:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.debug('[API][Push][Subscribe] Subscription saved for user:', user_uid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API][Push][Subscribe] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
