/* =========================================================================
 *  Electrisim - Scenario Compare (run A vs run B)
 *  -----------------------------------------------------------------------
 *  Given a baseline Load Flow result and the current Load Flow result,
 *  compute a structured delta and render it as:
 *    - A floating modal with KPI deltas, top movers and status migrations.
 *    - Coloured chips painted next to changed cells on the live SLD.
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
     *  Build a stable identity key for each row using id → mxObjectId →
     *  dialog name → name. Uses the existing graph cell lookup so the same
     *  cell maps to the same key in both snapshots.
     * ------------------------------------------------------------------- */
    function makeKeyResolver(graph) {
        const hasResolver =
            typeof window !== 'undefined' &&
            typeof window.buildGraphCellLookupMap   === 'function' &&
            typeof window.resolveGraphCellForResult === 'function';
        let map = null;
        if (hasResolver && graph) {
            try { map = window.buildGraphCellLookupMap(graph); } catch (e) { map = null; }
        }
        const cellKey = (cell) => {
            if (!cell) return null;
            if (cell.id != null) return `cell:${cell.id}`;
            if (cell.mxObjectId)  return `mx:${String(cell.mxObjectId).replace(/#/g, '_')}`;
            return null;
        };
        return (row) => {
            if (!row) return null;
            if (map) {
                try {
                    const cell = window.resolveGraphCellForResult(map, row, graph);
                    const k = cellKey(cell);
                    if (k) return k;
                } catch (e) { /* fall through */ }
            }
            if (row.id != null && row.id !== '') return `id:${row.id}`;
            if (row.mxObjectId) return `mx:${String(row.mxObjectId).replace(/#/g, '_')}`;
            if (row.dialogName) return `name:${row.dialogName}`;
            if (row.name)       return `name:${row.name}`;
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
            return (row) => row?.dialogName || row?.name || (row?.id != null ? String(row.id) : '');
        }
        let map;
        try { map = window.buildGraphCellLookupMap(graph); } catch (e) { map = null; }
        return (row) => {
            try {
                const cell = map ? window.resolveGraphCellForResult(map, row, graph) : null;
                if (cell) {
                    const dn = window.getDialogNameFromCell(cell);
                    if (dn) return dn;
                }
            } catch (e) { /* ignore */ }
            const n = row?.name;
            if (n && !/^mxCell[#_]\d+$/i.test(String(n))) return String(n).replace(/_/g, '#');
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

        const keyOf       = makeKeyResolver(graph);
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
            const key = keyOf(r);
            if (key) busAByKey.set(key, r);
        }
        const seenBusKeys = new Set();
        const perBus = [];
        const addedBuses = [], removedBuses = [];
        for (const r of busesB) {
            const key = keyOf(r);
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
                key, kind: 'bus',
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
            const key = keyOf(r);
            if (key) brAByKey.set(key, r);
        }
        const seenBrKeys = new Set();
        const perBranch = [];
        const addedBranches = [], removedBranches = [];
        for (const r of brB) {
            const key = keyOf(r);
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
            for (const r of aRows) { const k = keyOf(r); if (k) aMap.set(k, r); }
            const bSeen = new Set();
            const added = [];
            for (const r of bRows) {
                const k = keyOf(r); if (!k) continue;
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

        return {
            kpiDelta,
            perBus,
            perBranch,
            statusMigrations,
            addedRemoved,
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
                z-index: 9998;
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
                z-index: 9999;
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

            /* SLD overlay chips ------------------------------------------- */
            #${OVERLAY_LAYER_ID} {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                pointer-events: none;
                z-index: 50;
            }
            .esc-chip-overlay {
                position: absolute;
                pointer-events: auto;
                padding: 2px 7px;
                border-radius: 999px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 11px; font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 4px 10px rgba(15,23,42,0.18);
                cursor: pointer;
                transform: translate(-50%, -120%);
                transition: transform 0.12s ease;
            }
            .esc-chip-overlay:hover { transform: translate(-50%, -120%) scale(1.06); }
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
                z-index: 10010;
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

    function tableRowsBus(rows, targets) {
        if (!rows.length) return '<div class="esc-empty">No bus voltage changes detected.</div>';
        const head = `
            <table class="esc-table">
                <thead><tr><th>Bus</th><th class="num">Base</th><th class="num">Current</th><th class="num">Δ pu</th><th>Status</th></tr></thead>
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
                <td class="num">${r.vm_pu_base.toFixed(3)}</td>
                <td class="num">${r.vm_pu_curr.toFixed(3)}</td>
                <td class="num"><span class="esc-chip ${cls}">${sign}${r.delta.toFixed(3)}</span></td>
                <td>
                    <span class="esc-band ${r.band_base}">${r.band_base}</span> →
                    <span class="esc-band ${r.band_curr}">${r.band_curr}</span>
                </td>
            </tr>`;
        }).join('');
        return head + body + '</tbody></table>';
    }

    function tableRowsBranch(rows, targets) {
        if (!rows.length) return '<div class="esc-empty">No branch loading changes detected.</div>';
        const head = `
            <table class="esc-table">
                <thead><tr><th>Element</th><th class="num">Base</th><th class="num">Current</th><th class="num">Δ %</th><th>Status</th></tr></thead>
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

    function ensureOverlayLayer(graph) {
        const container = (graph && graph.container) || null;
        if (!container) return null;
        let layer = container.querySelector('#' + OVERLAY_LAYER_ID);
        if (!layer) {
            layer = document.createElement('div');
            layer.id = OVERLAY_LAYER_ID;
            // The mxGraph container is positioned; ours is absolutely placed
            // inside it so chips track the diagram on scroll.
            const cs = window.getComputedStyle(container);
            if (cs && cs.position === 'static') {
                container.style.position = 'relative';
            }
            container.appendChild(layer);
        }
        return layer;
    }

    function chipPositionForCell(graph, cell) {
        try {
            const view = graph.view;
            const state = view && view.getState ? view.getState(cell) : null;
            if (state) {
                // Place chip at top-center of the cell's bounding box, in
                // container-local coordinates (state coords are already in
                // container space when scrollbars are factored in).
                const cx = state.x + state.width  / 2;
                const cy = state.y;
                return { x: cx, y: cy };
            }
            // Fallback: geometry × view scale + translate.
            if (graph.getModel && cell.geometry) {
                const g = cell.geometry;
                const s = (view && view.scale) || 1;
                const t = (view && view.translate) || { x: 0, y: 0 };
                return { x: (g.x + g.width / 2 + t.x) * s, y: (g.y + t.y) * s };
            }
        } catch (e) { /* ignore */ }
        return null;
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
        if (!graph || !delta) return;
        ensureStyle();
        clearSldOverlay();
        const layer = ensureOverlayLayer(graph);
        if (!layer) return;
        const map = (typeof window.buildGraphCellLookupMap === 'function')
            ? window.buildGraphCellLookupMap(graph) : null;
        const resolveCell = (row) => {
            if (!row) return null;
            try {
                if (map && typeof window.resolveGraphCellForResult === 'function') {
                    return window.resolveGraphCellForResult(map, row, graph);
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
        // Prefer items whose band actually changed.
        for (const r of (delta.perBus || [])) {
            if (Math.abs(r.delta || 0) < 1e-3 && r.band_base === r.band_curr) continue;
            const sev = (r.severity === 'improved') ? 'improved'
                      : (r.severity === 'worsened') ? 'worsened' : 'changed';
            pushItem(r, sev, 'bus');
        }
        for (const r of (delta.perBranch || [])) {
            if (Math.abs(r.delta || 0) < 0.5 && r.band_base === r.band_curr) continue;
            const sev = (r.severity === 'improved') ? 'improved'
                      : (r.severity === 'worsened') ? 'worsened' : 'changed';
            pushItem(r, sev, r.kind);
        }
        for (const r of (delta.addedRemoved && delta.addedRemoved.added) || []) {
            pushItem(r, 'added', 'added');
        }
        for (const r of (delta.addedRemoved && delta.addedRemoved.removed) || []) {
            pushItem(r, 'removed', 'removed');
        }

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
            el.textContent = it.label;
            el.title = (it.row.dialogName || it.row.name || it.row.id || '') + ' — click to focus';
            el.addEventListener('click', () => {
                focusCell(graph, it.cell);
            });
            layer.appendChild(el);
            it.el = el;
        }
        renderItems();

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
        try { graph.container && graph.container.addEventListener('scroll', onScroll, { passive: true }); } catch (e) {}
        try { window.addEventListener('resize', onResize); } catch (e) {}

        _overlayState = {
            graph, layer, items,
            cleanup: () => {
                try { graph.container && graph.container.removeEventListener('scroll', onScroll); } catch (e) {}
                try { window.removeEventListener('resize', onResize); } catch (e) {}
                // mxEvent listeners are best-effort; mxGraph has no removeAll.
            },
        };
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
        const delta = computeScenarioDelta(baselineDataJson, currentDataJson, liveGraph);

        // Click-target registry, same pattern the dashboard uses.
        const targets = [];

        const baseLabel = baseline.label || 'Baseline';
        const baseTs    = baseline.ts ? new Date(baseline.ts).toLocaleString() : '';
        const baseEng   = (baseline.engine || '').toUpperCase();
        const currLabel = opts.currentLabel || 'Current run';
        const currTs    = new Date().toLocaleString();
        const currEng   = (opts.engine || '').toUpperCase();

        // Remove any prior instance.
        document.querySelectorAll(`#${PANEL_ID}, .esc-overlay`).forEach(n => n.remove());

        const overlay = document.createElement('div');
        overlay.className = 'esc-overlay';
        document.body.appendChild(overlay);

        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        const violationsKpi = delta.kpiDelta.violations || null;
        const migCount = (delta.statusMigrations || []).length;
        const headerSub =
            `${migCount} status migration${migCount === 1 ? '' : 's'} · ` +
            `${(delta.perBus || []).length} bus deltas · ` +
            `${(delta.perBranch || []).length} branch deltas` +
            ((delta.addedRemoved && (delta.addedRemoved.added.length || delta.addedRemoved.removed.length))
                ? ` · ${delta.addedRemoved.added.length} added · ${delta.addedRemoved.removed.length} removed`
                : '');

        panel.innerHTML = `
            <div class="esc-header">
                <div>
                    <h3>Scenario Compare</h3>
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

                <div class="esc-kpi-grid">
                    ${kpiCard('Health Score', delta.kpiDelta.healthScore, 0, '')}
                    ${kpiCard('Total Generation', delta.kpiDelta.totalGen, 2, ' MW')}
                    ${kpiCard('Total Load', delta.kpiDelta.totalLoad, 2, ' MW')}
                    ${kpiCard('Total Losses', delta.kpiDelta.totalLosses, 3, ' MW')}
                    ${kpiCard('Loss %', delta.kpiDelta.lossPct, 2, ' %')}
                    ${kpiCard('Violations', violationsKpi, 0, '')}
                </div>

                ${migrationsBlock(delta.statusMigrations || [])}

                <div class="esc-grid2">
                    <div>
                        <h5 class="esc-section-title">Top Bus Voltage Movers
                            <span class="esc-count">click → focus</span>
                        </h5>
                        ${tableRowsBus(delta.perBus || [], targets)}
                    </div>
                    <div>
                        <h5 class="esc-section-title">Top Branch Loading Movers
                            <span class="esc-count">click → focus</span>
                        </h5>
                        ${tableRowsBranch(delta.perBranch || [], targets)}
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
            try { panel.remove(); } catch (e) {}
            try { overlay.remove(); } catch (e) {}
            // Leave the SLD overlay alive intentionally — closing the panel
            // shouldn't wipe the highlights if the user explicitly painted
            // them. They can dismiss with the Clear Overlay button.
        };
        panel.querySelector('.esc-close').addEventListener('click', closeAll);
        panel.querySelector('.esc-close-btn').addEventListener('click', closeAll);
        import('../utils/dialogStyles.js').then(({ attachBackdropCloseHandler }) => {
            attachBackdropCloseHandler(overlay, panel, closeAll);
        });

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

        // Highlight Differences → paint SLD chips.
        panel.querySelector('.esc-paint-btn').addEventListener('click', () => {
            paintSldOverlay(liveGraph, delta);
            showToast('Highlighting ' + (
                (delta.perBus.filter(r => r.severity !== 'neutral').length) +
                (delta.perBranch.filter(r => r.severity !== 'neutral').length) +
                (delta.addedRemoved.added.length) +
                (delta.addedRemoved.removed.length)
            ) + ' changed elements on the diagram.');
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
        classifyVoltage,
        classifyLoading,
        bandIndex,
        makeKeyResolver,
    };
})();
