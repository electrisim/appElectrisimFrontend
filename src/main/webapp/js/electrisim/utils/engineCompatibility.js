/**
 * Engine compatibility: elements supported only by Pandapower or only by OpenDSS.
 * Used to warn the user when the selected calculation engine will exclude some elements.
 */

// Pandapower-only: supported by Pandapower load flow / short circuit; excluded when using OpenDSS
// Order matters: longer names first so "B2B VSC" matches before "VSC"
const PANDAPOWER_ONLY_TYP_PREFIXES = [
    'B2B VSC',
    'DC Line',
    'DC Bus',
    'Load DC',
    'Source DC',
    'SVC',
    'TCSC',
    'SSC',
    'Switch',
    'VSC'
];

// Display names for UI (match the "Elements supported exclusively" list)
const PANDAPOWER_ONLY_DISPLAY_NAMES = {
    'SVC': 'SVC',
    'TCSC': 'TCSC',
    'SSC': 'SSC',
    'DC Line': 'DC Line',
    'DC Bus': 'DC Bus',
    'Load DC': 'Load DC',
    'Source DC': 'Source DC',
    'Switch': 'Switch',
    'VSC': 'VSC',
    'B2B VSC': 'B2B VSC'
};

// OpenDSS-only: supported by OpenDSS; excluded when using Pandapower
const OPENDSS_ONLY_TYP_PREFIXES = ['PVSystem'];
const OPENDSS_ONLY_DISPLAY_NAMES = { 'PVSystem': 'PVSystem' };

function typMatchesPrefix(typ, prefixes) {
    if (!typ || typeof typ !== 'string') return false;
    const t = typ.trim();
    for (const p of prefixes) {
        if (t === p || t.startsWith(p)) return p;
    }
    return false;
}

/**
 * Given network data (array of objects with at least .typ) and engine ('pandapower' | 'opendss'),
 * returns { incompatible: [{ typ, displayName }], message } for elements that will NOT be included
 * in the calculation for the selected engine.
 * @param {Array<{ typ: string, userFriendlyName?: string }>} networkData - Collected network elements
 * @param {'pandapower'|'opendss'} engine
 * @returns {{ incompatible: Array<{ typ: string, displayName: string }>, message: string|null }}
 */
export function getIncompatibleElements(networkData, engine) {
    const incompatible = [];
    if (!Array.isArray(networkData)) return { incompatible, message: null };

    for (const item of networkData) {
        const typ = item && item.typ;
        if (!typ) continue;
        // Skip parameter objects
        if (typ.includes('Parameters')) continue;

        if (engine === 'opendss') {
            const prefix = typMatchesPrefix(typ, PANDAPOWER_ONLY_TYP_PREFIXES);
            if (prefix) {
                const displayName = PANDAPOWER_ONLY_DISPLAY_NAMES[prefix] || prefix;
                incompatible.push({ typ, displayName, name: item.userFriendlyName || item.name });
            }
        } else if (engine === 'pandapower') {
            const prefix = typMatchesPrefix(typ, OPENDSS_ONLY_TYP_PREFIXES);
            if (prefix) {
                const displayName = OPENDSS_ONLY_DISPLAY_NAMES[prefix] || prefix;
                incompatible.push({ typ, displayName, name: item.userFriendlyName || item.name });
            }
        }
    }

    let message = null;
    if (incompatible.length > 0) {
        const displayNames = [...new Set(incompatible.map(i => i.displayName))];
        if (engine === 'opendss') {
            message = 'The following elements are supported only by Pandapower and will not be included in the OpenDSS calculation: ' +
                displayNames.join(', ') + '.';
        } else {
            message = 'The following elements are supported only by OpenDSS and will not be included in the Pandapower calculation: ' +
                displayNames.join(', ') + '.';
        }
    }
    return { incompatible, message };
}
