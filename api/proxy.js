// PipoRadio CORS Proxy — Vercel Serverless Function
// Forwards requests to udioapi.pro and Anthropic without CORS issues

export default async function handler(req, res) {
  // CORS headers — allow from anywhere
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get target service from query param: ?service=udio or ?service=anthropic
  const service = req.query.service || 'udio';
  const path    = req.query.path   || '';

  let targetUrl;
  if (service === 'anthropic') {
    targetUrl = `https://api.anthropic.com${path}`;
  } else {
    // udioapi.pro by default
    targetUrl = `https://udioapi.pro${path}`;
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
    };

    // Forward auth headers
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    if (req.headers['x-api-key']) {
      headers['x-api-key'] = req.headers['x-api-key'];
    }
    if (req.headers['anthropic-version']) {
      headers['anthropic-version'] = req.headers['anthropic-version'];
    }

    const fetchOpts = {
      method: req.method,
      headers,
    };

    if (req.method !== 'GET' && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOpts);
    const data = await upstream.text();

    res.status(upstream.status)
       .setHeader('Content-Type', 'application/json')
       .send(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
