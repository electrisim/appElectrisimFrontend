/**
 * Electrisim template gallery.
 *
 * Replaces the template picker of draw.io's NewDialog (File > New, "Create New Diagram" on the
 * start screen, Arrange > Insert > Template) with a gallery made for network templates:
 * categories with counts, search, preview images, a description and network facts (buses,
 * voltage levels, ...) for each template, and a details panel for the selected one.
 *
 * Template list: templates/index.xml (<template url title description featured="1">).
 * Previews and facts: templates/previews/manifest.json and the images next to it, made with
 *   node scripts/template-previews.js   (then run ElectrisimTemplateGallery.generatePreviews()).
 * A template without a generated preview is drawn in the browser when its card comes into view.
 *
 * Compact NewDialog calls and the cloud variants with recent/search documents keep using the
 * original draw.io dialog.
 */
(function () {
    'use strict';

    if (window.ElectrisimTemplateGallery) return;

    var PREVIEW_W = 640;
    var PREVIEW_H = 400;
    var LARGE_BUSES = 1000;
    var LARGE_BYTES = 400 * 1024;
    var LIVE_RENDER_MAX_BYTES = 600 * 1024;
    var AUTO_PREFETCH_MAX_BYTES = 200 * 1024;

    // ----------------------------------------------------------------------------------------
    // Icons (24x24, stroked)
    // ----------------------------------------------------------------------------------------
    var ICONS = {
        featured: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
        all: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.3"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.3"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.3"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.3"/>',
        renewables: '<circle cx="12" cy="12" r="3.6"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
        transmission: '<path d="M12 3L8 21M12 3l4 18M4 7.5h16M6.3 12h11.4M9.3 16.5h5.4M6.5 21h11"/>',
        distribution: '<path d="M12 3v5M3.5 8h17M6.5 8v7M12 8v7M17.5 8v7"/><path d="M4.5 15l2 3.5 2-3.5zM10 15l2 3.5 2-3.5zM15.5 15l2 3.5 2-3.5z"/>',
        industrial: '<path d="M3 20.5V10.5l5 3.5v-3.5l5 3.5v-3.5l5 3.5V4h3v16.5z"/><path d="M7 17.5h2M12 17.5h2"/>',
        cigre: '<path d="M12 3.5l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.5l9 4.8 9-4.8"/><path d="M3 16.5l9 4.8 9-4.8"/>',
        low_voltage: '<path d="M3 11l9-7 9 7"/><path d="M5.5 9.3V20h13V9.3"/><path d="M12.6 11.5l-2.6 4h4l-2.6 4"/>',
        tutorials: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11.2v4.3c0 1.6 2.5 3 5.5 3s5.5-1.4 5.5-3v-4.3"/><path d="M21.5 9v5"/>',
        testing_with_other_software: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8"/>',
        folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.2l2 2.2h8.8A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
        search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        close: '<path d="M7 7l10 10M17 7L7 17"/>',
        warn: '<path d="M12 4.2l8.8 15.3H3.2z"/><path d="M12 10v4.2M12 17v.4"/>',
        info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.4"/>',
        pages: '<rect x="7" y="3.5" width="12" height="15" rx="1.5"/><path d="M5 7v12a1.5 1.5 0 0 0 1.5 1.5H15"/>',
        network: '<circle cx="6" cy="6" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M8.2 6h7.6M7.2 7.9l3.6 8.2M16.8 7.9l-3.6 8.2"/>'
    };

    function icon(name, cls) {
        return '<svg class="' + (cls || 'etg-icon') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
            'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
            (ICONS[name] || ICONS.network) + '</svg>';
    }

    // ----------------------------------------------------------------------------------------
    // Categories
    // ----------------------------------------------------------------------------------------
    var CATEGORY_INFO = {
        featured: { label: 'Start here', blurb: 'An empty diagram or one of these ready-to-run networks.' },
        all: { label: 'All templates', blurb: 'Every network template, grouped by type.' },
        renewables: { label: 'Renewables', blurb: 'Wind and solar farms, battery storage, hydro and microgrids.' },
        transmission: { label: 'Transmission', blurb: 'Grid substations and benchmark grids from IEEE, PEGASE, RTE and others, from 4 to 3120 buses.' },
        distribution: { label: 'Distribution', blurb: 'Medium-voltage substations and feeders.' },
        industrial: { label: 'Industrial & commercial', short: 'Industrial', blurb: 'Plants with motors, buildings and EV charging.' },
        cigre: { label: 'CIGRE benchmarks', short: 'CIGRE', blurb: 'CIGRE high-, medium- and low-voltage benchmark networks.' },
        low_voltage: { label: 'Low voltage', blurb: 'Low-voltage feeders and village grids from published benchmarks.' },
        tutorials: { label: 'Tutorials', blurb: 'Small networks prepared for one study each.' },
        testing_with_other_software: { label: 'Validation', blurb: 'Test cases that compare Electrisim with other power system software.' }
    };

    function categoryLabel(key) {
        if (CATEGORY_INFO[key]) return CATEGORY_INFO[key].label;
        var res = window.mxResources && mxResources.get(key, null, null);
        if (res) return res;
        var s = String(key || '').replace(/_/g, ' ');
        return s.charAt(0).toUpperCase() + s.substring(1);
    }

    function categoryShortLabel(key) {
        return CATEGORY_INFO[key] && CATEGORY_INFO[key].short || categoryLabel(key);
    }

    function categoryIcon(key) {
        return ICONS[key] ? key : 'folder';
    }

    // ----------------------------------------------------------------------------------------
    // Small helpers
    // ----------------------------------------------------------------------------------------
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function el(tag, cls, html) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html != null) e.innerHTML = html;
        return e;
    }

    function getUi() {
        return window.App && (App._editorUi || App._instance) || null;
    }

    function templatePath() {
        return typeof TEMPLATE_PATH !== 'undefined' ? TEMPLATE_PATH : 'templates';
    }

    function encodePath(rel) {
        return String(rel).split('/').map(encodeURIComponent).join('/');
    }

    function resolveUrl(ui, rel) {
        if (/^https?:\/\//.test(rel)) {
            return (ui && ui.editor && !ui.editor.isCorsEnabledForUrl(rel) && typeof PROXY_URL !== 'undefined')
                ? PROXY_URL + '?url=' + encodeURIComponent(rel) : rel;
        }
        return templatePath() + '/' + encodePath(rel);
    }

    function fetchText(url, noCache) {
        return fetch(url, noCache ? { cache: 'no-cache' } : undefined).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
            return r.text();
        });
    }

    function plural(n, one, many) {
        return n + ' ' + (n === 1 ? one : many);
    }

    function fmtKvValue(v) {
        return String(+(+v).toPrecision(3));
    }

    function fmtKv(list) {
        if (!list || !list.length) return '';
        if (list.length <= 3) return list.map(fmtKvValue).join('/') + ' kV';
        return fmtKvValue(list[0]) + '–' + fmtKvValue(list[list.length - 1]) + ' kV';
    }

    function fmtBytes(n) {
        if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
        return Math.max(1, Math.round(n / 1024)) + ' KB';
    }

    function isLarge(t) {
        return !!t && ((t.stats && t.stats.buses >= LARGE_BUSES) || (t.bytes && t.bytes >= LARGE_BYTES));
    }

    // ----------------------------------------------------------------------------------------
    // Reading templates: model of a .drawio file and network facts
    // ----------------------------------------------------------------------------------------
    function elementType(style) {
        var m = /(?:^|;)shapeELXXX=([^;]+)/.exec(style || '');
        return m ? m[1] : null;
    }

    function diagramModel(diagram) {
        var inner = diagram.getElementsByTagName('mxGraphModel')[0];
        if (inner) return inner;
        var txt = mxUtils.trim(mxUtils.getTextContent(diagram));
        if (!txt) return null;
        try {
            return mxUtils.parseXml(Graph.decompress(txt)).documentElement;
        } catch (e) {
            return null;
        }
    }

    function hasBuses(node) {
        var cells = node.getElementsByTagName('mxCell');
        for (var i = 0; i < cells.length; i++) {
            if (elementType(cells[i].getAttribute('style')) === 'Bus') return true;
        }
        return false;
    }

    /** Model of the first page that contains a network (or the first page), and the page count. */
    function pickModel(xmlText) {
        var root = mxUtils.parseXml(xmlText).documentElement;
        if (root == null) return null;
        if (root.nodeName === 'mxGraphModel') return { node: root, pages: 1 };
        var diagrams = root.getElementsByTagName('diagram');
        var first = null;
        for (var i = 0; i < diagrams.length; i++) {
            var node = diagramModel(diagrams[i]);
            if (node == null) continue;
            if (first == null) first = node;
            if (hasBuses(node)) return { node: node, pages: diagrams.length };
        }
        return first ? { node: first, pages: diagrams.length } : null;
    }

    function computeStats(node) {
        var counts = {};
        var kv = {};
        var cells = node.getElementsByTagName('mxCell');
        for (var i = 0; i < cells.length; i++) {
            var t = elementType(cells[i].getAttribute('style'));
            if (!t) continue;
            counts[t] = (counts[t] || 0) + 1;
            if (t === 'Bus') {
                var p = cells[i].parentNode;
                var v = p && p.nodeName === 'object' ? parseFloat(p.getAttribute('vn_kv')) : NaN;
                if (isFinite(v) && v > 0) kv[+v.toPrecision(3)] = true;
            }
        }
        function n() {
            var s = 0;
            for (var j = 0; j < arguments.length; j++) s += counts[arguments[j]] || 0;
            return s;
        }
        return {
            buses: n('Bus'),
            lines: n('Line', 'DC Line'),
            transformers: n('Transformer', 'Three Winding Transformer'),
            generators: n('Generator', 'Static Generator', 'Asymmetric Static Generator', 'Wind Turbine', 'PVSystem'),
            extGrids: n('External Grid'),
            loads: n('Load', 'Asymmetric Load'),
            motors: n('Motor'),
            storage: n('Storage'),
            switches: n('Switch'),
            kv: Object.keys(kv).map(Number).sort(function (a, b) { return b - a; })
        };
    }

    /**
     * Draws a template page into a width x height canvas: only the network (notes, result boxes
     * and flow arrows are left out), no labels, and line widths that stay visible when the whole
     * network is scaled down.
     */
    function renderPreview(ui, node, width, height) {
        width = width || PREVIEW_W;
        height = height || PREVIEW_H;
        return new Promise(function (resolve, reject) {
            var graph = ui.createTemporaryGraph(ui.editor.graph.getStylesheet());
            var container = graph.container;
            document.body.appendChild(container);
            var cleaned = false;
            var cleanup = function () {
                if (cleaned) return;
                cleaned = true;
                try { graph.destroy(); } catch (e) { /* ignore */ }
                if (container.parentNode) container.parentNode.removeChild(container);
            };
            try {
                var model = graph.getModel();
                var buses = 0;
                model.beginUpdate();
                try {
                    new mxCodec(node.ownerDocument).decode(node, model);
                    var all = [];
                    var hasElements = false;
                    for (var id in model.cells) {
                        var c = model.cells[id];
                        if (c === model.root || c.parent === model.root) continue;
                        all.push(c);
                        var t = elementType(c.style);
                        if (t && !/^(Result|FlowArrow)/.test(t)) hasElements = true;
                        if (t === 'Bus') buses++;
                    }
                    var containsElement = function (cell) {
                        var t2 = elementType(cell.style);
                        if (t2 && !/^(Result|FlowArrow)/.test(t2)) return true;
                        for (var k = 0; k < model.getChildCount(cell); k++) {
                            if (containsElement(model.getChildAt(cell, k))) return true;
                        }
                        return false;
                    };
                    var remove = [];
                    for (var i = 0; i < all.length; i++) {
                        var cell = all[i];
                        var type = elementType(cell.style);
                        if (type && /^(Result|FlowArrow)/.test(type)) remove.push(cell);
                        else if (hasElements && model.isLayer(cell.parent) && !containsElement(cell)) remove.push(cell);
                    }
                    if (remove.length) graph.removeCells(remove, true);
                } finally {
                    model.endUpdate();
                }

                var b = graph.getGraphBounds();
                if (!(b.width > 1 && b.height > 1)) throw new Error('empty diagram');
                var pad = 14;
                var s = Math.min((width - 2 * pad) / b.width, (height - 2 * pad) / b.height, 1);

                if (hasElements) {
                    var dense = buses > 400;
                    var linePx = dense ? 1.3 : 2.4;
                    var busPx = dense ? 2 : 4.5;
                    model.beginUpdate();
                    try {
                        for (var id2 in model.cells) {
                            var c2 = model.cells[id2];
                            if (c2 === model.root || c2.parent === model.root) continue;
                            var st = mxUtils.setStyle(c2.style || '', 'noLabel', '1');
                            var cur = parseFloat(mxUtils.getValue(graph.getCellStyle(c2), mxConstants.STYLE_STROKEWIDTH, 1)) || 1;
                            if (model.isEdge(c2)) {
                                st = mxUtils.setStyle(st, 'strokeWidth', Math.max(cur, linePx / s).toFixed(2));
                            } else if (elementType(c2.style) === 'Bus') {
                                st = mxUtils.setStyle(st, 'strokeWidth', Math.max(cur, busPx / s).toFixed(2));
                            }
                            model.setStyle(c2, st);
                        }
                    } finally {
                        model.endUpdate();
                    }
                }

                ui.editor.exportToCanvas(function (canvas) {
                    try {
                        var out = document.createElement('canvas');
                        out.width = width;
                        out.height = height;
                        var ctx = out.getContext('2d');
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);
                        var f = Math.min(1, width / canvas.width, height / canvas.height);
                        var w = canvas.width * f;
                        var h = canvas.height * f;
                        ctx.drawImage(canvas, Math.round((width - w) / 2), Math.round((height - h) / 2), w, h);
                        cleanup();
                        resolve(out);
                    } catch (e) {
                        cleanup();
                        reject(e);
                    }
                }, null, null, '#ffffff', function (e) {
                    cleanup();
                    reject(e || new Error('export failed'));
                }, false, true, s, false, false, null, graph, 0);
            } catch (e) {
                cleanup();
                reject(e);
            }
        });
    }

    // ----------------------------------------------------------------------------------------
    // Template catalogue (index.xml + previews/manifest.json), cached for the session
    // ----------------------------------------------------------------------------------------
    var catalogues = {};
    var xmlCache = {};
    var livePreviews = {};

    function parseIndex(text) {
        var root = mxUtils.parseXml(text).documentElement;
        var clibs = {};
        var list = [];
        for (var n = root && root.firstChild; n != null; n = n.nextSibling) {
            if (n.nodeType !== 1) continue;
            if (n.nodeName === 'clibs') {
                var adds = n.getElementsByTagName('add');
                var libs = [];
                for (var i = 0; i < adds.length; i++) libs.push(encodeURIComponent(mxUtils.getTextContent(adds[i])));
                if (n.getAttribute('name') && libs.length) clibs[n.getAttribute('name')] = libs.join(';');
            } else if (n.nodeName === 'template') {
                var url = n.getAttribute('url');
                if (!url) continue;
                var section = n.getAttribute('section') || (url.indexOf('/') > 0 ? url.substring(0, url.indexOf('/')) : 'other');
                var cl = n.getAttribute('clibs');
                if (cl && clibs[cl]) cl = clibs[cl];
                var title = n.getAttribute('title');
                if (title && window.mxResources) title = mxResources.get(title, null, title);
                if (!title) {
                    title = url.substring(url.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '').replace(/_/g, ' ');
                }
                list.push({
                    url: url,
                    title: title,
                    description: n.getAttribute('description') || '',
                    featured: n.getAttribute('featured') === '1',
                    libs: n.getAttribute('libs'),
                    clibs: cl,
                    previewAttr: n.getAttribute('preview'),
                    category: section
                });
            }
        }
        return list;
    }

    function applyManifest(list, manifest) {
        var entries = manifest && manifest.templates || {};
        var version = manifest && manifest.generated ? encodeURIComponent(manifest.generated) : '';
        list.forEach(function (t) {
            var m = entries[t.url];
            if (m) {
                t.stats = m.stats || null;
                t.bytes = m.bytes || 0;
                t.pages = m.pages || 1;
                if (m.image) t.previewUrl = templatePath() + '/previews/' + encodePath(m.image) + (version ? '?v=' + version : '');
            }
            if (!t.previewUrl && t.previewAttr) t.previewUrl = resolveUrl(null, t.previewAttr);
            if (!t.previewUrl && livePreviews[t.url]) {
                t.previewUrl = livePreviews[t.url].dataUrl;
                t.stats = t.stats || livePreviews[t.url].stats;
            }
        });
    }

    function loadCatalogue(ui, indexUrl, fresh) {
        indexUrl = indexUrl || (window.EditorUi && EditorUi.templateFile) || templatePath() + '/index.xml';
        if (!fresh && catalogues[indexUrl]) return catalogues[indexUrl];
        var src = /^https?:\/\//.test(indexUrl) && ui && !ui.editor.isCorsEnabledForUrl(indexUrl) && typeof PROXY_URL !== 'undefined'
            ? PROXY_URL + '?url=' + encodeURIComponent(indexUrl) : indexUrl;
        var p = Promise.all([
            fetchText(src, fresh),
            fetchText(templatePath() + '/previews/manifest.json', true).then(JSON.parse).catch(function () { return null; })
        ]).then(function (res) {
            var list = parseIndex(res[0]);
            applyManifest(list, res[1]);
            return list;
        });
        catalogues[indexUrl] = p;
        p.catch(function () { delete catalogues[indexUrl]; });
        return p;
    }

    function loadTemplateXml(ui, t) {
        if (!xmlCache[t.url]) {
            xmlCache[t.url] = fetchText(resolveUrl(ui, t.url));
            xmlCache[t.url].catch(function () { delete xmlCache[t.url]; });
        }
        return xmlCache[t.url];
    }

    // Live previews for templates without a generated image, one at a time.
    var liveQueue = Promise.resolve();

    function queueLivePreview(ui, t) {
        if (t.liveState) return t.liveState;
        t.liveState = new Promise(function (resolve) {
            liveQueue = liveQueue.then(function () {
                if (t.bytes && t.bytes > LIVE_RENDER_MAX_BYTES) return resolve(null);
                return loadTemplateXml(ui, t).then(function (text) {
                    t.bytes = t.bytes || text.length;
                    var picked = pickModel(text);
                    if (!picked) return resolve(null);
                    t.stats = t.stats || computeStats(picked.node);
                    t.pages = t.pages || picked.pages;
                    if (text.length > LIVE_RENDER_MAX_BYTES) return resolve(null);
                    return renderPreview(ui, picked.node, PREVIEW_W, PREVIEW_H).then(function (canvas) {
                        var dataUrl = canvas.toDataURL('image/png');
                        livePreviews[t.url] = { dataUrl: dataUrl, stats: t.stats };
                        t.previewUrl = dataUrl;
                        resolve(dataUrl);
                    });
                }).catch(function (e) {
                    console.warn('[templates] preview failed for', t.url, e);
                    resolve(null);
                });
            });
        });
        return t.liveState;
    }

    // ----------------------------------------------------------------------------------------
    // Styles
    // ----------------------------------------------------------------------------------------
    var CSS = [
        '.etg{--etg-bg:#fff;--etg-panel:#f6f7f9;--etg-border:#dde2e8;--etg-border-strong:#b8c2cf;--etg-text:#1f2328;--etg-muted:#5f6b7a;',
        '--etg-accent:#2f6fde;--etg-accent-soft:#e7effd;--etg-hover:#edf1f6;--etg-card:#fff;--etg-thumb:#fbfcfd;--etg-warn-bg:#fff5e1;--etg-warn:#7a4f00;',
        'position:relative;box-sizing:border-box;height:100%;display:flex;flex-direction:column;font-family:Helvetica,Arial,sans-serif;',
        'font-size:13px;line-height:1.35;color:var(--etg-text);text-align:left;white-space:normal}',
        '.etg *,.etg *::before,.etg *::after{box-sizing:border-box}',
        '.etg-icon{width:18px;height:18px;flex:0 0 auto}',
        '.etg-head{display:flex;align-items:center;flex-wrap:wrap;gap:10px 16px;padding:0 0 12px}',
        '.etg-name{display:flex;align-items:center;gap:8px;flex:1 1 380px;min-width:0;white-space:nowrap}',
        '.etg-name-label{color:var(--etg-muted);font-size:12.5px}',
        '.etg-name input{flex:0 1 260px;min-width:110px;height:30px;padding:0 8px;border:1px solid var(--etg-border);border-radius:6px;font:inherit;color:inherit;background:var(--etg-bg)}',
        '.etg-name select{height:30px;max-width:170px;border:1px solid var(--etg-border);border-radius:6px;font:inherit;font-size:12.5px;color:inherit;background:var(--etg-bg);margin:0!important;width:auto!important}',
        '.etg-name img{margin:0!important}',
        '.etg-name input:focus,.etg-name select:focus{outline:none;border-color:var(--etg-accent);box-shadow:0 0 0 3px rgba(47,111,222,.15)}',
        '.etg-search{position:relative;flex:0 1 300px;min-width:200px;margin-left:auto}',
        '.etg-search input{width:100%;height:32px;padding:0 32px 0 34px;border:1px solid var(--etg-border);border-radius:16px;background:var(--etg-panel);font:inherit;color:inherit}',
        '.etg-search input:focus{outline:none;border-color:var(--etg-accent);background:var(--etg-bg);box-shadow:0 0 0 3px rgba(47,111,222,.15)}',
        '.etg-search>.etg-icon{position:absolute;left:11px;top:8px;width:16px;height:16px;color:var(--etg-muted);pointer-events:none}',
        '.etg-search-clear{position:absolute;right:6px;top:6px;width:20px;height:20px;padding:2px;border:0;border-radius:50%;background:none;color:var(--etg-muted);cursor:pointer;display:none}',
        '.etg-search-clear:hover{background:var(--etg-hover);color:var(--etg-text)}',
        '.etg-search-clear .etg-icon{width:16px;height:16px}',
        '.etg-search.has-text .etg-search-clear{display:block}',
        '.etg-body{flex:1 1 auto;min-height:0;display:flex;border:1px solid var(--etg-border);border-radius:8px;overflow:hidden;background:var(--etg-bg)}',
        '.etg-cats{flex:0 0 204px;overflow-y:auto;padding:8px;background:var(--etg-panel);border-right:1px solid var(--etg-border)}',
        '.etg-cat{display:flex;align-items:center;gap:9px;width:100%;margin:0 0 1px;padding:7px 9px;border:0;border-radius:6px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}',
        '.etg-cat:hover{background:var(--etg-hover)}',
        '.etg-cat:focus-visible{outline:2px solid var(--etg-accent);outline-offset:-2px}',
        '.etg-cat[aria-current="true"]{background:var(--etg-accent-soft);color:var(--etg-accent);font-weight:600}',
        '.etg-cat-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
        '.etg-cat-count{flex:0 0 auto;min-width:22px;padding:1px 6px;border-radius:9px;background:rgba(95,107,122,.1);color:var(--etg-muted);font-size:11px;font-weight:normal;text-align:center}',
        '.etg-cat[aria-current="true"] .etg-cat-count{background:rgba(47,111,222,.14);color:var(--etg-accent)}',
        '.etg-cats-sep{height:1px;margin:6px 4px 7px;background:var(--etg-border)}',
        '.etg-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}',
        '.etg-main-head{padding:12px 16px 8px}',
        '.etg-main-title{margin:0;font-size:15px;font-weight:600}',
        '.etg-main-blurb{margin:2px 0 0;color:var(--etg-muted);font-size:12px}',
        '.etg-grid{flex:1 1 auto;min-height:0;overflow-y:auto;padding:4px 16px 16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(158px,1fr));grid-auto-rows:max-content;gap:12px;align-content:start;outline:none}',
        '.etg-group{grid-column:1/-1;display:flex;align-items:center;gap:6px;margin:10px 0 -4px;color:var(--etg-muted);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}',
        '.etg-group:first-child{margin-top:2px}',
        '.etg-group .etg-icon{width:15px;height:15px}',
        '.etg-card{position:relative;display:flex;flex-direction:column;min-width:0;border:1px solid var(--etg-border);border-radius:8px;background:var(--etg-card);cursor:pointer;overflow:hidden;user-select:none;transition:border-color .12s,box-shadow .12s}',
        '.etg-card:hover{border-color:var(--etg-border-strong);box-shadow:0 2px 8px rgba(16,24,40,.08)}',
        '.etg-card:focus{outline:none}',
        '.etg-card:focus-visible{box-shadow:0 0 0 3px rgba(47,111,222,.35)}',
        '.etg-card[aria-selected="true"]{border-color:var(--etg-accent);box-shadow:0 0 0 1px var(--etg-accent),0 3px 10px rgba(47,111,222,.16)}',
        '.etg-thumb{position:relative;flex:0 0 auto;aspect-ratio:16/10;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--etg-thumb);border-bottom:1px solid var(--etg-border)}',
        '.etg-thumb img{display:block;width:100%;height:100%;object-fit:contain}',
        '.etg-thumb>.etg-icon{width:38px;height:38px;color:#c5ccd6}',
        '.etg-thumb.is-loading>.etg-icon{animation:etg-pulse 1.3s ease-in-out infinite}',
        '.etg-blank .etg-thumb{background:var(--etg-bg)}',
        '.etg-blank .etg-thumb>.etg-icon{width:42px;height:42px;padding:8px;border:2px dashed var(--etg-border-strong);border-radius:10px;color:var(--etg-accent);box-sizing:content-box}',
        '.etg-card-body{padding:8px 10px 9px}',
        '.etg-card-title{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;min-height:2.6em;font-size:12.5px;font-weight:600;line-height:1.3}',
        '.etg-card-meta{margin-top:3px;min-height:1.35em;overflow:hidden;color:var(--etg-muted);font-size:11.5px;white-space:nowrap;text-overflow:ellipsis}',
        '.etg-badge{position:absolute;top:6px;left:6px;padding:1px 6px;border:1px solid #f0d49b;border-radius:4px;background:rgba(255,245,225,.95);color:var(--etg-warn);font-size:10.5px;font-weight:600}',
        '.etg-empty{grid-column:1/-1;padding:48px 12px;text-align:center;color:var(--etg-muted)}',
        '.etg-empty .etg-icon{width:32px;height:32px;margin-bottom:8px;color:#c5ccd6}',
        '.etg-empty button{margin-top:12px}',
        '.etg-detail{flex:0 0 292px;overflow-y:auto;padding:16px;border-left:1px solid var(--etg-border);background:var(--etg-bg)}',
        '.etg-detail-thumb{flex:0 0 auto;aspect-ratio:16/10;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px solid var(--etg-border);border-radius:8px;background:var(--etg-thumb)}',
        '.etg-detail-thumb img{display:block;width:100%;height:100%;object-fit:contain}',
        '.etg-detail-thumb>.etg-icon{width:48px;height:48px;color:#c5ccd6}',
        '.etg-detail-thumb.is-blank{background:var(--etg-bg)}',
        '.etg-detail-thumb.is-blank>.etg-icon{color:var(--etg-accent)}',
        '.etg-detail-cat{display:flex;align-items:center;gap:5px;margin-top:14px;color:var(--etg-accent);font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}',
        '.etg-detail-cat .etg-icon{width:14px;height:14px}',
        '.etg-detail-title{margin:4px 0 6px;font-size:16px;font-weight:600;line-height:1.3}',
        '.etg-detail-desc{margin:0;color:var(--etg-text);opacity:.86;font-size:12.5px;line-height:1.5}',
        '.etg-facts{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:14px 0 0;padding:0}',
        '.etg-fact{margin:0;padding:6px 9px;border-radius:6px;background:var(--etg-panel)}',
        '.etg-fact dt{color:var(--etg-muted);font-size:10.5px;letter-spacing:.03em;text-transform:uppercase}',
        '.etg-fact dd{margin:1px 0 0;font-size:14px;font-weight:600}',
        '.etg-fact.is-wide{grid-column:1/-1}',
        '.etg-fact.is-wide dd{font-size:13px}',
        '.etg-note{display:flex;gap:8px;margin-top:12px;padding:8px 10px;border-radius:6px;background:var(--etg-panel);color:var(--etg-muted);font-size:12px;line-height:1.4}',
        '.etg-note.is-warn{background:var(--etg-warn-bg);color:var(--etg-warn)}',
        '.etg-note.is-error{background:#fdecec;color:#8a1c1c}',
        '.etg-note .etg-icon{width:16px;height:16px;margin-top:1px}',
        '.etg-spinner{flex:0 0 auto;width:14px;height:14px;margin-top:1px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:etg-spin .8s linear infinite}',
        '.etg-foot{display:flex;align-items:center;gap:8px;padding-top:14px}',
        '.etg-foot-info{flex:1 1 auto;min-width:0;overflow:hidden;color:var(--etg-muted);font-size:12px;white-space:nowrap;text-overflow:ellipsis}',
        '.etg-foot .geBtn{margin:0;flex:0 0 auto}',
        '.etg-narrow .etg-detail{display:none}',
        '.etg-compact .etg-body{flex-direction:column}',
        '.etg-compact .etg-cats{flex:0 0 auto;display:flex;gap:2px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;padding:6px;border-right:0;border-bottom:1px solid var(--etg-border)}',
        '.etg-compact .etg-cat{width:auto;flex:0 0 auto;margin:0}',
        '.etg-compact .etg-cats-sep{display:none}',
        '.etg-compact .etg-search{flex-basis:100%;margin-left:0}',
        '.etg-dark{--etg-bg:#2a2a2a;--etg-panel:#323232;--etg-border:#474747;--etg-border-strong:#5d5d5d;--etg-text:#e8e8e8;--etg-muted:#a9a9a9;',
        '--etg-accent:#78a9ff;--etg-accent-soft:rgba(120,169,255,.15);--etg-hover:#383838;--etg-card:#2e2e2e;--etg-thumb:#1f1f1f;--etg-warn-bg:#3d3220;--etg-warn:#f0c674}',
        '.etg-dark .etg-thumb img,.etg-dark .etg-detail-thumb img{filter:invert(.9) hue-rotate(180deg)}',
        '@keyframes etg-pulse{0%,100%{opacity:.4}50%{opacity:1}}',
        '@keyframes etg-spin{to{transform:rotate(360deg)}}',
        '@media (prefers-reduced-motion:reduce){.etg *{animation:none!important;transition:none!important}}'
    ].join('\n');

    function ensureStyles() {
        if (document.getElementById('etg-styles')) return;
        var style = document.createElement('style');
        style.id = 'etg-styles';
        style.textContent = CSS;
        document.head.appendChild(style);
    }

    // ----------------------------------------------------------------------------------------
    // The dialog
    // ----------------------------------------------------------------------------------------
    /**
     * Same arguments as draw.io's NewDialog (editorUi, compact, showName, callback, createOnly,
     * cancelCallback, leftHighlight, rightHighlight, templateExtUrl, templateCatPadding,
     * templateFile, recentDocsCallback, searchDocsCallback, openExtDocCallback, showImport,
     * createButtonLabel, customTempCallback).
     */
    function TemplateGalleryDialog(ui, compact, showName, callback, createOnly, cancelCallback,
        leftHighlight, rightHighlight, templateExtUrl, templateCatPadding, templateFile,
        recentDocsCallback, searchDocsCallback, openExtDocCallback, showImport, createButtonLabel) {

        ensureStyles();
        showName = showName != null ? showName : true;
        createOnly = createOnly != null ? createOnly : false;

        var insertMode = !showName && callback != null;
        var BLANK = {
            blank: true,
            url: null,
            title: window.mxResources ? mxResources.get('blankDiagram', null, 'Blank Diagram') : 'Blank Diagram',
            description: 'An empty canvas. Draw your own network from the shape library on the left.',
            category: 'featured'
        };

        var state = {
            templates: [],
            category: 'featured',
            query: '',
            selected: null,
            xml: null,
            loading: false,
            error: null,
            pendingCreate: false,
            cards: []
        };
        var destroyed = false;

        // ---- skeleton ------------------------------------------------------------------------
        var root = el('div', 'etg' + (window.uiTheme == 'dark' ? ' etg-dark' : ''));
        root.setAttribute('data-electrisim-template-gallery', '1');

        var head = el('div', 'etg-head');
        root.appendChild(head);

        var nameInput = document.createElement('input');
        var ext = '.drawio';
        if (showName) {
            var nameWrap = el('div', 'etg-name');
            var lbl = el('label', 'etg-name-label');
            var nameId = 'etg-name-' + Math.random().toString(36).slice(2, 8);
            lbl.setAttribute('for', nameId);
            mxUtils.write(lbl, (ui.mode == null || ui.mode == App.MODE_GOOGLE || ui.mode == App.MODE_BROWSER
                ? mxResources.get('diagramName') : mxResources.get('filename')) + ':');
            nameWrap.appendChild(lbl);

            if (ui.mode == App.MODE_GOOGLE && ui.drive != null) ext = ui.drive.extension;
            else if (ui.mode == App.MODE_DROPBOX && ui.dropbox != null) ext = ui.dropbox.extension;
            else if (ui.mode == App.MODE_ONEDRIVE && ui.oneDrive != null) ext = ui.oneDrive.extension;
            else if (ui.mode == App.MODE_GITHUB && ui.gitHub != null) ext = ui.gitHub.extension;
            else if (ui.mode == App.MODE_GITLAB && ui.gitLab != null) ext = ui.gitLab.extension;
            else if (ui.mode == App.MODE_TRELLO && ui.trello != null) ext = ui.trello.extension;

            nameInput.id = nameId;
            nameInput.setAttribute('type', 'text');
            nameInput.setAttribute('spellcheck', 'false');
            nameInput.value = ui.defaultFilename + ext;
            nameWrap.appendChild(nameInput);

            if (ui.editor.diagramFileTypes != null) {
                nameWrap.appendChild(FilenameDialog.createFileTypes(ui, nameInput, ui.editor.diagramFileTypes));
            }
            if (ui.editor.fileExtensions != null) {
                var hint = FilenameDialog.createTypeHint(ui, nameInput, ui.editor.fileExtensions);
                hint.style.marginTop = '0';
                nameWrap.appendChild(hint);
            }
            head.appendChild(nameWrap);

            mxEvent.addListener(nameInput, 'keydown', function (evt) {
                if (evt.keyCode == 13) {
                    evt.preventDefault();
                    create();
                }
            });
        }

        var searchWrap = el('div', 'etg-search', icon('search'));
        var searchInput = document.createElement('input');
        searchInput.setAttribute('type', 'text');
        searchInput.setAttribute('role', 'searchbox');
        searchInput.setAttribute('placeholder', 'Search templates (name, kV, type...)');
        searchInput.setAttribute('aria-label', 'Search templates');
        searchInput.setAttribute('autocomplete', 'off');
        searchInput.setAttribute('spellcheck', 'false');
        searchWrap.appendChild(searchInput);
        var clearBtn = el('button', 'etg-search-clear', icon('close'));
        clearBtn.setAttribute('type', 'button');
        clearBtn.setAttribute('title', 'Clear search');
        clearBtn.setAttribute('aria-label', 'Clear search');
        searchWrap.appendChild(clearBtn);
        head.appendChild(searchWrap);

        var body = el('div', 'etg-body');
        var cats = el('nav', 'etg-cats');
        cats.setAttribute('aria-label', 'Template categories');
        var main = el('section', 'etg-main');
        var mainHead = el('div', 'etg-main-head');
        var mainTitle = el('h3', 'etg-main-title');
        var mainBlurb = el('p', 'etg-main-blurb');
        mainHead.appendChild(mainTitle);
        mainHead.appendChild(mainBlurb);
        var grid = el('div', 'etg-grid');
        grid.setAttribute('role', 'listbox');
        grid.setAttribute('aria-label', 'Templates');
        main.appendChild(mainHead);
        main.appendChild(grid);
        var detail = el('aside', 'etg-detail');
        detail.setAttribute('aria-live', 'polite');
        body.appendChild(cats);
        body.appendChild(main);
        body.appendChild(detail);
        root.appendChild(body);

        var foot = el('div', 'etg-foot');
        var helpBtn = null;
        if (!compact && !ui.isOffline() && showName && callback == null && !createOnly) {
            helpBtn = mxUtils.button(mxResources.get('help'), function () {
                ui.openLink('https://electrisim.com');
            });
            helpBtn.className = 'geBtn';
            foot.appendChild(helpBtn);
        }
        var footInfo = el('div', 'etg-foot-info');
        foot.appendChild(footInfo);

        var cancelBtn = mxUtils.button(mxResources.get('cancel'), function () {
            if (cancelCallback != null) cancelCallback();
            ui.hideDialog(true);
        });
        cancelBtn.className = 'geBtn';
        var showCancel = !(createOnly && cancelCallback == null);
        if (ui.editor.cancelFirst && showCancel) foot.appendChild(cancelBtn);

        if (Graph.fileSupport && showImport) {
            var importBtn = mxUtils.button(mxResources.get('import'), function () {
                if (ui.newDlgFileInputElt == null) {
                    var fileInput = document.createElement('input');
                    fileInput.setAttribute('multiple', 'multiple');
                    fileInput.setAttribute('type', 'file');
                    mxEvent.addListener(fileInput, 'change', function () {
                        ui.openFiles(fileInput.files, true);
                        fileInput.value = '';
                    });
                    fileInput.style.display = 'none';
                    document.body.appendChild(fileInput);
                    ui.newDlgFileInputElt = fileInput;
                }
                ui.newDlgFileInputElt.click();
            });
            importBtn.className = 'geBtn';
            foot.appendChild(importBtn);
        }

        var createLabel = createButtonLabel || mxResources.get('create');
        var createBtn = mxUtils.button(createLabel, function () {
            create();
        });
        createBtn.className = 'geBtn gePrimaryBtn';
        foot.appendChild(createBtn);
        if (!ui.editor.cancelFirst && callback == null && showCancel) foot.appendChild(cancelBtn);
        root.appendChild(foot);

        // ---- data ------------------------------------------------------------------------------
        function byCategory(key) {
            if (key === 'featured') {
                var list = state.templates.filter(function (t) { return t.featured; });
                return insertMode ? list : [BLANK].concat(list);
            }
            if (key === 'all') return state.templates.slice();
            return state.templates.filter(function (t) { return t.category === key; });
        }

        function categoryKeys() {
            var keys = [];
            state.templates.forEach(function (t) {
                if (keys.indexOf(t.category) < 0) keys.push(t.category);
            });
            return keys;
        }

        function searchText(t) {
            if (t._search == null) {
                var parts = [t.title, t.description, categoryLabel(t.category), t.url];
                if (t.stats) {
                    parts.push(t.stats.buses + ' bus buses');
                    (t.stats.kv || []).forEach(function (v) { parts.push(fmtKvValue(v) + 'kv ' + fmtKvValue(v) + ' kv'); });
                    if (t.stats.storage) parts.push('battery bess storage');
                    if (t.stats.motors) parts.push('motor motors');
                }
                t._search = parts.join(' ').toLowerCase();
            }
            return t._search;
        }

        function searchResults(q) {
            var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
            var res = state.templates.filter(function (t) {
                var hay = searchText(t);
                return tokens.every(function (tok) { return hay.indexOf(tok) >= 0; });
            });
            if (!insertMode && tokens.every(function (tok) { return 'blank empty new diagram'.indexOf(tok) >= 0; })) {
                res.unshift(BLANK);
            }
            return res;
        }

        // ---- rendering -------------------------------------------------------------------------
        function metaText(t, withCategory) {
            var parts = [];
            if (withCategory) parts.push(categoryLabel(t.category));
            if (t.blank) {
                parts.push('Start from scratch');
            } else if (t.stats && t.stats.buses) {
                parts.push(plural(t.stats.buses, 'bus', 'buses'));
                var kv = fmtKv(t.stats.kv);
                if (kv) parts.push(kv);
            } else if (t.pages > 1) {
                parts.push(plural(t.pages, 'page', 'pages'));
            } else if (t.stats && !withCategory) {
                parts.push('Guide page');
            }
            return parts.join(' · ');
        }

        function renderSidebar() {
            cats.innerHTML = '';
            var keys = ['featured', 'all', null].concat(categoryKeys());
            keys.forEach(function (key) {
                if (key === null) {
                    cats.appendChild(el('div', 'etg-cats-sep'));
                    return;
                }
                var count = byCategory(key).length;
                if (key === 'featured' && count === 0) return;
                var btn = el('button', 'etg-cat',
                    icon(categoryIcon(key)) +
                    '<span class="etg-cat-label">' + esc(categoryShortLabel(key)) + '</span>' +
                    '<span class="etg-cat-count">' + count + '</span>');
                btn.setAttribute('type', 'button');
                btn.setAttribute('data-key', key);
                btn.setAttribute('title', categoryLabel(key) + ' (' + count + ')');
                btn.setAttribute('aria-current', !state.query && state.category === key ? 'true' : 'false');
                mxEvent.addListener(btn, 'click', function () {
                    if (state.query) {
                        searchInput.value = '';
                        state.query = '';
                        searchWrap.classList.remove('has-text');
                    }
                    state.category = key;
                    renderSidebar();
                    renderGrid(true);
                });
                cats.appendChild(btn);
            });
        }

        function cardFor(t, withCategory) {
            var card = el('div', 'etg-card' + (t.blank ? ' etg-blank' : ''));
            card.setAttribute('role', 'option');
            card.setAttribute('tabindex', '-1');
            card.setAttribute('aria-selected', 'false');
            setCardTooltip(card, t);

            var thumb = el('div', 'etg-thumb');
            fillThumb(thumb, t, true);
            card.appendChild(thumb);

            if (isLarge(t)) {
                var badge = el('span', 'etg-badge', 'Large');
                badge.setAttribute('title', 'Large network: opening and simulating take longer');
                card.appendChild(badge);
            }

            var cb = el('div', 'etg-card-body');
            var title = el('div', 'etg-card-title');
            mxUtils.write(title, t.title);
            var meta = el('div', 'etg-card-meta');
            mxUtils.write(meta, metaText(t, withCategory));
            cb.appendChild(title);
            cb.appendChild(meta);
            card.appendChild(cb);

            mxEvent.addListener(card, 'click', function () {
                select(t, true);
            });
            mxEvent.addListener(card, 'dblclick', function (evt) {
                select(t, true);
                create();
                mxEvent.consume(evt);
            });
            card._etgTemplate = t;
            card._etgMeta = meta;
            card._etgThumb = thumb;
            card._etgWithCategory = withCategory;
            return card;
        }

        // The description is in the details panel; when that panel is hidden it goes in the tooltip.
        function setCardTooltip(card, t) {
            var narrow = root.classList.contains('etg-narrow');
            card.setAttribute('title', narrow && t.description ? t.title + '\n\n' + t.description : t.title);
        }

        function fillThumb(thumb, t, lazy) {
            thumb.innerHTML = '';
            thumb.classList.remove('is-loading');
            if (t.blank) {
                thumb.innerHTML = icon('plus');
                return;
            }
            if (t.previewUrl) {
                var img = document.createElement('img');
                img.setAttribute('alt', '');
                img.setAttribute('decoding', 'async');
                if (lazy) img.setAttribute('loading', 'lazy');
                img.onerror = function () {
                    thumb.innerHTML = icon(categoryIcon(t.category));
                };
                img.src = t.previewUrl;
                thumb.appendChild(img);
                return;
            }
            thumb.innerHTML = icon(categoryIcon(t.category));
            if (!(t.bytes && t.bytes > LIVE_RENDER_MAX_BYTES)) thumb.classList.add('is-loading');
        }

        // Cards without a generated preview get one drawn when they are (nearly) in view.
        var visibleTimer = null;

        function scheduleVisiblePreviews() {
            if (visibleTimer) window.clearTimeout(visibleTimer);
            visibleTimer = window.setTimeout(function () {
                visibleTimer = null;
                if (destroyed) return;
                var view = grid.getBoundingClientRect();
                state.cards.forEach(function (c) {
                    var t = c._etgTemplate;
                    if (t.blank || t.previewUrl || t.liveState) return;
                    var r = c.getBoundingClientRect();
                    if (r.bottom >= view.top - 200 && r.top <= view.bottom + 200) startLivePreview(c);
                });
            }, 60);
        }

        mxEvent.addListener(grid, 'scroll', scheduleVisiblePreviews);

        function startLivePreview(card) {
            var t = card._etgTemplate;
            if (!t || t.blank || t.previewUrl) return;
            queueLivePreview(ui, t).then(function (dataUrl) {
                if (destroyed) return;
                t._search = null;
                state.cards.forEach(function (c) {
                    if (c._etgTemplate !== t) return;
                    if (dataUrl) fillThumb(c._etgThumb, t, false);
                    else c._etgThumb.classList.remove('is-loading');
                    c._etgMeta.textContent = metaText(t, c._etgWithCategory);
                });
                if (state.selected === t) renderDetail();
            });
        }

        function renderGrid(resetScroll) {
            grid.innerHTML = '';
            state.cards = [];

            var items;
            var groups = null;
            if (state.query) {
                items = searchResults(state.query);
                mainTitle.textContent = items.length
                    ? plural(items.length, 'template', 'templates') + ' found'
                    : 'No templates found';
                mainBlurb.textContent = 'Search: “' + state.query + '”';
            } else {
                var key = state.category;
                if (key !== 'all' && key !== 'featured' && categoryKeys().indexOf(key) < 0) key = 'featured';
                if (key === 'featured' && byCategory('featured').length === 0) key = 'all';
                state.category = key;
                items = byCategory(key);
                mainTitle.textContent = categoryLabel(key);
                mainBlurb.textContent = CATEGORY_INFO[key] ? CATEGORY_INFO[key].blurb : plural(items.length, 'template', 'templates');
                if (key === 'all') groups = categoryKeys();
            }

            var withCategory = !!state.query;
            if (groups) {
                groups.forEach(function (g) {
                    var header = el('div', 'etg-group', icon(categoryIcon(g)) + '<span>' + esc(categoryLabel(g)) + '</span>');
                    header.setAttribute('role', 'presentation');
                    grid.appendChild(header);
                    items.filter(function (t) { return t.category === g; }).forEach(function (t) {
                        var c = cardFor(t, false);
                        grid.appendChild(c);
                        state.cards.push(c);
                    });
                });
            } else {
                items.forEach(function (t) {
                    var c = cardFor(t, withCategory);
                    grid.appendChild(c);
                    state.cards.push(c);
                });
            }

            if (!items.length) {
                var empty = el('div', 'etg-empty', icon('search') + '<div>No template matches “' + esc(state.query) +
                    '”.<br>Try a bus count, a voltage such as “110 kV”, or a word like “wind”.</div>');
                var clear = mxUtils.button('Show all templates', function () {
                    clearSearch();
                    state.category = 'all';
                    renderSidebar();
                    renderGrid(true);
                });
                clear.className = 'geBtn';
                empty.appendChild(clear);
                grid.appendChild(empty);
            }

            if (resetScroll) grid.scrollTop = 0;
            scheduleVisiblePreviews();

            // Keep the selection if it is shown, otherwise select the first card.
            if (items.indexOf(state.selected) >= 0) {
                markSelected(false);
            } else if (items.length) {
                select(items[0], false);
            } else {
                markSelected(false);
            }
        }

        function markSelected(scroll) {
            state.cards.forEach(function (c) {
                var on = c._etgTemplate === state.selected;
                c.setAttribute('aria-selected', on ? 'true' : 'false');
                c.setAttribute('tabindex', on ? '0' : '-1');
                if (on && scroll && c.scrollIntoView) c.scrollIntoView({ block: 'nearest' });
            });
            if (!state.cards.some(function (c) { return c.getAttribute('tabindex') === '0'; }) && state.cards[0]) {
                state.cards[0].setAttribute('tabindex', '0');
            }
        }

        function factHtml(label, value, wide) {
            return '<div class="etg-fact' + (wide ? ' is-wide' : '') + '"><dt>' + esc(label) + '</dt><dd>' + esc(value) + '</dd></div>';
        }

        function renderDetail() {
            var t = state.selected;
            detail.innerHTML = '';
            if (!t) {
                detail.appendChild(el('div', 'etg-note', icon('info') + '<span>Select a template to see what it contains.</span>'));
                updateFooter();
                return;
            }
            var thumb = el('div', 'etg-detail-thumb' + (t.blank ? ' is-blank' : ''));
            fillThumb(thumb, t, false);
            thumb.classList.remove('is-loading');
            detail.appendChild(thumb);

            detail.appendChild(el('div', 'etg-detail-cat', icon(categoryIcon(t.blank ? 'featured' : t.category)) +
                '<span>' + esc(t.blank ? 'Blank' : categoryLabel(t.category)) + '</span>'));
            var title = el('h4', 'etg-detail-title');
            mxUtils.write(title, t.title);
            detail.appendChild(title);
            if (t.description) {
                var desc = el('p', 'etg-detail-desc');
                mxUtils.write(desc, t.description);
                detail.appendChild(desc);
            }

            var s = t.stats;
            if (s && s.buses) {
                var html = factHtml('Buses', s.buses) + factHtml('Lines', s.lines) +
                    factHtml('Transformers', s.transformers) + factHtml('Loads', s.loads) +
                    factHtml('Generators', s.generators) + factHtml('External grids', s.extGrids || 0);
                if (s.motors) html += factHtml('Motors', s.motors);
                if (s.storage) html += factHtml('Storage', s.storage);
                if (s.switches) html += factHtml('Switches', s.switches);
                if (s.kv && s.kv.length) {
                    html += factHtml(s.kv.length === 1 ? 'Voltage level' : 'Voltage levels',
                        s.kv.map(fmtKvValue).join(' / ') + ' kV', true);
                }
                var dl = el('dl', 'etg-facts', html);
                detail.appendChild(dl);
            }

            if (t.pages > 1) {
                detail.appendChild(el('div', 'etg-note', icon('pages') + '<span>' + esc(plural(t.pages, 'page', 'pages')) +
                    ' in this diagram. Switch pages with the tabs at the bottom of the canvas.</span>'));
            }
            if (isLarge(t)) {
                var what = s && s.buses ? s.buses + ' buses' : 'large file';
                if (t.bytes) what += ', ' + fmtBytes(t.bytes);
                detail.appendChild(el('div', 'etg-note is-warn', icon('warn') + '<span>Large network (' + esc(what) +
                    '). Opening it takes a few seconds and simulations take longer than on small grids.</span>'));
            }
            if (state.loading && state.selected === t) {
                detail.appendChild(el('div', 'etg-note', '<span class="etg-spinner"></span><span>Loading template…</span>'));
            } else if (state.error && state.selected === t) {
                detail.appendChild(el('div', 'etg-note is-error', icon('warn') + '<span>' + esc(state.error) + '</span>'));
            }
            updateFooter();
        }

        function updateFooter() {
            var t = state.selected;
            createBtn.disabled = !t || state.pendingCreate;
            createBtn.textContent = state.pendingCreate ? 'Loading…' : createLabel;
            if (!t) {
                footInfo.textContent = '';
                return;
            }
            var info = t.title;
            var m = t.blank ? '' : metaText(t, false);
            if (m) info += ' · ' + m;
            footInfo.textContent = info;
            footInfo.setAttribute('title', info);
        }

        // ---- selection & loading -----------------------------------------------------------------
        var loadToken = 0;

        function select(t, explicit) {
            var changed = state.selected !== t;
            state.selected = t;
            if (changed) {
                state.xml = null;
                state.error = null;
                state.loading = false;
                state.pendingCreate = false;
                loadToken++;
            }
            markSelected(explicit);
            if (changed && !t.blank && (explicit || !t.bytes || t.bytes <= AUTO_PREFETCH_MAX_BYTES)) {
                fetchSelected();
            }
            renderDetail();
        }

        function fetchSelected() {
            var t = state.selected;
            if (!t || t.blank || state.xml != null || state.loading) return;
            var token = ++loadToken;
            state.loading = true;
            state.error = null;
            loadTemplateXml(ui, t).then(function (text) {
                if (destroyed || token !== loadToken) return;
                state.loading = false;
                state.xml = text;
                if (!t.bytes) t.bytes = text.length;
                renderDetail();
                if (state.pendingCreate) {
                    state.pendingCreate = false;
                    create();
                }
            }, function (e) {
                if (destroyed || token !== loadToken) return;
                state.loading = false;
                state.pendingCreate = false;
                state.error = 'Could not load this template (' + (e && e.message ? e.message : e) + '). Check your connection and try again.';
                renderDetail();
            });
            renderDetail();
        }

        function create() {
            var t = state.selected;
            if (!t) return;
            if (!t.blank && state.xml == null) {
                if (state.error) {
                    state.error = null;
                }
                state.pendingCreate = true;
                fetchSelected();
                renderDetail();
                return;
            }
            var xml = t.blank ? null : state.xml;
            var libs = t.blank ? null : t.libs;
            var clibs = t.blank ? null : t.clibs;
            var url = t.blank ? null : resolveUrl(ui, t.url);

            if (callback != null) {
                if (!showName) ui.hideDialog();
                callback(xml, nameInput.value, url, libs);
                return;
            }
            var name = nameInput.value;
            if (name == null || name.length === 0) {
                nameInput.focus();
                return;
            }
            ui.pickFolder(ui.mode, function (folderId) {
                ui.createFile(name, xml, libs != null && libs.length > 0 ? libs : null, null, function () {
                    ui.hideDialog();
                }, null, folderId, null, clibs != null && clibs.length > 0 ? clibs : null);
            }, ui.mode != App.MODE_GOOGLE || ui.stateArg == null || ui.stateArg.folderId == null);
        }

        // ---- search & keyboard -------------------------------------------------------------------
        var searchTimer = null;

        function clearSearch() {
            searchInput.value = '';
            state.query = '';
            searchWrap.classList.remove('has-text');
        }

        mxEvent.addListener(searchInput, 'input', function () {
            searchWrap.classList.toggle('has-text', searchInput.value.length > 0);
            if (searchTimer) window.clearTimeout(searchTimer);
            searchTimer = window.setTimeout(function () {
                var q = mxUtils.trim(searchInput.value);
                if (q === state.query) return;
                state.query = q;
                renderSidebar();
                renderGrid(true);
            }, 120);
        });

        mxEvent.addListener(searchInput, 'keydown', function (evt) {
            if (evt.keyCode == 27 && searchInput.value) { // Escape clears the search first
                evt.preventDefault();
                evt.stopPropagation();
                clearSearch();
                renderSidebar();
                renderGrid(true);
            } else if (evt.keyCode == 40 || evt.keyCode == 13) { // Down / Enter: go to the results
                evt.preventDefault();
                focusSelectedCard();
            }
        });

        mxEvent.addListener(clearBtn, 'click', function () {
            clearSearch();
            renderSidebar();
            renderGrid(true);
            searchInput.focus();
        });

        function focusSelectedCard() {
            for (var i = 0; i < state.cards.length; i++) {
                if (state.cards[i]._etgTemplate === state.selected) {
                    state.cards[i].focus();
                    return;
                }
            }
            if (state.cards[0]) {
                select(state.cards[0]._etgTemplate, true);
                state.cards[0].focus();
            }
        }

        function cardIndex(t) {
            for (var i = 0; i < state.cards.length; i++) if (state.cards[i]._etgTemplate === t) return i;
            return -1;
        }

        function verticalNeighbour(idx, dir) {
            var cur = state.cards[idx].getBoundingClientRect();
            var cx = cur.left + cur.width / 2;
            var best = null;
            var bestRow = null;
            for (var i = 0; i < state.cards.length; i++) {
                var r = state.cards[i].getBoundingClientRect();
                var dy = dir > 0 ? r.top - cur.top : cur.top - r.top;
                if (dy <= 5) continue;
                if (bestRow == null || dy < bestRow - 5) {
                    bestRow = dy;
                    best = i;
                } else if (Math.abs(dy - bestRow) <= 5) {
                    var bx = state.cards[best].getBoundingClientRect();
                    if (Math.abs(r.left + r.width / 2 - cx) < Math.abs(bx.left + bx.width / 2 - cx)) best = i;
                }
            }
            return best;
        }

        mxEvent.addListener(grid, 'keydown', function (evt) {
            var idx = cardIndex(state.selected);
            if (idx < 0 && state.cards.length) idx = 0;
            if (idx < 0) return;
            var next = null;
            switch (evt.keyCode) {
                case 37: next = Math.max(0, idx - 1); break;                       // Left
                case 39: next = Math.min(state.cards.length - 1, idx + 1); break;  // Right
                case 38: next = verticalNeighbour(idx, -1); if (next == null) { searchInput.focus(); evt.preventDefault(); return; } break;
                case 40: next = verticalNeighbour(idx, 1); break;                  // Down
                case 36: next = 0; break;                                          // Home
                case 35: next = state.cards.length - 1; break;                     // End
                case 13:                                                            // Enter
                case 32:                                                            // Space selects
                    evt.preventDefault();
                    if (evt.keyCode == 13) create();
                    else select(state.cards[idx]._etgTemplate, true);
                    return;
                default: return;
            }
            evt.preventDefault();
            if (next != null && state.cards[next]) {
                select(state.cards[next]._etgTemplate, true);
                state.cards[next].focus();
            }
        });

        // ---- responsive layout ------------------------------------------------------------------
        function updateLayout(width) {
            if (!width) return;
            var wasNarrow = root.classList.contains('etg-narrow');
            root.classList.toggle('etg-narrow', width < 840);
            root.classList.toggle('etg-compact', width < 600);
            if (wasNarrow !== root.classList.contains('etg-narrow')) {
                state.cards.forEach(function (c) { setCardTooltip(c, c._etgTemplate); });
            }
        }
        var resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(function (entries) {
                updateLayout(entries[0].contentRect.width);
            });
            resizeObserver.observe(root);
        }

        // Stop observers when the dialog is removed from the page.
        var removalObserver = new MutationObserver(function () {
            if (!document.body.contains(root) && root._etgShown) {
                destroyed = true;
                if (resizeObserver) resizeObserver.disconnect();
                removalObserver.disconnect();
            }
        });

        // ---- first load --------------------------------------------------------------------------
        grid.appendChild(el('div', 'etg-empty', '<span class="etg-spinner" style="display:inline-block"></span><div style="margin-top:8px">Loading templates…</div>'));
        mainTitle.textContent = 'Templates';
        state.selected = insertMode ? null : BLANK;
        renderDetail();

        loadCatalogue(ui, templateFile).then(function (list) {
            if (destroyed) return;
            state.templates = list;
            renderSidebar();
            renderGrid(true);
        }, function (e) {
            if (destroyed) return;
            console.error('[templates] could not load the template list', e);
            renderSidebar();
            grid.innerHTML = '';
            grid.appendChild(el('div', 'etg-empty', icon('warn') + '<div>The template list could not be loaded.<br>You can still create a blank diagram.</div>'));
            if (!insertMode) {
                var c = cardFor(BLANK, false);
                grid.appendChild(c);
                state.cards = [c];
                select(BLANK, false);
            }
        });

        this.container = root;
        this.init = function () {
            root._etgShown = true;
            removalObserver.observe(document.body, { childList: true, subtree: false });
            updateLayout(root.getBoundingClientRect().width);
            if (showName) {
                nameInput.focus();
                nameInput.select();
            } else {
                searchInput.focus();
            }
        };
    }

    // ----------------------------------------------------------------------------------------
    // Preview generation (developer tool, see scripts/template-previews.js)
    // ----------------------------------------------------------------------------------------
    function encodeCanvas(canvas, format) {
        if (format === 'webp') {
            var webp = canvas.toDataURL('image/webp', 0.9);
            if (webp.indexOf('data:image/webp') === 0) return { dataUrl: webp, ext: '.webp' };
        }
        return { dataUrl: canvas.toDataURL('image/png'), ext: '.png' };
    }

    function post(url, payload) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ' from ' + url);
            return r.json();
        });
    }

    /**
     * Renders every template in templates/index.xml and sends the images and manifest.json to
     * the preview server (node scripts/template-previews.js), which writes templates/previews.
     */
    function generatePreviews(options) {
        options = options || {};
        var endpoint = options.endpoint || '/__template-previews/save';
        var format = options.format || 'webp';
        var ui = getUi();
        if (!ui) return Promise.reject(new Error('Electrisim is not loaded yet'));
        var manifest = { generated: new Date().toISOString(), width: PREVIEW_W, height: PREVIEW_H, templates: {} };
        var done = 0;
        var failed = [];
        return loadCatalogue(ui, null, true).then(function (list) {
            var chain = Promise.resolve();
            list.forEach(function (t) {
                chain = chain.then(function () {
                    return fetchText(resolveUrl(ui, t.url), true).then(function (text) {
                        var picked = pickModel(text);
                        var entry = { bytes: text.length, pages: picked ? picked.pages : 1 };
                        manifest.templates[t.url] = entry;
                        if (!picked) throw new Error('no diagram found');
                        entry.stats = computeStats(picked.node);
                        return renderPreview(ui, picked.node, PREVIEW_W, PREVIEW_H).then(function (canvas) {
                            var enc = encodeCanvas(canvas, format);
                            var file = t.url.replace(/\.[^./]+$/, '') + enc.ext;
                            return post(endpoint, { file: file, dataUrl: enc.dataUrl }).then(function () {
                                entry.image = file;
                                done++;
                                console.log('[templates] preview ' + done + '/' + list.length + ': ' + file);
                            });
                        });
                    }).catch(function (e) {
                        failed.push(t.url + ': ' + (e && e.message ? e.message : e));
                        console.warn('[templates] preview failed for', t.url, e);
                    });
                });
            });
            return chain.then(function () {
                return post(endpoint, { file: 'manifest.json', text: JSON.stringify(manifest, null, 2) + '\n' });
            }).then(function () {
                catalogues = {};
                return { rendered: done, total: list.length, failed: failed };
            });
        });
    }

    // ----------------------------------------------------------------------------------------
    // Install
    // ----------------------------------------------------------------------------------------
    var OriginalNewDialog = null;

    function GalleryNewDialog(editorUi, compact, showName, callback, createOnly, cancelCallback,
        leftHighlight, rightHighlight, templateExtUrl, templateCatPadding, templateFile,
        recentDocsCallback, searchDocsCallback, openExtDocCallback, showImport, createButtonLabel,
        customTempCallback) {
        if (compact || recentDocsCallback || searchDocsCallback || openExtDocCallback || customTempCallback) {
            return Reflect.construct(OriginalNewDialog, arguments);
        }
        try {
            return new TemplateGalleryDialog(editorUi, compact, showName, callback, createOnly, cancelCallback,
                leftHighlight, rightHighlight, templateExtUrl, templateCatPadding, templateFile,
                recentDocsCallback, searchDocsCallback, openExtDocCallback, showImport, createButtonLabel);
        } catch (e) {
            console.error('[templates] gallery failed, using the standard dialog', e);
            return Reflect.construct(OriginalNewDialog, arguments);
        }
    }

    function patchShowDialog() {
        if (!window.EditorUi || EditorUi.prototype.showDialog.__etg) return;
        var showDialog = EditorUi.prototype.showDialog;
        var patched = function (elt, w, h) {
            if (elt && elt.getAttribute && elt.getAttribute('data-electrisim-template-gallery') === '1') {
                var vw = window.innerWidth || document.documentElement.clientWidth || 1200;
                var vh = window.innerHeight || document.documentElement.clientHeight || 800;
                var args = Array.prototype.slice.call(arguments);
                args[1] = Math.max(Math.min(w || 0, vw - 80), Math.min(1100, vw - 140));
                args[2] = Math.max(Math.min(h || 0, vh - 80), Math.min(700, vh - 110));
                return showDialog.apply(this, args);
            }
            return showDialog.apply(this, arguments);
        };
        patched.__etg = true;
        EditorUi.prototype.showDialog = patched;
    }

    function install() {
        if (typeof window.NewDialog !== 'function' || !window.EditorUi || !window.mxUtils) return false;
        if (!window.NewDialog.__etg) {
            OriginalNewDialog = window.NewDialog;
            GalleryNewDialog.__etg = true;
            GalleryNewDialog.Original = OriginalNewDialog;
            window.NewDialog = GalleryNewDialog;
        }
        patchShowDialog();
        return true;
    }

    window.ElectrisimTemplateGallery = {
        generatePreviews: generatePreviews,
        renderPreview: renderPreview,
        pickModel: pickModel,
        computeStats: computeStats,
        Dialog: TemplateGalleryDialog
    };

    (function tryInstall(attempt) {
        if (install()) return;
        if (attempt < 200) window.setTimeout(function () { tryInstall(attempt + 1); }, 100);
    })(0);
})();
