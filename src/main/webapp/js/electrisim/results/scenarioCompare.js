/* =========================================================================
 *  Electrisim - Scenario Compare (run A vs run B)
 *  -----------------------------------------------------------------------
 *  Given a baseline Load Flow result and the current Load Flow result,
 *  compute a structured delta and render it as:
 *    - A floating modal with KPI deltas, top movers and status migrations.
 *    - Coloured delta chips on the live SLD (voltage / loading movers only).
 *
 *  Reuses the same metrics module the Network Health Dashboard / Engineering
 *  Report use (window.computeNetworkHealthMetrics) so the totals always
 *  agree with the rest of the app.
 *
 *  Public API on window:
 *      openScenarioCompare(currentDataJson, graph, opts?)
 *      closeScenarioCompare()
 *      computeScenarioDelta(baselineDataJson, currentDataJson, graph?)
 *      paintSldOverlay(graph, delta)
 *      clearSldOverlay()
 *
 *  Internal helpers exposed for tests at window._scenarioCompareInternals.
 * =========================================================================
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    /* ---------------------------------------------------------------------
     *  Constants — kept consistent with networkHealthDashboard.js
     * ------------------------------------------------------------------- */
    const VOLTAGE_OK_LOW       = 0.95;
    const VOLTAGE_OK_HIGH      = 1.05;
    const VOLTAGE_DANGER_LOW   = 0.90;
    const VOLTAGE_DANGER_HIGH  = 1.10;
    const LOADING_WARNING      = 80;
    const LOADING_DANGER       = 100;

    const COLOR_GOOD    = '#16a34a';
    const COLOR_WARN    = '#f59e0b';
    const COLOR_DANGER  = '#dc2626';
    const COLOR_INFO    = '#2563eb';
    const COLOR_TEXT    = '#0f172a';
    const COLOR_MUTED   = '#64748b';
    const COLOR_BORDER  = '#e2e8f0';

    const PANEL_ID  = 'electrisim-scenario-compare';
    const STYLE_ID  = 'electrisim-scenario-compare-style';
    const OVERLAY_LAYER_ID = 'electrisim-scenario-compare-overlay';

    /* ---------------------------------------------------------------------
     *  Helpers
     * ------------------------------------------------------------------- */
    const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v))) ? null : Number(v);
    const fmt = (v, d = 2) => (num(v) === null ? '—' : num(v).toFixed(d));

    function classifyVoltage(vmPu) {
        const v = num(vmPu);
        if (v === null) return 'unknown';
        if (v >= VOLTAGE_DANGER_HIGH || v <= VOLTAGE_DANGER_LOW) return 'danger';
        if (v >  VOLTAGE_OK_HIGH    || v <  VOLTAGE_OK_LOW)     return 'warn';
        return 'good';
    }

    function classifyLoading(loading) {
        const l = num(loading);
        if (l === null) return 'unknown';
        if (l > LOADING_DANGER)  return 'danger';
        if (l > LOADING_WARNING) return 'warn';
        return 'good';
    }

    function bandIndex(name) {
        if (name === 'good')   return 0;
        if (name === 'warn')   return 1;
        if (name === 'danger') return 2;
        return -1;
    }

    function escapeHtml(s) {
        if (s === null || s === undefined) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function arrOf(json, ...keys) {
        const j = json || {};
        for (const k of keys) {
            if (Array.isArray(j[k])) return j[k];
        }
        return [];
    }

    /* ---------------------------------------------------------------------
     *  Element matching across two runs.
     *  Prefer user dialog names (stable across sheets), then electrical
     *  topology roles, then legacy id / mxCell fallbacks.
     * ------------------------------------------------------------------- */
    function isInternalMxName(str) {
        if (str == null || str === '') return true;
        const s = String(str).trim().replace(/#/g, '_');
        return /^mxCell_\d+$/i.test(s);
    }

    function normalizeDialogKey(name) {
        if (!name || isInternalMxName(name)) return null;
        return String(name).trim().toLowerCase();
    }

    function rowBusAliases(row) {
        const out = new Set();
        const add = (v) => {
            if (v == null || v === '') return;
            const s = String(v);
            out.add(s);
            out.add(s.replace(/_/g, '#'));
            out.add(s.replace(/#/g, '_'));
            out.add(s.toLowerCase());
        };
        add(row?.name);
        add(row?.id);
        return out;
    }

    function busRefMatch(ref, aliases) {
        if (ref == null || ref === '') return false;
        const s = String(ref);
        return aliases.has(s)
            || aliases.has(s.replace(/_/g, '#'))
            || aliases.has(s.replace(/#/g, '_'))
            || aliases.has(s.toLowerCase());
    }

    function collectTransformers(json) {
        return [
            ...arrOf(json, 'transformers').map(x => Object.assign({ kind: 'transformer' }, x)),
            ...arrOf(json, 'transformers3W', 'transformers3w').map(x => Object.assign({ kind: 'transformer3w' }, x)),
        ];
    }

    function busTopologyKey(row, dataJson) {
        if (!row || !dataJson) return null;
        const aliases = rowBusAliases(row);
        if (arrOf(dataJson, 'externalgrids').some(g => busRefMatch(g.bus, aliases))) {
            return 'topo:bus:externalgrid';
        }
        if (arrOf(dataJson, 'storages').some(s => busRefMatch(s.bus, aliases))) {
            return 'topo:bus:storage';
        }
        const trafos = collectTransformers(dataJson);
        if (trafos.some(t => busRefMatch(t.busTo, aliases))) return 'topo:bus:trafo_lv';
        if (trafos.some(t => busRefMatch(t.busFrom, aliases))) return 'topo:bus:trafo_hv';
        if (trafos.some(t => busRefMatch(t.busHv, aliases))) return 'topo:bus:trafo_hv';
        if (trafos.some(t => busRefMatch(t.busMv, aliases))) return 'topo:bus:trafo_mv';
        if (trafos.some(t => busRefMatch(t.busLv, aliases))) return 'topo:bus:trafo_lv';
        if (arrOf(dataJson, 'generators').some(g => busRefMatch(g.bus, aliases))) return 'topo:bus:generator';
        if (arrOf(dataJson, 'staticgenerators').some(g => busRefMatch(g.bus, aliases))) return 'topo:bus:sgen';
        if (arrOf(dataJson, 'loads').some(l => busRefMatch(l.bus, aliases))) return 'topo:bus:load';
        const lineCount = arrOf(dataJson, 'lines').filter(l =>
            busRefMatch(l.busFrom, aliases) || busRefMatch(l.busTo, aliases)).length;
        if (lineCount > 0) return `topo:bus:line_node:${lineCount}`;
        return null;
    }

    function endpointTopologyKey(ref, dataJson) {
        if (ref == null || ref === '') return null;
        return busTopologyKey({ name: ref, id: ref }, dataJson);
    }

    function lineTopologyKey(row, dataJson) {
        const from = endpointTopologyKey(row.busFrom, dataJson);
        const to   = endpointTopologyKey(row.busTo, dataJson);
        if (from && to) return `topo:line:${[from, to].sort().join('::')}`;
        return null;
    }

    function transformerTopologyKey(row, dataJson) {
        if (row.busHv != null || row.busMv != null || row.busLv != null) {
            const parts = [
                endpointTopologyKey(row.busHv, dataJson),
                endpointTopologyKey(row.busMv, dataJson),
                endpointTopologyKey(row.busLv, dataJson),
            ].filter(Boolean).sort();
            if (parts.length >= 2) return `topo:trafo3w:${parts.join('::')}`;
        }
        const from = endpointTopologyKey(row.busFrom, dataJson);
        const to   = endpointTopologyKey(row.busTo, dataJson);
        if (from && to) return `topo:trafo2w:${[from, to].sort().join('::')}`;
        return null;
    }

    function elementOnBusTopologyKey(prefix, row, dataJson) {
        const busKey = busTopologyKey({ name: row.bus, id: row.bus }, dataJson);
        return busKey ? `${prefix}:${busKey}` : null;
    }

    function topologyKeyForRow(row, category, dataJson) {
        if (!row || !dataJson) return null;
        const cat = String(category || '').toLowerCase();
        if (cat === 'bus' || cat === 'busbars') return busTopologyKey(row, dataJson);
        if (cat === 'line' || cat === 'lines') return lineTopologyKey(row, dataJson);
        if (cat === 'transformer' || cat === 'transformers') return transformerTopologyKey(row, dataJson);
        if (cat === 'transformer3w' || cat === 'transformers3w') return transformerTopologyKey(row, dataJson);
        if (cat === 'externalgrids' || cat === 'externalgrid') {
            return elementOnBusTopologyKey('topo:extgrid', row, dataJson);
        }
        if (cat === 'storages' || cat === 'storage') {
            return elementOnBusTopologyKey('topo:storage', row, dataJson);
        }
        if (cat === 'generators' || cat === 'generator') {
            return elementOnBusTopologyKey('topo:gen', row, dataJson);
        }
        if (cat === 'staticgenerators' || cat === 'sgen') {
            return elementOnBusTopologyKey('topo:sgen', row, dataJson);
        }
        if (cat === 'loads' || cat === 'load') {
            return elementOnBusTopologyKey('topo:load', row, dataJson);
        }
        if (cat === 'pvsystems' || cat === 'pv') {
            return elementOnBusTopologyKey('topo:pv', row, dataJson);
        }
        if (cat === 'motors' || cat === 'motor') {
            return elementOnBusTopologyKey('topo:motor', row, dataJson);
        }
        return null;
    }

    function makeKeyResolver(graph, dataJson) {
        const hasResolver =
            typeof window !== 'undefined' &&
            typeof window.buildGraphCellLookupMap   === 'function' &&
            typeof window.resolveGraphCellForResult === 'function' &&
            typeof window.getDialogNameFromCell     === 'function';
        let map = null;
        if (hasResolver && graph) {
            try { map = window.buildGraphCellLookupMap(graph); } catch (e) { map = null; }
        }
        const dialogFromGraph = (row) => {
            if (!map || !row) return null;
            try {
                const cell = window.resolveGraphCellForResult(map, row, graph);
                if (!cell) return null;
                const dn = window.getDialogNameFromCell(cell);
                return normalizeDialogKey(dn);
            } catch (e) { return null; }
        };
        return (row, category) => {
            if (!row) return null;
            const cat = String(category || 'element').toLowerCase();

            const storedDn = normalizeDialogKey(row.dialogName);
            if (storedDn) return `dn:${cat}:${storedDn}`;

            const graphDn = dialogFromGraph(row);
            if (graphDn) return `dn:${cat}:${graphDn}`;

            const topo = topologyKeyForRow(row, cat, dataJson);
            if (topo) return topo;

            if (row.id != null && row.id !== '' && !isInternalMxName(row.id)) {
                return `id:${row.id}`;
            }
            if (row.mxObjectId) return `mx:${String(row.mxObjectId).replace(/#/g, '_')}`;
            if (row.name && !isInternalMxName(row.name)) return `name:${row.name}`;
            if (row.id != null && row.id !== '') return `id:${row.id}`;
            if (row.name) return `name:${row.name}`;
            return null;
        };
    }

    function makeDisplayNameResolver(graph) {
        const hasResolver =
            typeof window !== 'undefined' &&
            typeof window.buildGraphCellLookupMap   === 'function' &&
            typeof window.resolveGraphCellForResult === 'function' &&
            typeof window.getDialogNameFromCell     === 'function';
        if (!hasResolver || !graph) {
            return (row) => {
                const dn = row?.dialogName;
                if (dn && !isInternalMxName(dn)) return dn;
                return row?.name || (row?.id != null ? String(row.id) : '');
            };
        }
        let map;
        try { map = window.buildGraphCellLookupMap(graph); } catch (e) { map = null; }
        return (row) => {
            const stored = row?.dialogName;
            if (stored && !isInternalMxName(stored)) return stored;
            try {
                const cell = map ? window.resolveGraphCellForResult(map, row, graph) : null;
                if (cell) {
                    const dn = window.getDialogNameFromCell(cell);
                    if (dn) return dn;
                }
            } catch (e) { /* ignore */ }
            const n = row?.name;
            if (n && !isInternalMxName(n)) return String(n).replace(/_/g, '#');
            return row?.id != null ? String(row.id) : '—';
        };
    }

    /* ---------------------------------------------------------------------
     *  Pure helper: compute the delta.
     *  Tolerant of both pandapower (`transformers3W`) and OpenDSS
     *  (`transformers3w`) key spellings, and of missing arrays.
     * ------------------------------------------------------------------- */
    function computeScenarioDelta(baselineDataJson, currentDataJson, graph) {
        const a = baselineDataJson || {};
        const b = currentDataJson  || {};

        const metricsFn = (typeof window !== 'undefined' && typeof window.computeNetworkHealthMetrics === 'function')
            ? window.computeNetworkHealthMetrics
            : null;

        const ma = metricsFn ? metricsFn(a, graph) : null;
        const mb = metricsFn ? metricsFn(b, graph) : null;

        const keyOfA      = makeKeyResolver(graph, a);
        const keyOfB      = makeKeyResolver(graph, b);
        const nameOf      = makeDisplayNameResolver(graph);

        // ---- KPI delta ----
        const kpiDelta = {};
        if (ma && mb) {
            const k = (id, baseVal, currVal, betterIs = 'lower', isPercent = false) => {
                const base = num(baseVal);
                const curr = num(currVal);
                const delta = (base !== null && curr !== null) ? curr - base : null;
                const deltaPct = (base !== null && Math.abs(base) > 1e-9 && delta !== null)
                    ? (delta / Math.abs(base)) * 100 : null;
                let direction = 'neutral';
                if (delta !== null && Math.abs(delta) > 1e-6) {
                    if (betterIs === 'lower') direction = delta < 0 ? 'improved' : 'worsened';
                    else if (betterIs === 'higher') direction = delta > 0 ? 'improved' : 'worsened';
                    else direction = 'changed';
                }
                kpiDelta[id] = { baseline: base, current: curr, delta, deltaPct, direction, isPercent };
            };
            k('totalGen',     ma.totalGen,     mb.totalGen,     'higher');
            k('totalLoad',    ma.totalLoad,    mb.totalLoad,    'changed');
            k('totalLosses',  ma.totalLosses,  mb.totalLosses,  'lower');
            k('lossPct',      ma.lossPct,      mb.lossPct,      'lower', true);
            k('healthScore',  ma.healthScore,  mb.healthScore,  'higher');
            const violA = (ma.equipmentBuckets.warn + ma.equipmentBuckets.danger
                         + ma.busBuckets.warn       + ma.busBuckets.danger);
            const violB = (mb.equipmentBuckets.warn + mb.equipmentBuckets.danger
                         + mb.busBuckets.warn       + mb.busBuckets.danger);
            k('violations', violA, violB, 'lower');
            k('minV', ma.minV, mb.minV, 'changed');
            k('maxV', ma.maxV, mb.maxV, 'changed');
            k('maxLoading', ma.maxL, mb.maxL, 'lower', true);
        }

        // ---- Per-bus delta ----
        const busesA = arrOf(a, 'busbars');
        const busesB = arrOf(b, 'busbars');
        const busAByKey = new Map();
        for (const r of busesA) {
            const key = keyOfA(r, 'bus');
            if (key) busAByKey.set(key, r);
        }
        const seenBusKeys = new Set();
        const perBus = [];
        const addedBuses = [], removedBuses = [];
        for (const r of busesB) {
            const key = keyOfB(r, 'bus');
            if (!key) continue;
            seenBusKeys.add(key);
            const peer = busAByKey.get(key);
            if (!peer) {
                addedBuses.push({ key, kind: 'bus', dialogName: nameOf(r), id: r.id, name: r.name });
                continue;
            }
            const vBase = num(peer.vm_pu);
            const vCurr = num(r.vm_pu);
            if (vBase === null || vCurr === null) continue;
            const delta = vCurr - vBase;
            const bandBase = classifyVoltage(vBase);
            const bandCurr = classifyVoltage(vCurr);
            let severity = 'neutral';
            if (Math.abs(delta) > 1e-4) {
                if (bandCurr === 'danger' || (bandIndex(bandCurr) > bandIndex(bandBase))) severity = 'worsened';
                else if (bandIndex(bandCurr) < bandIndex(bandBase))                       severity = 'improved';
                else                                                                       severity = 'changed';
            }
            perBus.push({
                key, kind: 'bus', order: perBus.length,
                id: r.id, name: r.name, dialogName: nameOf(r),
                vm_pu_base: vBase, vm_pu_curr: vCurr, delta,
                band_base: bandBase, band_curr: bandCurr,
                severity,
            });
        }
        for (const [key, peer] of busAByKey.entries()) {
            if (!seenBusKeys.has(key)) {
                removedBuses.push({ key, kind: 'bus', dialogName: nameOf(peer), id: peer.id, name: peer.name });
            }
        }
        perBus.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

        // ---- Per-branch delta (lines + 2W trafos + 3W trafos) ----
        const collectBranches = (json) => {
            return [
                ...arrOf(json, 'lines').map(x => Object.assign({ kind: 'line' }, x)),
                ...arrOf(json, 'transformers').map(x => Object.assign({ kind: 'transformer' }, x)),
                ...arrOf(json, 'transformers3W', 'transformers3w').map(x => Object.assign({ kind: 'transformer3w' }, x)),
            ];
        };
        const brA = collectBranches(a);
        const brB = collectBranches(b);
        const brAByKey = new Map();
        for (const r of brA) {
            const key = keyOfA(r, r.kind || 'branch');
            if (key) brAByKey.set(key, r);
        }
        const seenBrKeys = new Set();
        const perBranch = [];
        const addedBranches = [], removedBranches = [];
        for (const r of brB) {
            const key = keyOfB(r, r.kind || 'branch');
            if (!key) continue;
            seenBrKeys.add(key);
            const peer = brAByKey.get(key);
            if (!peer) {
                addedBranches.push({ key, kind: r.kind, dialogName: nameOf(r), id: r.id, name: r.name });
                continue;
            }
            const lBase = num(peer.loading_percent);
            const lCurr = num(r.loading_percent);
            if (lBase === null || lCurr === null) continue;
            const delta = lCurr - lBase;
            const bandBase = classifyLoading(lBase);
            const bandCurr = classifyLoading(lCurr);
            let severity = 'neutral';
            if (Math.abs(delta) > 1e-3) {
                if (bandCurr === 'danger' || (bandIndex(bandCurr) > bandIndex(bandBase))) severity = 'worsened';
                else if (bandIndex(bandCurr) < bandIndex(bandBase))                       severity = 'improved';
                else                                                                       severity = delta > 0 ? 'changed' : 'changed';
            }
            perBranch.push({
                key, kind: r.kind,
                id: r.id, name: r.name, dialogName: nameOf(r),
                loading_base: lBase, loading_curr: lCurr, delta,
                band_base: bandBase, band_curr: bandCurr,
                severity,
            });
        }
        for (const [key, peer] of brAByKey.entries()) {
            if (!seenBrKeys.has(key)) {
                removedBranches.push({ key, kind: peer.kind, dialogName: nameOf(peer), id: peer.id, name: peer.name });
            }
        }
        perBranch.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

        // ---- Status migrations (band crossings) ----
        const statusMigrations = [];
        for (const r of perBus) {
            if (r.band_base !== r.band_curr) {
                statusMigrations.push({
                    kind: 'bus',
                    name: r.dialogName || r.name || r.id,
                    from: r.band_base, to: r.band_curr,
                    delta: r.delta, unit: 'pu',
                    id: r.id, src: r.name, key: r.key,
                });
            }
        }
        for (const r of perBranch) {
            if (r.band_base !== r.band_curr) {
                statusMigrations.push({
                    kind: r.kind,
                    name: r.dialogName || r.name || r.id,
                    from: r.band_base, to: r.band_curr,
                    delta: r.delta, unit: '%',
                    id: r.id, src: r.name, key: r.key,
                });
            }
        }
        // Worsened first.
        statusMigrations.sort((x, y) => {
            const xw = bandIndex(x.to) - bandIndex(x.from);
            const yw = bandIndex(y.to) - bandIndex(y.from);
            return yw - xw;
        });

        // ---- Added / removed elements (other categories) ----
        const compareCategory = (catKey) => {
            const aRows = arrOf(a, catKey);
            const bRows = arrOf(b, catKey);
            const aMap = new Map();
            for (const r of aRows) { const k = keyOfA(r, catKey); if (k) aMap.set(k, r); }
            const bSeen = new Set();
            const added = [];
            for (const r of bRows) {
                const k = keyOfB(r, catKey); if (!k) continue;
                bSeen.add(k);
                if (!aMap.has(k)) added.push({ key: k, category: catKey, dialogName: nameOf(r), id: r.id, name: r.name });
            }
            const removed = [];
            for (const [k, peer] of aMap.entries()) {
                if (!bSeen.has(k)) removed.push({ key: k, category: catKey, dialogName: nameOf(peer), id: peer.id, name: peer.name });
            }
            return { added, removed };
        };
        const otherCats = [
            'generators', 'staticgenerators', 'asymmetricstaticgenerators',
            'externalgrids', 'pvsystems', 'storages',
            'loads', 'asymmetricloads', 'motors',
        ];
        const addedRemoved = { added: [...addedBuses, ...addedBranches], removed: [...removedBuses, ...removedBranches] };
        for (const c of otherCats) {
            const { added, removed } = compareCategory(c);
            addedRemoved.added.push(...added);
            addedRemoved.removed.push(...removed);
        }

        // ---- Overvoltage mitigation (BESS / weak-grid tutorial helper) ----
        const OV_THRESHOLD = VOLTAGE_OK_HIGH; // 1.05 pu
        const overvoltageBuses = perBus.filter((r) => {
            const baseOv = num(r.vm_pu_base) > OV_THRESHOLD;
            const currOv = num(r.vm_pu_curr) > OV_THRESHOLD;
            return baseOv || currOv;
        });
        const mitigatedBuses = overvoltageBuses.filter((r) => {
            const baseOv = num(r.vm_pu_base) > OV_THRESHOLD;
            const currOk = num(r.vm_pu_curr) <= OV_THRESHOLD;
            return baseOv && currOk;
        });
        const worsenedOvBuses = overvoltageBuses.filter((r) => {
            const baseOk = num(r.vm_pu_base) <= OV_THRESHOLD;
            const currOv = num(r.vm_pu_curr) > OV_THRESHOLD;
            return baseOk && currOv;
        });
        const partialMitigation = overvoltageBuses.filter((r) => {
            const baseOv = num(r.vm_pu_base) > OV_THRESHOLD;
            const currOv = num(r.vm_pu_curr) > OV_THRESHOLD;
            return baseOv && currOv && r.delta < -1e-4;
        });
        const maxBaseV = perBus.reduce((m, r) => Math.max(m, num(r.vm_pu_base) || 0), 0);
        const maxCurrV = perBus.reduce((m, r) => Math.max(m, num(r.vm_pu_curr) || 0), 0);

        const storagesA = arrOf(a, 'storages');
        const storagesB = arrOf(b, 'storages');
        const storageQByKey = new Map();
        for (const r of storagesA) {
            const k = keyOfA(r, 'storages');
            if (k) storageQByKey.set(k, { q_base: num(r.q_mvar), q_curr: null, name: nameOf(r) });
        }
        for (const r of storagesB) {
            const k = keyOfB(r, 'storages');
            if (!k) continue;
            const entry = storageQByKey.get(k) || { q_base: null, q_curr: null, name: nameOf(r) };
            entry.q_curr = num(r.q_mvar);
            entry.inv_mode = r.inv_control_mode || '';
            storageQByKey.set(k, entry);
        }
        const storageReactiveDelta = [];
        for (const [k, v] of storageQByKey.entries()) {
            if (v.q_base === null || v.q_curr === null) continue;
            const dq = v.q_curr - v.q_base;
            if (Math.abs(dq) > 1e-4) {
                storageReactiveDelta.push({
                    key: k, name: v.name, q_base: v.q_base, q_curr: v.q_curr,
                    delta: dq, inv_mode: v.inv_mode || '',
                });
            }
        }
        storageReactiveDelta.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

        const overvoltageMitigation = {
            threshold_pu: OV_THRESHOLD,
            max_vm_base: maxBaseV,
            max_vm_curr: maxCurrV,
            max_vm_delta: maxCurrV - maxBaseV,
            mitigated_count: mitigatedBuses.length,
            worsened_count: worsenedOvBuses.length,
            partial_count: partialMitigation.length,
            mitigated_buses: mitigatedBuses.slice(0, 8),
            worsened_buses: worsenedOvBuses.slice(0, 5),
            partial_buses: partialMitigation.slice(0, 5),
            storage_reactive_delta: storageReactiveDelta.slice(0, 5),
        };

        return {
            kpiDelta,
            perBus,
            perBranch,
            statusMigrations,
            addedRemoved,
            overvoltageMitigation,
            metaA: {
                counts: ma ? ma.counts : null,
                converged: ma ? ma.converged : null,
                healthScore: ma ? ma.healthScore : null,
            },
            metaB: {
                counts: mb ? mb.counts : null,
                converged: mb ? mb.converged : null,
                healthScore: mb ? mb.healthScore : null,
            },
        };
    }

    /* ---------------------------------------------------------------------
     *  Style injection (one-time)
     * ------------------------------------------------------------------- */
    function ensureStyle() {
        if (typeof document === 'undefined') return;
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .esc-overlay {
                position: fixed; inset: 0;
                background: rgba(15, 23, 42, 0.45);
                /* Above the Network Health Dashboard (10020) and the load-flow legend (10001),
                   which the panel is opened from. */
                z-index: 10030;
                animation: esc-fade-in 0.2s ease;
            }
            @keyframes esc-fade-in { from { opacity: 0; } to { opacity: 1; } }

            #${PANEL_ID} {
                position: fixed; left: 50%; top: 50%;
                transform: translate(-50%, -50%);
                width: min(1100px, calc(100vw - 40px));
                max-height: calc(100vh - 60px);
                background: #ffffff;
                border: 1px solid ${COLOR_BORDER};
                border-radius: 14px;
                box-shadow: 0 24px 60px -12px rgba(15,23,42,0.35);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: ${COLOR_TEXT};
                z-index: 10031;
                display: flex; flex-direction: column;
                overflow: hidden;
                animation: esc-pop-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes esc-pop-in {
                from { transform: translate(-50%, -50%) scale(0.96); opacity: 0; }
                to   { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
            }
            #${PANEL_ID} .esc-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 14px 18px;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #f8fafc;
            }
            #${PANEL_ID} .esc-header h3 {
                margin: 0; font-size: 15px; font-weight: 600; letter-spacing: 0.3px;
            }
            #${PANEL_ID} .esc-header .esc-sub {
                margin-top: 3px; font-size: 12px; color: #cbd5e1; font-weight: 400;
            }
            #${PANEL_ID} .esc-icon-btn {
                background: rgba(255,255,255,0.1); color: #f8fafc;
                border: none; border-radius: 6px; width: 28px; height: 28px;
                cursor: pointer; font-size: 16px; line-height: 1;
                display: inline-flex; align-items: center; justify-content: center;
            }
            #${PANEL_ID} .esc-icon-btn:hover { background: rgba(255,255,255,0.2); }
            #${PANEL_ID} .esc-body {
                padding: 16px 18px; overflow-y: auto;
            }
            #${PANEL_ID} .esc-runs {
                display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
                margin-bottom: 14px;
            }
            #${PANEL_ID} .esc-run-card {
                padding: 10px 12px;
                background: ${COLOR_INFO}10; /* faint tint */
                background: #f1f5ff;
                border: 1px solid #c7d2fe;
                border-radius: 8px;
            }
            #${PANEL_ID} .esc-run-card.curr {
                background: #ecfeff;
                border-color: #a5f3fc;
            }
            #${PANEL_ID} .esc-run-label {
                font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
                color: ${COLOR_MUTED}; font-weight: 700;
            }
            #${PANEL_ID} .esc-run-name {
                margin-top: 3px; font-size: 14px; font-weight: 600; color: ${COLOR_TEXT};
            }
            #${PANEL_ID} .esc-run-meta {
                margin-top: 2px; font-size: 11px; color: ${COLOR_MUTED};
            }
            #${PANEL_ID} .esc-kpi-grid {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
                margin-bottom: 14px;
            }
            #${PANEL_ID} .esc-kpi {
                padding: 12px; border: 1px solid ${COLOR_BORDER}; border-radius: 8px;
                background: #f8fafc;
            }
            #${PANEL_ID} .esc-kpi-label {
                font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
                color: ${COLOR_MUTED}; font-weight: 700;
            }
            #${PANEL_ID} .esc-kpi-row {
                margin-top: 4px; display: flex; align-items: baseline; gap: 8px;
                font-size: 13px;
            }
            #${PANEL_ID} .esc-kpi-base { color: ${COLOR_MUTED}; }
            #${PANEL_ID} .esc-kpi-curr { font-size: 18px; font-weight: 700; color: ${COLOR_TEXT}; }
            #${PANEL_ID} .esc-kpi-arrow { color: ${COLOR_MUTED}; }
            #${PANEL_ID} .esc-chip {
                display: inline-block; padding: 2px 7px; margin-top: 6px;
                border-radius: 999px; font-size: 11px; font-weight: 700;
                background: #e2e8f0; color: ${COLOR_TEXT};
            }
            #${PANEL_ID} .esc-chip.improved { background: #dcfce7; color: #14532d; }
            #${PANEL_ID} .esc-chip.worsened { background: #fee2e2; color: #7f1d1d; }
            #${PANEL_ID} .esc-chip.neutral  { background: #e2e8f0; color: #334155; }

            #${PANEL_ID} .esc-grid2 {
                display: grid; grid-template-columns: 1fr 1fr; gap: 14px;
                margin-bottom: 14px;
            }
            #${PANEL_ID} .esc-section-title {
                font-size: 12px; font-weight: 700; color: ${COLOR_TEXT};
                margin: 0 0 8px 0;
                display: flex; align-items: center; justify-content: space-between;
            }
            #${PANEL_ID} .esc-section-title .esc-count {
                font-size: 10px; color: ${COLOR_MUTED}; font-weight: 600;
            }
            #${PANEL_ID} table.esc-table {
                width: 100%; border-collapse: collapse; font-size: 12px;
                border: 1px solid ${COLOR_BORDER}; border-radius: 6px;
                overflow: hidden;
            }
            #${PANEL_ID} table.esc-table th, #${PANEL_ID} table.esc-table td {
                padding: 6px 8px; text-align: left;
                border-bottom: 1px solid ${COLOR_BORDER};
            }
            #${PANEL_ID} table.esc-table th {
                background: #f8fafc; color: ${COLOR_MUTED};
                font-weight: 600; font-size: 10px;
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            #${PANEL_ID} table.esc-table tbody tr { cursor: pointer; }
            #${PANEL_ID} table.esc-table tbody tr:hover { background: #f1f5f9; }
            #${PANEL_ID} table.esc-table .num { text-align: right; font-variant-numeric: tabular-nums; }
            #${PANEL_ID} .esc-empty {
                padding: 12px; text-align: center; font-size: 12px; color: ${COLOR_MUTED};
                background: #f8fafc; border-radius: 6px; border: 1px dashed ${COLOR_BORDER};
            }
            #${PANEL_ID} .esc-migrations {
                background: #fff7ed; border: 1px solid #fed7aa;
                border-radius: 8px; padding: 10px 12px; margin-bottom: 14px;
            }
            #${PANEL_ID} .esc-migrations.empty { background: #ecfdf5; border-color: #bbf7d0; }
            #${PANEL_ID} .esc-migrations h4 {
                margin: 0 0 6px 0; font-size: 12px; font-weight: 700;
                color: ${COLOR_TEXT};
            }
            #${PANEL_ID} .esc-migration-row {
                display: flex; align-items: center; gap: 8px;
                font-size: 12px; padding: 4px 0;
                border-top: 1px solid #fed7aa;
            }
            #${PANEL_ID} .esc-migration-row:first-of-type { border-top: none; }
            #${PANEL_ID} .esc-band {
                display: inline-block; padding: 1px 7px;
                border-radius: 4px; font-weight: 700; font-size: 10px;
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            #${PANEL_ID} .esc-band.good   { background: #dcfce7; color: #14532d; }
            #${PANEL_ID} .esc-band.warn   { background: #fef3c7; color: #78350f; }
            #${PANEL_ID} .esc-band.danger { background: #fee2e2; color: #7f1d1d; }
            #${PANEL_ID} .esc-band.unknown{ background: #e2e8f0; color: #334155; }

            #${PANEL_ID} .esc-footer {
                padding: 12px 18px;
                border-top: 1px solid ${COLOR_BORDER};
                display: flex; flex-wrap: wrap; gap: 10px;
                background: #f8fafc;
            }
            #${PANEL_ID} .esc-btn {
                padding: 8px 14px; font-size: 12px; font-weight: 600;
                border-radius: 8px; border: 1px solid ${COLOR_BORDER};
                background: #ffffff; color: ${COLOR_TEXT};
                cursor: pointer; transition: all 0.15s ease;
            }
            #${PANEL_ID} .esc-btn:hover { background: #f1f5f9; }
            #${PANEL_ID} .esc-btn.primary {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: #fff; border-color: transparent;
            }
            #${PANEL_ID} .esc-btn.primary:hover { box-shadow: 0 6px 14px -4px rgba(37,99,235,0.45); }
            #${PANEL_ID} .esc-btn.danger {
                color: ${COLOR_DANGER};
            }

            /* Solver cross-check (baseline and current run from different engines) */
            #${PANEL_ID} .esc-xc { margin-bottom: 14px; }
            #${PANEL_ID} .esc-xc-verdict {
                display: flex; align-items: center; gap: 12px;
                padding: 12px 14px; margin-bottom: 10px;
                border: 1px solid ${COLOR_BORDER}; border-radius: 10px; background: #f8fafc;
            }
            #${PANEL_ID} .esc-xc-verdict.agree  { background: #ecfdf5; border-color: #86efac; }
            #${PANEL_ID} .esc-xc-verdict.close  { background: #fffbeb; border-color: #fcd34d; }
            #${PANEL_ID} .esc-xc-verdict.differ { background: #fef2f2; border-color: #fca5a5; }
            #${PANEL_ID} .esc-xc-icon {
                width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
                display: inline-flex; align-items: center; justify-content: center;
                font-size: 18px; font-weight: 800; color: #fff; background: ${COLOR_MUTED};
            }
            #${PANEL_ID} .agree  .esc-xc-icon { background: ${COLOR_GOOD}; }
            #${PANEL_ID} .close  .esc-xc-icon { background: ${COLOR_WARN}; }
            #${PANEL_ID} .differ .esc-xc-icon { background: ${COLOR_DANGER}; }
            #${PANEL_ID} .esc-xc-title { font-size: 14px; font-weight: 700; color: ${COLOR_TEXT}; }
            #${PANEL_ID} .esc-xc-text  { margin-top: 2px; font-size: 12px; color: #334155; }
            #${PANEL_ID} .esc-xc-verdict .esc-btn { margin-left: auto; flex-shrink: 0; }
            #${PANEL_ID} .esc-xc-stats {
                display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;
                margin-bottom: 10px;
            }
            #${PANEL_ID} .esc-xc-stat {
                padding: 10px 12px; border: 1px solid ${COLOR_BORDER}; border-radius: 8px;
                background: #f8fafc; min-width: 0;
            }
            #${PANEL_ID} .esc-xc-stat-label {
                font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
                color: ${COLOR_MUTED}; font-weight: 700;
            }
            #${PANEL_ID} .esc-xc-stat-value {
                margin-top: 3px; font-size: 18px; font-weight: 700; color: ${COLOR_TEXT};
                font-variant-numeric: tabular-nums;
            }
            #${PANEL_ID} .esc-xc-stat-sub {
                margin-top: 1px; font-size: 11px; color: ${COLOR_MUTED};
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            }
            #${PANEL_ID} .esc-xc-charts {
                display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.73fr);
                gap: 12px; margin-bottom: 10px;
            }
            #${PANEL_ID} .esc-xc-card {
                border: 1px solid ${COLOR_BORDER}; border-radius: 8px; padding: 10px 12px;
                background: #ffffff; min-width: 0;
            }
            #${PANEL_ID} .esc-xc-card svg { width: 100%; height: auto; display: block; overflow: visible; }
            #${PANEL_ID} .esc-xc-card [data-xc-idx] { cursor: pointer; }
            #${PANEL_ID} .esc-xc-card text { font-family: inherit; }
            #${PANEL_ID} .esc-xc-pt {
                transform-box: fill-box; transform-origin: center;
                animation: esc-xc-pop 0.45s cubic-bezier(0.16, 1, 0.3, 1) backwards;
            }
            #${PANEL_ID} .esc-xc-pt:hover { stroke: ${COLOR_TEXT}; stroke-width: 1.5; }
            #${PANEL_ID} .esc-xc-bar {
                transform-box: fill-box; transform-origin: bottom;
                animation: esc-xc-grow 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
            }
            #${PANEL_ID} .esc-xc-bar.neg { transform-origin: top; }
            #${PANEL_ID} .esc-xc-bar:hover { opacity: 0.75; }
            @keyframes esc-xc-pop  { from { opacity: 0; transform: scale(0.2); } }
            @keyframes esc-xc-grow { from { transform: scaleY(0); } }
            #${PANEL_ID} .esc-xc-legend {
                display: flex; flex-wrap: wrap; gap: 12px; margin-top: 4px;
                font-size: 11px; color: ${COLOR_MUTED};
            }
            #${PANEL_ID} .esc-xc-legend i {
                display: inline-block; width: 9px; height: 9px; border-radius: 50%;
                margin-right: 4px; vertical-align: -1px;
            }
            #${PANEL_ID} .esc-xc-notes {
                padding: 10px 12px; font-size: 12px; color: ${COLOR_TEXT};
                background: #f8fafc; border: 1px solid ${COLOR_BORDER}; border-radius: 8px;
            }
            #${PANEL_ID} .esc-xc-notes h4 { margin: 0 0 6px 0; font-size: 12px; font-weight: 700; }
            #${PANEL_ID} .esc-xc-notes ul { margin: 0; padding-left: 18px; }
            #${PANEL_ID} .esc-xc-notes li { margin: 3px 0; line-height: 1.4; }
            @media (max-width: 760px) {
                #${PANEL_ID} .esc-xc-stats  { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                #${PANEL_ID} .esc-xc-charts { grid-template-columns: minmax(0, 1fr); }
                #${PANEL_ID} .esc-xc-verdict { flex-wrap: wrap; }
            }
            @media (min-width: 761px) and (max-width: 1060px) {
                #${PANEL_ID} .esc-xc-charts { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
                #${PANEL_ID} .esc-xc-charts .esc-xc-card.wide { grid-column: 1 / -1; }
            }

            /* SLD overlay chips — fixed HTML layer on document.body (mxGraph's
               overlay pane is SVG <g>, which cannot host HTML div chips). */
            #${OVERLAY_LAYER_ID} {
                position: fixed; top: 0; left: 0;
                width: 100%; height: 100%;
                overflow: visible;
                pointer-events: none;
                z-index: 9990;
            }
            .esc-chip-overlay {
                position: fixed;
                pointer-events: auto;
                padding: 2px 4px 2px 7px;
                border-radius: 999px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 11px; font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 4px 10px rgba(15,23,42,0.18);
                cursor: pointer;
                transform: translate(-50%, -120%);
                transition: transform 0.12s ease;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            .esc-chip-overlay:hover { transform: translate(-50%, -120%) scale(1.06); }
            .esc-chip-overlay .esc-chip-dismiss {
                border: none;
                background: rgba(255,255,255,0.28);
                color: inherit;
                border-radius: 999px;
                width: 16px;
                height: 16px;
                padding: 0;
                font-size: 12px;
                line-height: 1;
                cursor: pointer;
                flex-shrink: 0;
            }
            .esc-chip-overlay .esc-chip-dismiss:hover { background: rgba(255,255,255,0.45); }
            .esc-chip-overlay.improved { background: #16a34a; color: #fff; }
            .esc-chip-overlay.worsened { background: #dc2626; color: #fff; }
            .esc-chip-overlay.changed  { background: #f59e0b; color: #fff; }
            .esc-chip-overlay.added    { background: #2563eb; color: #fff; }
            .esc-chip-overlay.removed  { background: #475569; color: #fff; }

            /* Toast ------------------------------------------------------- */
            .esc-toast {
                position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
                padding: 10px 16px; border-radius: 8px;
                background: #0f172a; color: #f8fafc;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                font-size: 13px; font-weight: 500;
                box-shadow: 0 12px 30px -10px rgba(15,23,42,0.45);
                z-index: 10040;
                animation: esc-toast 2.4s ease forwards;
            }
            @keyframes esc-toast {
                0%   { opacity: 0; transform: translate(-50%, 16px); }
                10%  { opacity: 1; transform: translate(-50%, 0); }
                85%  { opacity: 1; transform: translate(-50%, 0); }
                100% { opacity: 0; transform: translate(-50%, -8px); }
            }
        `;
        document.head.appendChild(style);
    }

    function showToast(msg) {
        try {
            const t = document.createElement('div');
            t.className = 'esc-toast';
            t.textContent = msg;
            document.body.appendChild(t);
            setTimeout(() => { try { t.remove(); } catch (e) {} }, 2600);
        } catch (e) { /* ignore */ }
    }

    /* ---------------------------------------------------------------------
     *  Format helpers for the panel
     * ------------------------------------------------------------------- */
    function deltaChip(kpi, opts) {
        if (!kpi || kpi.delta === null || kpi.delta === undefined) {
            return '<span class="esc-chip neutral">no change</span>';
        }
        const sign = kpi.delta > 0 ? '+' : '';
        const decimals = (opts && opts.decimals != null) ? opts.decimals : 2;
        const unit = (opts && opts.unit) || '';
        const cls = kpi.direction === 'improved' ? 'improved'
                  : kpi.direction === 'worsened' ? 'worsened'
                  : 'neutral';
        let label = `${sign}${kpi.delta.toFixed(decimals)}${unit}`;
        if (kpi.deltaPct !== null && Math.abs(kpi.deltaPct) > 0.01 && !kpi.isPercent) {
            label += ` (${kpi.deltaPct > 0 ? '+' : ''}${kpi.deltaPct.toFixed(1)} %)`;
        }
        return `<span class="esc-chip ${cls}">${label}</span>`;
    }

    function kpiCard(label, kpi, decimals, unit) {
        if (!kpi) {
            return `<div class="esc-kpi"><div class="esc-kpi-label">${label}</div>
                    <div class="esc-empty" style="margin-top:6px;">no data</div></div>`;
        }
        const base = num(kpi.baseline);
        const curr = num(kpi.current);
        const baseStr = base === null ? '—' : base.toFixed(decimals);
        const currStr = curr === null ? '—' : curr.toFixed(decimals);
        return `
            <div class="esc-kpi">
                <div class="esc-kpi-label">${label}</div>
                <div class="esc-kpi-row">
                    <span class="esc-kpi-base">${baseStr}${unit}</span>
                    <span class="esc-kpi-arrow">→</span>
                    <span class="esc-kpi-curr">${currStr}${unit}</span>
                </div>
                ${deltaChip(kpi, { decimals, unit })}
            </div>
        `;
    }

    function tableRowsBus(rows, targets, labels) {
        if (!rows.length) return '<div class="esc-empty">No bus voltage changes detected.</div>';
        const baseHead = escapeHtml((labels && labels.base) || 'Base');
        const currHead = escapeHtml((labels && labels.curr) || 'Current');
        // Engines usually agree to well under 0.001 pu, so the cross-check shows more digits.
        const vDec = labels ? 4 : 3;
        const dDec = labels ? 5 : 3;
        const head = `
            <table class="esc-table">
                <thead><tr><th>Bus</th><th class="num">${baseHead}</th><th class="num">${currHead}</th><th class="num">Δ pu</th><th>Status</th></tr></thead>
                <tbody>`;
        const body = rows.slice(0, 5).map((r) => {
            const idx = targets.length;
            targets.push({ id: r.id, name: r.name });
            const sign = r.delta > 0 ? '+' : '';
            const cls = r.severity === 'improved' ? 'improved'
                      : r.severity === 'worsened' ? 'worsened'
                      : 'neutral';
            return `<tr data-target-idx="${idx}">
                <td>${escapeHtml(r.dialogName || r.name || r.id)}</td>
                <td class="num">${r.vm_pu_base.toFixed(vDec)}</td>
                <td class="num">${r.vm_pu_curr.toFixed(vDec)}</td>
                <td class="num"><span class="esc-chip ${cls}">${sign}${r.delta.toFixed(dDec)}</span></td>
                <td>
                    <span class="esc-band ${r.band_base}">${r.band_base}</span> →
                    <span class="esc-band ${r.band_curr}">${r.band_curr}</span>
                </td>
            </tr>`;
        }).join('');
        return head + body + '</tbody></table>';
    }

    function tableRowsBranch(rows, targets, labels) {
        if (!rows.length) return '<div class="esc-empty">No branch loading changes detected.</div>';
        const baseHead = escapeHtml((labels && labels.base) || 'Base');
        const currHead = escapeHtml((labels && labels.curr) || 'Current');
        const head = `
            <table class="esc-table">
                <thead><tr><th>Element</th><th class="num">${baseHead}</th><th class="num">${currHead}</th><th class="num">Δ %</th><th>Status</th></tr></thead>
                <tbody>`;
        const body = rows.slice(0, 5).map((r) => {
            const idx = targets.length;
            targets.push({ id: r.id, name: r.name });
            const sign = r.delta > 0 ? '+' : '';
            const cls = r.severity === 'improved' ? 'improved'
                      : r.severity === 'worsened' ? 'worsened'
                      : 'neutral';
            const kindShort = r.kind === 'transformer' ? 'Trafo'
                            : r.kind === 'transformer3w' ? '3W' : 'Line';
            return `<tr data-target-idx="${idx}">
                <td><span style="color:${COLOR_MUTED};font-size:10px;">${kindShort}</span> ${escapeHtml(r.dialogName || r.name || r.id)}</td>
                <td class="num">${r.loading_base.toFixed(1)} %</td>
                <td class="num">${r.loading_curr.toFixed(1)} %</td>
                <td class="num"><span class="esc-chip ${cls}">${sign}${r.delta.toFixed(1)} %</span></td>
                <td>
                    <span class="esc-band ${r.band_base}">${r.band_base}</span> →
                    <span class="esc-band ${r.band_curr}">${r.band_curr}</span>
                </td>
            </tr>`;
        }).join('');
        return head + body + '</tbody></table>';
    }

    /* ---------------------------------------------------------------------
     *  Solver cross-check: the same network solved by two engines
     * ------------------------------------------------------------------- */
    const XC_V_AGREE = 0.005;   // pu: engines agree within ±0.5 % of nominal
    const XC_V_CLOSE = 0.02;    // pu
    const XC_L_AGREE = 2;       // loading percentage points
    const XC_L_CLOSE = 5;

    function engineDisplayName(eng) {
        const e = String(eng || '').toLowerCase();
        if (e === 'opendss') return 'OpenDSS';
        if (e === 'pandapower') return 'pandapower';
        return eng ? String(eng) : '';
    }

    function xcColor(absDelta) {
        return absDelta <= XC_V_AGREE ? COLOR_GOOD : absDelta <= XC_V_CLOSE ? COLOR_WARN : COLOR_DANGER;
    }

    function fmtPu(v) {
        const a = Math.abs(v);
        return a === 0 ? '0' : a < 0.001 ? v.toFixed(5) : v.toFixed(4);
    }

    function crossCheckStats(delta) {
        const buses = (delta.perBus || []).filter((r) => num(r.vm_pu_base) !== null && num(r.vm_pu_curr) !== null);
        const branches = (delta.perBranch || []).filter((r) => num(r.delta) !== null);
        let maxV = 0, worstBus = null, sumAbs = 0, within = 0;
        for (const r of buses) {
            const d = Math.abs(r.delta);
            sumAbs += d;
            if (d <= XC_V_AGREE) within++;
            if (!worstBus || d > maxV) { maxV = d; worstBus = r; }
        }
        let maxL = 0, worstBranch = null;
        for (const r of branches) {
            const d = Math.abs(r.delta);
            if (!worstBranch || d > maxL) { maxL = d; worstBranch = r; }
        }
        let verdict = 'agree';
        if (!buses.length) verdict = 'nodata';
        else if (maxV > XC_V_CLOSE || maxL > XC_L_CLOSE) verdict = 'differ';
        else if (maxV > XC_V_AGREE || maxL > XC_L_AGREE) verdict = 'close';
        return {
            buses, branches, nBus: buses.length, nBranch: branches.length,
            maxV, meanV: buses.length ? sumAbs / buses.length : 0, within, worstBus,
            maxL, worstBranch, verdict,
        };
    }

    function niceStep(span, count) {
        const raw = span / (count || 5);
        const p = Math.pow(10, Math.floor(Math.log10(raw)));
        const m = raw / p;
        return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
    }

    function xcTarget(targets, r) {
        targets.push({ id: r.id, name: r.name });
        return targets.length - 1;
    }

    // Scatter of one engine's result against the other's: on the diagonal they agree.
    // points: [{ x, y, d, label, row }]; opts: { id, tol, colorOf, xLabel, yLabel, minPad, floor }
    function parityChartSvg(points, targets, opts) {
        const W = 260, H = 260, L = 44, R = 8, T = 8, B = 38;
        const pw = W - L - R, ph = H - T - B;
        let lo = Infinity, hi = -Infinity;
        for (const pt of points) {
            lo = Math.min(lo, pt.x, pt.y);
            hi = Math.max(hi, pt.x, pt.y);
        }
        if (!isFinite(lo)) { lo = 0; hi = 1; }
        const pad = Math.max(opts.minPad, (hi - lo) * 0.08);
        const step = niceStep(hi - lo + 2 * pad, 5);
        lo = Math.floor((lo - pad) / step) * step;
        hi = Math.ceil((hi + pad) / step) * step;
        if (opts.floor !== undefined && lo < opts.floor) lo = opts.floor;
        const dec = step >= 1 ? 0 : step < 0.01 ? 3 : 2;
        const sx = (v) => L + (v - lo) / (hi - lo) * pw;
        const sy = (v) => T + ph - (v - lo) / (hi - lo) * ph;
        const tol = opts.tol;
        let grid = '';
        for (let v = lo; v <= hi + step / 2; v += step) {
            grid += `<line x1="${sx(v).toFixed(1)}" y1="${T}" x2="${sx(v).toFixed(1)}" y2="${T + ph}" stroke="#eef2f7"/>`
                 +  `<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${L + pw}" y2="${sy(v).toFixed(1)}" stroke="#eef2f7"/>`
                 +  `<text x="${sx(v).toFixed(1)}" y="${T + ph + 13}" font-size="9" fill="${COLOR_MUTED}" text-anchor="middle">${v.toFixed(dec)}</text>`
                 +  `<text x="${L - 5}" y="${(sy(v) + 3).toFixed(1)}" font-size="9" fill="${COLOR_MUTED}" text-anchor="end">${v.toFixed(dec)}</text>`;
        }
        const band = [[lo, lo + tol], [hi, hi + tol], [hi, hi - tol], [lo, lo - tol]]
            .map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(' ');
        const n = points.length;
        const radius = n <= 60 ? 3.6 : n <= 300 ? 2.8 : 2;
        const stagger = Math.min(14, 900 / Math.max(1, n));
        const ordered = points.slice().sort((a, b) => Math.abs(a.d) - Math.abs(b.d));
        const marks = ordered.map((pt, i) => {
            const idx = xcTarget(targets, pt.row);
            return `<circle class="esc-xc-pt" data-xc-idx="${idx}" cx="${sx(pt.x).toFixed(1)}" cy="${sy(pt.y).toFixed(1)}"`
                + ` r="${radius}" fill="${opts.colorOf(Math.abs(pt.d))}" fill-opacity="0.85" stroke="#fff" stroke-width="0.8"`
                + ` style="animation-delay:${Math.round(i * stagger)}ms"><title>${escapeHtml(pt.label)}</title></circle>`;
        }).join('');
        return `
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(opts.yLabel)} against ${escapeHtml(opts.xLabel)}">
                <defs><clipPath id="${opts.id}"><rect x="${L}" y="${T}" width="${pw}" height="${ph}"/></clipPath></defs>
                ${grid}
                <g clip-path="url(#${opts.id})">
                    <polygon points="${band}" fill="${COLOR_GOOD}" fill-opacity="0.12"/>
                    <line x1="${sx(lo)}" y1="${sy(lo)}" x2="${sx(hi)}" y2="${sy(hi)}" stroke="${COLOR_GOOD}" stroke-width="1.2" stroke-dasharray="4 3"/>
                </g>
                <rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="none" stroke="${COLOR_BORDER}"/>
                ${marks}
                <text x="${L + pw / 2}" y="${H - 5}" font-size="10" font-weight="600" fill="${COLOR_TEXT}" text-anchor="middle">${escapeHtml(opts.xLabel)}</text>
                <text x="11" y="${T + ph / 2}" font-size="10" font-weight="600" fill="${COLOR_TEXT}" text-anchor="middle" transform="rotate(-90 11 ${T + ph / 2})">${escapeHtml(opts.yLabel)}</text>
            </svg>`;
    }

    function voltageParitySvg(rows, targets, names) {
        const points = rows.map((r) => ({
            x: r.vm_pu_base, y: r.vm_pu_curr, d: r.delta, row: r,
            label: `${r.dialogName || r.name || r.id}: ${names.base} ${r.vm_pu_base.toFixed(4)} pu · `
                + `${names.curr} ${r.vm_pu_curr.toFixed(4)} pu · Δ ${r.delta >= 0 ? '+' : ''}${fmtPu(r.delta)} pu`,
        }));
        return parityChartSvg(points, targets, {
            id: 'esc-xc-clip-v', tol: XC_V_AGREE, minPad: 0.01, colorOf: xcColor,
            xLabel: `${names.base} |V| (pu)`, yLabel: `${names.curr} |V| (pu)`,
        });
    }

    function xcLoadingColor(absDelta) {
        return absDelta <= XC_L_AGREE ? COLOR_GOOD : absDelta <= XC_L_CLOSE ? COLOR_WARN : COLOR_DANGER;
    }

    function loadingParitySvg(rows, targets, names) {
        const kindName = { line: 'Line', transformer: 'Transformer', transformer3w: '3W transformer' };
        const points = rows.map((r) => ({
            x: r.loading_base, y: r.loading_curr, d: r.delta, row: r,
            label: `${kindName[r.kind] || 'Branch'} ${r.dialogName || r.name || r.id}: ${names.base} `
                + `${r.loading_base.toFixed(1)} % · ${names.curr} ${r.loading_curr.toFixed(1)} % · `
                + `Δ ${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)} pp`,
        }));
        return parityChartSvg(points, targets, {
            id: 'esc-xc-clip-l', tol: XC_L_AGREE, minPad: 2, floor: 0, colorOf: xcLoadingColor,
            xLabel: `${names.base} loading (%)`, yLabel: `${names.curr} loading (%)`,
        });
    }

    // Voltage gap at every bus, in diagram order, against the ±tolerance band.
    function deltaProfileSvg(rows, targets, names) {
        const W = 450, H = 260, L = 54, R = 8, T = 10, B = 38;
        const pw = W - L - R, ph = H - T - B;
        const ordered = rows.slice().sort((x, y) => (x.order || 0) - (y.order || 0));
        const n = ordered.length;
        const maxAbs = ordered.reduce((m, r) => Math.max(m, Math.abs(r.delta)), 0);
        // When every gap is far inside the tolerance, zoom to the data so the pattern stays
        // readable, and say how much room is left instead of drawing the tolerance lines.
        const zoomed = maxAbs * 1.3 < XC_V_AGREE;
        const lim = zoomed ? Math.max(maxAbs * 1.3, 1e-5) : Math.max(maxAbs * 1.15, XC_V_AGREE * 1.3);
        const y0 = T + ph / 2;
        const sy = (d) => y0 - d / lim * (ph / 2);
        const slot = pw / Math.max(1, n);
        const barW = Math.max(1, Math.min(18, slot * 0.72));
        const stagger = Math.min(14, 900 / Math.max(1, n));
        const step = niceStep(2 * lim, 4);
        let grid = '';
        for (let v = Math.ceil(-lim / step) * step; v <= lim + 1e-12; v += step) {
            const y = sy(v);
            grid += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${L + pw}" y2="${y.toFixed(1)}" stroke="#eef2f7"/>`
                 +  `<text x="${L - 5}" y="${(y + 3).toFixed(1)}" font-size="9" fill="${COLOR_MUTED}" text-anchor="end">${Math.abs(v) < 1e-12 ? '0' : (v > 0 ? '+' : '') + fmtPu(v)}</text>`;
        }
        const headroom = maxAbs > 0 ? XC_V_AGREE / maxAbs : Infinity;
        const zoomNote = `Zoomed in: the ±${XC_V_AGREE} pu tolerance is `
            + (headroom > 1000 ? 'over 1000×' : `${Math.round(headroom)}×`) + ' the largest gap';
        const tolLines = zoomed
            ? `<text x="${L + pw - 4}" y="${T + 10}" font-size="9.5" font-weight="700" fill="${COLOR_GOOD}" text-anchor="end">${escapeHtml(zoomNote)}</text>`
            : [XC_V_AGREE, -XC_V_AGREE].map((t) =>
            `<line x1="${L}" y1="${sy(t).toFixed(1)}" x2="${L + pw}" y2="${sy(t).toFixed(1)}" stroke="${COLOR_GOOD}" stroke-width="1.2" stroke-dasharray="5 3"/>`
        ).join('') + `<text x="${L + pw - 4}" y="${(sy(XC_V_AGREE) - 4).toFixed(1)}" font-size="9" font-weight="700" fill="${COLOR_GOOD}" text-anchor="end">±${XC_V_AGREE} pu</text>`;
        const tolBand = zoomed ? ''
            : `<rect x="${L}" y="${sy(XC_V_AGREE).toFixed(1)}" width="${pw}" height="${(sy(-XC_V_AGREE) - sy(XC_V_AGREE)).toFixed(1)}" fill="${COLOR_GOOD}" fill-opacity="0.07"/>`;
        const bars = ordered.map((r, i) => {
            const idx = xcTarget(targets, r);
            const d = r.delta;
            const yTop = Math.min(sy(d), y0);
            const h = Math.max(0.8, Math.abs(sy(d) - y0));
            const x = L + i * slot + (slot - barW) / 2;
            const label = `${r.dialogName || r.name || r.id}: Δ ${d >= 0 ? '+' : ''}${fmtPu(d)} pu `
                + `(${names.curr} ${r.vm_pu_curr.toFixed(4)}, ${names.base} ${r.vm_pu_base.toFixed(4)})`;
            return `<rect class="esc-xc-bar${d < 0 ? ' neg' : ''}" data-xc-idx="${idx}" x="${x.toFixed(2)}" y="${yTop.toFixed(2)}"`
                + ` width="${barW.toFixed(2)}" height="${h.toFixed(2)}" rx="${barW > 4 ? 1.5 : 0}" fill="${xcColor(Math.abs(d))}"`
                + ` style="animation-delay:${Math.round(i * stagger)}ms"><title>${escapeHtml(label)}</title></rect>`;
        }).join('');
        return `
            <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Voltage gap per bus">
                ${grid}
                ${tolBand}
                ${tolLines}
                <line x1="${L}" y1="${y0}" x2="${L + pw}" y2="${y0}" stroke="#94a3b8"/>
                ${bars}
                <text x="${L + pw / 2}" y="${H - 6}" font-size="10" font-weight="600" fill="${COLOR_TEXT}" text-anchor="middle">${n} buses, in diagram order</text>
                <text x="12" y="${y0}" font-size="10" font-weight="600" fill="${COLOR_TEXT}" text-anchor="middle" transform="rotate(-90 12 ${y0})">ΔV = ${escapeHtml(names.curr)} − ${escapeHtml(names.base)} (pu)</text>
            </svg>`;
    }

    function crossCheckSummaryText(st, names) {
        const verdict = st.verdict === 'agree' ? 'the engines agree'
            : st.verdict === 'close' ? 'small differences, worth a look'
            : st.verdict === 'differ' ? 'the engines differ' : 'no matching buses';
        const lines = [`Solver cross-check: ${names.base} vs ${names.curr}`];
        if (st.nBus) {
            lines.push(`Buses compared: ${st.nBus}; max |ΔV| ${fmtPu(st.maxV)} pu`
                + (st.worstBus ? ` (${st.worstBus.dialogName || st.worstBus.name || st.worstBus.id})` : '')
                + `, mean ${fmtPu(st.meanV)} pu; ${st.within} of ${st.nBus} within ±${XC_V_AGREE} pu`);
        }
        if (st.nBranch) {
            lines.push(`Branches compared: ${st.nBranch}; max loading gap ${st.maxL.toFixed(2)} percentage points`
                + (st.worstBranch ? ` (${st.worstBranch.dialogName || st.worstBranch.name || st.worstBranch.id})` : ''));
        }
        lines.push(`Verdict: ${verdict}`);
        return lines.join('\n');
    }

    function crossCheckNotes(st, delta, baseJson, currJson, names) {
        const items = [];
        const outside = st.buses.filter((r) =>
            r.vm_pu_base < 0.95 || r.vm_pu_base > 1.05 || r.vm_pu_curr < 0.95 || r.vm_pu_curr > 1.05).length;
        if (outside) {
            items.push(`${outside} bus${outside === 1 ? '' : 'es'} sit outside 0.95–1.05 pu. OpenDSS models loads as `
                + 'constant impedance outside that range (its Vminpu / Vmaxpu); pandapower keeps them constant power.');
        }
        const ar = delta.addedRemoved || { added: [], removed: [] };
        const only = (ar.added || []).length + (ar.removed || []).length;
        if (only) {
            items.push(`${only} element${only === 1 ? ' is' : 's are'} in only one of the two results: `
                + 'each engine skips the elements it does not model.');
        }
        const warns = [];
        [[baseJson, names.base], [currJson, names.curr]].forEach(([json, eng]) => {
            const list = json && Array.isArray(json.warnings) ? json.warnings : [];
            list.slice(0, 2).forEach((w) => { if (w) warns.push(`${eng}: ${String(w)}`); });
        });
        warns.slice(0, 3).forEach((w) => items.push(w));
        if (st.nBranch && st.maxL > XC_L_AGREE) {
            items.push('Branch loading definitions: pandapower loads a line by the larger of its two end currents '
                + 'and a transformer by its winding currents against rated current. A result that uses one end, '
                + 'or MVA at actual voltage, reads differently on long lines and off-nominal voltages.');
        }
        if (st.verdict !== 'agree') {
            items.push('External grids: OpenDSS keeps the source short-circuit impedance in the load flow; '
                + 'pandapower holds the slack bus exactly at its set point.');
            items.push('Transformer vector groups: OpenDSS applies the 30° shift of Dyn / YNd windings, so loops '
                + 'through transformers with different shifts carry circulating current.');
        }
        if (!items.length) {
            return `<div class="esc-xc-notes"><h4>What this shows</h4><ul>
                <li>Two independent solvers with different algorithms give the same bus voltages and branch
                    loadings, so the model and its results have been checked twice.</li></ul></div>`;
        }
        return `<div class="esc-xc-notes"><h4>${st.verdict === 'agree' ? 'Worth knowing' : 'Where differences usually come from'}</h4>
            <ul>${items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul></div>`;
    }

    function crossCheckBlock(st, delta, targets, names, baseJson, currJson) {
        if (st.verdict === 'nodata') {
            return `<div class="esc-xc"><div class="esc-xc-verdict"><div class="esc-xc-icon">?</div><div>
                <div class="esc-xc-title">No buses could be matched between the two runs</div>
                <div class="esc-xc-text">Run both engines on the same network, then open the cross-check again.</div>
                </div></div></div>`;
        }
        const icon = st.verdict === 'agree' ? '✓' : st.verdict === 'close' ? '≈' : '!';
        const vOk = st.maxV <= XC_V_AGREE, lOk = !st.nBranch || st.maxL <= XC_L_AGREE;
        const title = st.verdict === 'agree' ? `${names.base} and ${names.curr} agree`
            : vOk && !lOk ? `Bus voltages agree, branch loadings ${st.verdict === 'close' ? 'are close' : 'differ'}`
            : !vOk && lOk ? `Branch loadings agree, bus voltages ${st.verdict === 'close' ? 'are close' : 'differ'}`
            : st.verdict === 'close' ? `${names.base} and ${names.curr} are close`
            : `${names.base} and ${names.curr} differ`;
        const worstBusName = st.worstBus ? (st.worstBus.dialogName || st.worstBus.name || st.worstBus.id) : '';
        const worstBranchName = st.worstBranch ? (st.worstBranch.dialogName || st.worstBranch.name || st.worstBranch.id) : '';
        const text = `${st.within} of ${st.nBus} buses within ±${XC_V_AGREE} pu · largest gap ${fmtPu(st.maxV)} pu`
            + (worstBusName ? ` at ${worstBusName}` : '')
            + (st.nBranch ? ` · largest loading gap ${st.maxL.toFixed(2)} % points`
                + (worstBranchName ? ` at ${worstBranchName}` : '') : '');
        const stat = (label, value, sub) => `<div class="esc-xc-stat"><div class="esc-xc-stat-label">${label}</div>
            <div class="esc-xc-stat-value">${value}</div><div class="esc-xc-stat-sub" title="${escapeHtml(sub)}">${escapeHtml(sub)}</div></div>`;
        return `
            <div class="esc-xc">
                <div class="esc-xc-verdict ${st.verdict}">
                    <div class="esc-xc-icon">${icon}</div>
                    <div>
                        <div class="esc-xc-title">${escapeHtml(title)}</div>
                        <div class="esc-xc-text">${escapeHtml(text)}</div>
                    </div>
                    <button class="esc-btn esc-xc-copy" title="Copy the cross-check result as text">Copy result</button>
                </div>
                <div class="esc-xc-stats">
                    ${stat('Buses compared', String(st.nBus), `${st.within} within ±${XC_V_AGREE} pu`)}
                    ${stat('Max |ΔV|', `${fmtPu(st.maxV)} pu`, worstBusName ? `at ${worstBusName}` : '—')}
                    ${stat('Mean |ΔV|', `${fmtPu(st.meanV)} pu`, `over ${st.nBus} buses`)}
                    ${stat('Max loading gap', st.nBranch ? `${st.maxL.toFixed(2)} pp` : '—',
                        st.nBranch ? (worstBranchName ? `at ${worstBranchName}` : `${st.nBranch} branches`) : 'no branch loadings')}
                </div>
                <div class="esc-xc-charts">
                    <div class="esc-xc-card">
                        <h5 class="esc-section-title">Bus voltage parity <span class="esc-count">on the line = same</span></h5>
                        ${voltageParitySvg(st.buses, targets, names)}
                    </div>
                    <div class="esc-xc-card">
                        <h5 class="esc-section-title">Branch loading parity <span class="esc-count">±${XC_L_AGREE} pp band</span></h5>
                        ${st.nBranch ? loadingParitySvg(st.branches, targets, names)
                            : '<div class="esc-empty">No branch loadings in both runs.</div>'}
                    </div>
                    <div class="esc-xc-card wide">
                        <h5 class="esc-section-title">Voltage gap per bus <span class="esc-count">click → focus</span></h5>
                        ${deltaProfileSvg(st.buses, targets, names)}
                        <div class="esc-xc-legend">
                            <span><i style="background:${COLOR_GOOD}"></i>≤ ${XC_V_AGREE} pu</span>
                            <span><i style="background:${COLOR_WARN}"></i>≤ ${XC_V_CLOSE} pu</span>
                            <span><i style="background:${COLOR_DANGER}"></i>&gt; ${XC_V_CLOSE} pu</span>
                        </div>
                    </div>
                </div>
                ${crossCheckNotes(st, delta, baseJson, currJson, names)}
            </div>`;
    }

    function copyText(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                const ok = document.execCommand('copy');
                ta.remove();
                ok ? resolve() : reject(new Error('copy failed'));
            } catch (e) { reject(e); }
        });
    }

    function migrationsBlock(migrations) {
        if (!migrations.length) {
            return `<div class="esc-migrations empty">
                <h4>No status migrations</h4>
                <div style="font-size:11px;color:${COLOR_MUTED};">
                    Every element stayed in the same band. Magnitudes may still have changed; check the tables below.
                </div>
            </div>`;
        }
        const top = migrations.slice(0, 6);
        const more = migrations.length > top.length ? ` (+${migrations.length - top.length} more)` : '';
        const rows = top.map((m) => {
            const sign = (typeof m.delta === 'number' && m.delta > 0) ? '+' : '';
            const dn = (typeof m.delta === 'number') ? `${sign}${m.delta.toFixed(m.unit === 'pu' ? 3 : 1)} ${m.unit}` : '';
            return `<div class="esc-migration-row">
                <span style="flex:1; font-weight:600;">${escapeHtml(m.kind)} · ${escapeHtml(m.name)}</span>
                <span class="esc-band ${m.from}">${m.from}</span>
                <span style="color:${COLOR_MUTED};">→</span>
                <span class="esc-band ${m.to}">${m.to}</span>
                <span style="color:${COLOR_MUTED};font-variant-numeric:tabular-nums;">${dn}</span>
            </div>`;
        }).join('');
        return `<div class="esc-migrations">
            <h4>${migrations.length} status migration${migrations.length === 1 ? '' : 's'}${more}</h4>
            ${rows}
        </div>`;
    }

    function overvoltageMitigationBlock(ov) {
        if (!ov) return '';
        const thr = ov.threshold_pu != null ? ov.threshold_pu : VOLTAGE_OK_HIGH;
        const maxBase = num(ov.max_vm_base);
        const maxCurr = num(ov.max_vm_curr);
        const maxDelta = num(ov.max_vm_delta);
        const mitigated = ov.mitigated_buses || [];
        const partial = ov.partial_buses || [];
        const worsened = ov.worsened_buses || [];
        const storageQ = ov.storage_reactive_delta || [];

        const busRow = (r, cls) => {
            const sign = r.delta > 0 ? '+' : '';
            return `<div class="esc-migration-row">
                <span style="flex:1;font-weight:600;">${escapeHtml(r.dialogName || r.name || r.id)}</span>
                <span style="font-variant-numeric:tabular-nums;">${r.vm_pu_base.toFixed(3)} → ${r.vm_pu_curr.toFixed(3)} pu</span>
                <span class="esc-chip ${cls}">${sign}${r.delta.toFixed(3)} pu</span>
            </div>`;
        };

        const storageRow = (s) => {
            const sign = s.delta > 0 ? '+' : '';
            const mode = s.inv_mode ? ` · ${escapeHtml(s.inv_mode)}` : '';
            return `<div class="esc-migration-row">
                <span style="flex:1;font-weight:600;">BESS ${escapeHtml(s.name)}${mode}</span>
                <span style="font-variant-numeric:tabular-nums;">Q ${s.q_base.toFixed(2)} → ${s.q_curr.toFixed(2)} MVar</span>
                <span class="esc-chip ${s.delta < 0 ? 'improved' : 'changed'}">${sign}${s.delta.toFixed(2)} MVar</span>
            </div>`;
        };

        let summary = '';
        if (maxBase !== null && maxCurr !== null) {
            const cls = maxCurr < maxBase ? 'improved' : (maxCurr > maxBase ? 'worsened' : 'neutral');
            const sign = maxDelta > 0 ? '+' : '';
            summary = `<div style="font-size:12px;margin-bottom:10px;color:${COLOR_TEXT};">
                Max bus voltage: <strong>${maxBase.toFixed(3)}</strong> → <strong>${maxCurr.toFixed(3)}</strong> pu
                <span class="esc-chip ${cls}" style="margin-left:6px;">${sign}${(maxDelta || 0).toFixed(3)} pu</span>
                <span style="color:${COLOR_MUTED};margin-left:8px;">(overvoltage threshold ${thr} pu)</span>
            </div>`;
        }

        const mitigatedHtml = mitigated.length
            ? mitigated.map((r) => busRow(r, 'improved')).join('')
            : `<div class="esc-empty" style="margin:4px 0;">No buses fully mitigated below ${thr} pu.</div>`;
        const partialHtml = partial.length
            ? partial.map((r) => busRow(r, 'improved')).join('')
            : '';
        const worsenedHtml = worsened.length
            ? worsened.map((r) => busRow(r, 'worsened')).join('')
            : '';
        const storageHtml = storageQ.length
            ? storageQ.map(storageRow).join('')
            : `<div class="esc-empty" style="margin:4px 0;">No BESS reactive power change detected.</div>`;

        return `<div class="esc-migrations" style="margin-bottom:14px;">
            <h4>Overvoltage mitigation (weak grid / BESS)</h4>
            ${summary}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <h5 class="esc-section-title">Fully mitigated<span class="esc-count">${ov.mitigated_count || 0}</span></h5>
                    ${mitigatedHtml}
                </div>
                <div>
                    <h5 class="esc-section-title">Partial improvement<span class="esc-count">${ov.partial_count || 0}</span></h5>
                    ${partialHtml || `<div class="esc-empty" style="margin:4px 0;">—</div>`}
                </div>
            </div>
            ${worsened.length ? `<div style="margin-top:10px;">
                <h5 class="esc-section-title">New overvoltage<span class="esc-count">${ov.worsened_count || 0}</span></h5>
                ${worsenedHtml}
            </div>` : ''}
            <div style="margin-top:10px;">
                <h5 class="esc-section-title">BESS reactive response</h5>
                ${storageHtml}
            </div>
        </div>`;
    }

    function addedRemovedBlock(addedRemoved) {
        const ar = addedRemoved || { added: [], removed: [] };
        if (!ar.added.length && !ar.removed.length) return '';
        const list = (rows, emptyMsg) => {
            if (!rows.length) return `<div class="esc-empty">${emptyMsg}</div>`;
            return `<ul style="margin:0; padding-left:18px; font-size:12px; color:${COLOR_TEXT};">${
                rows.slice(0, 8).map(r => `<li>${escapeHtml(r.dialogName || r.name || r.id)}
                    <span style="color:${COLOR_MUTED}; font-size:10px;"> · ${escapeHtml(r.category || r.kind || '')}</span></li>`).join('')
            }${rows.length > 8 ? `<li style="color:${COLOR_MUTED};">+${rows.length - 8} more</li>` : ''}</ul>`;
        };
        return `<div class="esc-grid2">
            <div>
                <h5 class="esc-section-title">Added in current<span class="esc-count">${ar.added.length}</span></h5>
                ${list(ar.added, 'No new elements.')}
            </div>
            <div>
                <h5 class="esc-section-title">Removed in current<span class="esc-count">${ar.removed.length}</span></h5>
                ${list(ar.removed, 'No removed elements.')}
            </div>
        </div>`;
    }

    /* ---------------------------------------------------------------------
     *  Cell focus + zoom (reused from dashboard logic)
     * ------------------------------------------------------------------- */
    function findCellById(graph, id, fallbackRow) {
        if (!graph) return null;
        try {
            if (typeof window !== 'undefined' &&
                typeof window.buildGraphCellLookupMap   === 'function' &&
                typeof window.resolveGraphCellForResult === 'function') {
                const map = window.buildGraphCellLookupMap(graph);
                const row = fallbackRow || { id, name: id };
                const cell = window.resolveGraphCellForResult(map, row, graph);
                if (cell) return cell;
            }
        } catch (e) { /* fall through */ }
        if (!id) return null;
        try {
            const model = graph.getModel();
            if (model && model.cells) {
                if (model.cells[id]) return model.cells[id];
                if (model.cells[String(id)]) return model.cells[String(id)];
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function focusCell(graph, cell) {
        if (!graph || !cell) return;
        try {
            if (graph.scrollCellToVisible) graph.scrollCellToVisible(cell, true);
            if (graph.setSelectionCell)    graph.setSelectionCell(cell);
        } catch (e) { /* ignore */ }
    }

    /* ---------------------------------------------------------------------
     *  SLD overlay — paint chips next to changed cells.
     * ------------------------------------------------------------------- */
    let _overlayState = null; // { graph, container, layer, items, listeners }

    function ensureOverlayLayer() {
        if (typeof document === 'undefined') return null;
        let layer = document.getElementById(OVERLAY_LAYER_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = OVERLAY_LAYER_ID;
            document.body.appendChild(layer);
        }
        return layer;
    }

    /** Viewport coordinates for a chip anchor (top-center of the cell shape). */
    function chipScreenPosition(graph, cell) {
        if (!graph?.view || !cell) return null;
        try {
            if (typeof graph.view.validate === 'function') graph.view.validate();
        } catch (e) { /* ignore */ }
        const state = graph.view.getState ? graph.view.getState(cell) : null;
        if (state?.shape?.node?.getBoundingClientRect) {
            const rect = state.shape.node.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
                return { x: rect.left + rect.width / 2, y: rect.top };
            }
        }
        const container = graph.container;
        if (state && container?.getBoundingClientRect) {
            const cr = container.getBoundingClientRect();
            const cx = (typeof state.getCenterX === 'function')
                ? state.getCenterX()
                : (state.x + state.width / 2);
            const scrollL = container.scrollLeft || 0;
            const scrollT = container.scrollTop || 0;
            return {
                x: cr.left + cx - scrollL,
                y: cr.top + state.y - scrollT,
            };
        }
        if (typeof graph.getCellBounds === 'function' && container?.getBoundingClientRect) {
            const bounds = graph.getCellBounds(cell, true);
            if (bounds) {
                const scale = graph.view.scale || 1;
                const tr = graph.view.translate || { x: 0, y: 0 };
                const cr = container.getBoundingClientRect();
                const scrollL = container.scrollLeft || 0;
                const scrollT = container.scrollTop || 0;
                const sx = cr.left + (bounds.x + tr.x) * scale - scrollL;
                const sy = cr.top + (bounds.y + tr.y) * scale - scrollT;
                return {
                    x: sx + (bounds.width * scale) / 2,
                    y: sy,
                };
            }
        }
        return null;
    }

    function chipPositionForCell(graph, cell) {
        return chipScreenPosition(graph, cell);
    }

    function chipLabel(item) {
        if (item.kind === 'bus') {
            const sign = item.delta > 0 ? '+' : '';
            return `${sign}${item.delta.toFixed(3)} pu`;
        }
        if (item.kind === 'added')   return '+ added';
        if (item.kind === 'removed') return '− removed';
        const sign = item.delta > 0 ? '+' : '';
        return `${sign}${item.delta.toFixed(1)} %`;
    }

    function paintSldOverlay(graph, delta) {
        if (!graph || !delta) return 0;
        ensureStyle();
        clearSldOverlay();
        const layer = ensureOverlayLayer();
        if (!layer) return 0;
        const map = (typeof window.buildGraphCellLookupMap === 'function')
            ? window.buildGraphCellLookupMap(graph) : null;
        const resolveCell = (row) => {
            if (!row) return null;
            try {
                if (map && typeof window.resolveGraphCellForResult === 'function') {
                    const cell = window.resolveGraphCellForResult(map, row, graph);
                    if (cell) return cell;
                }
                if (map && row.dialogName) {
                    const dn = String(row.dialogName).trim().toLowerCase();
                    if (dn) {
                        const byDn = map.get(dn) || map.get('dn:' + dn);
                        if (byDn) return byDn;
                    }
                }
            } catch (e) { /* ignore */ }
            return findCellById(graph, row.id, row);
        };
        const items = [];
        const pushItem = (row, severity, kind) => {
            const cell = resolveCell(row);
            if (!cell) return;
            const label = chipLabel({ kind: kind || row.kind, delta: row.delta });
            items.push({ cell, severity, label, row });
        };
        // Only paint meaningful movers on the SLD — skip neutral deltas and
        // structural added/removed lists (those stay in the compare panel only;
        // "+ added" chips clutter the diagram and are often key-mismatch noise).
        for (const r of (delta.perBus || [])) {
            if (r.severity === 'neutral') continue;
            if (Math.abs(r.delta || 0) < 1e-3 && r.band_base === r.band_curr) continue;
            const sev = (r.severity === 'improved') ? 'improved'
                      : (r.severity === 'worsened') ? 'worsened' : 'changed';
            pushItem(r, sev, 'bus');
        }
        for (const r of (delta.perBranch || [])) {
            if (r.severity === 'neutral') continue;
            if (Math.abs(r.delta || 0) < 0.5 && r.band_base === r.band_curr) continue;
            const sev = (r.severity === 'improved') ? 'improved'
                      : (r.severity === 'worsened') ? 'worsened' : 'changed';
            pushItem(r, sev, r.kind);
        }

        if (!items.length) return 0;

        const renderItems = () => {
            // Only re-render positions; keep DOM nodes for performance.
            for (const it of items) {
                if (!it.el) continue;
                const pos = chipPositionForCell(graph, it.cell);
                if (!pos) { it.el.style.display = 'none'; continue; }
                it.el.style.display = '';
                it.el.style.left = pos.x + 'px';
                it.el.style.top  = pos.y + 'px';
            }
        };

        for (const it of items) {
            const el = document.createElement('div');
            el.className = 'esc-chip-overlay ' + it.severity;
            el.title = (it.row.dialogName || it.row.name || it.row.id || '') + ' — click to focus';
            const labelSpan = document.createElement('span');
            labelSpan.className = 'esc-chip-label';
            labelSpan.textContent = it.label;
            const dismiss = document.createElement('button');
            dismiss.type = 'button';
            dismiss.className = 'esc-chip-dismiss';
            dismiss.textContent = '×';
            dismiss.title = 'Remove this highlight';
            dismiss.setAttribute('aria-label', 'Remove highlight');
            dismiss.addEventListener('click', (e) => {
                e.stopPropagation();
                el.remove();
            });
            el.appendChild(labelSpan);
            el.appendChild(dismiss);
            el.addEventListener('click', () => {
                focusCell(graph, it.cell);
            });
            layer.appendChild(el);
            it.el = el;
        }
        renderItems();
        let paintAttempts = 0;
        const retryRender = () => {
            renderItems();
            const anyVisible = items.some((it) => it.el && it.el.style.display !== 'none');
            if (!anyVisible && paintAttempts < 10) {
                paintAttempts += 1;
                if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(retryRender);
                }
            }
        };
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(retryRender);
        }

        // Track view changes so chips follow zoom / pan.
        const listeners = [];
        try {
            if (graph.view && graph.view.addListener && typeof window.mxEvent !== 'undefined') {
                const evtNames = ['scale', 'translate', 'scaleAndTranslate', 'units', 'down', 'up'];
                for (const n of evtNames) {
                    const handler = () => renderItems();
                    try {
                        graph.view.addListener(window.mxEvent[n.toUpperCase()] || n, handler);
                        listeners.push({ src: graph.view, handler, name: n });
                    } catch (e) { /* not all events exist */ }
                }
            }
        } catch (e) { /* ignore */ }
        const onScroll = () => renderItems();
        const onResize = () => renderItems();
        const onKeyDown = (e) => {
            if (e.key === 'Escape') clearSldOverlay();
        };
        try { graph.container && graph.container.addEventListener('scroll', onScroll, { passive: true }); } catch (e) {}
        try { window.addEventListener('scroll', onScroll, { passive: true, capture: true }); } catch (e) {}
        try { window.addEventListener('resize', onResize); } catch (e) {}
        try { window.addEventListener('keydown', onKeyDown); } catch (e) {}

        _overlayState = {
            graph, layer, items,
            cleanup: () => {
                try { graph.container && graph.container.removeEventListener('scroll', onScroll); } catch (e) {}
                try { window.removeEventListener('scroll', onScroll, true); } catch (e) {}
                try { window.removeEventListener('resize', onResize); } catch (e) {}
                try { window.removeEventListener('keydown', onKeyDown); } catch (e) {}
                // mxEvent listeners are best-effort; mxGraph has no removeAll.
            },
        };
        return items.length;
    }

    function clearSldOverlay() {
        if (_overlayState) {
            try { _overlayState.cleanup(); } catch (e) {}
            try { _overlayState.layer.remove(); } catch (e) {}
            _overlayState = null;
        } else if (typeof document !== 'undefined') {
            const stale = document.getElementById(OVERLAY_LAYER_ID);
            if (stale) try { stale.remove(); } catch (e) {}
        }
    }

    /* ---------------------------------------------------------------------
     *  Live graph fallback resolver — same idea the report button uses.
     * ------------------------------------------------------------------- */
    function resolveLiveGraph(graph) {
        if (graph && typeof graph.getGraphBounds === 'function') return graph;
        try {
            const ui = (window.App && (window.App._editorUi || window.App._instance)) ||
                       window.editorUi || window.ui || null;
            if (ui && ui.editor && ui.editor.graph) return ui.editor.graph;
            if (window.App && window.App.main && window.App.main.editor && window.App.main.editor.graph) {
                return window.App.main.editor.graph;
            }
        } catch (e) { /* ignore */ }
        return graph || null;
    }

    /* ---------------------------------------------------------------------
     *  Open the Compare panel
     * ------------------------------------------------------------------- */
    async function openScenarioCompare(currentDataJson, graph, opts) {
        opts = opts || {};
        ensureStyle();

        const liveGraph = resolveLiveGraph(graph);
        let baseline = opts.baseline || null;
        if (!baseline) {
            if (typeof window.getBaselineSnapshot !== 'function') {
                showToast('Snapshot store is unavailable. Reload the page and try again.');
                return;
            }
            try { baseline = await window.getBaselineSnapshot(); }
            catch (e) { console.warn('[ScenarioCompare] baseline lookup failed:', e); baseline = null; }
        }
        if (!baseline) {
            showToast('No baseline pinned yet. Click "Save as Baseline" first.');
            return;
        }
        if (!currentDataJson) {
            showToast('No current run available to compare.');
            return;
        }

        const baselineDataJson = baseline.dataJson || baseline;
        let currentJson = currentDataJson;
        if (typeof window.enrichResultJsonWithDialogNames === 'function' && liveGraph) {
            try { window.enrichResultJsonWithDialogNames(currentJson, liveGraph); } catch (e) { /* ignore */ }
        }
        const delta = computeScenarioDelta(baselineDataJson, currentJson, liveGraph);

        // Click-target registry, same pattern the dashboard uses.
        const targets = [];

        const baseLabel = baseline.label || 'Baseline';
        const baseTs    = baseline.ts ? new Date(baseline.ts).toLocaleString() : '';
        const baseEngId = String(baseline.engine || '').toLowerCase();
        const currEngId = String(opts.engine
            || (typeof window.getResultEngine === 'function' ? window.getResultEngine(currentDataJson) : '')
            || '').toLowerCase();
        const baseEng   = baseEngId.toUpperCase();
        const currLabel = opts.currentLabel || 'Current run';
        const currTs    = new Date().toLocaleString();
        const currEng   = currEngId.toUpperCase();
        // Same network, two engines: show the solver cross-check instead of a scenario diff.
        const isCrossCheck = !!(baseEngId && currEngId && baseEngId !== currEngId);
        const names = isCrossCheck
            ? { base: engineDisplayName(baseEngId), curr: engineDisplayName(currEngId) }
            : null;
        const xc = isCrossCheck ? crossCheckStats(delta) : null;
        // Between two engines a difference is neither an improvement nor a regression.
        const kpis = isCrossCheck
            ? Object.fromEntries(Object.entries(delta.kpiDelta || {}).map(([k, v]) =>
                [k, Object.assign({}, v, { direction: 'neutral' })]))
            : delta.kpiDelta;

        // Remove any prior instance.
        document.querySelectorAll(`#${PANEL_ID}, .esc-overlay`).forEach(n => n.remove());

        const overlay = document.createElement('div');
        overlay.className = 'esc-overlay';
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        const violationsKpi = kpis.violations || null;
        const migCount = (delta.statusMigrations || []).length;
        const headerSub = isCrossCheck
            ? `${names.base} vs ${names.curr} · same network, two independent solvers · `
              + `${xc.nBus} buses · ${xc.nBranch} branches`
            :
            `${migCount} status migration${migCount === 1 ? '' : 's'} · ` +
            `${(delta.perBus || []).length} bus deltas · ` +
            `${(delta.perBranch || []).length} branch deltas` +
            ((delta.addedRemoved && (delta.addedRemoved.added.length || delta.addedRemoved.removed.length))
                ? ` · ${delta.addedRemoved.added.length} added · ${delta.addedRemoved.removed.length} removed`
                : '');

        panel.innerHTML = `
            <div class="esc-header">
                <div>
                    <h3>${isCrossCheck ? 'Solver Cross-Check' : 'Scenario Compare'}</h3>
                    <div class="esc-sub">${escapeHtml(headerSub)}</div>
                </div>
                <button class="esc-icon-btn esc-close" aria-label="Close" title="Close">×</button>
            </div>
            <div class="esc-body">
                <div class="esc-runs">
                    <div class="esc-run-card">
                        <div class="esc-run-label">Baseline${baseEng ? ` · ${escapeHtml(baseEng)}` : ''}</div>
                        <div class="esc-run-name">${escapeHtml(baseLabel)}</div>
                        <div class="esc-run-meta">${escapeHtml(baseTs)}</div>
                    </div>
                    <div class="esc-run-card curr">
                        <div class="esc-run-label">Current${currEng ? ` · ${escapeHtml(currEng)}` : ''}</div>
                        <div class="esc-run-name">${escapeHtml(currLabel)}</div>
                        <div class="esc-run-meta">${escapeHtml(currTs)}</div>
                    </div>
                </div>

                ${isCrossCheck ? crossCheckBlock(xc, delta, targets, names, baselineDataJson, currentJson) : ''}

                <div class="esc-kpi-grid">
                    ${kpiCard('Health Score', kpis.healthScore, 0, '')}
                    ${kpiCard('Total Generation', kpis.totalGen, 2, ' MW')}
                    ${kpiCard('Total Load', kpis.totalLoad, 2, ' MW')}
                    ${kpiCard('Total Losses', kpis.totalLosses, 3, ' MW')}
                    ${kpiCard('Loss %', kpis.lossPct, 2, ' %')}
                    ${kpiCard('Violations', violationsKpi, 0, '')}
                </div>

                ${migrationsBlock(delta.statusMigrations || [])}

                ${isCrossCheck ? '' : overvoltageMitigationBlock(delta.overvoltageMitigation)}

                <div class="esc-grid2">
                    <div>
                        <h5 class="esc-section-title">${isCrossCheck ? 'Largest Bus Voltage Gaps' : 'Top Bus Voltage Movers'}
                            <span class="esc-count">click → focus</span>
                        </h5>
                        ${tableRowsBus(delta.perBus || [], targets, names)}
                    </div>
                    <div>
                        <h5 class="esc-section-title">${isCrossCheck ? 'Largest Branch Loading Gaps' : 'Top Branch Loading Movers'}
                            <span class="esc-count">click → focus</span>
                        </h5>
                        ${tableRowsBranch(delta.perBranch || [], targets, names)}
                    </div>
                </div>

                ${addedRemovedBlock(delta.addedRemoved)}
            </div>
            <div class="esc-footer">
                <button class="esc-btn primary esc-paint-btn">Highlight Differences</button>
                <button class="esc-btn esc-clear-btn">Clear Overlay</button>
                <button class="esc-btn esc-pin-btn" title="Make the current run the new baseline">Pin Current as Baseline</button>
                <div style="flex:1;"></div>
                <button class="esc-btn esc-close-btn">Close</button>
            </div>
        `;
        document.body.appendChild(panel);

        const closeAll = () => {
            clearSldOverlay();
            try { panel.remove(); } catch (e) {}
            try { overlay.remove(); } catch (e) {}
        };
        // Dismiss the modal (panel + backdrop) but keep the painted chips so
        // the user can actually see the highlighted diagram underneath.
        const dismissKeepOverlay = () => {
            try { panel.remove(); } catch (e) {}
            try { overlay.remove(); } catch (e) {}
        };
        panel.querySelector('.esc-close').addEventListener('click', closeAll);
        panel.querySelector('.esc-close-btn').addEventListener('click', closeAll);
        import('../utils/dialogStyles.js').then(({ attachBackdropCloseHandler }) => {
            attachBackdropCloseHandler(overlay, panel, closeAll);
        });

        // Click-to-focus on cross-check chart marks.
        panel.querySelectorAll('[data-xc-idx]').forEach((mark) => {
            mark.addEventListener('click', () => {
                const t = targets[parseInt(mark.getAttribute('data-xc-idx'), 10)];
                if (!t) return;
                const cell = findCellById(liveGraph, t.id, t);
                if (cell) focusCell(liveGraph, cell);
            });
        });
        const xcCopy = panel.querySelector('.esc-xc-copy');
        if (xcCopy && xc) {
            xcCopy.addEventListener('click', () => {
                copyText(crossCheckSummaryText(xc, names))
                    .then(() => showToast('Cross-check result copied.'))
                    .catch(() => showToast('Could not copy to the clipboard.'));
            });
        }

        // Click-to-focus on table rows.
        panel.querySelectorAll('tr[data-target-idx]').forEach((tr) => {
            tr.addEventListener('click', () => {
                const idx = parseInt(tr.getAttribute('data-target-idx'), 10);
                const t = targets[idx];
                if (!t) return;
                const cell = findCellById(liveGraph, t.id, t);
                if (cell) focusCell(liveGraph, cell);
            });
        });

        // Highlight Differences → paint SLD chips, then close the modal so the
        // diagram (and the chips) are visible. Chips persist until the user
        // presses Esc, runs a new load flow, or reopens compare.
        panel.querySelector('.esc-paint-btn').addEventListener('click', () => {
            const painted = paintSldOverlay(resolveLiveGraph(liveGraph), delta);
            if (painted) {
                dismissKeepOverlay();
                showToast(`Highlighting ${painted} changed element${painted === 1 ? '' : 's'} on the diagram. Press Esc to remove.`);
            } else {
                showToast('Could not place highlights on the diagram — try zooming to fit, then click again.');
            }
        });
        panel.querySelector('.esc-clear-btn').addEventListener('click', () => {
            clearSldOverlay();
            showToast('Overlay cleared.');
        });
        panel.querySelector('.esc-pin-btn').addEventListener('click', async () => {
            try {
                if (typeof window.saveSnapshot !== 'function' || typeof window.setBaselineSnapshot !== 'function') {
                    showToast('Snapshot store is unavailable.');
                    return;
                }
                const id = await window.saveSnapshot(currentDataJson, { engine: opts.engine, label: opts.currentLabel });
                await window.setBaselineSnapshot(id);
                showToast('Current run pinned as the new baseline.');
                closeAll();
            } catch (e) {
                console.error('[ScenarioCompare] pin baseline failed:', e);
                showToast('Could not pin baseline (see console).');
            }
        });

        return panel;
    }

    function closeScenarioCompare() {
        if (typeof document === 'undefined') return;
        clearSldOverlay();
        document.querySelectorAll(`#${PANEL_ID}, .esc-overlay`).forEach(n => n.remove());
    }

    /* ---------------------------------------------------------------------
     *  Public API
     * ------------------------------------------------------------------- */
    window.openScenarioCompare    = openScenarioCompare;
    window.closeScenarioCompare   = closeScenarioCompare;
    window.computeScenarioDelta   = computeScenarioDelta;
    window.paintSldOverlay        = paintSldOverlay;
    window.clearSldOverlay        = clearSldOverlay;

    // Internals for tests
    window._scenarioCompareInternals = {
        computeScenarioDelta,
        crossCheckStats,
        crossCheckSummaryText,
        classifyVoltage,
        classifyLoading,
        bandIndex,
        makeKeyResolver,
        busTopologyKey,
        topologyKeyForRow,
        isInternalMxName,
    };
})();
