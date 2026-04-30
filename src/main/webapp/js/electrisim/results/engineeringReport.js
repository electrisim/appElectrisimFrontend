/* =========================================================================
 *  Electrisim - Engineering Report (PDF) export
 *  -----------------------------------------------------------------------
 *  One-click, multi-page PDF report generated entirely in the browser from
 *  a Pandapower / OpenDSS Load Flow result JSON. Reuses the same metrics
 *  module the Network Health Dashboard uses, so the report can never
 *  disagree with the dashboard.
 *
 *  Public API (attached to window):
 *      window.exportEngineeringReport(dataJson, graph, opts?)
 *      window.openReportMetadataDialog(prefill, onSubmit, onCancel)
 *      window.buildPrintableReportHtml(dataJson, graph, meta)
 * =========================================================================
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    /* ---------------------------------------------------------------------
     *  CDN sources for jsPDF + autoTable + svg2pdf (optional, for vector SLD).
     *  Loaded lazily on first click. Multiple mirrors so a blocked CDN
     *  doesn't kill the feature.
     * ------------------------------------------------------------------- */
    const JSPDF_SOURCES = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
        'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
    ];
    const AUTOTABLE_SOURCES = [
        'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
        'https://unpkg.com/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
        'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',
    ];
    // svg2pdf.js is OPTIONAL — when available, the SLD is embedded as native
    // PDF vector graphics (selectable text, infinite zoom). When the load
    // fails we automatically fall back to a high-DPI rasterisation.
    const SVG2PDF_SOURCES = [
        'https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.4/dist/svg2pdf.umd.min.js',
        'https://unpkg.com/svg2pdf.js@2.2.4/dist/svg2pdf.umd.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/svg2pdf.js/2.2.4/svg2pdf.umd.min.js',
    ];

    const STORAGE_KEY      = 'electrisim.reportMetadata';
    const META_DIALOG_ID   = 'electrisim-report-meta-dialog';
    const META_STYLE_ID    = 'electrisim-report-meta-style';

    /* ---------------------------------------------------------------------
     *  Brand palette — kept in sync with networkHealthDashboard.js
     * ------------------------------------------------------------------- */
    const COLOR = {
        TEXT:    '#0f172a',
        MUTED:   '#64748b',
        BORDER:  '#e2e8f0',
        GOOD:    '#16a34a',
        WARN:    '#f59e0b',
        DANGER:  '#dc2626',
        BRAND:   '#2563eb',
        BRAND_D: '#1d4ed8',
        BG_SOFT: '#f8fafc',
    };

    // Layout constants (mm) — A4 portrait
    const PAGE = { w: 210, h: 297, margin: 14 };
    const CONTENT_W = PAGE.w - 2 * PAGE.margin;

    /* ---------------------------------------------------------------------
     *  Helpers
     * ------------------------------------------------------------------- */
    const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v))) ? null : Number(v);
    const fmt = (v, d = 2) => (num(v) === null ? '—' : num(v).toFixed(d));
    const slug = (s) => String(s || 'report').trim().replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'report';
    const nowIso = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

    function hexToRgb(hex) {
        const h = String(hex).replace('#', '');
        return [
            parseInt(h.substring(0, 2), 16),
            parseInt(h.substring(2, 4), 16),
            parseInt(h.substring(4, 6), 16),
        ];
    }

    function loadScriptOnce(srcs) {
        return new Promise((resolve, reject) => {
            const tryNext = (i) => {
                if (i >= srcs.length) return reject(new Error('All CDN sources failed: ' + srcs.join(', ')));
                const src = srcs[i];
                if (Array.from(document.scripts).some(s => s.src === src)) return resolve();
                const s = document.createElement('script');
                s.src = src;
                s.async = true;
                s.onload  = () => resolve();
                s.onerror = () => { console.warn('[Report] CDN failed, trying next:', src); tryNext(i + 1); };
                document.head.appendChild(s);
            };
            tryNext(0);
        });
    }

    let _libsPromise = null;
    function ensurePdfLibs() {
        if (_libsPromise) return _libsPromise;
        _libsPromise = loadScriptOnce(JSPDF_SOURCES)
            .then(() => loadScriptOnce(AUTOTABLE_SOURCES))
            .then(async () => {
                const jspdfNs = window.jspdf || window.jsPDF;
                if (!jspdfNs || !(jspdfNs.jsPDF || jspdfNs)) {
                    throw new Error('jsPDF did not register on window after load');
                }
                // svg2pdf.js is optional. Try to load it but don't fail the
                // whole pipeline if every CDN is blocked — we'll just use
                // raster fallback for the SLD page.
                try {
                    await loadScriptOnce(SVG2PDF_SOURCES);
                } catch (e) {
                    console.warn('[Report] svg2pdf.js could not be loaded — SLD will be rasterised. Reason:', e && e.message);
                }
                return jspdfNs;
            })
            .catch((err) => { _libsPromise = null; throw err; });
        return _libsPromise;
    }

    function getSvg2PdfFn() {
        if (typeof window.svg2pdf === 'function')      return window.svg2pdf;
        if (window.svg2pdfjs && typeof window.svg2pdfjs.svg2pdf === 'function')
            return window.svg2pdfjs.svg2pdf;
        return null;
    }

    /* ---------------------------------------------------------------------
     *  Metadata dialog
     * ------------------------------------------------------------------- */
    function ensureMetaStyle() {
        if (document.getElementById(META_STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = META_STYLE_ID;
        s.textContent = `
            #${META_DIALOG_ID}-overlay {
                position: fixed; inset: 0; background: rgba(15,23,42,0.45);
                z-index: 10000; display: flex; align-items: center; justify-content: center;
                animation: erm-fade 0.18s ease-out;
            }
            @keyframes erm-fade { from { opacity: 0 } to { opacity: 1 } }
            #${META_DIALOG_ID} {
                background: #ffffff; border-radius: 12px; width: 460px; max-width: calc(100vw - 32px);
                box-shadow: 0 24px 60px -12px rgba(15,23,42,0.35);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: ${COLOR.TEXT};
                overflow: hidden;
                animation: erm-pop 0.22s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes erm-pop {
                from { transform: translateY(8px) scale(0.98); opacity: 0; }
                to   { transform: translateY(0)    scale(1);    opacity: 1; }
            }
            #${META_DIALOG_ID} .erm-h {
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #f8fafc; padding: 14px 18px; display: flex; align-items: center; gap: 10px;
            }
            #${META_DIALOG_ID} .erm-h .erm-icon {
                width: 28px; height: 28px; border-radius: 6px;
                background: ${COLOR.BRAND};
                display: inline-flex; align-items: center; justify-content: center;
                color: #fff; font-weight: 700; font-size: 13px;
            }
            #${META_DIALOG_ID} .erm-h h3 { margin: 0; font-size: 15px; font-weight: 600; }
            #${META_DIALOG_ID} .erm-h small { display: block; font-size: 11px; color: #cbd5e1; margin-top: 2px; }
            #${META_DIALOG_ID} .erm-body { padding: 16px 18px; }
            #${META_DIALOG_ID} .erm-row { margin-bottom: 12px; }
            #${META_DIALOG_ID} label {
                display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px;
                color: ${COLOR.MUTED}; font-weight: 600; margin-bottom: 4px;
            }
            #${META_DIALOG_ID} input[type="text"], #${META_DIALOG_ID} textarea {
                width: 100%; box-sizing: border-box;
                padding: 8px 10px; font-size: 13px; color: ${COLOR.TEXT};
                border: 1px solid ${COLOR.BORDER}; border-radius: 6px; background: #ffffff;
                font-family: inherit; transition: border-color 0.15s ease, box-shadow 0.15s ease;
            }
            #${META_DIALOG_ID} input[type="text"]:focus,
            #${META_DIALOG_ID} textarea:focus {
                outline: none; border-color: ${COLOR.BRAND};
                box-shadow: 0 0 0 3px rgba(37,99,235,0.15);
            }
            #${META_DIALOG_ID} textarea { min-height: 60px; resize: vertical; }
            #${META_DIALOG_ID} .erm-remember {
                display: flex; align-items: center; gap: 8px;
                font-size: 12px; color: ${COLOR.MUTED};
                margin-top: 4px;
            }
            #${META_DIALOG_ID} .erm-foot {
                padding: 12px 18px; background: ${COLOR.BG_SOFT};
                display: flex; justify-content: flex-end; gap: 8px;
                border-top: 1px solid ${COLOR.BORDER};
            }
            #${META_DIALOG_ID} button {
                font-size: 13px; font-weight: 600; padding: 8px 14px; border-radius: 7px;
                border: 1px solid ${COLOR.BORDER}; background: #ffffff; color: ${COLOR.TEXT};
                cursor: pointer; transition: all 0.15s ease;
            }
            #${META_DIALOG_ID} button:hover { background: #f1f5f9; }
            #${META_DIALOG_ID} button.primary {
                background: linear-gradient(135deg, ${COLOR.BRAND} 0%, ${COLOR.BRAND_D} 100%);
                color: #fff; border-color: transparent;
            }
            #${META_DIALOG_ID} button.primary:hover { box-shadow: 0 6px 14px -4px rgba(37,99,235,0.45); }
            #${META_DIALOG_ID} .erm-required { color: ${COLOR.DANGER}; }
        `;
        document.head.appendChild(s);
    }

    function readStoredMeta() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function writeStoredMeta(meta) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(meta)); } catch (e) { /* no-op */ }
    }

    function getDefaultEngineerEmail() {
        try {
            const raw = localStorage.getItem('user');
            if (raw) {
                const u = JSON.parse(raw);
                if (u && u.email) return String(u.email);
            }
        } catch (e) { /* no-op */ }
        return '';
    }

    function openReportMetadataDialog(prefill, onSubmit, onCancel) {
        ensureMetaStyle();
        const stored = prefill || readStoredMeta() || {};
        const meta = {
            project:  stored.project  || '',
            engineer: stored.engineer || getDefaultEngineerEmail(),
            company:  stored.company  || '',
            notes:    stored.notes    || '',
            remember: stored.remember !== false,
        };

        const overlay = document.createElement('div');
        overlay.id = META_DIALOG_ID + '-overlay';
        overlay.innerHTML = `
            <div id="${META_DIALOG_ID}" role="dialog" aria-modal="true" aria-labelledby="${META_DIALOG_ID}-title">
                <div class="erm-h">
                    <span class="erm-icon">PDF</span>
                    <div>
                        <h3 id="${META_DIALOG_ID}-title">Engineering Report — Setup</h3>
                        <small>This information appears on the cover page.</small>
                    </div>
                </div>
                <div class="erm-body">
                    <div class="erm-row">
                        <label for="erm-project">Project name <span class="erm-required">*</span></label>
                        <input type="text" id="erm-project" placeholder="e.g. Offshore Wind Connection Study" required>
                    </div>
                    <div class="erm-row">
                        <label for="erm-engineer">Engineer</label>
                        <input type="text" id="erm-engineer" placeholder="Your name or email">
                    </div>
                    <div class="erm-row">
                        <label for="erm-company">Company</label>
                        <input type="text" id="erm-company" placeholder="Optional">
                    </div>
                    <div class="erm-row">
                        <label for="erm-notes">Notes / description</label>
                        <textarea id="erm-notes" placeholder="Optional — appears on the cover page"></textarea>
                    </div>
                    <label class="erm-remember">
                        <input type="checkbox" id="erm-remember">
                        Remember these defaults for next time
                    </label>
                </div>
                <div class="erm-foot">
                    <button type="button" class="erm-cancel">Cancel</button>
                    <button type="button" class="primary erm-submit">Generate PDF</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const $ = (sel) => overlay.querySelector(sel);
        $('#erm-project').value  = meta.project;
        $('#erm-engineer').value = meta.engineer;
        $('#erm-company').value  = meta.company;
        $('#erm-notes').value    = meta.notes;
        $('#erm-remember').checked = !!meta.remember;
        setTimeout(() => $('#erm-project').focus(), 30);

        const close = () => { try { overlay.remove(); } catch (e) {} };

        const cancel = () => {
            close();
            if (typeof onCancel === 'function') onCancel();
        };

        const submit = () => {
            const out = {
                project:  $('#erm-project').value.trim(),
                engineer: $('#erm-engineer').value.trim(),
                company:  $('#erm-company').value.trim(),
                notes:    $('#erm-notes').value.trim(),
                remember: $('#erm-remember').checked,
            };
            if (!out.project) {
                $('#erm-project').focus();
                $('#erm-project').style.borderColor = COLOR.DANGER;
                $('#erm-project').style.boxShadow   = `0 0 0 3px rgba(220,38,38,0.18)`;
                return;
            }
            if (out.remember) writeStoredMeta(out);
            close();
            if (typeof onSubmit === 'function') onSubmit(out);
        };

        overlay.querySelector('.erm-cancel').addEventListener('click', cancel);
        overlay.querySelector('.erm-submit').addEventListener('click', submit);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) cancel(); });
        overlay.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') cancel();
            else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.target.id !== 'erm-notes')) submit();
        });
    }

    /* ---------------------------------------------------------------------
     *  Diagram capture — best-effort SLD snapshot. Layered fallbacks:
     *    1. graph.getSvg(...)         — mxGraph's own export, used by drawio
     *                                   for SVG/PNG export. Most accurate.
     *    2. editor.exportToCanvas(...) — drawio editor pipeline that handles
     *                                   embedded image fills properly.
     *    3. Live <svg> clone           — last-ditch fallback rasterising
     *                                   whatever the graph container shows.
     *  Returns { dataUrl, w, h } or null on failure.
     * ------------------------------------------------------------------- */
    function findGraphContainer(graph) {
        try {
            if (graph && graph.container) return graph.container;
        } catch (e) {}
        return document.querySelector('.geDiagramContainer') ||
               document.querySelector('.geEditor') ||
               document.querySelector('[data-graph-container]');
    }

    /**
     * Locate the active EditorUi. Electrisim instantiates drawio's UI
     * asynchronously and exposes the instance at multiple property paths
     * (see index.html callback at App.main). We try every documented
     * location, including a DOM-based fallback.
     */
    function findEditorUi() {
        try {
            const A = (typeof window !== 'undefined') ? window.App : null;
            if (A) {
                // Set by Electrisim's bootstrap callback in index.html:
                //     App.main(function(app) {
                //         window.App._instance = app;
                //         window.App._editorUi = app;
                //         window.App.main.editor = app.editor;  // legacy
                //     });
                if (A._editorUi && A._editorUi.editor) return A._editorUi;
                if (A._instance && A._instance.editor) return A._instance;
                if (A.main && typeof A.main === 'object' && A.main.editor) {
                    // Some legacy code paths only set App.main.editor; try to
                    // find the EditorUi that owns this Editor instance.
                    if (A.main.editor.editorUi) return A.main.editor.editorUi;
                }
            }
            if (typeof window.editorUi !== 'undefined' && window.editorUi && window.editorUi.editor) return window.editorUi;
            if (typeof window.ui       !== 'undefined' && window.ui       && window.ui.editor)       return window.ui;

            // DOM fallback: drawio attaches the EditorUi instance to the
            // root .geEditor element as ._editorUi.
            const el = document.querySelector('.geEditor, [class*="geEditor"]');
            if (el && el._editorUi) return el._editorUi;
        } catch (e) { /* ignore */ }
        return null;
    }

    function svgElementToDataUrl(svgEl, padding, pixelRatio) {
        try {
            // Higher pixel-ratio than the on-screen size keeps the SLD crisp
            // when the PDF viewer rescales it to ~300 DPI. SVG is vector, so
            // we just stretch <Image> to the larger canvas — no quality loss.
            const pr = Math.max(1, pixelRatio || 2.5);
            const clone = svgEl.cloneNode(true);
            if (!clone.getAttribute('xmlns'))       clone.setAttribute('xmlns',       'http://www.w3.org/2000/svg');
            if (!clone.getAttribute('xmlns:xlink')) clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
            const declaredW = Number(clone.getAttribute('width'))  || 0;
            const declaredH = Number(clone.getAttribute('height')) || 0;
            const w = declaredW || svgEl.getBoundingClientRect().width  || 1200;
            const h = declaredH || svgEl.getBoundingClientRect().height || 800;
            clone.setAttribute('width',  String(w));
            clone.setAttribute('height', String(h));
            const xml = new XMLSerializer().serializeToString(clone);
            // Embed raw XML directly in a data URL to avoid blob: URL CORS issues
            // some browsers slap on cross-origin SVG <-> Image rasterisation.
            const dataSrc = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
            return new Promise((resolve, reject) => {
                const im = new Image();
                im.crossOrigin = 'anonymous';
                im.onload  = () => {
                    const pad = padding || 0;
                    const canvas = document.createElement('canvas');
                    // Cap the long edge at 6000 px so we don't OOM jsPDF on huge SLDs.
                    let effectivePr = pr;
                    const longestNative = Math.max(w + 2 * pad, h + 2 * pad);
                    if (longestNative * effectivePr > 6000) {
                        effectivePr = 6000 / longestNative;
                    }
                    canvas.width  = Math.max(1, Math.ceil((w + 2 * pad) * effectivePr));
                    canvas.height = Math.max(1, Math.ceil((h + 2 * pad) * effectivePr));
                    const ctx = canvas.getContext('2d');
                    if (typeof ctx.imageSmoothingEnabled === 'boolean') {
                        ctx.imageSmoothingEnabled = true;
                        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
                    }
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    try {
                        // Stretch the vector source to the high-res canvas in one go.
                        ctx.drawImage(im,
                            pad * effectivePr, pad * effectivePr,
                            w   * effectivePr, h   * effectivePr);
                    } catch (e) { reject(e); return; }
                    try { resolve({ dataUrl: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }); }
                    catch (e) { reject(e); }
                };
                im.onerror = () => reject(new Error('Image load failed'));
                im.src = dataSrc;
            });
        } catch (e) {
            return Promise.reject(e);
        }
    }

    /**
     * Capture the SLD. Returns either:
     *   { kind: 'canvas', canvas, dataUrl, w, h }   — preferred, drawio's
     *                                                  exportToCanvas (renders
     *                                                  every shape correctly,
     *                                                  high DPI, tile-cropable)
     *   { kind: 'svg',    element, w, h }           — vector fallback
     *   { kind: 'raster', dataUrl, w, h }           — last-resort bitmap
     *   null on total failure.
     *
     * NOTE on shape fidelity: svg2pdf.js silently drops some drawio custom
     * shape types (mxStencil-based, image-fill stencils, paintNodeShape
     * subclasses). To guarantee transformers, generators, ext-grids and
     * three-winding transformers all appear in the report we now prefer
     * drawio's own canvas pipeline as the primary path.
     */
    async function captureSldArtifact(graph) {
        const ui = findEditorUi();
        const g = graph || (ui && ui.editor && ui.editor.graph) || null;

        console.log('[Report] SLD capture — editor UI found:', !!ui,
            '| graph found:', !!g,
            '| App._editorUi:', !!(window.App && window.App._editorUi),
            '| App._instance:', !!(window.App && window.App._instance));

        if (!g) {
            console.warn('[Report] No graph reference for SLD capture.');
            return null;
        }

        const bounds = (typeof g.getGraphBounds === 'function') ? g.getGraphBounds() : null;
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
            console.warn('[Report] Graph bounds are empty; skipping SLD capture.');
            return null;
        }

        // -------- Preferred path: editor.exportToCanvas at high scale -----------
        // drawio's own PNG export pipeline. Calls convertImages() and then
        // rasterises through Image()/Canvas, so every shape type Electrisim
        // registers is rendered exactly as in the editor.
        if (ui && ui.editor && typeof ui.editor.exportToCanvas === 'function') {
            try {
                console.log('[Report] SLD capture — using editor.exportToCanvas (drawio pipeline)');
                const canvas = await new Promise((resolve, reject) => {
                    try {
                        // scale = 3 yields ~3× the editor's pixel resolution,
                        // which is plenty for landscape A4 tiling (a typical
                        // 1500×1000 source becomes 4500×3000 px).
                        ui.editor.exportToCanvas(
                            (cv) => resolve(cv),
                            /* width */ null,
                            /* imageCache */ null,
                            /* background */ '#ffffff',
                            /* error */ reject,
                            /* limitHeight */ null,
                            /* ignoreSelection */ true,
                            /* scale */ 3,
                            /* transparentBackground */ false,
                            /* addShadow */ false
                        );
                    } catch (e) { reject(e); }
                });
                if (canvas && canvas.width > 0 && canvas.height > 0) {
                    console.log(`[Report] SLD capture — canvas pipeline OK (${canvas.width}×${canvas.height} px)`);
                    return {
                        kind:    'canvas',
                        canvas:  canvas,
                        dataUrl: canvas.toDataURL('image/png'),
                        w:       canvas.width,
                        h:       canvas.height,
                    };
                }
            } catch (e) {
                console.warn('[Report] editor.exportToCanvas path failed:', e);
            }
        } else {
            console.warn('[Report] editor.exportToCanvas not available — falling back to graph.getSvg.',
                '\nThis means symbol shapes (transformers, generators, ext-grids, 3W trafos) may not render correctly.',
                '\nMake sure the report is triggered from inside the running Electrisim editor.');
        }

        // -------- Fallback 1: graph.getSvg(...) → SVG element (vector) --------
        try {
            if (typeof g.getSvg === 'function') {
                const bg = '#ffffff';
                const scale = 1;
                const border = 12;
                const noCrop = false;
                const ignoreSelection = true;
                let svgRoot = null;
                try {
                    svgRoot = g.getSvg(bg, scale, border, noCrop, null, ignoreSelection);
                } catch (e1) {
                    try { svgRoot = g.getSvg(bg); } catch (e2) { svgRoot = null; }
                }
                if (svgRoot) {
                    if (ui && ui.editor && typeof ui.editor.convertImages === 'function') {
                        await new Promise((resolve) => {
                            try { ui.editor.convertImages(svgRoot, () => resolve()); }
                            catch (e) { resolve(); }
                        });
                    }
                    const w = Number(svgRoot.getAttribute('width'))  || bounds.width  + 2 * border;
                    const h = Number(svgRoot.getAttribute('height')) || bounds.height + 2 * border;
                    return { kind: 'svg', element: svgRoot, w, h };
                }
            }
        } catch (e) {
            console.warn('[Report] graph.getSvg path failed:', e);
        }

        // -------- Fallback 2: serialize the live <svg> in the container --------
        try {
            const container = findGraphContainer(g);
            if (container) {
                const svgEl = container.querySelector('svg');
                if (svgEl) {
                    const w = Number(svgEl.getAttribute('width'))  || svgEl.getBoundingClientRect().width  || 1200;
                    const h = Number(svgEl.getAttribute('height')) || svgEl.getBoundingClientRect().height || 800;
                    return { kind: 'svg', element: svgEl.cloneNode(true), w, h };
                }
            }
        } catch (e) {
            console.warn('[Report] live <svg> capture failed:', e);
        }

        return null;
    }

    /**
     * Crop a sub-region (in source pixels) of an HTMLCanvasElement and return
     * a fresh canvas containing just that region. Used for tile pages.
     */
    function cropCanvas(sourceCanvas, sx, sy, sw, sh) {
        const out = document.createElement('canvas');
        out.width  = Math.max(1, Math.ceil(sw));
        out.height = Math.max(1, Math.ceil(sh));
        const ctx = out.getContext('2d');
        if ('imageSmoothingEnabled'  in ctx) ctx.imageSmoothingEnabled  = true;
        if ('imageSmoothingQuality'  in ctx) ctx.imageSmoothingQuality  = 'high';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, out.width, out.height);
        ctx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
        return out;
    }

    /**
     * Render the SLD onto the current PDF page. Tries vector first (svg2pdf),
     * then falls back to a 4× rasterisation if vector rendering is unavailable
     * or fails for the given diagram.
     * Returns a Promise resolving to true on success, false on failure.
     */
    async function renderSldOntoPdf(doc, sld, x, y, maxW, maxH) {
        if (!sld) return false;

        const fit = (w, h) => {
            const ratio = w / h;
            let dw = maxW, dh = dw / ratio;
            if (dh > maxH) { dh = maxH; dw = dh * ratio; }
            return { w: dw, h: dh, x: x + (maxW - dw) / 2, y };
        };

        // ----- Primary path: high-DPI canvas from drawio's own pipeline -----
        if (sld.kind === 'canvas' && sld.dataUrl) {
            const target = fit(sld.w, sld.h);
            doc.addImage(sld.dataUrl, 'PNG', target.x, target.y, target.w, target.h);
            return true;
        }

        // ----- Vector path via svg2pdf.js (when canvas path failed) -----
        if (sld.kind === 'svg' && sld.element) {
            const svg2pdfFn = getSvg2PdfFn();
            if (svg2pdfFn) {
                const target = fit(sld.w, sld.h);
                // svg2pdf needs the SVG attached to the document so getBBox /
                // getComputedTextLength etc. can run during conversion.
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;width:0;height:0;overflow:hidden;';
                host.appendChild(sld.element);
                document.body.appendChild(host);
                try {
                    await svg2pdfFn(sld.element, doc, {
                        x: target.x,
                        y: target.y,
                        width:  target.w,
                        height: target.h,
                    });
                    return true;
                } catch (e) {
                    console.warn('[Report] svg2pdf failed, falling back to raster:', e);
                } finally {
                    try { document.body.removeChild(host); } catch (e) {}
                }
            } else {
                console.warn('[Report] svg2pdf not available — using high-DPI raster.');
            }

            // ----- Vector failed → raster the SVG ourselves at high DPI -----
            try {
                // Re-attach so getBoundingClientRect works during rasterisation
                // (data URL Image rasterisation only needs serialized XML).
                const raster = await svgElementToDataUrl(sld.element, 0, 4.0);
                if (raster) {
                    const target = fit(raster.w, raster.h);
                    doc.addImage(raster.dataUrl, 'PNG', target.x, target.y, target.w, target.h);
                    return true;
                }
            } catch (e) {
                console.warn('[Report] high-DPI raster of SVG failed:', e);
            }
            return false;
        }

        // ----- Pure raster artifact -----
        if (sld.kind === 'raster' && sld.dataUrl) {
            const target = fit(sld.w, sld.h);
            doc.addImage(sld.dataUrl, 'PNG', target.x, target.y, target.w, target.h);
            return true;
        }

        return false;
    }

    // Backwards-compat alias (some callers / tests reference the old name).
    const captureSldImage = captureSldArtifact;

    /**
     * Pick a tile grid for the SLD detail pages based on diagram density.
     * Returns { cols, rows, label } where cols × rows is the number of
     * detail pages that will be added after the overview page.
     */
    function pickSldTileGrid(metrics, sld) {
        const counts = metrics && metrics.counts ? metrics.counts : {};
        const cellCount =
            (counts.buses        || 0) +
            (counts.lines        || 0) +
            (counts.transformers || 0) +
            (counts.generators   || 0) +
            (counts.loads        || 0);
        const aspect = sld && sld.w && sld.h ? (sld.w / sld.h) : 1.5;

        // Heuristic thresholds tuned for typical SLDs:
        //   ≤ 25 cells  → overview only (1×1)
        //   26–60 cells → 2×1 horizontal split (or 1×2 if SLD is tall)
        //   ≥ 61 cells  → 2×2 four-tile detail (3×2 if very wide aspect)
        if (cellCount <= 25) return { cols: 1, rows: 1, label: 'overview only' };
        if (cellCount <= 60) {
            return aspect < 0.8
                ? { cols: 1, rows: 2, label: '2-page vertical split' }
                : { cols: 2, rows: 1, label: '2-page horizontal split' };
        }
        if (aspect > 2.2)    return { cols: 3, rows: 2, label: '3 × 2 detail tiles' };
        if (aspect < 0.6)    return { cols: 2, rows: 3, label: '2 × 3 detail tiles' };
        return { cols: 2, rows: 2, label: '2 × 2 detail tiles' };
    }

    /**
     * Render a single SLD tile (sub-region of the source SVG) onto the
     * current PDF page. Uses svg2pdf when available so text remains vector;
     * otherwise rasterises the cropped sub-region at 4× DPI.
     */
    async function renderSldTile(doc, sourceSld, col, row, cols, rows, x, y, maxW, maxH) {
        if (!sourceSld) return false;

        // Sub-region of the source pixel/user-coordinate space (with overlap
        // so result boxes that straddle a tile boundary aren't truncated).
        const tileW = sourceSld.w / cols;
        const tileH = sourceSld.h / rows;
        const overlap = 0.06;
        const padX = tileW * overlap;
        const padY = tileH * overlap;
        const vbX = Math.max(0,                  col * tileW - padX);
        const vbY = Math.max(0,                  row * tileH - padY);
        const vbW = Math.min(sourceSld.w - vbX,  tileW + 2 * padX);
        const vbH = Math.min(sourceSld.h - vbY,  tileH + 2 * padY);

        const fit = (w, h) => {
            const ratio = w / h;
            let dw = maxW, dh = dw / ratio;
            if (dh > maxH) { dh = maxH; dw = dh * ratio; }
            return { w: dw, h: dh, x: x + (maxW - dw) / 2, y };
        };
        const target = fit(vbW, vbH);

        // ----- Primary path: crop sub-region of the source canvas -----
        // Canvas was already produced by drawio's exportToCanvas, so all
        // shapes are correctly rendered. We just slice and re-encode.
        if (sourceSld.kind === 'canvas' && sourceSld.canvas) {
            try {
                const sub = cropCanvas(sourceSld.canvas, vbX, vbY, vbW, vbH);
                doc.addImage(sub.toDataURL('image/png'), 'PNG',
                    target.x, target.y, target.w, target.h);
                return true;
            } catch (e) {
                console.warn(`[Report] canvas tile (${col},${row}) crop failed:`, e);
            }
        }

        // From here on we expect an SVG-backed source.
        if (!sourceSld.element) return false;

        // ----- Vector path: clone SVG with restricted viewBox -----
        const svg2pdfFn = getSvg2PdfFn();
        if (svg2pdfFn) {
            const clone = sourceSld.element.cloneNode(true);
            clone.setAttribute('viewBox',  `${vbX} ${vbY} ${vbW} ${vbH}`);
            clone.setAttribute('width',    String(vbW));
            clone.setAttribute('height',   String(vbH));
            clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            const host = document.createElement('div');
            host.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden;width:0;height:0;overflow:hidden;';
            host.appendChild(clone);
            document.body.appendChild(host);
            try {
                await svg2pdfFn(clone, doc, {
                    x: target.x, y: target.y,
                    width: target.w, height: target.h,
                });
                return true;
            } catch (e) {
                console.warn(`[Report] svg2pdf tile (${col},${row}) failed; rasterising:`, e);
            } finally {
                try { document.body.removeChild(host); } catch (e) {}
            }
        }

        // ----- Raster fallback: clone with viewBox, then high-DPI raster -----
        try {
            const clone = sourceSld.element.cloneNode(true);
            clone.setAttribute('viewBox',  `${vbX} ${vbY} ${vbW} ${vbH}`);
            clone.setAttribute('width',    String(vbW));
            clone.setAttribute('height',   String(vbH));
            const raster = await svgElementToDataUrl(clone, 0, 4.0);
            if (raster) {
                doc.addImage(raster.dataUrl, 'PNG', target.x, target.y, target.w, target.h);
                return true;
            }
        } catch (e) {
            console.warn(`[Report] raster tile (${col},${row}) failed:`, e);
        }
        return false;
    }

    /**
     * Draw a small mini-map at the given page coords showing the full SLD
     * outline with the current tile highlighted. Used as a "you are here"
     * indicator on the detail pages.
     */
    function drawTileMiniMap(doc, hexFns, col, row, cols, rows, sldAspect, x, y, maxW, maxH) {
        const { setFill, setStroke, setText } = hexFns;
        let mw = maxW, mh = mw / sldAspect;
        if (mh > maxH) { mh = maxH; mw = mh * sldAspect; }
        setFill('#ffffff');
        setStroke('#cbd5e1');
        doc.setLineWidth(0.3);
        doc.rect(x, y, mw, mh, 'FD');
        const cellW = mw / cols;
        const cellH = mh / rows;
        setStroke('#e2e8f0');
        doc.setLineWidth(0.15);
        for (let i = 1; i < cols; i++) doc.line(x + i * cellW, y,            x + i * cellW, y + mh);
        for (let i = 1; i < rows; i++) doc.line(x,             y + i * cellH, x + mw,        y + i * cellH);
        setFill(COLOR.BRAND);
        doc.setGState(new doc.GState({ opacity: 0.32 }));
        doc.rect(x + col * cellW, y + row * cellH, cellW, cellH, 'F');
        doc.setGState(new doc.GState({ opacity: 1 }));
        setStroke(COLOR.BRAND_D);
        doc.setLineWidth(0.4);
        doc.rect(x + col * cellW, y + row * cellH, cellW, cellH, 'S');
        setText(COLOR.MUTED);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('SLD overview', x, y - 1.5);
    }

    /* ---------------------------------------------------------------------
     *  Charts — rendered to off-screen canvas, embedded as PNG.
     * ------------------------------------------------------------------- */
    function renderHistogramCanvas(metrics) {
        const W = 1200, H = 360, padL = 70, padR = 20, padT = 30, padB = 50;
        const innerW = W - padL - padR;
        const innerH = H - padT - padB;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        const bins   = metrics.histogram || [];
        const labels = metrics.histLabels || [];
        const histMin = metrics.histMin ?? 0.85;
        const histMax = metrics.histMax ?? 1.15;
        const maxCount = Math.max(1, ...bins);

        // Voltage bands
        const xFor = (vm) => padL + ((vm - histMin) / (histMax - histMin)) * innerW;
        const bands = [
            { from: histMin, to: 0.90, color: 'rgba(220,38,38,0.10)' },
            { from: 0.90,    to: 0.95, color: 'rgba(245,158,11,0.10)' },
            { from: 0.95,    to: 1.05, color: 'rgba(22,163,74,0.10)' },
            { from: 1.05,    to: 1.10, color: 'rgba(245,158,11,0.10)' },
            { from: 1.10,    to: histMax, color: 'rgba(220,38,38,0.10)' },
        ];
        bands.forEach(b => {
            const bx = xFor(Math.max(b.from, histMin));
            const bw = xFor(Math.min(b.to, histMax)) - bx;
            ctx.fillStyle = b.color;
            ctx.fillRect(bx, padT, bw, innerH);
        });

        // Y axis
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + innerH);
        ctx.lineTo(W - padR, padT + innerH);
        ctx.stroke();

        ctx.fillStyle = COLOR.MUTED;
        ctx.font = '14px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        const yTicks = 4;
        for (let i = 0; i <= yTicks; i++) {
            const v = Math.round((maxCount * i) / yTicks);
            const y = padT + innerH - (i / yTicks) * innerH;
            ctx.fillText(String(v), padL - 8, y);
            ctx.strokeStyle = '#eef2f7';
            ctx.beginPath();
            ctx.moveTo(padL, y); ctx.lineTo(W - padR, y);
            ctx.stroke();
        }

        // Bars
        const barCount = bins.length;
        const barW = innerW / barCount;
        for (let i = 0; i < barCount; i++) {
            const c = bins[i];
            if (!c) continue;
            const lo = histMin + (histMax - histMin) * (i / barCount);
            const hi = histMin + (histMax - histMin) * ((i + 1) / barCount);
            const center = (lo + hi) / 2;
            const cls = (center >= 1.10 || center <= 0.90) ? COLOR.DANGER
                      : (center >  1.05 || center <  0.95) ? COLOR.WARN  : COLOR.GOOD;
            const bh = (c / maxCount) * innerH;
            const x = padL + i * barW + 4;
            const y = padT + innerH - bh;
            ctx.fillStyle = cls;
            ctx.globalAlpha = 0.9;
            ctx.fillRect(x, y, barW - 8, bh);
            ctx.globalAlpha = 1;
            ctx.fillStyle = COLOR.TEXT;
            ctx.font = '13px Helvetica, Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(String(c), x + (barW - 8) / 2, y - 2);
        }

        // X axis labels
        const ticks = [0.90, 0.95, 1.00, 1.05, 1.10];
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = COLOR.MUTED;
        ctx.font = '13px Helvetica, Arial, sans-serif';
        ticks.forEach(t => {
            const x = xFor(t);
            ctx.fillText(t.toFixed(2), x, padT + innerH + 6);
            ctx.strokeStyle = '#94a3b8';
            ctx.beginPath();
            ctx.moveTo(x, padT + innerH); ctx.lineTo(x, padT + innerH + 4);
            ctx.stroke();
        });

        ctx.fillStyle = COLOR.TEXT;
        ctx.font = 'bold 15px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Bus voltage distribution (count vs. magnitude in pu)', padL, 6);

        return { dataUrl: canvas.toDataURL('image/png'), w: W, h: H };
    }

    function renderTopLoadingCanvas(metrics) {
        const W = 1200, H = 360, padL = 220, padR = 80, padT = 30, padB = 30;
        const innerW = W - padL - padR;
        const innerH = H - padT - padB;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        const items = (metrics.top5 || []).slice();
        if (!items.length) {
            ctx.fillStyle = COLOR.MUTED;
            ctx.font = '15px Helvetica, Arial, sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('No loading data available.', W / 2, H / 2);
            return { dataUrl: canvas.toDataURL('image/png'), w: W, h: H };
        }
        const maxL = Math.max(100, ...items.map(i => i.loading_percent || 0));
        const rowH = innerH / items.length;

        // 100% reference line
        const x100 = padL + (100 / maxL) * innerW;
        ctx.strokeStyle = COLOR.DANGER;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x100, padT); ctx.lineTo(x100, padT + innerH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COLOR.DANGER;
        ctx.font = '12px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('100%', x100 + 4, padT + 2);

        items.forEach((e, i) => {
            const pct = e.loading_percent || 0;
            const cls = pct > 100 ? COLOR.DANGER : pct > 80 ? COLOR.WARN : COLOR.GOOD;
            const y = padT + i * rowH + 6;
            const h = rowH - 12;
            const w = (pct / maxL) * innerW;

            // Track
            ctx.fillStyle = '#eef2f7';
            ctx.fillRect(padL, y, innerW, h);
            // Bar
            ctx.fillStyle = cls;
            ctx.fillRect(padL, y, Math.max(2, w), h);

            // Label
            ctx.fillStyle = COLOR.TEXT;
            ctx.font = '14px Helvetica, Arial, sans-serif';
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            const label = (e.dialogName || e.name || e.id || e.kind || '—').toString().slice(0, 36);
            ctx.fillText(`${e.kind}: ${label}`, padL - 10, y + h / 2);

            // Value
            ctx.fillStyle = cls;
            ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`${pct.toFixed(1)}%`, padL + w + 8, y + h / 2);
        });

        ctx.fillStyle = COLOR.TEXT;
        ctx.font = 'bold 15px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('Top 5 most loaded equipment', padL - 200, 6);

        return { dataUrl: canvas.toDataURL('image/png'), w: W, h: H };
    }

    function renderGaugeCanvas(score, color) {
        const W = 480, H = 280;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        const cx = W / 2, cy = 200, r = 150;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 28;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, 2 * Math.PI);
        ctx.stroke();

        const frac = Math.max(0, Math.min(100, score)) / 100;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * frac);
        ctx.stroke();

        ctx.fillStyle = COLOR.TEXT;
        ctx.font = 'bold 72px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(String(Math.round(score)), cx, cy - 10);
        ctx.fillStyle = COLOR.MUTED;
        ctx.font = '18px Helvetica, Arial, sans-serif';
        ctx.fillText('out of 100', cx, cy + 18);

        return { dataUrl: canvas.toDataURL('image/png'), w: W, h: H };
    }

    /* ---------------------------------------------------------------------
     *  Status / verdict text from health score
     * ------------------------------------------------------------------- */
    function scoreStatus(score, converged) {
        if (!converged)   return { text: 'Did not converge',  color: COLOR.DANGER };
        if (score >= 90)  return { text: 'Excellent',         color: COLOR.GOOD };
        if (score >= 75)  return { text: 'Healthy',           color: COLOR.GOOD };
        if (score >= 60)  return { text: 'Acceptable',        color: COLOR.WARN };
        if (score >= 40)  return { text: 'Stressed',          color: COLOR.WARN };
        return                  { text: 'Critical',           color: COLOR.DANGER };
    }

    /* ---------------------------------------------------------------------
     *  Detailed result table builders — one per backend element category.
     *  Each returns { title, head: [...], rows: [[...]] } or null when the
     *  category is empty in the supplied dataJson.
     * ------------------------------------------------------------------- */
    function nameOf(row, fallback) {
        if (!row) return fallback || '—';
        const n = row.dialogName || row.name;
        if (n && !/^mxCell[#_]\d+$/i.test(String(n))) return String(n).replace(/_/g, '#');
        return row.id != null ? String(row.id) : (fallback || '—');
    }

    function tableForCategory(key, rows, dialogNameFor) {
        if (!Array.isArray(rows) || rows.length === 0) return null;
        const dn = dialogNameFor || ((r) => '');
        const numF = (v, d = 3) => num(v) === null ? '—' : num(v).toFixed(d);

        switch (key) {
            case 'busbars': return {
                title: 'Buses',
                head: ['Object id', 'Dialog name', 'U [pu]', 'U [deg]'],
                rows: rows.map(b => [nameOf(b, 'Bus'), dn(b) || '—', numF(b.vm_pu, 3), numF(b.va_degree, 2)]),
            };
            case 'lines': return {
                title: 'Lines',
                head: ['Object id', 'Dialog name', 'P_from [MW]', 'Q_from [MVAr]', 'I_from [kA]', 'P_to [MW]', 'Q_to [MVAr]', 'I_to [kA]', 'Loading [%]'],
                rows: rows.map(l => [
                    nameOf(l, 'Line'), dn(l) || '—',
                    numF(l.p_from_mw), numF(l.q_from_mvar), numF(l.i_from_ka),
                    numF(l.p_to_mw),   numF(l.q_to_mvar),   numF(l.i_to_ka),
                    numF(l.loading_percent, 1),
                ]),
            };
            case 'transformers': return {
                title: 'Transformers (2W)',
                head: ['Object id', 'Dialog name', 'P_HV [MW]', 'Q_HV [MVAr]', 'P_LV [MW]', 'Q_LV [MVAr]', 'Loading [%]', 'Loss [MW]'],
                rows: rows.map(t => [
                    nameOf(t, 'Trafo'), dn(t) || '—',
                    numF(t.p_hv_mw), numF(t.q_hv_mvar), numF(t.p_lv_mw), numF(t.q_lv_mvar),
                    numF(t.loading_percent, 1), numF(t.pl_mw),
                ]),
            };
            case 'transformers3W':
            case 'transformers3w': return {
                title: 'Transformers (3W)',
                head: ['Object id', 'Dialog name', 'P_HV', 'P_MV', 'P_LV', 'Loading [%]', 'Loss [MW]'],
                rows: rows.map(t => [
                    nameOf(t, '3W-Trafo'), dn(t) || '—',
                    numF(t.p_hv_mw), numF(t.p_mv_mw), numF(t.p_lv_mw),
                    numF(t.loading_percent, 1), numF(t.pl_mw),
                ]),
            };
            case 'externalgrids': return {
                title: 'External grids',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]', 'PF', 'Q/P'],
                rows: rows.map(g => [
                    nameOf(g, 'Grid'), dn(g) || '—',
                    numF(g.p_mw), numF(g.q_mvar), numF(g.pf, 3), numF(g.q_p, 3),
                ]),
            };
            case 'generators': return {
                title: 'Synchronous generators',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]', 'U [pu]', 'U [deg]'],
                rows: rows.map(g => [
                    nameOf(g, 'Gen'), dn(g) || '—',
                    numF(g.p_mw), numF(g.q_mvar), numF(g.vm_pu, 3), numF(g.va_degree, 2),
                ]),
            };
            case 'staticgenerators': return {
                title: 'Static generators',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]'],
                rows: rows.map(g => [nameOf(g, 'SGen'), dn(g) || '—', numF(g.p_mw), numF(g.q_mvar)]),
            };
            case 'asymmetricstaticgenerators': return {
                title: 'Asymmetric static generators',
                head: ['Object id', 'Dialog name', 'P_a', 'P_b', 'P_c', 'Q_a', 'Q_b', 'Q_c'],
                rows: rows.map(g => [
                    nameOf(g, 'ASGen'), dn(g) || '—',
                    numF(g.p_a_mw), numF(g.p_b_mw), numF(g.p_c_mw),
                    numF(g.q_a_mvar), numF(g.q_b_mvar), numF(g.q_c_mvar),
                ]),
            };
            case 'loads': return {
                title: 'Loads',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]'],
                rows: rows.map(l => [nameOf(l, 'Load'), dn(l) || '—', numF(l.p_mw), numF(l.q_mvar)]),
            };
            case 'asymmetricloads': return {
                title: 'Asymmetric loads',
                head: ['Object id', 'Dialog name', 'P_a', 'P_b', 'P_c', 'Q_a', 'Q_b', 'Q_c'],
                rows: rows.map(l => [
                    nameOf(l, 'ALoad'), dn(l) || '—',
                    numF(l.p_a_mw), numF(l.p_b_mw), numF(l.p_c_mw),
                    numF(l.q_a_mvar), numF(l.q_b_mvar), numF(l.q_c_mvar),
                ]),
            };
            case 'motors': return {
                title: 'Motors',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]'],
                rows: rows.map(m => [nameOf(m, 'Motor'), dn(m) || '—', numF(m.p_mw), numF(m.q_mvar)]),
            };
            case 'storages': return {
                title: 'Storages',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]'],
                rows: rows.map(s => [nameOf(s, 'Storage'), dn(s) || '—', numF(s.p_mw), numF(s.q_mvar)]),
            };
            case 'pvsystems':
            case 'pvSystems': return {
                title: 'PV systems',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]', 'U [pu]'],
                rows: rows.map(s => [nameOf(s, 'PV'), dn(s) || '—', numF(s.p_mw), numF(s.q_mvar), numF(s.vm_pu, 3)]),
            };
            case 'shunts': return {
                title: 'Shunt reactors',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]', 'U [pu]', 'Step'],
                rows: rows.map(s => [
                    nameOf(s, 'Shunt'), dn(s) || '—',
                    numF(s.p_mw), numF(s.q_mvar), numF(s.vm_pu, 3),
                    s.step != null ? String(Math.round(Number(s.step))) : '—',
                ]),
            };
            case 'capacitors': return {
                title: 'Capacitors',
                head: ['Object id', 'Dialog name', 'P [MW]', 'Q [MVAr]', 'U [pu]'],
                rows: rows.map(c => [nameOf(c, 'Cap'), dn(c) || '—', numF(c.p_mw), numF(c.q_mvar), numF(c.vm_pu, 3)]),
            };
        }
        return null;
    }

    function buildDetailedSections(dataJson, graph) {
        const dn = (typeof window !== 'undefined' && typeof window.createDialogNameResolver === 'function')
            ? window.createDialogNameResolver(graph)
            : (() => '');
        const order = [
            'externalgrids', 'busbars', 'lines',
            'transformers', 'transformers3W', 'transformers3w',
            'generators', 'staticgenerators', 'asymmetricstaticgenerators',
            'loads', 'asymmetricloads', 'motors', 'storages',
            'pvsystems', 'pvSystems',
            'shunts', 'capacitors',
        ];
        const seen = new Set();
        const out = [];
        for (const key of order) {
            if (seen.has(key)) continue;
            const tbl = tableForCategory(key, dataJson?.[key], dn);
            if (tbl) { out.push(tbl); seen.add(key); }
        }
        return out;
    }

    /* ---------------------------------------------------------------------
     *  Section builders — pure data, exposed for unit tests.
     * ------------------------------------------------------------------- */
    function buildKpiCells(metrics) {
        const lossPct  = metrics.totalGen ? (metrics.totalLosses / metrics.totalGen) * 100 : 0;
        const lossCls  = lossPct > 8 ? 'danger' : lossPct > 4 ? 'warn' : 'good';
        const vMin     = metrics.minV;
        const vMax     = metrics.maxV;
        const vCls     = (vMin !== null && (vMin <= 0.90 || (vMax !== null && vMax >= 1.10))) ? 'danger'
                       : (vMin !== null && (vMin < 0.95 || (vMax !== null && vMax > 1.05)))   ? 'warn'  : 'good';
        const lCls     = metrics.maxL == null ? 'unknown'
                       : metrics.maxL > 100 ? 'danger' : metrics.maxL > 80 ? 'warn' : 'good';
        const violations = (metrics.equipmentBuckets?.warn || 0) + (metrics.equipmentBuckets?.danger || 0)
                         + (metrics.busBuckets?.warn       || 0) + (metrics.busBuckets?.danger       || 0);
        const violCls = (metrics.equipmentBuckets?.danger || 0) + (metrics.busBuckets?.danger || 0) > 0
            ? 'danger'
            : violations > 0 ? 'warn' : 'good';

        return [
            { label: 'Total Generation', value: fmt(metrics.totalGen, 2),  unit: 'MW', sub: `${metrics.counts?.generators || 0} sources`, cls: 'info' },
            { label: 'Total Load',       value: fmt(metrics.totalLoad, 2), unit: 'MW', sub: `${metrics.counts?.loads || 0} loads/motors`, cls: 'info' },
            { label: 'System Losses',    value: fmt(metrics.totalLosses, 3), unit: 'MW', sub: `${fmt(lossPct, 2)} % of generation`, cls: lossCls },
            { label: 'Voltage Range',    value: (vMin !== null && vMax !== null ? `${vMin.toFixed(2)} – ${vMax.toFixed(2)}` : '—'), unit: 'pu', sub: `${metrics.busBuckets?.good || 0}/${metrics.busBuckets?.total || 0} buses in band`, cls: vCls },
            { label: 'Max Loading',      value: metrics.maxL !== null && metrics.maxL !== undefined ? fmt(metrics.maxL, 1) : '—', unit: '%', sub: metrics.maxLEntity ? `${metrics.maxLEntity.kind}: ${metrics.maxLEntity.dialogName || metrics.maxLEntity.name || metrics.maxLEntity.id}` : '—', cls: lCls },
            { label: 'Violations',       value: String(violations), unit: '', sub: `${(metrics.equipmentBuckets?.danger || 0) + (metrics.busBuckets?.danger || 0)} critical · ${(metrics.equipmentBuckets?.warn || 0) + (metrics.busBuckets?.warn || 0)} warning`, cls: violCls },
        ];
    }

    function buildBreakdownRows(breakdown, total) {
        if (!Array.isArray(breakdown) || breakdown.length === 0) return [];
        const rows = breakdown.map(r => [r.label, String(r.count || 0), fmt(r.value, 3) + ' MW']);
        rows.push(['TOTAL', '', fmt(total, 3) + ' MW']);
        return rows;
    }

    function buildIssueRows(metrics) {
        const items = (metrics.issues || []).slice();
        return items.map(i => [i.severity.toUpperCase(), i.title, i.detail]);
    }

    function buildBusRows(dataJson, dialogNameFor) {
        const buses = Array.isArray(dataJson?.busbars) ? dataJson.busbars : [];
        return buses
            .map(b => {
                const v = num(b.vm_pu);
                let band = 'OK';
                if (v !== null && (v >= 1.10 || v <= 0.90)) band = 'CRITICAL';
                else if (v !== null && (v > 1.05 || v < 0.95)) band = 'WARN';
                return {
                    name:  nameOf(b, 'Bus'),
                    dialog: dialogNameFor ? (dialogNameFor(b) || '—') : '—',
                    vm_pu: v,
                    va:    num(b.va_degree),
                    band,
                };
            })
            .sort((a, b) => (a.vm_pu || 0) - (b.vm_pu || 0))
            .map(r => [r.name, r.dialog, fmt(r.vm_pu, 3), fmt(r.va, 2), r.band]);
    }

    function buildLoadingRows(dataJson, dialogNameFor) {
        const lines  = Array.isArray(dataJson?.lines) ? dataJson.lines : [];
        const tr2w   = Array.isArray(dataJson?.transformers) ? dataJson.transformers : [];
        const tr3w   = Array.isArray(dataJson?.transformers3W) ? dataJson.transformers3W
                     : (Array.isArray(dataJson?.transformers3w) ? dataJson.transformers3w : []);
        const all = [
            ...lines.map(x => ({ kind: 'Line', ...x })),
            ...tr2w.map(x => ({ kind: 'Trafo', ...x })),
            ...tr3w.map(x => ({ kind: '3W-Trafo', ...x })),
        ].filter(x => num(x.loading_percent) !== null);
        return all
            .sort((a, b) => (b.loading_percent || 0) - (a.loading_percent || 0))
            .map(x => [
                x.kind,
                nameOf(x, x.kind),
                dialogNameFor ? (dialogNameFor(x) || '—') : '—',
                fmt(x.loading_percent, 1),
                x.loading_percent > 100 ? 'CRITICAL' : x.loading_percent > 80 ? 'WARN' : 'OK',
            ]);
    }

    /* ---------------------------------------------------------------------
     *  Comparison vs Baseline page (stretch goal).
     *
     *  Resolves a pinned baseline (window.getBaselineSnapshot) and the
     *  compare helper (window.computeScenarioDelta) and appends a single
     *  landscape page with KPI deltas + top movers tables. No-op silently
     *  when no baseline is pinned or the compare module is missing.
     * ------------------------------------------------------------------- */
    async function renderComparisonPage(doc, dataJson, graph, meta, helpers) {
        if (!doc || typeof doc.addPage !== 'function') return;
        if (typeof window === 'undefined') return;
        if (typeof window.getBaselineSnapshot !== 'function' ||
            typeof window.computeScenarioDelta !== 'function') {
            return;
        }
        let baseline = null;
        try { baseline = await window.getBaselineSnapshot(); }
        catch (e) { console.warn('[Report] baseline lookup failed:', e); }
        if (!baseline || !baseline.dataJson) return;

        const { drawHeaderBand, setFill, setText, setStroke, hexToRgb } = helpers;
        const delta = window.computeScenarioDelta(baseline.dataJson, dataJson, graph);

        doc.addPage('a4', 'portrait');
        const baseLabel = baseline.label || 'Baseline';
        const baseTs    = baseline.ts ? new Date(baseline.ts).toLocaleString() : '';
        drawHeaderBand('Comparison vs Baseline', `${baseLabel}${baseTs ? ` · ${baseTs}` : ''} → Current run`);

        // ---- Sub-header summary line ----
        setText(COLOR.MUTED);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        const migCount = (delta.statusMigrations || []).length;
        const summary =
            `${migCount} status migration${migCount === 1 ? '' : 's'} · ` +
            `${(delta.perBus || []).length} bus deltas · ` +
            `${(delta.perBranch || []).length} branch deltas` +
            ((delta.addedRemoved.added.length || delta.addedRemoved.removed.length)
                ? ` · ${delta.addedRemoved.added.length} added · ${delta.addedRemoved.removed.length} removed`
                : '');
        doc.text(summary, PAGE.margin, 28);

        // ---- KPI delta table ----
        const kpiBody = [];
        const kpiRow = (label, kpi, decimals, unit) => {
            if (!kpi) return;
            const base = (kpi.baseline === null || kpi.baseline === undefined) ? '—' : Number(kpi.baseline).toFixed(decimals);
            const curr = (kpi.current  === null || kpi.current  === undefined) ? '—' : Number(kpi.current ).toFixed(decimals);
            const sign = (kpi.delta > 0) ? '+' : '';
            const dlt  = (kpi.delta === null || kpi.delta === undefined) ? '—' : `${sign}${Number(kpi.delta).toFixed(decimals)}`;
            const dir  = kpi.direction === 'improved' ? 'IMPROVED'
                       : kpi.direction === 'worsened' ? 'WORSENED'
                       : 'NEUTRAL';
            kpiBody.push([label, `${base}${unit}`, `${curr}${unit}`, `${dlt}${unit}`, dir]);
        };
        kpiRow('Health Score',     delta.kpiDelta.healthScore, 0, '');
        kpiRow('Total Generation', delta.kpiDelta.totalGen,    2, ' MW');
        kpiRow('Total Load',       delta.kpiDelta.totalLoad,   2, ' MW');
        kpiRow('Total Losses',     delta.kpiDelta.totalLosses, 3, ' MW');
        kpiRow('Loss %',           delta.kpiDelta.lossPct,     2, ' %');
        kpiRow('Violations',       delta.kpiDelta.violations,  0, '');
        kpiRow('Min Bus Voltage',  delta.kpiDelta.minV,        3, ' pu');
        kpiRow('Max Bus Voltage',  delta.kpiDelta.maxV,        3, ' pu');
        kpiRow('Max Loading',      delta.kpiDelta.maxLoading,  1, ' %');

        if (doc.autoTable && kpiBody.length) {
            doc.autoTable({
                startY: 33,
                margin: { left: PAGE.margin, right: PAGE.margin },
                head: [['Metric', 'Baseline', 'Current', 'Δ', 'Direction']],
                body: kpiBody,
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.4 },
                headStyles: { fillColor: hexToRgb(COLOR.TEXT), textColor: [255,255,255] },
                columnStyles: {
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' },
                    4: { halign: 'center', cellWidth: 24, fontStyle: 'bold' },
                },
                didParseCell: (d) => {
                    if (d.section !== 'body' || d.column.index !== 4) return;
                    const v = String(d.cell.raw || '').toUpperCase();
                    if      (v === 'IMPROVED') { d.cell.styles.fillColor = [220, 252, 231]; d.cell.styles.textColor = hexToRgb(COLOR.GOOD); }
                    else if (v === 'WORSENED') { d.cell.styles.fillColor = [254, 226, 226]; d.cell.styles.textColor = hexToRgb(COLOR.DANGER); }
                    else                       { d.cell.styles.textColor = hexToRgb(COLOR.MUTED); }
                },
            });
        }

        let cursorY = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : 60) + 8;

        // ---- Status migrations callout ----
        if (migCount && cursorY < PAGE.h - 40) {
            const lines = (delta.statusMigrations || []).slice(0, 6);
            const blockH = 8 + lines.length * 5 + 4;
            setFill('#fff7ed');
            setStroke('#fed7aa');
            doc.setLineWidth(0.4);
            doc.roundedRect(PAGE.margin, cursorY, CONTENT_W, blockH, 2, 2, 'FD');
            setText(COLOR.TEXT);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.text(`${migCount} band migration${migCount === 1 ? '' : 's'}`, PAGE.margin + 3, cursorY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            for (let i = 0; i < lines.length; i++) {
                const m = lines[i];
                const sign = (typeof m.delta === 'number' && m.delta > 0) ? '+' : '';
                const dn = (typeof m.delta === 'number')
                    ? `${sign}${Number(m.delta).toFixed(m.unit === 'pu' ? 3 : 1)} ${m.unit}`
                    : '';
                const text = `${m.kind} · ${m.name}: ${m.from} → ${m.to}${dn ? '   (' + dn + ')' : ''}`;
                doc.text(text, PAGE.margin + 4, cursorY + 11 + i * 5);
            }
            cursorY += blockH + 8;
        }

        // ---- Top bus movers table ----
        if (doc.autoTable && (delta.perBus || []).length && cursorY < PAGE.h - 60) {
            setText(COLOR.TEXT);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Top Bus Voltage Movers', PAGE.margin, cursorY);
            const busRows = (delta.perBus || []).slice(0, 8).map(r => [
                r.dialogName || r.name || r.id || '—',
                Number(r.vm_pu_base).toFixed(3),
                Number(r.vm_pu_curr).toFixed(3),
                `${r.delta > 0 ? '+' : ''}${Number(r.delta).toFixed(3)}`,
                `${r.band_base} → ${r.band_curr}`,
                r.severity.toUpperCase(),
            ]);
            doc.autoTable({
                startY: cursorY + 3,
                margin: { left: PAGE.margin, right: PAGE.margin },
                head: [['Bus', 'Base [pu]', 'Current [pu]', 'Δ [pu]', 'Status', 'Direction']],
                body: busRows,
                theme: 'striped',
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.1 },
                headStyles: { fillColor: hexToRgb(COLOR.BRAND), textColor: [255,255,255] },
                columnStyles: {
                    1: { halign: 'right' }, 2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' },
                    5: { halign: 'center', cellWidth: 22 },
                },
                didParseCell: (d) => {
                    if (d.section !== 'body' || d.column.index !== 5) return;
                    const v = String(d.cell.raw || '').toUpperCase();
                    if      (v === 'IMPROVED') { d.cell.styles.textColor = hexToRgb(COLOR.GOOD);   d.cell.styles.fontStyle = 'bold'; }
                    else if (v === 'WORSENED') { d.cell.styles.textColor = hexToRgb(COLOR.DANGER); d.cell.styles.fontStyle = 'bold'; }
                },
            });
            cursorY = (doc.lastAutoTable && doc.lastAutoTable.finalY) + 8;
        }

        // ---- Top branch movers table ----
        if (doc.autoTable && (delta.perBranch || []).length && cursorY < PAGE.h - 30) {
            setText(COLOR.TEXT);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.text('Top Branch Loading Movers', PAGE.margin, cursorY);
            const brRows = (delta.perBranch || []).slice(0, 8).map(r => [
                r.kind === 'transformer' ? 'Trafo' : r.kind === 'transformer3w' ? '3W' : 'Line',
                r.dialogName || r.name || r.id || '—',
                Number(r.loading_base).toFixed(1) + ' %',
                Number(r.loading_curr).toFixed(1) + ' %',
                `${r.delta > 0 ? '+' : ''}${Number(r.delta).toFixed(1)} %`,
                `${r.band_base} → ${r.band_curr}`,
                r.severity.toUpperCase(),
            ]);
            doc.autoTable({
                startY: cursorY + 3,
                margin: { left: PAGE.margin, right: PAGE.margin },
                head: [['Type', 'Element', 'Base', 'Current', 'Δ', 'Status', 'Direction']],
                body: brRows,
                theme: 'striped',
                styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.1 },
                headStyles: { fillColor: hexToRgb(COLOR.BRAND), textColor: [255,255,255] },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
                    2: { halign: 'right' }, 3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold' },
                    6: { halign: 'center', cellWidth: 22 },
                },
                didParseCell: (d) => {
                    if (d.section !== 'body' || d.column.index !== 6) return;
                    const v = String(d.cell.raw || '').toUpperCase();
                    if      (v === 'IMPROVED') { d.cell.styles.textColor = hexToRgb(COLOR.GOOD);   d.cell.styles.fontStyle = 'bold'; }
                    else if (v === 'WORSENED') { d.cell.styles.textColor = hexToRgb(COLOR.DANGER); d.cell.styles.fontStyle = 'bold'; }
                },
            });
        }
    }

    /* ---------------------------------------------------------------------
     *  PDF generation
     * ------------------------------------------------------------------- */
    async function generatePdf(dataJson, graph, meta) {
        const jspdfNs = await ensurePdfLibs();
        const JsPDFCtor = (jspdfNs && jspdfNs.jsPDF) || jspdfNs;
        if (!JsPDFCtor) throw new Error('jsPDF unavailable');

        const doc = new JsPDFCtor({ unit: 'mm', format: 'a4', compress: true });

        const metrics = (typeof window !== 'undefined' && typeof window.computeNetworkHealthMetrics === 'function')
            ? window.computeNetworkHealthMetrics(dataJson, graph)
            : null;
        if (!metrics) throw new Error('Network Health metrics not available; ensure networkHealthDashboard.js is loaded.');

        const status = scoreStatus(metrics.healthScore, metrics.converged);
        const dialogNameFor = (typeof window !== 'undefined' && typeof window.createDialogNameResolver === 'function')
            ? window.createDialogNameResolver(graph)
            : (() => '');

        const engine = (dataJson && (dataJson.engine || dataJson.solver)) ||
                       (Array.isArray(dataJson?.opendss_commands) ? 'OpenDSS' : 'Pandapower');

        // ---------- helpers scoped to the document ----------
        const setFill = (hex) => doc.setFillColor.apply(doc, hexToRgb(hex));
        const setText = (hex) => doc.setTextColor.apply(doc, hexToRgb(hex));
        const setStroke = (hex) => doc.setDrawColor.apply(doc, hexToRgb(hex));

        // Returns the current page's (w, h) in mm — supports mixed orientations.
        const currentPageSize = () => {
            try {
                const ps = doc.internal.pageSize;
                const w = (typeof ps.getWidth  === 'function') ? ps.getWidth()  : ps.width;
                const h = (typeof ps.getHeight === 'function') ? ps.getHeight() : ps.height;
                return { w: w || PAGE.w, h: h || PAGE.h };
            } catch (e) { return { w: PAGE.w, h: PAGE.h }; }
        };

        const drawHeaderBand = (title, subtitle) => {
            const ps = currentPageSize();
            setFill('#0f172a');
            doc.rect(0, 0, ps.w, 22, 'F');
            setText('#ffffff');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(String(title), PAGE.margin, 11);
            if (subtitle) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                setText('#cbd5e1');
                doc.text(String(subtitle), PAGE.margin, 17);
            }
            setText(COLOR.TEXT);
            doc.setFont('helvetica', 'normal');
        };

        const drawFooter = () => {
            const total = doc.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                const ps = currentPageSize();
                setText(COLOR.MUTED);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.text(`Electrisim · ${meta.project || ''}`, PAGE.margin, ps.h - 6);
                doc.text(new Date().toISOString().slice(0, 19).replace('T', ' '), ps.w / 2, ps.h - 6, { align: 'center' });
                doc.text(`Page ${i} / ${total}`, ps.w - PAGE.margin, ps.h - 6, { align: 'right' });
                setStroke(COLOR.BORDER);
                doc.setLineWidth(0.2);
                doc.line(PAGE.margin, ps.h - 9, ps.w - PAGE.margin, ps.h - 9);
            }
        };

        const fitImage = (img, maxW, maxH) => {
            if (!img || !img.w || !img.h) return null;
            const ratio = img.w / img.h;
            let w = maxW, h = w / ratio;
            if (h > maxH) { h = maxH; w = h * ratio; }
            return { w, h };
        };

        // ============= PAGE 1: COVER =============
        setFill('#0f172a');
        doc.rect(0, 0, PAGE.w, 90, 'F');
        // Brand mark
        setFill(COLOR.BRAND);
        doc.roundedRect(PAGE.margin, 18, 16, 16, 3, 3, 'F');
        setText('#ffffff');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('E', PAGE.margin + 8, 28, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        setText('#cbd5e1');
        doc.text('ELECTRISIM', PAGE.margin + 22, 24);
        doc.setFontSize(8);
        doc.text('Power System Analysis', PAGE.margin + 22, 30);

        setText('#ffffff');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.text('Engineering Report', PAGE.margin, 56);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(13);
        setText('#cbd5e1');
        doc.text('Load Flow study', PAGE.margin, 66);
        doc.setFontSize(11);
        doc.text(`Engine: ${engine}`, PAGE.margin, 74);

        // Project block
        setText(COLOR.TEXT);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text(meta.project || 'Untitled project', PAGE.margin, 110);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        setText(COLOR.MUTED);
        const metaLines = [];
        if (meta.engineer) metaLines.push(`Engineer: ${meta.engineer}`);
        if (meta.company)  metaLines.push(`Company: ${meta.company}`);
        metaLines.push(`Generated: ${new Date().toLocaleString()}`);
        metaLines.push(`Network: ${metrics.counts.buses} buses · ${metrics.counts.lines} lines · ${metrics.counts.transformers} transformers · ${metrics.counts.generators} sources`);
        doc.text(metaLines, PAGE.margin, 118);

        if (meta.notes) {
            doc.setFont('helvetica', 'italic');
            setText(COLOR.TEXT);
            doc.setFontSize(10);
            const wrapped = doc.splitTextToSize(meta.notes, CONTENT_W - 60);
            doc.text(wrapped, PAGE.margin, 145);
        }

        // Health score gauge on the right
        const gauge = renderGaugeCanvas(metrics.healthScore, status.color);
        const gFit = fitImage(gauge, 70, 50);
        if (gauge && gFit) {
            doc.addImage(gauge.dataUrl, 'PNG', PAGE.w - PAGE.margin - gFit.w, 105, gFit.w, gFit.h);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            setText(status.color);
            doc.text(status.text, PAGE.w - PAGE.margin, 105 + gFit.h + 6, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            setText(COLOR.MUTED);
            doc.text('Network Health Score', PAGE.w - PAGE.margin, 105 + gFit.h + 12, { align: 'right' });
        }

        // Bottom strip
        setFill(COLOR.BG_SOFT);
        doc.rect(0, PAGE.h - 30, PAGE.w, 30, 'F');
        setText(COLOR.MUTED);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Generated automatically by Electrisim from the load flow result JSON.', PAGE.margin, PAGE.h - 18);
        doc.text('Open-source power system analysis · electrisim.com', PAGE.margin, PAGE.h - 12);

        // ============= PAGE 2: EXECUTIVE SUMMARY =============
        doc.addPage();
        drawHeaderBand('Executive Summary', `${meta.project || 'Project'} · Engine: ${engine}`);

        // KPI grid (2 rows × 3 cols)
        const kpis = buildKpiCells(metrics);
        const kpiCellW = (CONTENT_W - 8) / 3;
        const kpiCellH = 26;
        let y = 30;
        kpis.forEach((k, i) => {
            const col = i % 3, row = Math.floor(i / 3);
            const x = PAGE.margin + col * (kpiCellW + 4);
            const yy = y + row * (kpiCellH + 4);
            setFill(COLOR.BG_SOFT);
            setStroke(COLOR.BORDER);
            doc.setLineWidth(0.3);
            doc.roundedRect(x, yy, kpiCellW, kpiCellH, 2, 2, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            setText(COLOR.MUTED);
            doc.text(k.label.toUpperCase(), x + 3, yy + 5);
            doc.setFontSize(15);
            const valueColor = k.cls === 'danger' ? COLOR.DANGER
                             : k.cls === 'warn'   ? COLOR.WARN
                             : k.cls === 'good'   ? COLOR.GOOD
                             : COLOR.BRAND;
            setText(valueColor);
            doc.text(`${k.value}${k.unit ? '  ' + k.unit : ''}`, x + 3, yy + 13);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            setText(COLOR.MUTED);
            const wrapped = doc.splitTextToSize(k.sub || '', kpiCellW - 6);
            doc.text(wrapped, x + 3, yy + 19);
        });

        // Verdict band
        const verdictY = y + 2 * (kpiCellH + 4) + 4;
        setFill(status.color);
        doc.setGState(new doc.GState({ opacity: 0.10 }));
        doc.rect(PAGE.margin, verdictY, CONTENT_W, 14, 'F');
        doc.setGState(new doc.GState({ opacity: 1 }));
        setText(status.color);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`System Status: ${status.text} (Score ${metrics.healthScore}/100)`, PAGE.margin + 4, verdictY + 9);

        // Generation / Load breakdown tables
        const startTablesY = verdictY + 22;
        const halfW = (CONTENT_W - 6) / 2;
        if (window.jspdf && window.jspdf.autoTable || doc.autoTable) {
            const at = doc.autoTable.bind(doc);
            at({
                startY: startTablesY,
                margin: { left: PAGE.margin },
                tableWidth: halfW,
                head: [['Generation source', 'Count', 'Active power']],
                body: buildBreakdownRows(metrics.breakdownGen,  metrics.totalGen),
                theme: 'grid',
                styles:        { font: 'helvetica', fontSize: 8.5, cellPadding: 1.4 },
                headStyles:    { fillColor: hexToRgb(COLOR.BRAND), textColor: [255,255,255], fontStyle: 'bold' },
                columnStyles:  { 1: { halign: 'right', cellWidth: 14 }, 2: { halign: 'right', cellWidth: 26 } },
                didParseCell:  (d) => { if (d.row.index === metrics.breakdownGen.length) d.cell.styles.fontStyle = 'bold'; },
            });
            at({
                startY: startTablesY,
                margin: { left: PAGE.margin + halfW + 6 },
                tableWidth: halfW,
                head: [['Load / consumption', 'Count', 'Active power']],
                body: buildBreakdownRows(metrics.breakdownLoad, metrics.totalLoad),
                theme: 'grid',
                styles:        { font: 'helvetica', fontSize: 8.5, cellPadding: 1.4 },
                headStyles:    { fillColor: hexToRgb(COLOR.BRAND_D), textColor: [255,255,255], fontStyle: 'bold' },
                columnStyles:  { 1: { halign: 'right', cellWidth: 14 }, 2: { halign: 'right', cellWidth: 26 } },
                didParseCell:  (d) => { if (d.row.index === metrics.breakdownLoad.length) d.cell.styles.fontStyle = 'bold'; },
            });
        }

        // ============= PAGE 3: SLD (landscape A4 overview) =============
        doc.addPage('a4', 'landscape');
        const sldPS = currentPageSize();
        const sldContentW = sldPS.w - 2 * PAGE.margin;
        drawHeaderBand('Single-Line Diagram', `${meta.project || 'Project'} · Overview`);
        let sld = null;
        try { sld = await captureSldArtifact(graph); }
        catch (e) { console.warn('[Report] SLD capture threw:', e); }
        let sldRendered = false;
        // Tile grid is decided up-front so we can mention it in the overview caption.
        const tileGrid = sld ? pickSldTileGrid(metrics, sld) : { cols: 1, rows: 1, label: '' };
        if (sld) {
            const sldTopY        = 28;
            const sldBottomLimit = sldPS.h - 18;
            sldRendered = await renderSldOntoPdf(
                doc, sld,
                PAGE.margin, sldTopY,
                sldContentW, sldBottomLimit - sldTopY
            );
            if (sldRendered) {
                setText(COLOR.MUTED);
                doc.setFontSize(8);
                const flavour =
                      sld.kind === 'canvas'                 ? `drawio canvas pipeline · ${sld.w}×${sld.h} px`
                    : (sld.kind === 'svg' && getSvg2PdfFn()) ? 'vector (selectable text)'
                    : (sld.kind === 'svg')                   ? `4× raster (${Math.round(sld.w * 4)}×${Math.round(sld.h * 4)} px)`
                    :                                          `raster (${sld.w}×${sld.h} px)`;
                const tileNote = (tileGrid.cols * tileGrid.rows > 1)
                    ? ` · detail follows on ${tileGrid.cols * tileGrid.rows} pages (${tileGrid.label})`
                    : '';
                doc.text(
                    `Captured at ${new Date().toLocaleString()} · ${metrics.counts.buses} buses, ${metrics.counts.lines} lines, ${metrics.counts.transformers} transformers · ${flavour}${tileNote}`,
                    PAGE.margin, sldBottomLimit + 4
                );
            }
        }
        if (!sldRendered) {
            // No usable graph in this context — typically the preview page,
            // a headless test, or a graph with no cells. Give the user a
            // helpful explanation instead of a blank page.
            const noGraph = !graph || typeof graph.getGraphBounds !== 'function';
            const emptyGraph = !noGraph && (() => {
                try {
                    const b = graph.getGraphBounds();
                    return !b || b.width <= 0 || b.height <= 0;
                } catch (e) { return true; }
            })();
            setFill(COLOR.BG_SOFT);
            setStroke(COLOR.BORDER);
            doc.setLineWidth(0.4);
            doc.roundedRect(PAGE.margin, 36, sldContentW, 60, 4, 4, 'FD');
            setText(COLOR.TEXT);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('Single-line diagram unavailable', PAGE.margin + 6, 50);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            setText(COLOR.MUTED);
            const reason =
                noGraph    ? 'The report was generated without a live mxGraph reference (e.g. from a preview page or a headless test).'
              : emptyGraph ? 'The graph reports zero bounds, which usually means no cells are visible at the time of export.'
              :              'The graph could not be serialized via mxGraph.getSvg() / Editor.exportToCanvas() in this browser session.';
            doc.text(doc.splitTextToSize(reason, sldContentW - 12), PAGE.margin + 6, 60);
            doc.text(
                doc.splitTextToSize('Tip: open the Network Health Dashboard from the Electrisim editor (after running Load Flow) and click Export Report there — the active diagram will be captured automatically.', sldContentW - 12),
                PAGE.margin + 6, 80
            );
        }

        // ============= PAGES 3.x: SLD DETAIL TILES =============
        // Rendered after the overview page when the diagram is dense. Each
        // tile gets its own landscape A4 page so result-box text is easily
        // legible. Mini-map at the bottom shows the tile's location.
        if (sldRendered && sld && (sld.kind === 'canvas' || sld.kind === 'svg') && (tileGrid.cols * tileGrid.rows > 1)) {
            const positionLabel = (col, row, cols, rows) => {
                if (rows === 1) return `column ${col + 1} of ${cols}`;
                if (cols === 1) return `row ${row + 1} of ${rows}`;
                const v = (rows === 2) ? (row === 0 ? 'top' : 'bottom')
                                       : (row === 0 ? 'top' : row === rows - 1 ? 'bottom' : `row ${row + 1}`);
                const h = (cols === 2) ? (col === 0 ? 'left' : 'right')
                                       : (col === 0 ? 'left' : col === cols - 1 ? 'right' : `col ${col + 1}`);
                return `${v} ${h}`;
            };
            let tileIdx = 0;
            const totalTiles = tileGrid.cols * tileGrid.rows;
            for (let row = 0; row < tileGrid.rows; row++) {
                for (let col = 0; col < tileGrid.cols; col++) {
                    tileIdx++;
                    doc.addPage('a4', 'landscape');
                    const ps = currentPageSize();
                    const contentW = ps.w - 2 * PAGE.margin;
                    drawHeaderBand(
                        `Single-Line Diagram — Detail ${tileIdx} / ${totalTiles}`,
                        `${meta.project || 'Project'} · ${positionLabel(col, row, tileGrid.cols, tileGrid.rows)}`
                    );
                    const tileTopY     = 28;
                    const miniMapH     = 22;
                    const tileBottomY  = ps.h - 18 - miniMapH;
                    const tileMaxH     = tileBottomY - tileTopY;
                    const ok = await renderSldTile(
                        doc, sld, col, row,
                        tileGrid.cols, tileGrid.rows,
                        PAGE.margin, tileTopY,
                        contentW, tileMaxH
                    );
                    if (ok) {
                        // Caption above the mini-map
                        setText(COLOR.MUTED);
                        doc.setFontSize(8);
                        doc.text(
                            `Detail tile · ${(100 / tileGrid.cols).toFixed(0)} % × ${(100 / tileGrid.rows).toFixed(0)} % of the SLD · 6 % overlap with neighbouring tiles`,
                            PAGE.margin, tileBottomY + 4
                        );
                        // Mini-map at the bottom-right
                        const sldAspect = sld.w / sld.h;
                        const miniMaxW = 56;
                        const miniMaxH = miniMapH - 8;
                        drawTileMiniMap(
                            doc, { setFill, setStroke, setText },
                            col, row, tileGrid.cols, tileGrid.rows, sldAspect,
                            ps.w - PAGE.margin - miniMaxW, tileBottomY + 8,
                            miniMaxW, miniMaxH
                        );
                    } else {
                        setText(COLOR.MUTED);
                        doc.setFontSize(11);
                        doc.text(
                            `Detail tile ${tileIdx} could not be rendered.`,
                            ps.w / 2, ps.h / 2, { align: 'center' }
                        );
                    }
                }
            }
        }

        // ============= PAGE 4: VOLTAGE PROFILE (back to portrait) =============
        doc.addPage('a4', 'portrait');
        drawHeaderBand('Voltage Profile', `${metrics.busBuckets.total} buses · band ±5% (warn) / ±10% (critical)`);
        const histo = renderHistogramCanvas(metrics);
        if (histo) {
            const fit = fitImage(histo, CONTENT_W, 75);
            if (fit) doc.addImage(histo.dataUrl, 'PNG', PAGE.margin, 28, fit.w, fit.h);
        }
        if (doc.autoTable) {
            const busRows = buildBusRows(dataJson, dialogNameFor);
            doc.autoTable({
                startY: 110,
                margin: { left: PAGE.margin, right: PAGE.margin },
                head: [['Object id', 'Dialog name', 'U [pu]', 'U [deg]', 'Band']],
                body: busRows,
                theme: 'striped',
                styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.2 },
                headStyles: { fillColor: hexToRgb(COLOR.BRAND), textColor: [255,255,255] },
                columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'center', cellWidth: 22 } },
                didParseCell: (d) => {
                    if (d.section !== 'body') return;
                    if (d.column.index === 4) {
                        const v = String(d.cell.raw || '');
                        if (v === 'CRITICAL') { d.cell.styles.fillColor = [253, 226, 226]; d.cell.styles.textColor = hexToRgb(COLOR.DANGER); d.cell.styles.fontStyle = 'bold'; }
                        else if (v === 'WARN') { d.cell.styles.fillColor = [254, 240, 199]; d.cell.styles.textColor = hexToRgb(COLOR.WARN);   d.cell.styles.fontStyle = 'bold'; }
                        else                    { d.cell.styles.textColor = hexToRgb(COLOR.GOOD); }
                    }
                },
            });
        }

        // ============= PAGE 5: TOP LOADED EQUIPMENT =============
        doc.addPage('a4', 'portrait');
        drawHeaderBand('Top Loaded Equipment', `${metrics.equipmentBuckets.total} branches monitored`);
        const top = renderTopLoadingCanvas(metrics);
        if (top) {
            const fit = fitImage(top, CONTENT_W, 75);
            if (fit) doc.addImage(top.dataUrl, 'PNG', PAGE.margin, 28, fit.w, fit.h);
        }
        if (doc.autoTable) {
            doc.autoTable({
                startY: 110,
                margin: { left: PAGE.margin, right: PAGE.margin },
                head: [['Type', 'Object id', 'Dialog name', 'Loading [%]', 'Status']],
                body: buildLoadingRows(dataJson, dialogNameFor),
                theme: 'striped',
                styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.2 },
                headStyles: { fillColor: hexToRgb(COLOR.BRAND), textColor: [255,255,255] },
                columnStyles: { 3: { halign: 'right' }, 4: { halign: 'center', cellWidth: 22 } },
                didParseCell: (d) => {
                    if (d.section !== 'body' || d.column.index !== 4) return;
                    const v = String(d.cell.raw || '');
                    if (v === 'CRITICAL') { d.cell.styles.fillColor = [253, 226, 226]; d.cell.styles.textColor = hexToRgb(COLOR.DANGER); d.cell.styles.fontStyle = 'bold'; }
                    else if (v === 'WARN'){ d.cell.styles.fillColor = [254, 240, 199]; d.cell.styles.textColor = hexToRgb(COLOR.WARN);   d.cell.styles.fontStyle = 'bold'; }
                    else                   { d.cell.styles.textColor = hexToRgb(COLOR.GOOD); }
                },
            });
        }

        // ============= PAGE 6: CRITICAL ISSUES =============
        doc.addPage('a4', 'portrait');
        drawHeaderBand('Critical Issues', `${metrics.issues.length} item${metrics.issues.length === 1 ? '' : 's'}`);
        if (!metrics.issues.length) {
            setFill('#ecfdf5');
            setStroke('#bbf7d0');
            doc.setLineWidth(0.4);
            doc.roundedRect(PAGE.margin, 36, CONTENT_W, 22, 3, 3, 'FD');
            setText(COLOR.GOOD);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text('All clear — no violations detected.', PAGE.w / 2, 50, { align: 'center' });
        } else if (doc.autoTable) {
            doc.autoTable({
                startY: 30,
                margin: { left: PAGE.margin, right: PAGE.margin },
                head: [['Severity', 'Issue', 'Detail']],
                body: buildIssueRows(metrics),
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.4 },
                headStyles: { fillColor: hexToRgb(COLOR.TEXT), textColor: [255,255,255] },
                columnStyles: { 0: { halign: 'center', cellWidth: 24, fontStyle: 'bold' } },
                didParseCell: (d) => {
                    if (d.section !== 'body' || d.column.index !== 0) return;
                    const v = String(d.cell.raw || '').toUpperCase();
                    if (v === 'DANGER') { d.cell.styles.fillColor = [253, 226, 226]; d.cell.styles.textColor = hexToRgb(COLOR.DANGER); }
                    else if (v === 'WARN') { d.cell.styles.fillColor = [254, 240, 199]; d.cell.styles.textColor = hexToRgb(COLOR.WARN); }
                },
            });
        }

        // ============= COMPARISON VS BASELINE (optional) =============
        // Appended only when a baseline snapshot is pinned and the compare
        // helper is available. Reuses the exact same delta engine the
        // Compare panel uses, so the numbers always agree with the UI.
        try {
            await renderComparisonPage(doc, dataJson, graph, meta, {
                drawHeaderBand,
                setFill, setText, setStroke,
                hexToRgb,
            });
        } catch (cmpErr) {
            console.warn('[Report] Comparison page skipped:', cmpErr);
        }

        // ============= PAGES 7+: DETAILED RESULTS =============
        const sections = buildDetailedSections(dataJson, graph);
        if (sections.length && doc.autoTable) {
            doc.addPage('a4', 'portrait');
            drawHeaderBand('Detailed Results', 'Element-by-element load flow output');
            let cursorY = 30;
            const reserveBottom = 20;
            sections.forEach((sec) => {
                if (cursorY > PAGE.h - reserveBottom - 30) {
                    doc.addPage('a4', 'portrait');
                    drawHeaderBand('Detailed Results (continued)', `${meta.project || 'Project'}`);
                    cursorY = 30;
                }
                setText(COLOR.TEXT);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(11);
                doc.text(sec.title, PAGE.margin, cursorY);
                doc.autoTable({
                    startY: cursorY + 3,
                    margin: { left: PAGE.margin, right: PAGE.margin },
                    head: [sec.head],
                    body: sec.rows,
                    theme: 'striped',
                    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.1 },
                    headStyles: { fillColor: hexToRgb(COLOR.BRAND), textColor: [255,255,255] },
                });
                cursorY = (doc.lastAutoTable && doc.lastAutoTable.finalY ? doc.lastAutoTable.finalY : cursorY + 30) + 8;
            });
        }

        drawFooter();

        // ---- Save ----
        const fileName = `Electrisim_Report_${slug(meta.project)}_${nowIso()}.pdf`;
        doc.save(fileName);
        return fileName;
    }

    /* ---------------------------------------------------------------------
     *  Printable HTML fallback (used when CDN libs cannot be loaded).
     * ------------------------------------------------------------------- */
    function buildPrintableReportHtml(dataJson, graph, meta) {
        const metrics = (typeof window !== 'undefined' && typeof window.computeNetworkHealthMetrics === 'function')
            ? window.computeNetworkHealthMetrics(dataJson, graph) : null;
        if (!metrics) return null;
        const status = scoreStatus(metrics.healthScore, metrics.converged);
        const escapeHtml = (s) => String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const kpiHtml = buildKpiCells(metrics).map(k => `
            <div class="kpi ${k.cls}">
                <div class="kpi-label">${escapeHtml(k.label)}</div>
                <div class="kpi-value">${escapeHtml(k.value)}<span class="kpi-unit">${escapeHtml(k.unit)}</span></div>
                <div class="kpi-sub">${escapeHtml(k.sub)}</div>
            </div>
        `).join('');
        return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Electrisim Report — ${escapeHtml(meta.project)}</title>
<style>
  body { font: 13px -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0f172a; margin: 24px; }
  h1 { margin: 0 0 4px; }
  .muted { color: #64748b; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 16px 0; }
  .kpi  { padding: 10px 12px; border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; }
  .kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: .6px; color: #64748b; font-weight: 600; }
  .kpi-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
  .kpi-unit  { font-size: 11px; color: #64748b; font-weight: 500; margin-left: 3px; }
  .kpi.good   .kpi-value { color: #16a34a; }
  .kpi.warn   .kpi-value { color: #f59e0b; }
  .kpi.danger .kpi-value { color: #dc2626; }
  .kpi.info   .kpi-value { color: #2563eb; }
  .verdict   { padding: 10px 14px; border-radius: 8px; font-weight: 700; }
  .print-btn { position: fixed; top: 16px; right: 16px; padding: 8px 14px;
               background: #2563eb; color: #fff; border: 0; border-radius: 8px;
               cursor: pointer; box-shadow: 0 6px 16px -6px rgba(37,99,235,.5); }
  @media print { .print-btn { display: none; } }
</style></head>
<body>
  <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  <h1>${escapeHtml(meta.project || 'Engineering Report')}</h1>
  <div class="muted">Engineer: ${escapeHtml(meta.engineer || '—')} · Company: ${escapeHtml(meta.company || '—')}
    · Generated: ${new Date().toLocaleString()}</div>
  <div class="verdict" style="margin-top:14px;background:${status.color}20;color:${status.color};">
    System Status: ${escapeHtml(status.text)} (Score ${metrics.healthScore}/100)
  </div>
  <div class="kpis">${kpiHtml}</div>
  <p class="muted">PDF library unavailable. Use your browser's "Save as PDF" via the Print dialog above.</p>
</body></html>`;
    }

    /* ---------------------------------------------------------------------
     *  Main entrypoint
     * ------------------------------------------------------------------- */
    async function exportEngineeringReport(dataJson, graph, opts) {
        opts = opts || {};
        if (!dataJson || typeof dataJson !== 'object') {
            console.warn('[Report] No dataJson provided.');
            return null;
        }
        return new Promise((resolve, reject) => {
            const proceed = (meta) => {
                generatePdf(dataJson, graph, meta)
                    .then(resolve)
                    .catch((err) => {
                        console.error('[Report] PDF generation failed, falling back to HTML:', err);
                        try {
                            const html = buildPrintableReportHtml(dataJson, graph, meta);
                            if (html) {
                                const w = window.open('', '_blank');
                                if (w) {
                                    w.document.open();
                                    w.document.write(html);
                                    w.document.close();
                                }
                            }
                        } catch (e) { /* ignore */ }
                        reject(err);
                    });
            };

            if (opts.skipDialog) {
                const stored = readStoredMeta() || {};
                proceed({
                    project:  opts.project  || stored.project  || 'Untitled project',
                    engineer: opts.engineer || stored.engineer || getDefaultEngineerEmail(),
                    company:  opts.company  || stored.company  || '',
                    notes:    opts.notes    || stored.notes    || '',
                });
                return;
            }

            openReportMetadataDialog(opts.prefill, proceed, () => resolve(null));
        });
    }

    /* ---------------------------------------------------------------------
     *  Public API
     * ------------------------------------------------------------------- */
    window.exportEngineeringReport       = exportEngineeringReport;
    window.openReportMetadataDialog      = openReportMetadataDialog;
    window.buildPrintableReportHtml      = buildPrintableReportHtml;
    // Internal helpers exposed for tests
    window._engineeringReportInternals = {
        buildKpiCells,
        buildBreakdownRows,
        buildIssueRows,
        buildBusRows,
        buildLoadingRows,
        buildDetailedSections,
        scoreStatus,
        slug,
    };
})();
