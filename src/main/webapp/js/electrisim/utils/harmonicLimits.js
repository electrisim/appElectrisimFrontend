// harmonicLimits.js - Harmonic voltage limits used to rate Harmonic Analysis results.
//
// IEEE 519-2022, Table 1: one individual-harmonic limit and one THD limit per voltage class.
// IEC: indicative planning levels of IEC TR 61000-3-6 (MV and HV-EHV) and the compatibility
// levels of IEC 61000-2-2 for low voltage; the individual limit depends on the harmonic order.
// The values are a screening aid: the limits that apply to a project are set by the grid
// operator, usually for the point of connection only.

export const HARMONIC_LIMIT_STANDARDS = [
    { value: 'ieee519', label: 'IEEE 519-2022' },
    { value: 'iec61000', label: 'IEC 61000-3-6 planning levels' },
    { value: 'none', label: 'No limit check' }
];

function ieee519(vnKv) {
    let individual;
    let thd;
    let label;
    if (vnKv <= 1) { individual = 5; thd = 8; label = 'V ≤ 1 kV'; }
    else if (vnKv <= 69) { individual = 3; thd = 5; label = '1 kV < V ≤ 69 kV'; }
    else if (vnKv <= 161) { individual = 1.5; thd = 2.5; label = '69 kV < V ≤ 161 kV'; }
    else { individual = 1; thd = 1.5; label = 'V > 161 kV'; }
    return { thd, individual: () => individual, label: `IEEE 519-2022, ${label}` };
}

// [exact orders, formula for the remaining orders up to 50] per harmonic family.
const IEC_LEVELS = {
    lv: {
        thd: 8,
        odd: { 5: 6, 7: 5, 11: 3.5, 13: 3 },
        oddRest: (h) => 2.27 * 17 / h - 0.27,
        triplen: { 3: 5, 9: 1.5, 15: 0.4, 21: 0.3 },
        triplenRest: () => 0.2,
        even: { 2: 2, 4: 1, 6: 0.5, 8: 0.5 },
        evenRest: (h) => 0.25 * 10 / h + 0.25
    },
    mv: {
        thd: 6.5,
        odd: { 5: 5, 7: 4, 11: 3, 13: 2.5 },
        oddRest: (h) => 1.9 * 17 / h - 0.2,
        triplen: { 3: 4, 9: 1.2, 15: 0.3, 21: 0.2 },
        triplenRest: () => 0.2,
        even: { 2: 1.8, 4: 1, 6: 0.5, 8: 0.5 },
        evenRest: (h) => 0.25 * 10 / h + 0.22
    },
    hv: {
        thd: 3,
        odd: { 5: 2, 7: 2, 11: 1.5, 13: 1.5 },
        oddRest: (h) => 1.2 * 17 / h,
        triplen: { 3: 2, 9: 1, 15: 0.3, 21: 0.2 },
        triplenRest: () => 0.2,
        even: { 2: 1.4, 4: 0.8, 6: 0.4, 8: 0.4 },
        evenRest: (h) => 0.19 * 10 / h + 0.16
    }
};

function iec61000(vnKv) {
    const key = vnKv <= 1 ? 'lv' : (vnKv <= 35 ? 'mv' : 'hv');
    const level = IEC_LEVELS[key];
    const label = key === 'lv'
        ? 'IEC 61000-2-2 compatibility levels, LV'
        : `IEC 61000-3-6 planning levels, ${key === 'mv' ? 'MV (1-35 kV)' : 'HV-EHV (> 35 kV)'}`;
    const individual = (order) => {
        const h = Math.round(Number(order));
        if (!Number.isFinite(h) || h < 2) return null;
        if (h % 2 === 0) return h in level.even ? level.even[h] : level.evenRest(h);
        if (h % 3 === 0) return h in level.triplen ? level.triplen[h] : level.triplenRest(h);
        return h in level.odd ? level.odd[h] : level.oddRest(h);
    };
    return { thd: level.thd, individual, label };
}

/**
 * Limits for a bus of nominal voltage vnKv (line-to-line kV).
 * @returns {{thd:number, individual:(order:number)=>number|null, label:string}|null} null = no check
 */
export function harmonicVoltageLimits(standard, vnKv) {
    const vn = Number(vnKv);
    if (!Number.isFinite(vn) || vn <= 0) return null;
    if (standard === 'ieee519') return ieee519(vn);
    if (standard === 'iec61000') return iec61000(vn);
    return null;
}

/**
 * Rate one bus. percents: [{order, pct}] individual harmonic voltages in % of the fundamental.
 * @returns {{status:'ok'|'over'|'none', thdLimit:number|null, worst:{order:number,pct:number,limit:number}|null,
 *            thdOver:boolean, overOrders:number[]}}
 */
export function rateBusHarmonics(standard, vnKv, thdPercent, percents) {
    const limits = harmonicVoltageLimits(standard, vnKv);
    if (!limits) return { status: 'none', thdLimit: null, worst: null, thdOver: false, overOrders: [], label: '' };
    let worst = null;
    const overOrders = [];
    (percents || []).forEach(({ order, pct }) => {
        const limit = limits.individual(order);
        if (limit == null || !Number.isFinite(pct)) return;
        if (pct > limit) overOrders.push(order);
        const ratio = pct / limit;
        if (!worst || ratio > worst.ratio) worst = { order, pct, limit, ratio };
    });
    const thdOver = Number(thdPercent) > limits.thd;
    return {
        status: thdOver || overOrders.length ? 'over' : 'ok',
        thdLimit: limits.thd,
        worst,
        thdOver,
        overOrders,
        label: limits.label
    };
}

if (typeof window !== 'undefined') {
    window.harmonicVoltageLimits = harmonicVoltageLimits;
}
