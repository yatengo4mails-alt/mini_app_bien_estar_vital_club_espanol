// Guardar como: lib/subs.js  (fuera de la carpeta api/, para que Vercel no lo trate como endpoint)
const DAY = 86400000;
const OFFERS = { w8xn1xdb: 'monthly', ms24zitl: 'annual' }; // códigos de oferta de tus checkouts

// Convierte un evento de Hotmart en la fila a guardar (o null si no aplica).
export function rowFromEvent(body) {
  const ev = body && body.event;
  const d = (body && body.data) || {};
  const email = String((d.buyer && d.buyer.email) || '').trim().toLowerCase();
  if (!ev || !email) return null;

  const now = Date.now();
  const offer = d.purchase && d.purchase.offer && d.purchase.offer.code;
  const plan = OFFERS[offer] || null;
  const row = {
    email,
    last_event: ev,
    last_transaction: (d.purchase && d.purchase.transaction) || null,
    subscriber_code: (d.subscription && d.subscription.subscriber && d.subscription.subscriber.code) || null,
    updated_at: new Date(now).toISOString()
  };
  if (plan) row.plan = plan;

  if (ev === 'PURCHASE_APPROVED') {
    let next = Number(d.purchase && d.purchase.date_next_charge) || 0;
    if (next && next < 1e12) next *= 1000;                       // segundos a milisegundos
    const base = next > now ? next : now + (plan === 'annual' ? 365 : 31) * DAY;
    row.active_until = new Date(base + 3 * DAY).toISOString();   // +3 días de gracia
    row.status = 'active';
  } else if (ev === 'PURCHASE_REFUNDED' || ev === 'PURCHASE_CHARGEBACK') {
    row.active_until = new Date(now).toISOString();              // se bloquea de inmediato
    row.status = 'refunded';
  } else if (ev === 'SUBSCRIPTION_CANCELLATION') {
    row.status = 'cancelled';                                    // conserva el acceso hasta active_until (ya lo pagó)
  } else if (ev === 'PURCHASE_DELAYED') {
    row.status = 'past_due';                                     // no se extiende: si no paga, vence solo
  } else {
    return null;
  }
  return row;
}

// Guarda o actualiza la fila en Supabase (solo desde el servidor).
export async function saveRow(row) {
  const r = await fetch(process.env.SUPABASE_URL + '/rest/v1/subscribers?on_conflict=email', {
    method: 'POST',
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(row)
  });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
}
