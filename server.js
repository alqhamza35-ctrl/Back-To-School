// Back to School — local dev server + AI proxy (Node built-ins only, no npm install).
//   node server.js            →  http://localhost:8123
// Serves the flat root folder and exposes /api/gemini so the browser never holds a key.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 8123;
const KEY_FILE = path.join(ROOT, 'gemini-key.json');
const MAX_BODY = 64 * 1024;
const UPSTREAM_TIMEOUT = 30000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.md': 'text/markdown; charset=utf-8'
};

// Overridden by gemini-key.json -> { "model": "..." }. Chosen here, never by the browser.
// Pinned: the rolling 'gemini-flash-latest' answers tool requests with 503 right now.
const DEFAULT_MODEL = 'gemini-3.6-flash';

// Both of these speak function-calling and sit on a separate free-tier quota.
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

function readKey() {
    try {
        if (fs.existsSync(KEY_FILE)) {
            const raw = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
            if (raw && typeof raw.key === 'string' && raw.key.trim()) {
                return { key: raw.key.trim(), model: String(raw.model || DEFAULT_MODEL) };
            }
        }
    } catch (e) {
        console.warn('gemini-key.json unreadable:', e.message);
    }
    const env = (process.env.GEMINI_API_KEY || '').trim();
    return env ? { key: env, model: DEFAULT_MODEL } : null;
}

function send(res, code, type, body) {
    res.writeHead(code, {
        'Content-Type': type,
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function sendJson(res, code, obj) {
    send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj));
}

function readBody(req, cb) {
    let size = 0;
    const chunks = [];
    req.on('data', function (c) {
        size += c.length;
        if (size > MAX_BODY) {
            req.destroy();
            cb(new Error('too_large'));
            return;
        }
        chunks.push(c);
    });
    req.on('end', function () { cb(null, Buffer.concat(chunks).toString('utf8')); });
    req.on('error', cb);
}

function sanitizeContents(v) {
    if (!Array.isArray(v)) return null;
    const out = [];
    v.slice(0, 24).forEach(function (c) {
        if (!c || !Array.isArray(c.parts)) return;
        const role = c.role === 'model' ? 'model' : 'user';
        const parts = [];
        c.parts.slice(0, 12).forEach(function (p) {
            if (!p) return;
            if (typeof p.text === 'string') {
                parts.push({ text: p.text.slice(0, 6000) });
            } else if (p.functionCall && typeof p.functionCall.name === 'string') {
                const part = {
                    functionCall: {
                        name: String(p.functionCall.name).replace(/[^a-z_]/g, '').slice(0, 64),
                        args: (p.functionCall.args && typeof p.functionCall.args === 'object') ? p.functionCall.args : {}
                    }
                };
                // Gemini 3.x rejects the follow-up turn unless this opaque signature is echoed back.
                if (typeof p.thoughtSignature === 'string') part.thoughtSignature = p.thoughtSignature.slice(0, 40000);
                parts.push(part);
            } else if (p.functionResponse && typeof p.functionResponse.name === 'string') {
                parts.push({
                    functionResponse: {
                        name: String(p.functionResponse.name).replace(/[^a-z_]/g, '').slice(0, 64),
                        response: (p.functionResponse.response && typeof p.functionResponse.response === 'object') ? p.functionResponse.response : {}
                    }
                });
            }
        });
        if (parts.length) out.push({ role: role, parts: parts });
    });
    return out.length ? out : null;
}

function proxyGemini(req, res) {
    const cred = readKey();
    if (!cred) return sendJson(res, 501, { ok: false, error: 'no_key' });

    readBody(req, function (err, body) {
        if (err) return sendJson(res, 413, { ok: false, error: 'too_large' });
        let payload;
        try { payload = JSON.parse(body || '{}'); } catch (e) {
            return sendJson(res, 400, { ok: false, error: 'bad_json' });
        }
        const prompt = typeof payload.prompt === 'string' ? payload.prompt.slice(0, 8000) : '';
        const system = typeof payload.system === 'string' ? payload.system.slice(0, 4000) : '';
        const contents = sanitizeContents(payload.contents)
            || (prompt ? [{ role: 'user', parts: [{ text: prompt }] }] : null);
        if (!contents) return sendJson(res, 400, { ok: false, error: 'empty_prompt' });
        // The browser names which app actions the model may call; the model still cannot reach the app itself.
        const tools = Array.isArray(payload.tools) && payload.tools.length
            ? [{ functionDeclarations: payload.tools.slice(0, 40) }]
            : undefined;

        // Free-tier quota runs out per model, so a 429/503 falls through to the next one.
        const models = [cred.model].concat(FALLBACK_MODELS.filter(function (m) { return m !== cred.model; }));
        const upstreamBody = JSON.stringify({
            systemInstruction: { parts: [{ text: system || 'You are a concise study assistant.' }] },
            contents: contents,
            tools: tools,
            generationConfig: { temperature: 0.4, maxOutputTokens: 700 }
        });

        // Node's fetch is used on purpose: the endpoint answers raw https.request with 503.
        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, UPSTREAM_TIMEOUT);

        function attempt(i) {
            return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(models[i]) + ':generateContent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cred.key },
                signal: controller.signal,
                body: upstreamBody
            }).then(async function (ures) {
                const text = await ures.text();
                if (ures.status !== 200) {
                    console.warn(models[i] + ' → ' + ures.status);
                    if ((ures.status === 429 || ures.status === 503) && i + 1 < models.length) return attempt(i + 1);
                    return { fail: 'upstream_' + ures.status };
                }
                let parsed;
                try { parsed = JSON.parse(text); } catch (e) { return { fail: 'bad_upstream' }; }
                const cand = parsed.candidates && parsed.candidates[0];
                const raw = cand && cand.content && Array.isArray(cand.content.parts) ? cand.content.parts : [];
                const parts = raw.filter(function (p) { return p && (p.text || p.functionCall) && !p.thought; })
                    .map(function (p) {
                        if (!p.functionCall) return { text: p.text };
                        const out = { functionCall: { name: p.functionCall.name, args: p.functionCall.args || {} } };
                        if (p.thoughtSignature) out.thoughtSignature = p.thoughtSignature;
                        return out;
                    });
                if (!parts.length) return { fail: 'empty_reply' };
                return { text: parts.map(function (p) { return p.text || ''; }).join('').trim(), parts: parts };
            });
        }

        attempt(0).then(function (out) {
            clearTimeout(timer);
            if (out.fail) return sendJson(res, 502, { ok: false, error: out.fail });
            sendJson(res, 200, { ok: true, text: out.text, parts: out.parts });
        }).catch(function (e) {
            clearTimeout(timer);
            console.warn('Gemini request failed:', e.message || e.name);
            if (!res.headersSent) sendJson(res, 502, { ok: false, error: e.name === 'AbortError' ? 'timeout' : 'network' });
        });
    });
}

function serveStatic(req, res) {
    const url = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
    let rel = url === '/' ? '/index.html' : url;
    const target = path.join(ROOT, path.normalize(rel));
    if (target !== ROOT && !target.startsWith(ROOT + path.sep)) {
        return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
    }
    if (path.basename(target) === 'gemini-key.json') {
        return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
    }
    fs.readFile(target, function (err, buf) {
        if (err) return send(res, 404, 'text/plain; charset=utf-8', 'Not found');
        send(res, 200, MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', buf);
    });
}

const server = http.createServer(function (req, res) {
    const route = (req.url || '/').split('?')[0];
    if (route === '/api/health') {
        return sendJson(res, 200, { ok: true, ai: !!readKey() });
    }
    if (route === '/api/gemini') {
        if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'method' });
        return proxyGemini(req, res);
    }
    if (route.indexOf('/api/') === 0) return sendJson(res, 404, { ok: false, error: 'not_found' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain; charset=utf-8', 'Method not allowed');
    serveStatic(req, res);
});

server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
        console.log('');
        console.log('Port ' + PORT + ' is already in use — the app is running somewhere else.');
        console.log('Close the other "start-server" window, or run:  node server.js  with  PORT=8124');
        process.exit(1);
    }
    console.error('Server error:', err.message);
    process.exit(1);
});

server.listen(PORT, HOST, function () {
    console.log('Back to School → http://localhost:' + PORT);
    console.log('AI proxy: ' + (readKey() ? 'ready' : 'no key (copy gemini-key.example.json to gemini-key.json)'));
});
