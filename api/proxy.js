const https = require('https');
const http = require('http');
const url = require('url');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key,xi-api-key,anthropic-version,anthropic-dangerous-direct-browser-access');

  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return; }

  const service = req.query ? req.query.service : (new url.URL('http://x' + req.url)).searchParams.get('service');
  const path    = req.query ? req.query.path    : (new url.URL('http://x' + req.url)).searchParams.get('path');

  const BASES = { udio:'https://udioapi.pro', anthropic:'https://api.anthropic.com', elevenlabs:'https://api.elevenlabs.io' };
  const base = BASES[service || 'udio'];
  if (!base) { res.statusCode = 400; res.end(JSON.stringify({error:'Unknown service'})); return; }

  const targetUrl = base + (path || '');
  const parsed    = url.parse(targetUrl);
  const lib       = parsed.protocol === 'https:' ? https : http;

  const reqHeaders = { 'content-type': 'application/json' };
  const h = req.headers || {};
  if (h['authorization'])     reqHeaders['authorization']     = h['authorization'];
  if (h['x-api-key'])         reqHeaders['x-api-key']         = h['x-api-key'];
  if (h['xi-api-key'])        reqHeaders['xi-api-key']        = h['xi-api-key'];
  if (h['anthropic-version']) reqHeaders['anthropic-version'] = h['anthropic-version'];
  if (h['anthropic-dangerous-direct-browser-access'])
    reqHeaders['anthropic-dangerous-direct-browser-access'] = h['anthropic-dangerous-direct-browser-access'];

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    if (body) reqHeaders['content-length'] = Buffer.byteLength(body);

    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path:     parsed.path,
      method:   req.method,
      headers:  reqHeaders,
    };

    const upstream = lib.request(opts, uRes => {
      res.statusCode = uRes.statusCode;
      res.setHeader('content-type', uRes.headers['content-type'] || 'application/json');
      uRes.pipe(res);
    });
    upstream.on('error', e => { res.statusCode = 502; res.end(JSON.stringify({error: e.message})); });
    if (body) upstream.write(body);
    upstream.end();
  });
};
