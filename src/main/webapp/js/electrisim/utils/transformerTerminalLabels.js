/**
 * Cosmetic terminal labels for 2W / 3W transformers (cell XML: term_label_0..2).
 * Port order matches grid export: edges[0]=hv, edges[1]=lv (2W); edges[0..2]=hv,mv,lv (3W).
 *
 * Labels are attached to shape.node (local cell coordinates). Do not use ownerSVGElement —
 * that is the diagram root; coordinates would be wrong and labels would not appear on the symbol.
 */

export const TERM_LABEL_ATTRS = ['term_label_0', 'term_label_1', 'term_label_2'];

export function getTermLabel(cell, index, fallback) {
    if (!cell || !cell.value || typeof cell.value.getAttribute !== 'function') {
        return fallback;
    }
    const v = cell.value.getAttribute(`term_label_${index}`);
    if (v == null || String(v).trim() === '') {
        return fallback;
    }
    return String(v).trim();
}

function isHtmlShapeNode(n) {
    return n && n.nodeType === 1 && String(n.nodeName).toUpperCase() === 'DIV';
}

/** state.style may omit shapeELXXX; fall back to the raw style string on the cell. */
function getShapeELXXXFromState(state, mxUtils) {
    let v = mxUtils && state.style && mxUtils.getValue(state.style, 'shapeELXXX', null);
    if (v) {
        return v;
    }
    const cell = state.cell;
    const s = cell && typeof cell.getStyle === 'function' ? cell.getStyle() : '';
    if (typeof s !== 'string') {
        return null;
    }
    const m = /shapeELXXX=([^;]+)/.exec(s);
    return m ? String(m[1]).trim() : null;
}

const trafoKindCache = new WeakMap();

function kindFromImageRef(ref) {
    if (ref == null || typeof ref !== 'string') {
        return null;
    }
    const lower = ref.toLowerCase();
    if (lower.indexOf('sym-3w-transformer') >= 0) {
        return 'Three Winding Transformer';
    }
    if (lower.indexOf('sym-transformer') >= 0) {
        return 'Transformer';
    }
    return null;
}

/** Programmatic inserts use image=...sym-transformer.svg; sidebar drops use shape=stencil(...) without shapeELXXX. */
function kindFromImageStyle(styleStr, state, mxUtils) {
    if (mxUtils && state.style) {
        const img = mxUtils.getValue(state.style, 'image', null);
        const k = kindFromImageRef(img);
        if (k) {
            return k;
        }
    }
    if (typeof styleStr !== 'string') {
        return null;
    }
    const m = /(?:^|;)image=([^;]+)/.exec(styleStr);
    if (!m || !m[1]) {
        return null;
    }
    let raw = m[1];
    try {
        raw = decodeURIComponent(raw);
    } catch (e) {
        /* keep raw */
    }
    return kindFromImageRef(raw);
}

function kindFromStencilStyle(styleStr) {
    if (typeof styleStr !== 'string' || styleStr.indexOf('stencil(') < 0) {
        return null;
    }
    const Graph = typeof window !== 'undefined' && window.Graph;
    if (!Graph || typeof Graph.decompress !== 'function') {
        return null;
    }
    const m = /(?:^|;)shape=stencil\(([^)]+)\)/.exec(styleStr);
    if (!m || !m[1]) {
        return null;
    }
    try {
        const xml = Graph.decompress(m[1]);
        if (typeof xml !== 'string' || xml.length < 20) {
            return null;
        }
        if (xml.indexOf('sym-3w-transformer.svg') >= 0) {
            return 'Three Winding Transformer';
        }
        if (xml.indexOf('sym-transformer.svg') >= 0) {
            return 'Transformer';
        }
    } catch (e) {
        /* ignore */
    }
    return null;
}

/**
 * Sidebar / saved cells from the abstract electrical library use the stencil registry id on style.shape
 * (see mxStencilRegistry.addStencil in Graph.js: package + stencilName.toLowerCase()).
 */
function kindFromMxgraphShapeStyle(state, mxUtils) {
    if (!mxUtils || !state.style) {
        return null;
    }
    const shapeKey = mxUtils.getValue(state.style, 'shape', null);
    if (typeof shapeKey !== 'string') {
        return null;
    }
    const k = shapeKey.toLowerCase();
    if (k === 'mxgraph.electrical.abstract.three_winding_transformer') {
        return 'Three Winding Transformer';
    }
    if (k === 'mxgraph.electrical.abstract.transformer') {
        return 'Transformer';
    }
    /* shape=image + image=...sym-*.svg (export / grid inserts), not a registry stencil id */
    if (k === 'image') {
        const img = mxUtils.getValue(state.style, 'image', null);
        return kindFromImageRef(img);
    }
    return null;
}

/** Sidebar / stencil cells: mxShape holds the live mxStencil; no need to decompress the style string. */
function kindFromLiveStencilDesc(state) {
    const stencil = state.shape && state.shape.stencil;
    const desc = stencil && stencil.desc;
    if (!desc) {
        return null;
    }
    const mxUtils = typeof window !== 'undefined' && window.mxUtils;
    if (!mxUtils || typeof mxUtils.getXml !== 'function') {
        return null;
    }
    try {
        const xml = mxUtils.getXml(desc);
        if (typeof xml !== 'string') {
            return null;
        }
        if (xml.indexOf('sym-3w-transformer.svg') >= 0 || xml.indexOf('name="three_winding_transformer"') >= 0) {
            return 'Three Winding Transformer';
        }
        if (xml.indexOf('sym-transformer.svg') >= 0) {
            return 'Transformer';
        }
        /* abstract.xml 2W shape: name="Transformer" w="82" (distinct from other libraries' "Transformer") */
        if (/name="Transformer"/.test(xml) && /w="82"/.test(xml) && xml.indexOf('three_winding') < 0) {
            return 'Transformer';
        }
    } catch (e) {
        /* ignore */
    }
    return null;
}

/**
 * Resolves Electrisim 2W / 3W transformer for overlay (shapeELXXX, image=, or compressed stencil).
 */
function resolveElectrisimTransformerKind(state, mxUtils) {
    const cell = state.cell;
    const styleStr = cell && typeof cell.getStyle === 'function' ? cell.getStyle() : '';

    const explicit = getShapeELXXXFromState(state, mxUtils);
    if (explicit === 'Transformer' || explicit === 'Three Winding Transformer') {
        return explicit;
    }

    const cached = trafoKindCache.get(cell);
    if (cached && cached.s === styleStr) {
        return cached.k;
    }

    let k = kindFromMxgraphShapeStyle(state, mxUtils);
    if (!k) {
        k = kindFromLiveStencilDesc(state);
    }
    if (!k) {
        k = kindFromImageStyle(styleStr, state, mxUtils);
    }
    if (!k) {
        k = kindFromStencilStyle(styleStr);
    }

    if (k) {
        trafoKindCache.set(cell, { s: styleStr, k });
    }
    return k;
}

function removeOldLayers(host) {
    if (!host || !host.querySelectorAll) {
        return;
    }
    host.querySelectorAll('[data-electrisim-term-labels]').forEach((el) => {
        if (el.parentNode) {
            el.parentNode.removeChild(el);
        }
    });
}

/**
 * Impedance-style approach: bake terminal labels into the SVG image itself via data URI.
 * The text is part of the rasterized image, so it scales identically with the symbol — no zoom issues.
 */
const SVG_2W_TEMPLATE =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-45 -30 90 58">' +
    '<circle cx="-10" cy="0" r="14" fill="none" stroke="#1a1a2e" stroke-width="2"/>' +
    '<circle cx="10" cy="0" r="14" fill="none" stroke="#1a1a2e" stroke-width="2"/>' +
    '<line x1="-35" y1="0" x2="-24" y2="0" stroke="#1a1a2e" stroke-width="2"/>' +
    '<line x1="24" y1="0" x2="35" y2="0" stroke="#1a1a2e" stroke-width="2"/>' +
    '<line x1="-35" y1="0" x2="-45" y2="0" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="square"/>' +
    '<line x1="35" y1="0" x2="45" y2="0" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="square"/>' +
    '<text x="-35" y="-5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="9" fill="#1a1a2e">%%0%%</text>' +
    '<text x="35" y="-5" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="9" fill="#1a1a2e">%%1%%</text>' +
    '</svg>';

const SVG_3W_TEMPLATE =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-45 -45 90 95">' +
    '<circle cx="-10" cy="-8" r="14" fill="none" stroke="#1a1a2e" stroke-width="2"/>' +
    '<circle cx="10" cy="-8" r="14" fill="none" stroke="#1a1a2e" stroke-width="2"/>' +
    '<circle cx="0" cy="12" r="14" fill="none" stroke="#1a1a2e" stroke-width="2"/>' +
    '<line x1="-36" y1="-8" x2="-24" y2="-8" stroke="#1a1a2e" stroke-width="2"/>' +
    '<line x1="24" y1="-8" x2="36" y2="-8" stroke="#1a1a2e" stroke-width="2"/>' +
    '<line x1="0" y1="36" x2="0" y2="26" stroke="#1a1a2e" stroke-width="2"/>' +
    '<line x1="-36" y1="-8" x2="-42" y2="-8" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="square"/>' +
    '<line x1="36" y1="-8" x2="42" y2="-8" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="square"/>' +
    '<line x1="0" y1="36" x2="0" y2="42" stroke="#1a1a2e" stroke-width="1.5" stroke-linecap="square"/>' +
    '<text x="-34" y="-18" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="9" fill="#1a1a2e">%%0%%</text>' +
    '<text x="34" y="-18" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="9" fill="#1a1a2e">%%1%%</text>' +
    '<text x="10" y="38" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="9" fill="#1a1a2e">%%2%%</text>' +
    '</svg>';

function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildLabeledSvgUri(template, labels) {
    let svg = template;
    for (let i = 0; i < labels.length; i++) {
        svg = svg.split('%%' + i + '%%').join(escapeXml(labels[i]));
    }
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function paintTransformerTerminalLabels(state) {
    if (!state || !state.cell || !state.shape) {
        return;
    }
    const model = state.view && state.view.graph && state.view.graph.getModel();
    if (!model || !model.isVertex(state.cell)) {
        return;
    }
    const mxUtils = typeof window !== 'undefined' && window.mxUtils;
    if (!mxUtils || !mxUtils.getValue) {
        return;
    }
    const trafoKind = resolveElectrisimTransformerKind(state, mxUtils);
    if (trafoKind !== 'Transformer' && trafoKind !== 'Three Winding Transformer') {
        return;
    }

    const host = state.shape.node;
    if (!host) {
        return;
    }

    removeOldLayers(host);

    const cell = state.cell;
    let template, labels;
    if (trafoKind === 'Transformer') {
        template = SVG_2W_TEMPLATE;
        labels = [getTermLabel(cell, 0, 'HV'), getTermLabel(cell, 1, 'LV')];
    } else {
        template = SVG_3W_TEMPLATE;
        labels = [getTermLabel(cell, 0, 'HV'), getTermLabel(cell, 1, 'MV'), getTermLabel(cell, 2, 'LV')];
    }

    const dataUri = buildLabeledSvgUri(template, labels);

    if (isHtmlShapeNode(host)) {
        const img = host.querySelector('img');
        if (img) {
            img.src = dataUri;
        }
    } else {
        const img = host.querySelector('image');
        if (img) {
            img.setAttribute('href', dataUri);
            try { img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUri); } catch (_) {}
        }
    }
}

let installed = false;
let installRetries = 0;
const MAX_INSTALL_RETRIES = 80;
let validateHookRetries = 0;
const MAX_VALIDATE_HOOK_RETRIES = 80;

function installTrafoValidateSweepHook() {
    if (typeof window === 'undefined' || window.__electrisimTrafoValidateHooked) {
        return;
    }
    const V = resolveDrawioClass('mxGraphView');
    if (!V || !V.prototype || !V.prototype.validate) {
        if (validateHookRetries < MAX_VALIDATE_HOOK_RETRIES) {
            validateHookRetries++;
            setTimeout(installTrafoValidateSweepHook, 250);
        }
        return;
    }
    window.__electrisimTrafoValidateHooked = true;
    const origValidate = V.prototype.validate;
    V.prototype.validate = function () {
        origValidate.apply(this, arguments);
        const view = this;
        const fn = window.__electrisimPaintTrafoLabels;
        if (!fn || !view.states || typeof view.states.visit !== 'function') {
            return;
        }
        if (view.__electrisimTrafoRaf != null) {
            cancelAnimationFrame(view.__electrisimTrafoRaf);
        }
        view.__electrisimTrafoRaf = requestAnimationFrame(function () {
            view.__electrisimTrafoRaf = null;
            try {
                view.states.visit(function (_id, st) {
                    if (st && st.shape) {
                        fn(st);
                    }
                });
            } catch (err) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('transformerTerminalLabels (validate sweep):', err);
                }
            }
        });
    };
}

function globalRoot() {
    return typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null;
}

/** ES modules do not see bare mx*; bridge script sets __drawio_mxShape on globalThis. */
function resolveDrawioClass(name) {
    const g = globalRoot();
    const bridged = g && g['__drawio_' + name];
    if (typeof bridged === 'function') {
        return bridged;
    }
    if (g && typeof g[name] === 'function') {
        return g[name];
    }
    try {
        const v = (0, eval)('typeof ' + name + ' !== "undefined" ? ' + name + ' : null');
        return typeof v === 'function' ? v : null;
    } catch (e) {
        return null;
    }
}

function scheduleGraphRefreshForTrafoLabels() {
    function tryRefresh() {
        try {
            const ed =
                (window.App && window.App.main && window.App.main.editor) ||
                (window.App && window.App._instance && window.App._instance.editor);
            const graph = ed && ed.graph;
            if (graph && typeof graph.refresh === 'function') {
                graph.refresh();
                return true;
            }
        } catch (e) {
            /* ignore */
        }
        return false;
    }
    if (!tryRefresh()) {
        setTimeout(tryRefresh, 400);
        setTimeout(tryRefresh, 2000);
    }
}

/**
 * Hook mxShape.redraw (primary) and mxCellRenderer.redraw (backup). Stencil vertices rebuild DOM inside shape.redraw().
 * Globals: use drawioGlobalsBridge.js + __drawio_* on globalThis.
 */
export function installTransformerTerminalLabelOverlay() {
    if (typeof window !== 'undefined') {
        window.__electrisimPaintTrafoLabels = paintTransformerTerminalLabels;
    }
    installTrafoValidateSweepHook();
    if (installed) {
        return;
    }
    if (typeof window !== 'undefined' && window.__electrisimTrafoRedrawHooked) {
        installed = true;
        scheduleGraphRefreshForTrafoLabels();
        return;
    }
    const S = resolveDrawioClass('mxShape');
    const R = resolveDrawioClass('mxCellRenderer');
    if (!S || !S.prototype || !S.prototype.redraw || !R || !R.prototype || !R.prototype.redraw) {
        if (installRetries < MAX_INSTALL_RETRIES) {
            installRetries++;
            setTimeout(installTransformerTerminalLabelOverlay, 250);
        }
        return;
    }
    installed = true;

    const origShapeRedraw = S.prototype.redraw;
    S.prototype.redraw = function () {
        origShapeRedraw.apply(this, arguments);
        try {
            if (this.state) {
                paintTransformerTerminalLabels(this.state);
            }
        } catch (err) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('transformerTerminalLabels (mxShape):', err);
            }
        }
    };

    const origCellRedraw = R.prototype.redraw;
    R.prototype.redraw = function (state, force, rendering) {
        origCellRedraw.apply(this, arguments);
        try {
            if (state) {
                paintTransformerTerminalLabels(state);
            }
        } catch (err) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('transformerTerminalLabels (mxCellRenderer):', err);
            }
        }
    };

    installModelChangeListener();
    scheduleGraphRefreshForTrafoLabels();
}

/**
 * Listen for mxGraphModel changes so that when a dialog writes new term_label_* values,
 * the shape redraws immediately instead of waiting for a zoom/pan event.
 */
function installModelChangeListener() {
    if (typeof window === 'undefined' || window.__electrisimTrafoModelListenerInstalled) {
        return;
    }
    function tryInstall() {
        try {
            const ed =
                (window.App && window.App.main && window.App.main.editor) ||
                (window.App && window.App._instance && window.App._instance.editor);
            const graph = ed && ed.graph;
            if (!graph || !graph.getModel || !graph.getView) {
                return false;
            }
            const model = graph.getModel();
            const mxEvent = window.mxEvent;
            if (!model || !mxEvent || typeof model.addListener !== 'function') {
                return false;
            }
            window.__electrisimTrafoModelListenerInstalled = true;
            model.addListener(mxEvent.CHANGE, function (_sender, evt) {
                const changes = evt.getProperty('edit').changes;
                if (!changes) {
                    return;
                }
                for (let i = 0; i < changes.length; i++) {
                    const ch = changes[i];
                    const cell = ch.cell;
                    if (!cell) {
                        continue;
                    }
                    const state = graph.getView().getState(cell);
                    if (state && state.shape && typeof state.shape.redraw === 'function') {
                        try {
                            state.shape.redraw();
                        } catch (_) { /* ignore */ }
                    }
                }
            });
            return true;
        } catch (e) {
            return false;
        }
    }
    if (!tryInstall()) {
        setTimeout(tryInstall, 500);
        setTimeout(tryInstall, 2000);
    }
}

(function bootstrapTransformerTerminalLabelOverlay() {
    if (typeof window === 'undefined') {
        return;
    }
    const run = () => installTransformerTerminalLabelOverlay();
    if (typeof queueMicrotask === 'function') {
        queueMicrotask(run);
    } else {
        setTimeout(run, 0);
    }
})();
