// Guardar como: api/hotmart.js  (reemplaza al actual)
import { timingSafeEqual } from 'node:crypto';
import { rowFromEvent, saveRow } from '../lib/subs.js';

// Compara el token de forma segura (sin filtrar información por tiempo de respuesta)
function sameToken(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
}

export default async function handler(req, res) {
  // Solo permitimos peticiones POST (que es como envía datos Hotmart)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  // Sin HOTTOK configurado NO se acepta nada: así nadie puede inventar pagos
  const hottokEsperado = process.env.HOTMART_HOTTOK;
  if (!hottokEsperado) {
    console.error('❌ Falta la variable HOTMART_HOTTOK en Vercel');
    return res.status(500).json({ message: 'Servidor sin configurar' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ message: 'JSON inválido' }); }
    }

    // Verificación de seguridad con el HOTTOK
    const hottokEnviado = req.headers['x-hotmart-hottok'] || body.hottok;
    if (!sameToken(hottokEnviado, hottokEsperado)) {
      console.warn('⚠️ Intento de Webhook no autorizado: Hottok inválido');
      return res.status(401).json({ message: 'No autorizado' });
    }

    const event = body.event || body.event_type;
    console.log(`✅ Webhook de Hotmart recibido. Evento: ${event}`);

    // Actualiza la suscripción en Supabase (vigencia hasta la próxima fecha de pago)
    const row = rowFromEvent(body);
    if (row) {
      await saveRow(row);
      console.log(`💾 Suscripción actualizada: ${row.status} (${row.plan || 'sin plan'})`);
    }

    return res.status(200).json({ success: true, message: 'Webhook recibido correctamente' });
  } catch (error) {
    // 500: Hotmart verá el error en su historial y podrá reenviar el evento
    console.error('❌ Error procesando el webhook de Hotmart:', error.message);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}
