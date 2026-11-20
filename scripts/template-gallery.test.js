/**
 * Checks the File > New template gallery data: every <template> in templates/index.xml points to
 * an existing file and has a title, and every preview image named in templates/previews/manifest.json
 * exists. A template without a description or preview only gives a warning (the gallery still
 * shows it; regenerate previews with node scripts/template-previews.js).
 * Run: node scripts/template-gallery.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATES = path.join(__dirname, '..', 'src', 'main', 'webapp', 'templates');
const index = fs.readFileSync(path.join(TEMPLATES, 'index.xml'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
const manifestPath = path.join(TEMPLATES, 'previews', 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : { templates: {} };

function attr(tag, name) {
    const m = new RegExp('\\s' + name + '="([^"]*)"').exec(tag);
    return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)) : null;
}

let failed = 0;
let warned = 0;
function fail(msg) { failed++; console.error('FAIL ' + msg); }
function warn(msg) { warned++; console.warn('WARN ' + msg); }

const tags = index.match(/<template\s[^>]*>/g) || [];
if (tags.length === 0) fail('no <template> entries found in index.xml');
const seen = new Set();
tags.forEach((tag) => {
    const url = attr(tag, 'url');
    if (!url) return fail('template without url: ' + tag);
    if (seen.has(url)) fail('duplicate template ' + url);
    seen.add(url);
    if (!fs.existsSync(path.join(TEMPLATES, url))) fail('template file missing: ' + url);
    if (!attr(tag, 'title')) fail('template without title: ' + url);
    if (!attr(tag, 'description')) warn('template without description: ' + url);
    const entry = manifest.templates[url];
    if (!entry || !entry.image) warn('no preview for ' + url + ' (run node scripts/template-previews.js)');
    else if (!fs.existsSync(path.join(TEMPLATES, 'previews', entry.image))) fail('preview image missing: ' + entry.image);
});

Object.keys(manifest.templates).forEach((url) => {
    if (!seen.has(url)) warn('manifest lists a template that is not in index.xml: ' + url);
});

console.log(`${tags.length} templates, ${Object.keys(manifest.templates).length} manifest entries, ${warned} warning(s)`);
if (failed) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
}
console.log('PASS template gallery data');
