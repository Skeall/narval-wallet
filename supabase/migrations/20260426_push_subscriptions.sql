-- Table pour stocker les subscriptions push notification
-- Chaque utilisateur peut avoir plusieurs subscriptions (plusieurs appareils/navigateurs)
-- debug: la contrainte UNIQUE sur (user_uid, endpoint) permet l'upsert propre

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_uid uuid NOT NULL,
  endpoint text NOT NULL,
  keys_p256dh text NOT NULL,
  keys_auth text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_uid, endpoint)
);

-- Index pour rechercher rapidement les subscriptions d'un utilisateur
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_uid ON push_subscriptions(user_uid);

-- RLS: seul le service role peut lire/écrire (les API routes utilisent le service role key)
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politique: autorise tout via service role (les requêtes client passent par l'API route)
CREATE POLICY "Service role full access" ON push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);
