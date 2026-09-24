/**
 * Write BESS preliminary-design case results onto every SLD result box.
 * Walks the placeholders the user sees (bus children and edge labels), then
 * matches them to the selected named case. POC P/Q is export-positive.
 */
import { findBessPlantElements, parkPlantResultBoxes } from '../bessPlantBuilder.js';
import { applyLoadFlowResultsToGraph } from './applyLoadFlowResults.js';

function nfmt(v, d = 2) {
    const x = Number(v);
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(d);
}

function cellName(cell) {
    try {
        return cell?.value?.getAttribute?.('name') || '';
    } catch {
        return '';
    }
}

function cellRole(cell) {
    try {
        return cell?.value?.getAttribute?.('bessPlantRole') || '';
    } catch {
        return '';
    }
}

function shapeOf(cell) {
    const st = cell?.style || '';
    const m = st.match(/shapeELXXX=([^;]+)/);
    return m ? m[1] : '';
}

function unwrapBessResults(results) {
    if (!results || typeof results !== 'object') return null;
    if (Array.isArray(results.named_cases)) return results;
    if (results.bess_preliminary_results) return unwrapBessResults(results.bess_preliminary_results);
    if (results.data) return unwrapBessResults(results.data);
    return results;
}

function indexRows(rows) {
    const map = new Map();
    (rows || []).forEach((row) => {
        if (!row) return;
        const put = (k) => {
            if (k == null || k === '') return;
            const s = String(k);
            map.set(s, row);
            map.set(s.replace(/#/g, '_'), row);
            map.set(s.replace(/_/g, '#'), row);
            map.set(s.toLowerCase(), row);
        };
        put(row.id);
        put(row.name);
        put(row.technical_name);
        put(row.userFriendlyName);
        put(row.dialogName);
    });
    return map;
}

function roleNameKeys(cell) {
    const role = String(cellRole(cell) || '');
    const keys = [];
    const push = (s) => { if (s) keys.push(s, String(s).toLowerCase()); };
    let m = role.match(/^lvBusA_(\d+)$/);
    if (m) {
        const n = Number(m[1]) + 1;
        push(`LV_Bus_${n}A`);
        push(`LV_Bus_${n}a`);
    }
    m = role.match(/^lvBusB_(\d+)$/);
    if (m) {
        const n = Number(m[1]) + 1;
        push(`LV_Bus_${n}B`);
    }
    m = role.match(/^lvBus_(\d+)$/);
    if (m) push(`LV_Bus_${Number(m[1]) + 1}`);
    m = role.match(/^stringBus_(\d+)$/);
    if (m) push(`String_Bus_${Number(m[1]) + 1}`);
    m = role.match(/^dcBus_(\d+)$/);
    if (m) push(`DC_Bus_${Number(m[1]) + 1}`);
    if (role === 'poc') push('POC_HV');
    if (role === 'bessHv') push('BESS_HV');
    if (role === 'mvBus') push('MV_Bus');
    return keys;
}

function rowFor(cell, index) {
    if (!cell || !index) return null;
    const keys = [];
    if (cell.id != null) keys.push(String(cell.id));
    if (cell.mxObjectId) {
        const mx = String(cell.mxObjectId);
        keys.push(mx, mx.replace(/#/g, '_'), mx.replace(/_/g, '#'));
    }
    const name = cellName(cell);
    if (name) keys.push(name, name.toLowerCase());
    keys.push(...roleNameKeys(cell));
    for (let i = 0; i < keys.length; i++) {
        if (index.has(keys[i])) return index.get(keys[i]);
    }
    return null;
}

function placeholderPlainText(ph) {
    const raw = ph?.value;
    let s = '';
    if (raw == null) s = '';
    else if (typeof raw === 'string') s = raw;
    else if (raw.getAttribute) s = raw.getAttribute('label') || '';
    else s = String(raw);
    return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function placeholderLooksEmpty(ph) {
    const plain = placeholderPlainText(ph);
    return !plain || /click simulate/i.test(plain);
}

function isBusOwner(owner) {
    const sh = shapeOf(owner);
    return sh === 'Bus' || sh === 'DC Bus' || /^lvBus|^stringBus|^dcBus|^mvBus$|^poc$|^bessHv$/.test(cellRole(owner));
}

function isResultStyle(st) {
    return !!(st && (
        st.indexOf('shapeELXXX=ResultBus') >= 0
        || st.indexOf('shapeELXXX=Result') >= 0
        || st.indexOf('shapeELXXX=ResultExternalGrid') >= 0
    ));
}

function collectPlaceholders(model, cell, acc) {
    if (!cell || !model) return;
    const st = (model.getStyle && model.getStyle(cell)) || cell.style || '';
    if (isResultStyle(st)) acc.push(cell);
    const n = model.getChildCount ? model.getChildCount(cell) : 0;
    for (let i = 0; i < n; i++) {
        collectPlaceholders(model, model.getChildAt(cell, i), acc);
    }
}

function ownerOfPlaceholder(model, ph) {
    if (!model || !ph) return null;
    const st = (model.getStyle && model.getStyle(ph)) || ph.style || '';
    const m = st.match(/connectedTo=([^;]+)/);
    if (m) {
        const id = String(m[1]).trim();
        const byId = model.getCell ? model.getCell(id) : null;
        if (byId) return byId;
        const cells = model.cells || {};
        for (const k of Object.keys(cells)) {
            if (String(cells[k]?.id) === id) return cells[k];
        }
    }
    return model.getParent ? model.getParent(ph) : ph.parent;
}

function isExtGridCell(cell) {
    const sh = shapeOf(cell);
    return sh === 'External Grid' || sh === 'Source 1ph' || cellRole(cell) === 'extGrid';
}

function isPocBus(cell, plant) {
    if (!cell) return false;
    if (plant?.pocBus && cell === plant.pocBus) return true;
    try {
        if (cell.value?.getAttribute?.('bessPlantPoc') === '1') return true;
    } catch { /* ignore */ }
    const name = cellName(cell);
    return cellRole(cell) === 'poc' || name === 'POC_HV' || name === 'POC_MV';
}

function tintPlaceholder(graph, ph, kind) {
    if (!ph || !graph.getModel) return;
    const fill = kind === 'fail' ? '#FFEBEE' : kind === 'warn' ? '#FFF8E1' : '#E8F5E9';
    const stroke = kind === 'fail' ? '#C62828' : kind === 'warn' ? '#F9A825' : '#2E7D32';
    const model = graph.getModel();
    let st = model.getStyle(ph) || ph.style || '';
    const set = (key, val) => {
        const prefix = `${key}=`;
        if (st.indexOf(prefix) >= 0) st = st.replace(new RegExp(`${key}=[^;]*`, 'g'), `${key}=${val}`);
        else st += `;${key}=${val}`;
    };
    set('fillColor', fill);
    set('strokeColor', stroke);
    set('fontColor', '#1e293b');
    set('dashed', '0');
    set('opacity', '100');
    model.setStyle(ph, st);
}

function setPlaceholderText(graph, ph, text) {
    const st = (graph.getModel?.().getStyle?.(ph) || ph.style || '');
    let value = text;
    if (st.indexOf('html=1') >= 0 && typeof text === 'string' && text.indexOf('<') < 0) {
        value = text.replace(/\r\n/g, '\n').replace(/\n/g, '<br>');
    }
    if (typeof window !== 'undefined' && window.setResultPlaceholderValue) {
        window.setResultPlaceholderValue(graph, ph, value);
    } else {
        graph.getModel().setValue(ph, value);
    }
}

function writePh(graph, ph, text, kind) {
    if (!ph) return;
    setPlaceholderText(graph, ph, text);
    tintPlaceholder(graph, ph, kind);
}

function vmKind(vm, umin, umax) {
    const v = Number(vm);
    if (!Number.isFinite(v)) return 'ok';
    if (v < umin || v > umax) return 'fail';
    if (v < umin + 0.01 || v > umax - 0.01) return 'warn';
    return 'ok';
}

function loadKind(lp) {
    const v = Number(lp);
    if (!Number.isFinite(v)) return 'ok';
    if (v > 100) return 'fail';
    if (v > 80) return 'warn';
    return 'ok';
}

function header(cell, fallback) {
    return cellName(cell) || fallback || '';
}

function pocExtra(cse) {
    return cse?.name ? [`Case: ${cse.name}`] : [];
}

function busText(row, cell, extraLines, pocCse) {
    const lines = [];
    const title = header(cell, row?.name);
    if (title) lines.push(title);
    (extraLines || []).forEach((ln) => { if (ln) lines.push(ln); });
    if (row?.vm_pu != null) lines.push(`U[pu]: ${nfmt(row.vm_pu, 3)}`);
    const vn = Number(row?.vn_kv);
    const vm = Number(row?.vm_pu);
    if (Number.isFinite(vn) && Number.isFinite(vm)) {
        lines.push(`U[kV]: ${nfmt(vn * vm, 2)}`);
    } else if (row?.vm_kv != null) {
        lines.push(`U[kV]: ${nfmt(row.vm_kv, 2)}`);
    }
    if (row?.va_degree != null) lines.push(`U[deg]: ${nfmt(row.va_degree, 2)}`);
    if (pocCse) {
        lines.push(`P[MW]: ${nfmt(pocCse.p_poc_mw)}`);
        lines.push(`Q[Mvar]: ${nfmt(pocCse.q_poc_mvar)}`);
    } else {
        if (row?.p_mw != null) lines.push(`P[MW]: ${nfmt(row.p_mw)}`);
        if (row?.q_mvar != null) lines.push(`Q[Mvar]: ${nfmt(row.q_mvar)}`);
    }
    return lines.join('\n') || '—';
}

function branchText(row, cell) {
    const lines = [];
    const title = header(cell, row?.name);
    if (title) lines.push(title);
    if (row?.loading_percent != null) lines.push(`Loading[%]: ${nfmt(row.loading_percent, 1)}`);
    const p = row?.p_from_mw ?? row?.p_hv_mw ?? row?.p_mw;
    const q = row?.q_from_mvar ?? row?.q_hv_mvar ?? row?.q_mvar;
    if (p != null) lines.push(`P[MW]: ${nfmt(p)}`);
    if (q != null) lines.push(`Q[Mvar]: ${nfmt(q)}`);
    return lines.join('\n') || '—';
}

function storageText(row, cell) {
    const lines = [];
    const title = header(cell, row?.name);
    if (title) lines.push(title);
    lines.push(`P[MW]: ${nfmt(row?.p_mw)}`);
    lines.push(`Q[Mvar]: ${nfmt(row?.q_mvar)}`);
    if (row?.loading_percent != null) lines.push(`Loading[%]: ${nfmt(row.loading_percent, 1)}`);
    return lines.join('\n');
}

function batteryDcText(row, cell) {
    const lines = [];
    const title = header(cell, row?.name);
    if (title) lines.push(title);
    lines.push(`P[MW]: ${nfmt(row?.p_dc_mw ?? row?.p_mw)}`);
    if (row?.pmax_mw != null) lines.push(`DC Pmax[MW]: ${nfmt(row.pmax_mw)}`);
    if (row?.loading_percent != null) lines.push(`Loading[%]: ${nfmt(row.loading_percent, 1)}`);
    return lines.join('\n');
}

function loadText(row, cell) {
    const lines = [];
    const title = header(cell, row?.name);
    if (title) lines.push(title);
    lines.push(`P[MW]: ${nfmt(row?.p_mw)}`);
    lines.push(`Q[Mvar]: ${nfmt(row?.q_mvar)}`);
    return lines.join('\n');
}

function extGridText(cse, cell) {
    const title = header(cell, 'Grid');
    return [
        title,
        cse?.name ? `Case: ${cse.name}` : null,
        'POC export',
        `P[MW]: ${nfmt(cse.p_poc_mw)}`,
        `Q[Mvar]: ${nfmt(cse.q_poc_mvar)}`,
    ].filter(Boolean).join('\n');
}

function batteryIndexFromCell(cell) {
    const role = cellRole(cell);
    const rm = String(role).match(/^(battery|dcBus)_(\d+)$/);
    if (rm) return Number(rm[2]) + 1;
    const name = cellName(cell);
    const nm = String(name).match(/^(?:Battery|DC_Bus)_(\d+)$/i);
    if (nm) return Number(nm[1]);
    return null;
}

function batteryRowFor(cell, elements) {
    const direct = rowFor(cell, elements);
    if (direct && (direct.type === 'battery_dc' || direct.type === 'source_dc')) return direct;
    const n = batteryIndexFromCell(cell);
    if (n == null || !elements) return null;
    return elements.get(`Battery_${n}`) || elements.get(`battery_${n}`) || null;
}

function textForOwner(owner, cse, buses, elements, plant, umin, umax) {
    if (!owner) return null;
    if (isExtGridCell(owner)) {
        return { text: extGridText(cse, owner), kind: cse.pass === false ? 'fail' : 'ok' };
    }
    const battRow = batteryRowFor(owner, elements);
    const sh = shapeOf(owner);
    const role = cellRole(owner);
    if (battRow && (
        sh === 'Source DC' || sh === 'DC Bus'
        || role.startsWith('battery_') || role.startsWith('dcBus_')
    )) {
        return { text: batteryDcText(battRow, owner), kind: loadKind(battRow.loading_percent) };
    }
    const busRow = rowFor(owner, buses);
    if (busRow) {
        const poc = isPocBus(owner, plant);
        return {
            text: busText(busRow, owner, poc ? pocExtra(cse) : [], poc ? cse : null),
            kind: vmKind(busRow.vm_pu, umin, umax),
        };
    }
    const elRow = rowFor(owner, elements);
    if (elRow) {
        if (elRow.type === 'storage') {
            return { text: storageText(elRow, owner), kind: loadKind(elRow.loading_percent) };
        }
        if (elRow.type === 'battery_dc' || elRow.type === 'source_dc') {
            return { text: batteryDcText(elRow, owner), kind: loadKind(elRow.loading_percent) };
        }
        if (elRow.type === 'load') {
            return { text: loadText(elRow, owner), kind: 'ok' };
        }
        if (elRow.type === 'ext_grid') {
            return { text: extGridText(cse, owner), kind: cse.pass === false ? 'fail' : 'ok' };
        }
        return { text: branchText(elRow, owner), kind: loadKind(elRow.loading_percent) };
    }
    if (isPocBus(owner, plant)) {
        return {
            text: [header(owner, 'POC'), ...pocExtra(cse)].filter(Boolean).join('\n'),
            kind: 'ok',
        };
    }
    return null;
}

function resolveOwner(model, ph, buses, elements) {
    const primary = ownerOfPlaceholder(model, ph);
    if (primary && (rowFor(primary, buses) || rowFor(primary, elements)
        || isExtGridCell(primary) || batteryRowFor(primary, elements))) {
        return primary;
    }
    const parent = model.getParent ? model.getParent(ph) : ph.parent;
    if (parent?.edge) {
        const src = parent.source;
        const tgt = parent.target;
        for (const end of [src, tgt]) {
            if (end && (rowFor(end, buses) || rowFor(end, elements)
                || isExtGridCell(end) || batteryRowFor(end, elements))) return end;
        }
        if (rowFor(parent, elements)) return parent;
        return src || tgt || primary;
    }
    return primary;
}

/**
 * @param {object} results bess_preliminary_results
 * @param {string} [preferredName]
 */
export function pickBessSldCase(results, preferredName) {
    const src = unwrapBessResults(results) || {};
    const cases = src.named_cases || [];
    if (preferredName) {
        const want = String(preferredName);
        const hit = cases.find((c) => c.name === want && (c.converged || (c.voltage_profile || []).length));
        if (hit) return hit;
        const byName = cases.find((c) => c.name === want);
        if (byName) return byName;
    }
    return cases.find((c) => c.converged && c.name === 'Unom_Export_Capacitive')
        || cases.find((c) => c.converged && c.name === 'Unom_POC_Target')
        || cases.find((c) => c.converged && String(c.name).includes('Unom_Export_Capacitive'))
        || cases.find((c) => c.converged && String(c.name).includes('Unom_POC_Target'))
        || cases.find((c) => c.converged && String(c.name).startsWith('Unom'))
        || cases.find((c) => c.converged)
        || cases.find((c) => (c.voltage_profile || []).length)
        || null;
}

/**
 * @returns {string|null} painted case name
 */
export function applyBessPreliminaryResultsToSld(graph, results, {
    caseName = null,
    umin_pu = 0.95,
    umax_pu = 1.05,
} = {}) {
    if (!graph) return null;
    const src = unwrapBessResults(results);
    if (!src) return null;
    const cse = pickBessSldCase(src, caseName);
    if (!cse) return null;

    const umin = Number(umin_pu) || 0.95;
    const umax = Number(umax_pu) || 1.05;
    const buses = indexRows(cse.voltage_profile || src.voltage_profile);
    const elements = indexRows(cse.elements);
    const plant = findBessPlantElements(graph);
    const model = graph.getModel ? graph.getModel() : graph.model;
    if (!model) return null;

    try { parkPlantResultBoxes(graph); } catch { /* ignore */ }

    const lf = namedCaseToLoadFlowJson(cse);
    if (cse.tap_pos != null) {
        (lf.transformers || []).forEach((tr) => {
            if (tr.tap_pos == null) {
                tr.tap_pos = cse.tap_pos;
                tr.tap_control_result = tr.tap_control_result || { tap_pos: cse.tap_pos };
            }
        });
    }
    let lfApplied = false;
    try {
        applyLoadFlowResultsToGraph(graph, lf);
        lfApplied = true;
    } catch (err) {
        console.warn('BESS case load-flow box apply failed', err);
    }

    const placeholders = [];
    const root = model.getRoot ? model.getRoot() : null;
    if (root) collectPlaceholders(model, root, placeholders);

    model.beginUpdate();
    try {
        placeholders.forEach((ph) => {
            const owner = resolveOwner(model, ph, buses, elements);
            if (!owner) return;
            if (lfApplied) {
                if (isPocBus(owner, plant)) {
                    const busRow = rowFor(owner, buses);
                    writePh(graph, ph, busText(busRow, owner, pocExtra(cse), cse),
                        vmKind(busRow?.vm_pu, umin, umax));
                    return;
                }
                if (isExtGridCell(owner)) {
                    writePh(graph, ph, extGridText(cse, owner), cse.pass === false ? 'fail' : 'ok');
                    return;
                }
                const battRow = batteryRowFor(owner, elements);
                const sh = shapeOf(owner);
                const role = cellRole(owner);
                if (battRow && (
                    sh === 'Source DC' || sh === 'DC Bus'
                    || String(role).startsWith('battery_') || String(role).startsWith('dcBus_')
                )) {
                    writePh(graph, ph, batteryDcText(battRow, owner), loadKind(battRow.loading_percent));
                    return;
                }
                // Load-flow apply can miss LV/MV bus boxes (lookup or leftover placeholders).
                // Always write buses, and any box still showing the empty placeholder.
                if (!isBusOwner(owner) && !placeholderLooksEmpty(ph) && !rowFor(owner, buses)) {
                    return;
                }
            }
            const painted = textForOwner(owner, cse, buses, elements, plant, umin, umax);
            if (!painted) return;
            writePh(graph, ph, painted.text, painted.kind);
        });
    } finally {
        model.endUpdate();
    }
    refreshGraphView(graph);
    return cse.name;
}

function pqMeta(p, q) {
    const P = Number(p);
    const Q = Number(q);
    const s = Math.hypot(P, Q);
    return {
        pf: Number.isFinite(P) && s > 1e-9 ? P / s : null,
        q_p: Number.isFinite(P) && Math.abs(P) > 1e-9 ? Q / P : null,
    };
}

/** Keep display name for labels; use pandapower/cell id for graph lookup. */
function lfIdentity(row) {
    if (!row) return row;
    return {
        ...row,
        dialogName: row.dialogName || row.name,
        name: row.technical_name || row.id || row.name,
    };
}

function isTrafo3wRow(e) {
    return e.type === 'transformer3w'
        || (e.type === 'transformer' && (e.p_mv_mw != null || e.q_mv_mvar != null
            || e.i_mv_ka != null));
}

/** Shape a named BESS case like a pandapower load-flow payload for result boxes. */
export function namedCaseToLoadFlowJson(cse) {
    if (!cse) return {};
    const els = cse.elements || [];
    const busbars = (cse.voltage_profile || []).map((b) => ({
        ...lfIdentity(b),
        ...pqMeta(b.p_mw, b.q_mvar),
    }));
    const lines = [];
    const transformers = [];
    const transformers3W = [];
    const externalgrids = [];
    const loads = [];
    const storages = [];
    const batteries = [];
    for (const e of els) {
        if (!e || !e.type) continue;
        const row = lfIdentity(e);
        if (e.type === 'line') {
            lines.push(row);
        } else if (isTrafo3wRow(e)) {
            transformers3W.push(row);
        } else if (e.type === 'transformer') {
            const tap = e.tap_control_result || (e.tap_pos != null ? {
                tap_pos: e.tap_pos,
                tap_min: e.tap_min,
                tap_max: e.tap_max,
            } : null);
            transformers.push({ ...row, tap_control_result: tap || undefined });
        } else if (e.type === 'ext_grid') {
            externalgrids.push({ ...row, ...pqMeta(e.p_mw, e.q_mvar) });
        } else if (e.type === 'load') {
            loads.push(row);
        } else if (e.type === 'storage') {
            storages.push(row);
        } else if (e.type === 'battery_dc' || e.type === 'source_dc') {
            batteries.push(row);
        }
    }
    return { busbars, lines, transformers, transformers3W, externalgrids, loads, storages, batteries };
}

function refreshGraphView(graph) {
    try {
        if (graph.view?.validate) graph.view.validate();
        if (graph.getView?.()?.refresh) graph.getView().refresh();
        else graph.refresh?.();
    } catch { /* ignore */ }
}

if (typeof window !== 'undefined') {
    window.applyBessPreliminaryResultsToSld = applyBessPreliminaryResultsToSld;
    window.pickBessSldCase = pickBessSldCase;
}
