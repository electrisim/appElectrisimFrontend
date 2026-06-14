/* =========================================================================
 *  Electrisim - Network Health Dashboard
 *  -----------------------------------------------------------------------
 *  A floating, draggable analytics panel that appears automatically after a
 *  successful Power Flow simulation. It turns the raw pandapower / OpenDSS
 *  result JSON into instant, engineer-friendly insights:
 *
 *    - Network Health Score (0-100, animated SVG gauge)
 *    - 6 KPI cards (count-up animated)
 *    - Top 5 most loaded equipment (click to zoom on SLD)
 *    - Voltage profile mini-histogram
 *    - Critical Issues list (click to flash & focus on SLD)
 *    - "Highlight Hot Spots" button
 *
 *  Self-contained: no external chart libraries, no backend changes, no AI.
 *  Public API (attached to window):
 *      window.showNetworkHealthDashboard(dataJson, graph)
 *      window.hideNetworkHealthDashboard()
 * =========================================================================
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    /* ---------------------------------------------------------------------
     *  Constants & thresholds — kept consistent with loadFlow.js color rules
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

    const PANEL_ID  = 'electrisim-health-dashboard';
    const STYLE_ID  = 'electrisim-health-dashboard-style';

    /* ---------------------------------------------------------------------
     *  Helpers
     * ------------------------------------------------------------------- */
    const num    = (v) => (v === null || v === undefined || Number.isNaN(Number(v))) ? null : Number(v);
    const fmt    = (v, d = 2) => (num(v) === null ? '—' : num(v).toFixed(d));
    const sumOf  = (arr, key) => (Array.isArray(arr) ? arr.reduce((s, r) => s + (num(r?.[key]) || 0), 0) : 0);

    // Sum p_mw across the three phases for asymmetric elements.
    // Backend emits p_a_mw, p_b_mw, p_c_mw (per AsymmetricStaticGeneratorOut /
    // AsymmetricLoadOut classes in pandapower_electrisim.py).
    const sumAsym = (arr) => (Array.isArray(arr)
        ? arr.reduce((s, r) =>
            s + (num(r?.p_a_mw) || 0) + (num(r?.p_b_mw) || 0) + (num(r?.p_c_mw) || 0), 0)
        : 0);

    // Decompose a list into the positive-injection and positive-consumption
    // parts. Useful for slack ext_grid (can act as source or sink) and for
    // storage (discharge = generation, charge = load).
    const splitBySign = (arr, key = 'p_mw') => {
        let pos = 0, neg = 0;
        if (!Array.isArray(arr)) return { pos, neg };
        for (const r of arr) {
            const v = num(r?.[key]);
            if (v === null) continue;
            if (v >= 0) pos += v;
            else        neg += -v;
        }
        return { pos, neg };
    };

    // Active-power injection at a bus element (MW). pandapower load-flow results
    // use negative p_mw for gen/sgen; OpenDSS and some UI exports use positive.
    const busInjectMw = (p) => {
        const v = num(p);
        if (v === null || v === 0) return 0;
        return v < 0 ? -v : v;
    };

    const sumBusInject = (arr, key = 'p_mw') => (Array.isArray(arr)
        ? arr.reduce((s, r) => s + busInjectMw(r?.[key]), 0)
        : 0);

    const sumBusWithdraw = (arr, key = 'p_mw') => (Array.isArray(arr)
        ? arr.reduce((s, r) => {
            const v = num(r?.[key]);
            return v === null || v <= 0 ? s : s + v;
        }, 0)
        : 0);

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

    /* ---------------------------------------------------------------------
     *  Resolve a friendly display name for a backend row by consulting the
     *  graph for a user-set dialog name. Falls back gracefully when the
     *  resolver utilities are not loaded.
     * ------------------------------------------------------------------- */
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
     *  KPI computation — works on pandapower result JSON shape used in
     *  loadFlow.js (busbars, lines, transformers, transformers3W,
     *  generators, externalgrids, staticgenerators, loads, motors).
     *  Pass `graph` to enable dialog-name resolution for the labels.
     * ------------------------------------------------------------------- */
    function computeMetrics(dataJson, graph) {
        const d = dataJson || {};
        const nameOf = makeDisplayNameResolver(graph);

        // Tolerant of pandapower (`transformers3W`) and OpenDSS (`transformers3w`)
        // key spellings, and of legacy / minor naming drift.
        const arr = (...keys) => {
            for (const k of keys) {
                if (Array.isArray(d[k])) return d[k];
            }
            return [];
        };
        const buses        = arr('busbars');
        const lines        = arr('lines');
        const trafos       = arr('transformers');
        const trafos3w     = arr('transformers3W', 'transformers3w');
        const generators   = arr('generators');
        const sgens        = arr('staticgenerators');
        const asymSgens    = arr('asymmetricstaticgenerators', 'asymmetric_sgens', 'asymmetricSgens');
        const extGrids     = arr('externalgrids');
        const loads        = arr('loads');
        const asymLoads    = arr('asymmetricloads', 'asymmetric_loads', 'asymmetricLoads');
        const motors       = arr('motors');
        const storages     = arr('storages');
        const pvSystems    = arr('pvsystems', 'pvSystems');
        const shunts       = arr('shunts');
        const capacitors   = arr('capacitors');
        const impedances   = arr('impedances');
        const dclines      = arr('dclines', 'dcline');

        // Generation accounting — gross output of every injecting element.
        // pandapower / OpenDSS sign conventions:
        //   ext_grid:           +p_mw → import (gen/supply from grid)
        //                       −p_mw → export (grid backfeed; not network load)
        //   gen / sgen / pv:    −p_mw → injection in pandapower; +p_mw in OpenDSS
        //   asymmetric_sgen:    p_total = p_a_mw + p_b_mw + p_c_mw
        //   storage:            +p_mw → charging (load), −p_mw → discharging (gen)
        const extSplit  = splitBySign(extGrids);
        const stoSplit  = splitBySign(storages);

        const genInjectMw  = sumBusInject(generators);
        const sgenInjectMw = sumBusInject(sgens);
        const pvInjectMw   = sumBusInject(pvSystems);

        // Asymmetric static generators are always sources; loads are always sinks.
        let asymSgenGen = 0;
        for (const r of asymSgens) {
            const tot = (num(r?.p_a_mw) || 0) + (num(r?.p_b_mw) || 0) + (num(r?.p_c_mw) || 0);
            asymSgenGen += busInjectMw(tot);
        }
        let asymLoadLoad = 0, asymLoadGen = 0;
        for (const r of asymLoads) {
            const tot = (num(r?.p_a_mw) || 0) + (num(r?.p_b_mw) || 0) + (num(r?.p_c_mw) || 0);
            if (tot >= 0) asymLoadLoad += tot;
            else          asymLoadGen  += -tot;
        }

        const shuntLoadMw    = sumBusWithdraw(shunts);
        const capacitorLoadMw = sumBusWithdraw(capacitors);

        // Detailed breakdown — surfaced via tooltip & console for transparency.
        const breakdownGen = [
            { label: 'External Grid (import)',     value: extSplit.pos,  count: extGrids.length },
            { label: 'Synchronous generators',     value: genInjectMw,   count: generators.length },
            { label: 'Static generators',          value: sgenInjectMw,  count: sgens.length },
            { label: 'Asymmetric static gens',     value: asymSgenGen,   count: asymSgens.length },
            { label: 'PV systems',                 value: pvInjectMw,    count: pvSystems.length },
            { label: 'Storage (discharge)',        value: stoSplit.neg,  count: storages.length },
            { label: 'Asymmetric loads (gen)',     value: asymLoadGen,   count: asymLoads.length },
        ].filter(x => x.count > 0 || x.value > 0.0001);

        const breakdownLoad = [
            { label: 'Loads',                      value: sumOf(loads,  'p_mw'), count: loads.length },
            { label: 'Asymmetric loads',           value: asymLoadLoad,          count: asymLoads.length },
            { label: 'Motors',                     value: sumOf(motors, 'p_mw'), count: motors.length },
            { label: 'Storage (charge)',           value: stoSplit.pos,          count: storages.length },
            { label: 'Shunt reactors',             value: shuntLoadMw,           count: shunts.length },
            { label: 'Capacitors',                 value: capacitorLoadMw,     count: capacitors.length },
        ].filter(x => x.count > 0 || x.value > 0.0001);

        const totalGen  = breakdownGen .reduce((s, r) => s + r.value, 0);
        const totalLoad = breakdownLoad.reduce((s, r) => s + r.value, 0);

        // Branch losses (lines, trafos, impedances, DC lines) — matches backend economic analysis.
        const branchLosses =
            sumOf(lines, 'pl_mw') +
            sumOf(trafos, 'pl_mw') +
            sumOf(trafos3w, 'pl_mw') +
            sumOf(impedances, 'pl_mw') +
            sumOf(dclines, 'pl_mw');

        // System losses from active-power balance (injections − withdrawals incl. grid export).
        const totalInjections =
            extSplit.pos + genInjectMw + sgenInjectMw + pvInjectMw +
            asymSgenGen + asymLoadGen + stoSplit.neg;
        const totalWithdrawals = totalLoad + extSplit.neg;

        let totalLosses = 0;
        if (totalInjections > 0.0001 || totalWithdrawals > 0.0001) {
            totalLosses = Math.max(0, totalInjections - totalWithdrawals);
        } else if (branchLosses > 0) {
            totalLosses = branchLosses;
        }
        const lossPct = totalGen ? (totalLosses / totalGen) * 100 : 0;

        // Voltage statistics (only buses that actually have a vm_pu)
        const busVms = buses
            .map(b => ({
                name: b.name || b.id,
                vm_pu: num(b.vm_pu),
                id: b.id,
                dialogName: nameOf(b),
            }))
            .filter(b => b.vm_pu !== null);
        let minV = null, maxV = null, minBus = null, maxBus = null;
        let voltageGood = 0, voltageWarn = 0, voltageDanger = 0;
        for (const b of busVms) {
            if (minV === null || b.vm_pu < minV) { minV = b.vm_pu; minBus = b; }
            if (maxV === null || b.vm_pu > maxV) { maxV = b.vm_pu; maxBus = b; }
            const c = classifyVoltage(b.vm_pu);
            if (c === 'good')   voltageGood++;
            if (c === 'warn')   voltageWarn++;
            if (c === 'danger') voltageDanger++;
        }
        const voltagePct = busVms.length ? (voltageGood / busVms.length) * 100 : 100;

        // Loading statistics across lines + transformers
        const loadEntities = [
            ...lines.map(x => ({ kind: 'Line',        ...x })),
            ...trafos.map(x => ({ kind: 'Transformer', ...x })),
            ...trafos3w.map(x => ({ kind: '3W-Trafo',  ...x })),
        ].map(x => ({
            ...x,
            loading_percent: num(x.loading_percent),
            dialogName: nameOf(x),
        })).filter(x => x.loading_percent !== null);

        let maxL = null, maxLEntity = null;
        let loadingGood = 0, loadingWarn = 0, loadingDanger = 0;
        for (const e of loadEntities) {
            if (maxL === null || e.loading_percent > maxL) { maxL = e.loading_percent; maxLEntity = e; }
            const c = classifyLoading(e.loading_percent);
            if (c === 'good')   loadingGood++;
            if (c === 'warn')   loadingWarn++;
            if (c === 'danger') loadingDanger++;
        }
        const loadingHeadroomPct = loadEntities.length ? (loadingGood / loadEntities.length) * 100 : 100;

        // Top 5 loaded equipment
        const top5 = loadEntities
            .slice()
            .sort((a, b) => b.loading_percent - a.loading_percent)
            .slice(0, 5);

        // Critical issues
        const issues = [];
        for (const e of loadEntities) {
            if (e.loading_percent > LOADING_DANGER) {
                issues.push({
                    severity: 'danger',
                    title: `${e.kind} ${e.dialogName || e.name || e.id} overloaded`,
                    detail: `${e.loading_percent.toFixed(1)} % loading`,
                    cellId: e.id || null,
                    cellName: e.name || null,
                    type: 'loading',
                });
            } else if (e.loading_percent > LOADING_WARNING) {
                issues.push({
                    severity: 'warn',
                    title: `${e.kind} ${e.dialogName || e.name || e.id} highly loaded`,
                    detail: `${e.loading_percent.toFixed(1)} % loading`,
                    cellId: e.id || null,
                    cellName: e.name || null,
                    type: 'loading',
                });
            }
        }
        for (const b of busVms) {
            if (b.vm_pu >= VOLTAGE_DANGER_HIGH || b.vm_pu <= VOLTAGE_DANGER_LOW) {
                issues.push({
                    severity: 'danger',
                    title: `Bus ${b.dialogName || b.name} voltage out of range`,
                    detail: `${b.vm_pu.toFixed(3)} pu`,
                    cellId: b.id || null,
                    cellName: b.name || null,
                    type: 'voltage',
                });
            } else if (b.vm_pu > VOLTAGE_OK_HIGH || b.vm_pu < VOLTAGE_OK_LOW) {
                issues.push({
                    severity: 'warn',
                    title: `Bus ${b.dialogName || b.name} voltage drift`,
                    detail: `${b.vm_pu.toFixed(3)} pu`,
                    cellId: b.id || null,
                    cellName: b.name || null,
                    type: 'voltage',
                });
            }
        }
        // sort by severity (danger first), then by detail magnitude
        issues.sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === 'danger' ? -1 : 1;
            return 0;
        });

        // Voltage histogram bins (8 bins covering 0.85..1.15)
        const histMin = 0.85, histMax = 1.15, bins = 8;
        const histogram = new Array(bins).fill(0);
        for (const b of busVms) {
            const idx = Math.min(bins - 1, Math.max(0,
                Math.floor(((b.vm_pu - histMin) / (histMax - histMin)) * bins)));
            histogram[idx]++;
        }
        const histLabels = [];
        for (let i = 0; i < bins; i++) {
            const lo = histMin + (histMax - histMin) * (i / bins);
            histLabels.push(lo.toFixed(2));
        }

        // Convergence detection — pandapower returns values; an `error`
        // payload would have been short-circuited earlier in loadFlow.js.
        const converged =
            !d.error &&
            (busVms.length > 0 || loadEntities.length > 0);

        // Health score (0-100) — weighted composite
        // Weights:  convergence 30, voltage 25, loading 25, losses 20
        let healthScore = 0;
        if (converged) {
            healthScore += 30;
            healthScore += 0.25 * voltagePct;
            healthScore += 0.25 * loadingHeadroomPct;
            // Losses: 0% => full 20pts, >=10% => 0pts
            const lossScore = Math.max(0, 20 * (1 - Math.min(lossPct, 10) / 10));
            healthScore += lossScore;
        }
        healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

        return {
            converged,
            totalGen, totalLoad, totalLosses, lossPct,
            breakdownGen, breakdownLoad,
            minV, maxV, minBus, maxBus,
            voltageGood, voltageWarn, voltageDanger,
            voltagePct,
            busBuckets: { good: voltageGood, warn: voltageWarn, danger: voltageDanger, total: busVms.length },
            maxL, maxLEntity,
            loadingGood, loadingWarn, loadingDanger,
            loadingHeadroomPct,
            equipmentBuckets: { good: loadingGood, warn: loadingWarn, danger: loadingDanger, total: loadEntities.length },
            top5,
            issues,
            histogram, histLabels, histMin, histMax,
            healthScore,
            counts: {
                buses: buses.length,
                lines: lines.length,
                transformers: trafos.length + trafos3w.length,
                generators:
                    generators.length + sgens.length + asymSgens.length +
                    extGrids.length + pvSystems.length,
                loads: loads.length + asymLoads.length + motors.length + storages.length,
            },
        };
    }

    /* ---------------------------------------------------------------------
     *  Style injection (one-time)
     * ------------------------------------------------------------------- */
    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            #${PANEL_ID} {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 380px;
                max-height: calc(100vh - 120px);
                background: #ffffff;
                border: 1px solid ${COLOR_BORDER};
                border-radius: 12px;
                box-shadow: 0 20px 50px -10px rgba(15,23,42,0.25), 0 4px 12px rgba(15,23,42,0.08);
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                color: ${COLOR_TEXT};
                z-index: 999;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: ehd-slide-in 0.35s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes ehd-slide-in {
                from { transform: translateX(40px); opacity: 0; }
                to   { transform: translateX(0);    opacity: 1; }
            }
            #${PANEL_ID}.ehd-collapsed { height: auto !important; max-height: 56px; }
            #${PANEL_ID}.ehd-collapsed .ehd-body { display: none; }
            #${PANEL_ID} .ehd-header {
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 16px;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #f8fafc;
                cursor: move;
                user-select: none;
            }
            #${PANEL_ID} .ehd-header h3 {
                margin: 0; font-size: 14px; font-weight: 600; letter-spacing: 0.3px;
                display: flex; align-items: center; gap: 8px;
            }
            #${PANEL_ID} .ehd-header .ehd-pulse {
                width: 8px; height: 8px; border-radius: 50%; background: #22c55e;
                box-shadow: 0 0 0 0 rgba(34,197,94,0.7); animation: ehd-pulse 2s infinite;
            }
            @keyframes ehd-pulse {
                0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
                70%  { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
                100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
            }
            #${PANEL_ID} .ehd-actions { display: flex; gap: 6px; }
            #${PANEL_ID} .ehd-icon-btn {
                background: rgba(255,255,255,0.1); color: #f8fafc;
                border: none; border-radius: 6px; width: 26px; height: 26px;
                cursor: pointer; font-size: 14px; line-height: 1;
                display: inline-flex; align-items: center; justify-content: center;
                transition: background 0.15s ease;
            }
            #${PANEL_ID} .ehd-icon-btn:hover { background: rgba(255,255,255,0.2); }
            #${PANEL_ID} .ehd-body {
                padding: 16px; overflow-y: auto; overflow-x: hidden;
                scrollbar-width: thin;
            }
            #${PANEL_ID} .ehd-body::-webkit-scrollbar { width: 6px; }
            #${PANEL_ID} .ehd-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

            #${PANEL_ID} .ehd-score-row {
                display: flex; align-items: center; gap: 14px;
                padding: 10px 12px;
                background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
                border: 1px solid ${COLOR_BORDER};
                border-radius: 10px;
                margin-bottom: 14px;
            }
            #${PANEL_ID} .ehd-score-info { flex: 1; }
            #${PANEL_ID} .ehd-score-label {
                font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px;
                color: ${COLOR_MUTED}; font-weight: 600;
            }
            #${PANEL_ID} .ehd-score-status {
                margin-top: 4px; font-size: 13px; font-weight: 600;
            }
            #${PANEL_ID} .ehd-score-detail {
                margin-top: 2px; font-size: 11px; color: ${COLOR_MUTED};
            }

            #${PANEL_ID} .ehd-kpi-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
                margin-bottom: 14px;
            }
            #${PANEL_ID} .ehd-kpi {
                padding: 10px 12px;
                background: #f8fafc;
                border: 1px solid ${COLOR_BORDER};
                border-radius: 8px;
                position: relative;
                overflow: hidden;
            }
            #${PANEL_ID} .ehd-kpi-label {
                font-size: 10px; text-transform: uppercase; letter-spacing: 0.6px;
                color: ${COLOR_MUTED}; font-weight: 600;
            }
            #${PANEL_ID} .ehd-kpi-value {
                margin-top: 4px; font-size: 18px; font-weight: 700; line-height: 1.1;
            }
            #${PANEL_ID} .ehd-kpi-unit { font-size: 11px; color: ${COLOR_MUTED}; font-weight: 500; margin-left: 3px; }
            #${PANEL_ID} .ehd-kpi-sub {
                margin-top: 2px; font-size: 11px; color: ${COLOR_MUTED};
            }
            #${PANEL_ID} .ehd-kpi.good   .ehd-kpi-value { color: ${COLOR_GOOD}; }
            #${PANEL_ID} .ehd-kpi.warn   .ehd-kpi-value { color: ${COLOR_WARN}; }
            #${PANEL_ID} .ehd-kpi.danger .ehd-kpi-value { color: ${COLOR_DANGER}; }
            #${PANEL_ID} .ehd-kpi.info   .ehd-kpi-value { color: ${COLOR_INFO}; }

            #${PANEL_ID} .ehd-section {
                margin-top: 14px;
            }
            #${PANEL_ID} .ehd-section-title {
                font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px;
                color: ${COLOR_MUTED}; font-weight: 700; margin-bottom: 8px;
                display: flex; align-items: center; justify-content: space-between;
            }
            #${PANEL_ID} .ehd-section-title .ehd-count { font-size: 10px; color: ${COLOR_MUTED}; font-weight: 600; }

            #${PANEL_ID} .ehd-bar-row {
                display: flex; align-items: center; gap: 8px;
                font-size: 11px; margin-bottom: 6px;
                cursor: pointer; padding: 4px 6px; border-radius: 6px;
                transition: background 0.12s ease;
            }
            #${PANEL_ID} .ehd-bar-row:hover { background: #f1f5f9; }
            #${PANEL_ID} .ehd-bar-name {
                flex: 0 0 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                color: ${COLOR_TEXT}; font-weight: 500;
            }
            #${PANEL_ID} .ehd-bar-track {
                flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;
                position: relative;
            }
            #${PANEL_ID} .ehd-bar-fill {
                height: 100%; border-radius: 4px;
                transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
            }
            #${PANEL_ID} .ehd-bar-value { flex: 0 0 50px; text-align: right; font-weight: 600; }

            #${PANEL_ID} .ehd-issue {
                display: flex; align-items: flex-start; gap: 8px;
                padding: 8px 10px; margin-bottom: 6px;
                background: #fafafa; border: 1px solid ${COLOR_BORDER};
                border-left-width: 3px;
                border-radius: 6px; cursor: pointer;
                transition: background 0.12s ease, transform 0.12s ease;
            }
            #${PANEL_ID} .ehd-issue:hover { background: #f1f5f9; transform: translateX(2px); }
            #${PANEL_ID} .ehd-issue.danger { border-left-color: ${COLOR_DANGER}; }
            #${PANEL_ID} .ehd-issue.warn   { border-left-color: ${COLOR_WARN}; }
            #${PANEL_ID} .ehd-issue-dot {
                width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0;
            }
            #${PANEL_ID} .ehd-issue.danger .ehd-issue-dot { background: ${COLOR_DANGER}; }
            #${PANEL_ID} .ehd-issue.warn   .ehd-issue-dot { background: ${COLOR_WARN}; }
            #${PANEL_ID} .ehd-issue-text { font-size: 11px; line-height: 1.35; flex: 1; }
            #${PANEL_ID} .ehd-issue-title { font-weight: 600; color: ${COLOR_TEXT}; }
            #${PANEL_ID} .ehd-issue-detail { color: ${COLOR_MUTED}; }
            #${PANEL_ID} .ehd-no-issues {
                padding: 10px; font-size: 12px; color: ${COLOR_GOOD};
                background: #ecfdf5; border-radius: 6px; text-align: center;
                border: 1px solid #bbf7d0;
            }

            #${PANEL_ID} .ehd-hist {
                width: 100%; height: 70px; display: block;
                border: 1px solid ${COLOR_BORDER}; border-radius: 6px; background: #f8fafc;
            }

            #${PANEL_ID} .ehd-cta-row {
                display: flex; flex-wrap: wrap; gap: 8px; margin-top: 14px;
            }
            #${PANEL_ID} .ehd-btn {
                flex: 1 1 calc(50% - 4px); min-width: 110px;
                padding: 8px 10px;
                font-size: 12px; font-weight: 600;
                border-radius: 8px; border: 1px solid ${COLOR_BORDER};
                background: #ffffff; color: ${COLOR_TEXT};
                cursor: pointer; transition: all 0.15s ease;
                display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            }
            #${PANEL_ID} .ehd-btn:hover { background: #f1f5f9; transform: translateY(-1px); }
            #${PANEL_ID} .ehd-btn.primary {
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                color: #fff; border-color: transparent;
            }
            #${PANEL_ID} .ehd-btn.primary:hover { box-shadow: 0 6px 14px -4px rgba(37,99,235,0.45); }
            #${PANEL_ID} .ehd-btn[disabled] {
                opacity: 0.6; cursor: progress; transform: none !important;
            }
            #${PANEL_ID} .ehd-spinner {
                width: 11px; height: 11px; border-radius: 50%;
                border: 2px solid rgba(15,23,42,0.18); border-top-color: ${COLOR_TEXT};
                animation: ehd-spin 0.8s linear infinite; display: inline-block;
            }
            @keyframes ehd-spin { to { transform: rotate(360deg); } }

            .ehd-flash-pulse {
                animation: ehd-flash 1.6s ease-in-out;
                animation-iteration-count: 2;
            }
            @keyframes ehd-flash {
                0%, 100% { filter: drop-shadow(0 0 0 rgba(220,38,38,0)); }
                50%      { filter: drop-shadow(0 0 14px rgba(220,38,38,0.95)); }
            }
        `;
        document.head.appendChild(style);
    }

    /* ---------------------------------------------------------------------
     *  SVG: animated health-score gauge (semicircular)
     * ------------------------------------------------------------------- */
    function buildGauge(score) {
        const color = score >= 85 ? COLOR_GOOD : score >= 60 ? COLOR_WARN : COLOR_DANGER;
        // semicircle from angle 180deg to 360deg, radius 36, center (50, 50)
        const radius = 36;
        const cx = 50, cy = 50;
        const total = Math.PI * radius;                 // arc length of full half-circle
        const filled = (score / 100) * total;

        return `
            <svg width="92" height="56" viewBox="0 0 100 60" aria-label="Health score gauge">
                <path d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}"
                      fill="none" stroke="#e2e8f0" stroke-width="9" stroke-linecap="round"/>
                <path class="ehd-gauge-fill"
                      d="M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}"
                      fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"
                      stroke-dasharray="${total}" stroke-dashoffset="${total}">
                    <animate attributeName="stroke-dashoffset"
                             from="${total}" to="${total - filled}"
                             dur="1.0s" fill="freeze"
                             calcMode="spline" keySplines="0.16 1 0.3 1"/>
                </path>
                <text x="50" y="46" text-anchor="middle"
                      font-size="22" font-weight="700" fill="${COLOR_TEXT}"
                      font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif">
                    <tspan>${score}</tspan>
                </text>
                <text x="50" y="56" text-anchor="middle" font-size="8" fill="${COLOR_MUTED}"
                      font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif">/ 100</text>
            </svg>
        `;
    }

    /* ---------------------------------------------------------------------
     *  SVG: voltage histogram (mini bar chart with green/yellow/red banding)
     * ------------------------------------------------------------------- */
    function buildHistogram(metrics) {
        const { histogram, histLabels, histMin, histMax } = metrics;
        const w = 348, h = 70, padL = 22, padR = 6, padT = 8, padB = 18;
        const innerW = w - padL - padR;
        const innerH = h - padT - padB;
        const bars = histogram.length;
        const barW = innerW / bars;
        const maxCount = Math.max(1, ...histogram);

        // Background bands: red < 0.9, yellow 0.9–0.95, green 0.95–1.05, yellow 1.05–1.1, red > 1.1
        const xFor = (vm) => padL + ((vm - histMin) / (histMax - histMin)) * innerW;
        const bands = [
            { from: histMin, to: 0.90, color: 'rgba(220,38,38,0.10)' },
            { from: 0.90,    to: 0.95, color: 'rgba(245,158,11,0.10)' },
            { from: 0.95,    to: 1.05, color: 'rgba(22,163,74,0.10)' },
            { from: 1.05,    to: 1.10, color: 'rgba(245,158,11,0.10)' },
            { from: 1.10,    to: histMax, color: 'rgba(220,38,38,0.10)' },
        ];

        let svg = `<svg class="ehd-hist" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`;
        for (const b of bands) {
            const bx = xFor(Math.max(b.from, histMin));
            const bw = xFor(Math.min(b.to, histMax)) - bx;
            svg += `<rect x="${bx}" y="${padT}" width="${bw}" height="${innerH}" fill="${b.color}"/>`;
        }

        // Bars
        for (let i = 0; i < bars; i++) {
            const count = histogram[i];
            if (!count) continue;
            const bh = (count / maxCount) * innerH;
            const x = padL + i * barW + 2;
            const y = padT + innerH - bh;
            const lo = histMin + (histMax - histMin) * (i / bars);
            const hi = histMin + (histMax - histMin) * ((i + 1) / bars);
            const center = (lo + hi) / 2;
            const cls = classifyVoltage(center);
            const color = cls === 'good' ? COLOR_GOOD : cls === 'warn' ? COLOR_WARN : COLOR_DANGER;
            svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW - 4).toFixed(1)}" height="${bh.toFixed(1)}"
                          fill="${color}" rx="2" ry="2"
                          opacity="0">
                        <animate attributeName="opacity" from="0" to="0.9" dur="0.5s" begin="${i * 0.05}s" fill="freeze"/>
                        <title>${count} bus(es) in [${lo.toFixed(2)}, ${hi.toFixed(2)}] pu</title>
                    </rect>`;
            if (count > 0) {
                svg += `<text x="${(x + (barW - 4) / 2).toFixed(1)}" y="${(y - 2).toFixed(1)}"
                              text-anchor="middle" font-size="9" fill="${COLOR_TEXT}"
                              font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif">${count}</text>`;
            }
        }

        // X axis labels (a few key ones)
        const ticks = [0.90, 0.95, 1.00, 1.05, 1.10];
        for (const t of ticks) {
            const x = xFor(t);
            svg += `<line x1="${x}" y1="${padT + innerH}" x2="${x}" y2="${padT + innerH + 3}" stroke="#94a3b8" stroke-width="1"/>`;
            svg += `<text x="${x}" y="${h - 4}" text-anchor="middle" font-size="9" fill="${COLOR_MUTED}"
                          font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif">${t.toFixed(2)}</text>`;
        }
        svg += `<text x="2" y="${padT + 8}" font-size="9" fill="${COLOR_MUTED}"
                      font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif">buses</text>`;
        svg += `<text x="${w - 28}" y="${h - 4}" font-size="9" fill="${COLOR_MUTED}"
                      font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif">U [pu]</text>`;
        svg += `</svg>`;
        return svg;
    }

    /* ---------------------------------------------------------------------
     *  Top 5 loaded equipment bars
     *  `targets` is a click-target registry: each row gets a stable index
     *  into an array of {id, name} so the resolver can be invoked on click.
     * ------------------------------------------------------------------- */
    function buildTop5(metrics, targets) {
        if (!metrics.top5.length) return '<div class="ehd-no-issues" style="background:#f8fafc;color:#64748b;border-color:#e2e8f0;">No loading data available.</div>';
        return metrics.top5.map((e) => {
            const pct = e.loading_percent;
            const cls = classifyLoading(pct);
            const color = cls === 'good' ? COLOR_GOOD : cls === 'warn' ? COLOR_WARN : COLOR_DANGER;
            const w = Math.min(100, pct).toFixed(0);
            const label = e.dialogName || e.name || e.id || `${e.kind}`;
            const tooltip = `${e.kind}: ${label} — ${pct.toFixed(1)}% loading`;
            const idx = targets.length;
            targets.push({ id: e.id, name: e.name });
            return `
                <div class="ehd-bar-row" data-target-idx="${idx}" title="${tooltip}">
                    <span class="ehd-bar-name">${label}</span>
                    <span class="ehd-bar-track">
                        <span class="ehd-bar-fill" style="width:0%; background:${color};" data-target="${w}"></span>
                    </span>
                    <span class="ehd-bar-value" style="color:${color};">${pct.toFixed(0)}%</span>
                </div>
            `;
        }).join('');
    }

    /* ---------------------------------------------------------------------
     *  Critical issues list
     * ------------------------------------------------------------------- */
    function buildIssues(metrics, targets) {
        if (!metrics.issues.length) {
            return '<div class="ehd-no-issues">All clear — no violations detected.</div>';
        }
        return metrics.issues.slice(0, 6).map(iss => {
            const idx = targets.length;
            targets.push({ id: iss.cellId, name: iss.cellName });
            return `
                <div class="ehd-issue ${iss.severity}" data-target-idx="${idx}">
                    <span class="ehd-issue-dot"></span>
                    <span class="ehd-issue-text">
                        <span class="ehd-issue-title">${iss.title}</span><br/>
                        <span class="ehd-issue-detail">${iss.detail}</span>
                    </span>
                </div>
            `;
        }).join('');
    }

    /* ---------------------------------------------------------------------
     *  Format a breakdown array as a human-readable, multi-line tooltip.
     * ------------------------------------------------------------------- */
    function tooltipFromBreakdown(rows, total) {
        if (!Array.isArray(rows) || rows.length === 0) return 'No contributions.';
        const w = Math.max(...rows.map(r => r.label.length));
        const lines = rows.map(r => {
            const pad = r.label.padEnd(w, ' ');
            const cnt = r.count ? ` (${r.count})` : '';
            return `${pad}  ${r.value.toFixed(3).padStart(9)} MW${cnt}`;
        });
        lines.push('-'.repeat(w + 18));
        lines.push(`${'TOTAL'.padEnd(w, ' ')}  ${total.toFixed(3).padStart(9)} MW`);
        return lines.join('\n');
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    /* ---------------------------------------------------------------------
     *  KPI cards
     * ------------------------------------------------------------------- */
    function buildKpis(m) {
        const lossPct  = m.totalGen ? (m.totalLosses / m.totalGen) * 100 : 0;
        const lossCls  = lossPct > 8 ? 'danger' : lossPct > 4 ? 'warn' : 'good';
        const vMinCls  = m.minV !== null ? classifyVoltage(m.minV) : 'unknown';
        const vMaxCls  = m.maxV !== null ? classifyVoltage(m.maxV) : 'unknown';
        const vCls     = (vMinCls === 'danger' || vMaxCls === 'danger') ? 'danger'
                       : (vMinCls === 'warn'   || vMaxCls === 'warn')   ? 'warn' : 'good';
        const lCls     = m.maxL !== null ? classifyLoading(m.maxL) : 'unknown';
        const violations = m.equipmentBuckets.warn + m.equipmentBuckets.danger
                         + m.busBuckets.warn       + m.busBuckets.danger;
        const violCls  = m.equipmentBuckets.danger + m.busBuckets.danger > 0 ? 'danger'
                       : violations > 0 ? 'warn' : 'good';

        const genTooltip  = tooltipFromBreakdown(m.breakdownGen,  m.totalGen);
        const loadTooltip = tooltipFromBreakdown(m.breakdownLoad, m.totalLoad);

        const cards = [
            {
                label: 'Total Generation ⓘ', cls: 'info',
                value: fmt(m.totalGen, 2), unit: 'MW',
                sub: `${m.counts.generators} sources · hover for breakdown`,
                tooltip: genTooltip,
            },
            {
                label: 'Total Load ⓘ', cls: 'info',
                value: fmt(m.totalLoad, 2), unit: 'MW',
                sub: `${m.counts.loads} loads/motors · hover for breakdown`,
                tooltip: loadTooltip,
            },
            {
                label: 'System Losses', cls: lossCls,
                value: fmt(m.totalLosses, 3), unit: 'MW',
                sub: `${fmt(lossPct, 2)} % of generation`,
            },
            {
                label: 'Voltage Range', cls: vCls,
                value: m.minV !== null && m.maxV !== null ? `${m.minV.toFixed(2)} – ${m.maxV.toFixed(2)}` : '—',
                unit: 'pu',
                sub: m.busBuckets.total > 0
                    ? `${m.busBuckets.good}/${m.busBuckets.total} buses in band`
                    : 'no buses',
            },
            {
                label: 'Max Loading', cls: lCls,
                value: m.maxL !== null ? fmt(m.maxL, 1) : '—', unit: '%',
                sub: m.maxLEntity ? `${m.maxLEntity.kind}: ${m.maxLEntity.dialogName || m.maxLEntity.name || m.maxLEntity.id}` : '—',
            },
            {
                label: 'Violations', cls: violCls,
                value: String(violations), unit: '',
                sub: `${m.equipmentBuckets.danger + m.busBuckets.danger} critical · ${m.equipmentBuckets.warn + m.busBuckets.warn} warning`,
            },
        ];

        return cards.map(c => `
            <div class="ehd-kpi ${c.cls}"${c.tooltip ? ` title="${escapeAttr(c.tooltip)}"` : ''}>
                <div class="ehd-kpi-label">${c.label}</div>
                <div class="ehd-kpi-value">${c.value}<span class="ehd-kpi-unit">${c.unit}</span></div>
                <div class="ehd-kpi-sub">${c.sub}</div>
            </div>
        `).join('');
    }

    /* ---------------------------------------------------------------------
     *  Score interpretation
     * ------------------------------------------------------------------- */
    function scoreStatus(score, converged) {
        if (!converged)   return { text: 'Did not converge',   color: COLOR_DANGER };
        if (score >= 90)  return { text: 'Excellent',          color: COLOR_GOOD };
        if (score >= 75)  return { text: 'Healthy',            color: COLOR_GOOD };
        if (score >= 60)  return { text: 'Acceptable',         color: COLOR_WARN };
        if (score >= 40)  return { text: 'Stressed',           color: COLOR_WARN };
        return                  { text: 'Critical',            color: COLOR_DANGER };
    }

    /* ---------------------------------------------------------------------
     *  Drag support (header drag)
     * ------------------------------------------------------------------- */
    function makeDraggable(panel, handle) {
        let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;
        handle.addEventListener('mousedown', (e) => {
            if (e.target.closest('.ehd-icon-btn')) return;
            dragging = true;
            sx = e.clientX; sy = e.clientY;
            const rect = panel.getBoundingClientRect();
            sl = rect.left; st = rect.top;
            panel.style.right = 'auto';
            panel.style.left  = sl + 'px';
            panel.style.top   = st + 'px';
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            const nl = sl + (e.clientX - sx);
            const nt = st + (e.clientY - sy);
            const maxL = window.innerWidth  - panel.offsetWidth - 4;
            const maxT = window.innerHeight - 60;
            panel.style.left = Math.max(4, Math.min(maxL, nl)) + 'px';
            panel.style.top  = Math.max(4, Math.min(maxT, nt)) + 'px';
            if (typeof window.repositionFlowConventionLegend === 'function') {
                window.repositionFlowConventionLegend();
            }
        });
        document.addEventListener('mouseup', () => {
            if (dragging && typeof window.repositionFlowConventionLegend === 'function') {
                window.repositionFlowConventionLegend();
            }
            dragging = false;
        });
    }

    /* ---------------------------------------------------------------------
     *  Zoom / pan to a graph cell + flash effect
     *  Prefers the robust resolver utilities (same matching loadFlow.js uses);
     *  falls back to a simple model-walk when those aren't available.
     * ------------------------------------------------------------------- */
    function findCellById(graph, id, fallbackRow) {
        if (!graph) return null;

        // Robust path: same resolver loadFlow.js uses (handles mxCell_ vs mxCell#,
        // numeric/string drift, name/id mismatches).
        try {
            if (typeof window !== 'undefined' &&
                typeof window.buildGraphCellLookupMap   === 'function' &&
                typeof window.resolveGraphCellForResult === 'function') {
                const map = window.buildGraphCellLookupMap(graph);
                const row = fallbackRow || { id, name: id };
                const cell = window.resolveGraphCellForResult(map, row, graph);
                if (cell) return cell;
            }
        } catch (e) { /* fall through to scan */ }

        if (!id) return null;
        try {
            const model = graph.getModel();
            if (model && model.cells) {
                if (model.cells[id]) return model.cells[id];
                if (model.cells[String(id)]) return model.cells[String(id)];
            }
            const root = graph.getDefaultParent();
            const stack = [root];
            while (stack.length) {
                const c = stack.pop();
                if (!c) continue;
                if (c.id != null && String(c.id) === String(id)) return c;
                const childCount = (model && model.getChildCount) ? model.getChildCount(c) : 0;
                for (let i = 0; i < childCount; i++) {
                    stack.push(model.getChildAt(c, i));
                }
            }
        } catch (e) {
            console.warn('[NHD] findCellById failed:', e);
        }
        return null;
    }

    function focusCell(graph, cell) {
        if (!graph || !cell) return;
        try {
            if (graph.scrollCellToVisible) {
                graph.scrollCellToVisible(cell, true);
            }
            if (graph.setSelectionCell) {
                graph.setSelectionCell(cell);
            }
            // Flash effect
            const state = graph.view && graph.view.getState ? graph.view.getState(cell) : null;
            const node = state && state.shape && state.shape.node ? state.shape.node : null;
            if (node) {
                node.classList.add('ehd-flash-pulse');
                setTimeout(() => node.classList.remove('ehd-flash-pulse'), 3400);
            }
        } catch (e) {
            console.warn('[NHD] focusCell failed:', e);
        }
    }

    function flashAllHotSpots(graph, metrics) {
        if (!graph) return;
        const rows = metrics.issues
            .map(i => ({ id: i.cellId, name: i.cellName }))
            .filter(r => r.id || r.name);
        let i = 0;
        const next = () => {
            if (i >= rows.length) return;
            const cell = findCellById(graph, rows[i].id, rows[i]);
            if (cell) focusCell(graph, cell);
            i++;
            setTimeout(next, 350);
        };
        next();
    }

    /* ---------------------------------------------------------------------
     *  Main: render the dashboard
     * ------------------------------------------------------------------- */
    function show(dataJson, graph) {
        try {
            ensureStyle();
            const metrics = computeMetrics(dataJson, graph);
            const status  = scoreStatus(metrics.healthScore, metrics.converged);

            // Console breakdown so users can audit the totals when something
            // looks off (e.g., a missing category or unexpected sign convention).
            try {
                if (typeof console !== 'undefined' && console.groupCollapsed) {
                    console.groupCollapsed(
                        `[Network Health] Generation ${metrics.totalGen.toFixed(3)} MW | ` +
                        `Load ${metrics.totalLoad.toFixed(3)} MW | ` +
                        `Losses ${metrics.totalLosses.toFixed(3)} MW`
                    );
                    console.log('Generation breakdown:', metrics.breakdownGen);
                    console.log('Load breakdown:',       metrics.breakdownLoad);
                    console.groupEnd();
                }
            } catch (e) { /* no-op */ }

            // Remove any existing instance
            const existing = document.getElementById(PANEL_ID);
            if (existing) existing.remove();

            // Click-target registry: HTML rows reference rows by index;
            // each entry carries enough info ({id, name}) for the resolver to
            // map back to the right graph cell on click.
            const targets = [];

            const panel = document.createElement('div');
            panel.id = PANEL_ID;
            panel.innerHTML = `
                <div class="ehd-header">
                    <h3>
                        <span class="ehd-pulse" style="background:${status.color};"></span>
                        Network Health Dashboard
                    </h3>
                    <div class="ehd-actions">
                        <button class="ehd-icon-btn ehd-collapse" title="Collapse / expand" aria-label="Collapse">−</button>
                        <button class="ehd-icon-btn ehd-close"    title="Close"               aria-label="Close">×</button>
                    </div>
                </div>
                <div class="ehd-body">
                    <div class="ehd-score-row">
                        ${buildGauge(metrics.healthScore)}
                        <div class="ehd-score-info">
                            <div class="ehd-score-label">System status</div>
                            <div class="ehd-score-status" style="color:${status.color};">${status.text}</div>
                            <div class="ehd-score-detail">
                                ${metrics.counts.buses} buses · ${metrics.counts.lines} lines ·
                                ${metrics.counts.transformers} transformers
                            </div>
                        </div>
                    </div>

                    <div class="ehd-kpi-grid">${buildKpis(metrics)}</div>

                    <div class="ehd-section">
                        <div class="ehd-section-title">
                            <span>Top 5 Loaded Equipment</span>
                            <span class="ehd-count">click → focus on diagram</span>
                        </div>
                        <div class="ehd-top5">${buildTop5(metrics, targets)}</div>
                    </div>

                    <div class="ehd-section">
                        <div class="ehd-section-title">
                            <span>Voltage Profile</span>
                            <span class="ehd-count">${metrics.busBuckets.total} buses</span>
                        </div>
                        ${buildHistogram(metrics)}
                    </div>

                    <div class="ehd-section">
                        <div class="ehd-section-title">
                            <span>Critical Issues</span>
                            <span class="ehd-count">${metrics.issues.length}</span>
                        </div>
                        <div class="ehd-issues">${buildIssues(metrics, targets)}</div>
                    </div>

                    <div class="ehd-cta-row">
                        <button class="ehd-btn primary ehd-flash-btn">Highlight Hot Spots</button>
                        <button class="ehd-btn ehd-line-i-btn"
                                title="Select one or more series Line edges first, then open this chart (|I| vs km from pandapower i_from / i_to)">Line current vs km…</button>
                        <button class="ehd-btn ehd-report-btn" title="Generate a multi-page PDF engineering report from this run">Export Report</button>
                        <button class="ehd-btn ehd-copy-btn">Copy Summary</button>
                    </div>
                    <div class="ehd-cta-row ehd-compare-row">
                        <button class="ehd-btn ehd-baseline-btn"
                                title="Pin this run as the Baseline so future runs can be compared against it">Save as Baseline</button>
                        <button class="ehd-btn primary ehd-compare-btn"
                                title="Open Scenario Compare against the pinned Baseline">Compare to Baseline</button>
                    </div>
                </div>
            `;

            document.body.appendChild(panel);
            makeDraggable(panel, panel.querySelector('.ehd-header'));

            // Animate top-5 bars after a tick
            requestAnimationFrame(() => {
                panel.querySelectorAll('.ehd-bar-fill').forEach(el => {
                    el.style.width = (el.getAttribute('data-target') || '0') + '%';
                });
            });

            // Header buttons
            panel.querySelector('.ehd-close').addEventListener('click', () => panel.remove());
            panel.querySelector('.ehd-collapse').addEventListener('click', () => {
                panel.classList.toggle('ehd-collapsed');
            });

            // Click → focus on diagram (Top 5 + Issues)
            panel.querySelectorAll('.ehd-bar-row, .ehd-issue').forEach(el => {
                el.addEventListener('click', () => {
                    const idx = parseInt(el.getAttribute('data-target-idx'), 10);
                    if (Number.isNaN(idx)) return;
                    const t = targets[idx];
                    if (!t) return;
                    const cell = findCellById(graph, t.id, t);
                    if (cell) focusCell(graph, cell);
                });
            });

            // Hot Spots button
            panel.querySelector('.ehd-flash-btn').addEventListener('click', () => {
                flashAllHotSpots(graph, metrics);
            });

            const lineIBtn = panel.querySelector('.ehd-line-i-btn');
            if (lineIBtn) {
                lineIBtn.addEventListener('click', () => {
                    if (typeof window.showLineCurrentCharacteristicPanel !== 'function') {
                        console.warn('[NetworkHealthDashboard] line current panel script missing.');
                        return;
                    }
                    try {
                        window.showLineCurrentCharacteristicPanel(graph);
                    } catch (e) {
                        console.warn('[NetworkHealthDashboard] Line current chart failed:', e);
                    }
                });
            }

            // Export Report button — generates a multi-page PDF
            const reportBtn = panel.querySelector('.ehd-report-btn');
            if (reportBtn) {
                reportBtn.addEventListener('click', () => {
                    if (typeof window.exportEngineeringReport !== 'function') {
                        console.warn('[NetworkHealthDashboard] exportEngineeringReport is not loaded.');
                        return;
                    }
                    if (reportBtn.hasAttribute('disabled')) return;
                    // Resolve the live graph from the editor if the caller's
                    // graph reference is missing (e.g. preview page).
                    let liveGraph = graph;
                    if (!liveGraph || typeof liveGraph.getGraphBounds !== 'function') {
                        try {
                            // Electrisim assigns App._editorUi / App._instance in
                            // index.html (App.main callback). See also App.main.editor.
                            const ui = (window.App && (window.App._editorUi || window.App._instance)) ||
                                       window.editorUi || window.ui || null;
                            if (ui && ui.editor && ui.editor.graph) {
                                liveGraph = ui.editor.graph;
                            } else if (window.App && window.App.main && window.App.main.editor && window.App.main.editor.graph) {
                                liveGraph = window.App.main.editor.graph;
                            }
                        } catch (e) { /* keep original */ }
                    }
                    const original = reportBtn.innerHTML;
                    reportBtn.setAttribute('disabled', 'true');
                    reportBtn.innerHTML = '<span class="ehd-spinner"></span> Building…';
                    Promise.resolve(window.exportEngineeringReport(dataJson, liveGraph))
                        .catch((err) => console.error('[NetworkHealthDashboard] report failed:', err))
                        .finally(() => {
                            reportBtn.removeAttribute('disabled');
                            reportBtn.innerHTML = original;
                        });
                });
            }

            // Copy summary
            panel.querySelector('.ehd-copy-btn').addEventListener('click', () => {
                const summary =
`Electrisim — Network Health Summary
Status: ${status.text} (Score ${metrics.healthScore}/100)
Generation:  ${fmt(metrics.totalGen, 2)} MW
Load:        ${fmt(metrics.totalLoad, 2)} MW
Losses:      ${fmt(metrics.totalLosses, 3)} MW (${fmt(metrics.lossPct, 2)} %)
Voltage:     min ${fmt(metrics.minV, 3)} pu | max ${fmt(metrics.maxV, 3)} pu
Max Loading: ${fmt(metrics.maxL, 1)} %
Buses:       ${metrics.counts.buses} | Lines: ${metrics.counts.lines} | Transformers: ${metrics.counts.transformers}
Violations:  ${metrics.issues.length}`;
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(summary).catch(() => {});
                }
                const btn = panel.querySelector('.ehd-copy-btn');
                const old = btn.textContent;
                btn.textContent = 'Copied ✓';
                setTimeout(() => { btn.textContent = old; }, 1400);
            });

            // ---------- Scenario Compare buttons ---------------------------
            // Resolve a usable graph reference once for both buttons; same
            // fallback the report button uses (preview pages, lazy editor).
            const resolveLiveGraphForCompare = () => {
                let liveGraph = graph;
                if (!liveGraph || typeof liveGraph.getGraphBounds !== 'function') {
                    try {
                        const ui = (window.App && (window.App._editorUi || window.App._instance)) ||
                                   window.editorUi || window.ui || null;
                        if (ui && ui.editor && ui.editor.graph) {
                            liveGraph = ui.editor.graph;
                        } else if (window.App && window.App.main && window.App.main.editor && window.App.main.editor.graph) {
                            liveGraph = window.App.main.editor.graph;
                        }
                    } catch (e) { /* keep original */ }
                }
                return liveGraph;
            };

            // Reflect baseline state in the Compare button (enabled / disabled).
            const compareBtn  = panel.querySelector('.ehd-compare-btn');
            const baselineBtn = panel.querySelector('.ehd-baseline-btn');
            const refreshCompareState = async () => {
                if (!compareBtn) return;
                if (typeof window.getBaselineSnapshot !== 'function') {
                    compareBtn.setAttribute('disabled', 'true');
                    compareBtn.title = 'Snapshot store is not loaded.';
                    return;
                }
                try {
                    const base = await window.getBaselineSnapshot();
                    if (base) {
                        compareBtn.removeAttribute('disabled');
                        compareBtn.title = `Compare to baseline: ${base.label || base.id}`;
                    } else {
                        compareBtn.setAttribute('disabled', 'true');
                        compareBtn.title = 'No baseline pinned yet — click Save as Baseline first.';
                    }
                } catch (e) { /* leave as-is */ }
            };
            refreshCompareState();

            if (baselineBtn) {
                baselineBtn.addEventListener('click', async () => {
                    if (typeof window.saveSnapshot !== 'function' ||
                        typeof window.setBaselineSnapshot !== 'function') {
                        console.warn('[NetworkHealthDashboard] Snapshot store unavailable.');
                        return;
                    }
                    if (baselineBtn.hasAttribute('disabled')) return;
                    const original = baselineBtn.innerHTML;
                    baselineBtn.setAttribute('disabled', 'true');
                    baselineBtn.innerHTML = '<span class="ehd-spinner"></span> Saving…';
                    try {
                        const id = await window.saveSnapshot(dataJson, {
                            label: 'Baseline ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        });
                        await window.setBaselineSnapshot(id);
                        baselineBtn.innerHTML = 'Pinned ✓';
                        setTimeout(() => { baselineBtn.innerHTML = original; }, 1400);
                        refreshCompareState();
                    } catch (e) {
                        console.error('[NetworkHealthDashboard] save baseline failed:', e);
                        baselineBtn.innerHTML = 'Failed';
                        setTimeout(() => { baselineBtn.innerHTML = original; }, 1400);
                    } finally {
                        baselineBtn.removeAttribute('disabled');
                    }
                });
            }

            if (compareBtn) {
                compareBtn.addEventListener('click', () => {
                    if (compareBtn.hasAttribute('disabled')) return;
                    if (typeof window.openScenarioCompare !== 'function') {
                        console.warn('[NetworkHealthDashboard] openScenarioCompare is not loaded.');
                        return;
                    }
                    Promise.resolve(window.openScenarioCompare(dataJson, resolveLiveGraphForCompare()))
                        .catch((err) => console.error('[NetworkHealthDashboard] compare failed:', err));
                });
            }

            return panel;
        } catch (e) {
            console.error('[NetworkHealthDashboard] failed to render:', e);
            return null;
        }
    }

    function hide() {
        const existing = document.getElementById(PANEL_ID);
        if (existing) existing.remove();
    }

    /* ---------------------------------------------------------------------
     *  Public API
     * ------------------------------------------------------------------- */
    window.showNetworkHealthDashboard = show;
    window.hideNetworkHealthDashboard = hide;
    window.computeNetworkHealthMetrics = computeMetrics; // exposed for testing / future use
})();
