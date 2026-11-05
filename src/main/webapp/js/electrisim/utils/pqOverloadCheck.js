/**
 * Overload check for a finished Grid Code P-Q study.
 *
 * Every point of the study (Q max, Q min and the operating point, at each voltage level) already
 * carries its solved load flow, so this only reads the stored line and transformer loading. It
 * runs no load flow and adds nothing to the study time.
 */

export const PQ_OVERLOAD_BRANCHES = [
    { key: 'lines', type: 'Line' },
    { key: 'transformers', type: 'Transformer' },
    { key: 'transformers3W', type: '3-winding transformer' }
];

function _num(v) {
    const n = (v == null || v === '') ? NaN : Number(v);
    return Number.isFinite(n) ? n : NaN;
}

/**
 * Every stored load flow of the study, once each.
 * resolve(vKey, side, p) returns the stored load flow for that point or null.
 * Returns [{ vKey, voltage, side, p, q, pKey, lf }].
 */
export function collectPqScenarios(data, resolve) {
    const out = [];
    (data?.voltage_levels || []).forEach((v) => {
        const vKey = String(parseFloat(v).toFixed(4));
        const curve = data.curves?.[vKey];
        if (!curve) return;
        const pDisp = curve.p_dispatch_mw || [];
        const runs = [
            { side: 'q_max', p: curve.p_max_mw || curve.p_mw || [], q: curve.q_max_mvar || [], disp: pDisp }
        ];
        // With the Park Controller as configured (no STATCOM envelope) both edges hold the same point.
        if (!curve.operating) {
            runs.push({ side: 'q_min', p: curve.p_min_mw || curve.p_mw || [], q: curve.q_min_mvar || [], disp: pDisp });
        }
        if (curve.statcom_envelope && curve.operating_line) {
            runs.push({ side: 'q_op', p: curve.operating_line.p_mw || [], q: curve.operating_line.q_mvar || [], disp: [] });
        }
        runs.forEach((run) => {
            const seen = new Set();
            run.p.forEach((p, i) => {
                let pKey = p;
                let lf = p == null ? null : resolve(vKey, run.side, p);
                if (!lf && run.disp[i] != null) {
                    pKey = run.disp[i];
                    lf = resolve(vKey, run.side, pKey);
                }
                if (!lf) return;
                const dedupe = `${run.side}|${Number(pKey).toFixed(4)}`;
                if (seen.has(dedupe)) return;
                seen.add(dedupe);
                out.push({
                    vKey,
                    voltage: parseFloat(v),
                    side: run.side,
                    p: _num(p),
                    q: _num(run.q[i]),
                    pKey,
                    lf
                });
            });
        });
    });
    return out;
}

/**
 * Lines and transformers above limitPct in each scenario.
 * nameOf(item, type) gives the display name of a result row.
 * Returns {
 *   limitPct, scenarioCount, overloadedScenarioCount,
 *   elements: [{ key, name, type, maxLoading, worst, count }]  (sorted, highest loading first; every element),
 *   cases:    [{ scenario, key, name, type, loading }]          (only the overloaded ones)
 *   byType:   [{ type, count, top }]  every branch type checked, how many, and its most loaded element
 * }
 */
export function findPqOverloads(scenarios, limitPct, nameOf = (item, type) => item?.name || type) {
    const limit = Number(limitPct);
    const elements = new Map();
    const cases = [];
    let overloadedScenarioCount = 0;
    scenarios.forEach((scenario) => {
        let overloaded = false;
        PQ_OVERLOAD_BRANCHES.forEach((src) => {
            const list = scenario.lf?.[src.key];
            if (!Array.isArray(list)) return;
            list.forEach((item) => {
                const loading = _num(item?.loading_percent);
                if (!Number.isFinite(loading)) return;
                const key = `${src.key}|${item.id ?? item.name}`;
                let el = elements.get(key);
                if (!el) {
                    el = { key, name: nameOf(item, src.type), type: src.type, maxLoading: -Infinity, worst: null, count: 0 };
                    elements.set(key, el);
                }
                if (loading > el.maxLoading) {
                    el.maxLoading = loading;
                    el.worst = scenario;
                }
                if (loading > limit) {
                    el.count += 1;
                    overloaded = true;
                    cases.push({ scenario, key, name: el.name, type: src.type, loading });
                }
            });
        });
        if (overloaded) overloadedScenarioCount += 1;
    });
    const sortedElements = [...elements.values()].sort((a, b) => b.maxLoading - a.maxLoading);
    cases.sort((a, b) => b.loading - a.loading);
    const byType = PQ_OVERLOAD_BRANCHES.map((src) => {
        const els = sortedElements.filter((el) => el.type === src.type);
        return { type: src.type, count: els.length, top: els[0] || null };
    }).filter((t) => t.count > 0);
    return {
        limitPct: limit,
        scenarioCount: scenarios.length,
        overloadedScenarioCount,
        elements: sortedElements,
        cases,
        byType
    };
}
