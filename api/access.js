// Guardar como: api/access.js  (reemplaza al actual)
// Responde si un correo tiene suscripción vigente y, si la tiene, entrega una credencial para usar a Carmen.
import { signToken, tokenConfigured } from '../lib/token.js';
import { hit, clientIp } from '../lib/limit.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  // Frena intentos masivos de adivinar correos
  if (!hit('access:' + clientIp(req), 30, 10 * 60 * 1000)) return res.status(429).json({ error: 'Demasiados intentos' });

  const email = String(req.query.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return res.status(400).json({ active: false });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !tokenConfigured()) return res.status(500).json({ error: 'Faltan variables de entorno' });

  try {
    const r = await fetch(url + '/rest/v1/subscribers?select=active_until&email=eq.' + encodeURIComponent(email), {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('Supabase ' + r.status);
    const rows = await r.json();
    const until = rows[0] ? Date.parse(rows[0].active_until) : 0;
    if (!(until > Date.now())) return res.status(200).json({ active: false });
    return res.status(200).json({ active: true, token: signToken(email) });
  } catch (e) {
    console.error('[access]', e.message);
    return res.status(500).json({ error: 'No se pudo verificar' });
  }
}
