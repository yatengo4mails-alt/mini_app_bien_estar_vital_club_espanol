// Guardar como: api/access.js
// Responde si un correo tiene suscripción vigente. La tabla queda privada: solo este servidor la lee.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.query.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) return res.status(400).json({ active: false });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ error: 'Faltan variables de entorno' });

  try {
    const r = await fetch(url + '/rest/v1/subscribers?select=active_until&email=eq.' + encodeURIComponent(email), {
      headers: { apikey: key, Authorization: 'Bearer ' + key }
    });
    if (!r.ok) throw new Error('Supabase ' + r.status);
    const rows = await r.json();
    const until = rows[0] ? Date.parse(rows[0].active_until) : 0;
    return res.status(200).json({ active: until > Date.now() });
  } catch (e) {
    console.error('[access]', e.message);
    return res.status(500).json({ error: 'No se pudo verificar' });
  }
}
