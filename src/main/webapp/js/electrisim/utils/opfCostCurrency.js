/**
 * OPF marginal-cost label currencies (numeric coefficients are passed to pandapower unchanged).
 */
export const OPF_COST_CURRENCY_OPTIONS = [
    { code: 'EUR', symbol: '€', label: 'EUR (€)' },
    { code: 'USD', symbol: '$', label: 'USD ($)' },
    { code: 'GBP', symbol: '£', label: 'GBP (£)' },
    { code: 'CHF', symbol: 'CHF', label: 'CHF' },
    { code: 'PLN', symbol: 'zł', label: 'PLN (zł)' },
    { code: 'SEK', symbol: 'kr', label: 'SEK (kr)' },
    { code: 'NOK', symbol: 'kr', label: 'NOK (kr)' },
    { code: 'DKK', symbol: 'kr', label: 'DKK (kr)' },
    { code: 'JPY', symbol: '¥', label: 'JPY (¥)' },
    { code: 'CNY', symbol: '¥', label: 'CNY (¥)' },
    { code: 'INR', symbol: '₹', label: 'INR (₹)' },
    { code: 'AUD', symbol: 'A$', label: 'AUD (A$)' },
    { code: 'CAD', symbol: 'C$', label: 'CAD (C$)' },
    { code: 'OTHER', symbol: '', label: 'Other / unitless' },
];

export function opfCostCurrencySymbol(code) {
    const hit = OPF_COST_CURRENCY_OPTIONS.find((c) => c.code === code);
    if (!hit || hit.code === 'OTHER') return '';
    return hit.symbol || hit.code;
}

/**
 * Single study-level label for backend metadata: first non-empty opf_cost_currency
 * on generators, external grids, storage, static generators, loads, then DC lines; default EUR.
 */
export function resolveStudyOpfCostCurrency(componentArrays) {
    const tryRow = (row) => {
        if (!row || row.opf_cost_currency == null) return null;
        const s = String(row.opf_cost_currency).trim();
        return s || null;
    };
    for (const g of componentArrays.generator || []) {
        const v = tryRow(g);
        if (v) return v;
    }
    for (const eg of componentArrays.externalGrid || []) {
        const v = tryRow(eg);
        if (v) return v;
    }
    for (const st of componentArrays.storage || []) {
        const v = tryRow(st);
        if (v) return v;
    }
    for (const sg of componentArrays.staticGenerator || []) {
        const v = tryRow(sg);
        if (v) return v;
    }
    for (const ld of componentArrays.load || []) {
        const v = tryRow(ld);
        if (v) return v;
    }
    for (const dc of componentArrays.dcLine || []) {
        const v = tryRow(dc);
        if (v) return v;
    }
    return 'EUR';
}
