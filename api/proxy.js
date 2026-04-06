export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,xi-api-key,anthropic-version,anthropic-dangerous-direct-browser-access');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { service = 'udio', path = '' } = req.query;

  const BASES = {
    udio:       'https://udioapi.pro',
    anthropic:  'https://api.anthropic.com',
    elevenlabs: 'https://api.elevenlabs.io',
  };

  const base = BASES[service];
  if (!base) return res.status(400).json({ error: 'Unknown service: ' + service });

  const targetUrl = base + path;
  console.log(`[proxy] ${req.method} ${service} → ${targetUrl}`);

  const headers = { 'Content-Type': 'application/json' };
  const h = req.headers;
  if (h['authorization'])       headers['Authorization']     = h['authorization'];
  if (h['x-api-key'])           headers['x-api-key']         = h['x-api-key'];
  if (h['xi-api-key'])          headers['xi-api-key']        = h['xi-api-key'];
  if (h['anthropic-version'])   headers['anthropic-version'] = h['anthropic-version'];
  if (h['anthropic-dangerous-direct-browser-access'])
    headers['anthropic-dangerous-direct-browser-access'] = h['anthropic-dangerous-direct-browser-access'];

  try {
    const upstream = await fetch(targetUrl, {
      method:  req.method,
      headers,
      body: ['GET','HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
    });

    const text = await upstream.text();
    const ct   = upstream.headers.get('content-type') || 'application/json';
    res.status(upstream.status).setHeader('Content-Type', ct).send(text);

  } catch (err) {
    console.error('[proxy] error:', err.message);
    res.status(502).json({ error: err.message });
  }
}
