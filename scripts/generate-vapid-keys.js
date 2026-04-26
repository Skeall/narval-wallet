// Script one-shot pour générer les clés VAPID nécessaires aux push notifications
// Usage: node scripts/generate-vapid-keys.js
// debug: copie les valeurs dans ton .env.local

const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n🔑 Clés VAPID générées avec succès !\n');
console.log('Ajoute ces lignes dans ton fichier .env.local :\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_EMAIL=mailto:narval@narval.app`);
console.log('\n⚠️  La clé privée ne doit JAMAIS être exposée côté client.');
console.log('⚠️  NEXT_PUBLIC_VAPID_PUBLIC_KEY est volontairement publique (nécessaire côté client).\n');
