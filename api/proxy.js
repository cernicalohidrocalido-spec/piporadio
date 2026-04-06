// PipoRadio CORS Proxy — Vercel Serverless Function

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const service = req.query.service || 'udio';
  const path    = decodeURIComponent(req.query.path || '');
  const targetUrl = service === 'anthropic'
    ? `https://api.anthropic.com${path}`
    : `https://udioapi.pro${path}`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization)       headers['Authorization']       = req.headers.authorization;
    if (req.headers['x-api-key'])        headers['x-api-key']           = req.headers['x-api-key'];
    if (req.headers['anthropic-version'])headers['anthropic-version']   = req.headers['anthropic-version'];

    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
    });

    const data = await upstream.text();
    res.status(upstream.status)
       .setHeader('Content-Type', 'application/json')
       .setHeader('Access-Control-Allow-Origin', '*')
       .send(data);
  } catch (err) {
    res.status(500).setHeader('Access-Control-Allow-Origin', '*').json({ error: err.message });
  }
}
