import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

// debug: API route to send push notifications to a specific user
// Fetches all subscriptions for the target user and sends to each

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:narval@narval.app';

// Configure web-push avec les clés VAPID
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
  console.debug('[API][Push][Send] VAPID configured');
} else {
  console.error('[API][Push][Send] Missing VAPID keys in env');
}

export async function POST(request: NextRequest) {
  console.debug('[API][Push][Send] Received send request');

  try {
    const body = await request.json();
    const { target_user_uid, title, body: notifBody, url, tag } = body;

    // Validation
    if (!target_user_uid || !title) {
      console.debug('[API][Push][Send] Missing target_user_uid or title');
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[API][Push][Send] Missing Supabase env vars');
      return NextResponse.json({ success: false, error: 'Server misconfigured' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Récupère toutes les subscriptions de l'utilisateur cible
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_uid', target_user_uid);

    if (fetchError) {
      console.error('[API][Push][Send] Fetch subscriptions error:', fetchError.message);
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.debug('[API][Push][Send] No subscriptions found for user:', target_user_uid);
      return NextResponse.json({ success: true, sent: 0, message: 'No subscriptions' });
    }

    console.debug('[API][Push][Send] Found', subscriptions.length, 'subscription(s) for user:', target_user_uid);

    // Payload de la notification
    const payload = JSON.stringify({
      title,
      body: notifBody || '',
      url: url || '/',
      tag: tag || 'narval-notification',
      type: tag || 'generic',
    });

    // Envoie à chaque subscription
    let sent = 0;
    let failed = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
        console.debug('[API][Push][Send] Sent to endpoint:', sub.endpoint.slice(0, 60));
      } catch (error: any) {
        failed++;
        console.error('[API][Push][Send] Send failed for endpoint:', sub.endpoint.slice(0, 60), error?.statusCode);

        // Si la subscription est expirée (410 Gone) ou invalide (404), on la supprime
        if (error?.statusCode === 410 || error?.statusCode === 404) {
          expiredEndpoints.push(sub.endpoint);
          console.debug('[API][Push][Send] Marking expired subscription for cleanup');
        }
      }
    }

    // Nettoyage des subscriptions expirées
    if (expiredEndpoints.length > 0) {
      console.debug('[API][Push][Send] Cleaning up', expiredEndpoints.length, 'expired subscription(s)');
      for (const endpoint of expiredEndpoints) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', endpoint)
          .eq('user_uid', target_user_uid);
      }
    }

    console.debug('[API][Push][Send] Results: sent=', sent, 'failed=', failed);
    return NextResponse.json({ success: true, sent, failed });
  } catch (error) {
    console.error('[API][Push][Send] Unexpected error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
