const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.8-flash,gemini-3.7-flash,gemini-3.5-flash-lite')
  .split(',').map(s => s.trim()).filter(Boolean);
const RETRY_WITH_NEXT_MODEL = [404, 429, 500, 503, 504];
const TOTAL_BUDGET_MS = 27000; // Vercel corta a los 30 s

async function callGemini(model, apiKey, prompt, timeoutMs) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(timeoutMs)
    }
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'JSON inválido en el cuerpo de la petición' });
    }
  }

  const prompt = body && body.prompt;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Falta el campo "prompt" (string)' });
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  let lastStatus = 502;
  let lastData = { error: 'Sin respuesta de Gemini' };

  for (const model of MODELS) {
    const remaining = deadline - Date.now();
    if (remaining < 3000) break; // no alcanza el tiempo para otro intento

    try {
      const response = await callGemini(model, apiKey, prompt, Math.min(14000, remaining));
      const data = await response.json();

      if (response.ok) {
        res.setHeader('x-model-used', model);
        return res.status(200).json(data);
      }

      console.error(`[chat] ${model} -> HTTP ${response.status}`, JSON.stringify(data).slice(0, 300));
      lastStatus = response.status;
      lastData = data;
      if (!RETRY_WITH_NEXT_MODEL.includes(response.status)) break; // 400/401/403: otro modelo no ayudaría
    } catch (error) {
      console.error(`[chat] ${model} falló:`, error.name, error.message);
      lastStatus = 504;
      lastData = { error: `Tiempo de espera o error de red con ${model}` };
    }
  }

  return res.status(lastStatus).json(lastData);
}