export default async function handler(req, res) {
  // Solo permitimos peticiones POST (que es como envía datos Hotmart)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método no permitido' });
  }

  try {
    const body = req.body || {};
    
    // Verificación de seguridad con el HOTTOK de las variables de entorno
    const hottokEnviado = req.headers['x-hotmart-hottok'] || body.hottok;
    const hottokEsperado = process.env.HOTMART_HOTTOK;

    if (hottokEsperado && hottokEnviado !== hottokEsperado) {
      console.warn('⚠️ Intento de Webhook no autorizado: Hottok inválido');
      return res.status(401).json({ message: 'No autorizado' });
    }

    // Extraemos los datos del evento que envía Hotmart
    const event = body.event || body.event_type;
    const data = body.data || body;

    console.log(`✅ Webhook de Hotmart recibido. Evento: ${event}`);

    // Responder con 200 OK a Hotmart inmediatamente
    return res.status(200).json({ 
      success: true, 
      message: 'Webhook recibido correctamente' 
    });

  } catch (error) {
    console.error('❌ Error procesando el webhook de Hotmart:', error);
    return res.status(500).json({ message: 'Error interno del servidor' });
  }
}