module.exports = async function handler(req, res) {
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

  const headers = { 'Content-Type': 'application/json' };
  const h = req.headers;
  if (h['authorization'])     headers['Authorization']     = h['authorization'];
  if (h['x-api-key'])         headers['x-api-key']         = h['x-api-key'];
  if (h['xi-api-key'])        headers['xi-api-key']        = h['xi-api-key'];
  if (h['anthropic-version']) headers['anthropic-version'] = h['anthropic-version'];
  if (h['anthropic-dangerous-direct-browser-access'])
    headers['anthropic-dangerous-direct-browser-access'] = h['anthropic-dangerous-direct-browser-access'];

  try {
    const https = require('https');
    const http  = require('http');
    const url   = require('url');
    const parsed = url.parse(targetUrl);
    const lib   = parsed.protocol === 'https:' ? https : http;

    const bodyStr = ['GET','HEAD'].includes(req.method)
      ? null
      : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    await new Promise((resolve, reject) => {
      const options = {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.path,
        method:   req.method,
        headers,
      };

      const upstream = lib.request(options, (uRes) => {
        let data = '';
        uRes.on('data', chunk => data += chunk);
        uRes.on('end', () => {
          res.status(uRes.statusCode)
             .setHeader('Content-Type', uRes.headers['content-type'] || 'application/json')
             .send(data);
          resolve();
        });
      });

      upstream.on('error', (e) => {
        res.status(502).json({ error: e.message });
        resolve();
      });

      if (bodyStr) upstream.write(bodyStr);
      upstream.end();
    });

  } catch (err) {
    res.status(502).json({ error: err.message });
  }
};
