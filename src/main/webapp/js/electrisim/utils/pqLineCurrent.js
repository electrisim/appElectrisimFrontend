/**
 * Line currents over every load flow of a Grid Code P-Q or U-Q study.
 *
 * Each stored point (Q max, Q min and the operating point, at each PCC voltage) already holds
 * its solved load flow, so this only reads line currents from those snapshots. No load flow runs.
 */

function _num(v) {
    const n = (v == null || v === '') ? NaN : Number(v);
    return Number.isFinite(n) ? n : NaN;
}

/** Current of a line row in amperes: the larger of the two ends. */
export function lineCurrentA(row) {
    const a = _num(row?.i_from_ka);
    const b = _num(row?.i_to_ka);
    const ka = Math.max(Number.isFinite(a) ? a : -Infinity, Number.isFinite(b) ? b : -Infinity);
    return Number.isFinite(ka) ? ka * 1000 : NaN;
}

/**
 * scenarios: from collectPqScenarios (each { vKey, voltage, side, p, q, pKey, lf }).
 * nameOf(row): display name of a line row.
 * Returns lines sorted by highest current:
 *   [{ key, name, maxA, maxLoading, worst, samples: [{ scenario, currentA, loading }] }]
 */
export function collectLineCurrents(scenarios, nameOf = (row) => row?.name || 'Line') {
    const lines = new Map();
    (scenarios || []).forEach((scenario) => {
        const rows = scenario.lf?.lines;
        if (!Array.isArray(rows)) return;
        rows.forEach((row) => {
            const currentA = lineCurrentA(row);
            if (!Number.isFinite(currentA)) return;
            const key = String(row.id ?? row.name);
            let line = lines.get(key);
            if (!line) {
                line = { key, name: nameOf(row), maxA: -Infinity, maxLoading: NaN, worst: null, samples: [] };
                lines.set(key, line);
            }
            const loading = _num(row.loading_percent);
            line.samples.push({ scenario, currentA, loading });
            if (currentA > line.maxA) {
                line.maxA = currentA;
                line.maxLoading = loading;
                line.worst = scenario;
            }
        });
    });
    return [...lines.values()].sort((a, b) => b.maxA - a.maxA);
}
