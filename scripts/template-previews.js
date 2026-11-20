#!/usr/bin/env node
/**
 * Regenerates the preview images and network facts of the File > New template gallery
 * (src/main/webapp/templates/previews/*.webp and manifest.json).
 *
 *   node scripts/template-previews.js [--port 5520]
 *
 * 1. Run this script. It serves src/main/webapp on http://127.0.0.1:<port>/ and saves the
 *    files the app sends to /__template-previews/save.
 * 2. Open the printed URL, wait until Electrisim has loaded and run in the browser console:
 *      ElectrisimTemplateGallery.generatePreviews()
 * 3. Commit the changed files in src/main/webapp/templates/previews.
 *
 * Run it after adding or changing a template in templates/index.xml. The gallery still works
 * without it: a template that has no preview is drawn in the browser when it is shown.
 * No dependencies; the server listens on 127.0.0.1 only and writes only inside previews/.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', 'src', 'main', 'webapp');
const OUT = path.join(ROOT, 'templates', 'previews');
const portArg = process.argv.indexOf('--port');
const PORT = parseInt(portArg > 0 ? process.argv[portArg + 1] : (process.env.PORT || '5520'), 10);
const SAVE_PATH = '/__template-previews/save';
const MAX_BODY = 25 * 1024 * 1024;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.drawio': 'application/xml; charset=utf-8',
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
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm'
};

function send(res, status, body, type) {
    res.writeHead(status, { 'Content-Type': type || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
}

/** Resolves a relative file name inside previews/, or null if it would leave that folder. */
function previewTarget(file) {
    if (typeof file !== 'string' || !/^[\w .()+&,'-]+(\/[\w .()+&,'-]+)*\.(webp|png|json)$/.test(file)) return null;
    const target = path.resolve(OUT, file);
    return target.startsWith(OUT + path.sep) ? target : null;
}

function handleSave(req, res) {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY) {
            send(res, 413, 'too large');
            req.destroy();
            return;
        }
        chunks.push(chunk);
    });
    req.on('end', () => {
        if (res.writableEnded) return;
        let payload;
        try {
            payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        } catch (e) {
            return send(res, 400, 'invalid JSON');
        }
        const target = previewTarget(payload.file);
        if (!target) return send(res, 400, 'invalid file name');
        let data;
        if (typeof payload.dataUrl === 'string') {
            const m = /^data:image\/(png|webp);base64,(.+)$/.exec(payload.dataUrl);
            if (!m || !target.endsWith('.' + m[1])) return send(res, 400, 'image type does not match file name');
            data = Buffer.from(m[2], 'base64');
        } else if (typeof payload.text === 'string' && target.endsWith('.json')) {
            data = Buffer.from(payload.text, 'utf8');
        } else {
            return send(res, 400, 'nothing to save');
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, data);
        console.log('saved', path.relative(ROOT, target), '(' + Math.round(data.length / 1024) + ' KB)');
        send(res, 200, JSON.stringify({ ok: true }), 'application/json');
    });
}

function handleStatic(req, res) {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
        return send(res, 400, 'bad request');
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'forbidden');
    fs.stat(file, (err, stat) => {
        if (err || !stat.isFile()) return send(res, 404, 'not found');
        res.writeHead(200, {
            'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
            'Content-Length': stat.size,
            'Cache-Control': 'no-store'
        });
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(file).pipe(res);
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === SAVE_PATH) return handleSave(req, res);
    if (req.method === 'GET' || req.method === 'HEAD') return handleStatic(req, res);
    send(res, 405, 'method not allowed');
});

server.listen(PORT, '127.0.0.1', () => {
    console.log('Template preview server: http://127.0.0.1:' + PORT + '/index.html');
    console.log('When Electrisim has loaded, run in the browser console:');
    console.log('  ElectrisimTemplateGallery.generatePreviews()');
    console.log('Files are written to ' + path.relative(process.cwd(), OUT));
});
