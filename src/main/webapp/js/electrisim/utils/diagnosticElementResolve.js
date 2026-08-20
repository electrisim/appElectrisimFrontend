/**
 * Resolve pandapower diagnostic indices to frontend element names/ids.
 * Mirrors backend create_busbars / create_other_elements ordering so index-only
 * diagnostic payloads (from older backends) can still be named and highlighted.
 */

function rowRef(row, index) {
    const id = row && row.name != null ? String(row.name) : String(index);
    const name = row && row.userFriendlyName != null && String(row.userFriendlyName).trim() !== ''
        ? String(row.userFriendlyName)
        : id;
    return { index, id, name };
}

function payloadKeysInOrder(payload) {
    if (!payload || typeof payload !== 'object') return [];
    return Object.keys(payload);
}

function creationOrderKey(payload, key, keyPos) {
    const row = payload[key];
    if (!row || typeof row !== 'object') return [1, keyPos];
    const typ = String(row.typ || '');
    if (typ.startsWith('Switch')) return [2, keyPos];
    if (typ.startsWith('Line')) return [0, keyPos];
    return [1, keyPos];
}

function isAcBusTyp(typ) {
    const t = String(typ || '');
    return t.includes('Bus') && !t.includes('DC Bus');
}

function isSgenTyp(typ) {
    const t = String(typ || '');
    return t.startsWith('Static Generator') || t.startsWith('Wind Turbine');
}

function isTrafoTyp(typ) {
    const t = String(typ || '');
    return (t.startsWith('Transformer') || t.startsWith('Two Winding Transformer'))
        && !t.startsWith('Three Winding Transformer');
}

/**
 * Build arrays indexed by pandapower element index for common element types.
 * @param {object} payload - load-flow request object (numeric string keys)
 */
export function buildPandapowerIndexMaps(payload) {
    const maps = {
        buses: [],
        lines: [],
        trafos: [],
        sgens: [],
        loads: [],
        generators: [],
        trafos3w: [],
    };
    if (!payload || typeof payload !== 'object') return maps;

    const keys = payloadKeysInOrder(payload);
    const keyPos = {};
    keys.forEach((k, i) => { keyPos[k] = i; });

    // Buses: create_busbars iterates payload in insertion order
    keys.forEach((k) => {
        const row = payload[k];
        if (!row || typeof row !== 'object') return;
        if (isAcBusTyp(row.typ)) {
            maps.buses.push(rowRef(row, maps.buses.length));
        }
    });

    // Other elements: create_other_elements uses Line → other → Switch ordering
    const ordered = [...keys].sort((a, b) => {
        const ka = creationOrderKey(payload, a, keyPos[a] || 0);
        const kb = creationOrderKey(payload, b, keyPos[b] || 0);
        return ka[0] - kb[0] || ka[1] - kb[1];
    });

    ordered.forEach((k) => {
        const row = payload[k];
        if (!row || typeof row !== 'object') return;
        const typ = String(row.typ || '');
        if (typ.startsWith('Line')) {
            maps.lines.push(rowRef(row, maps.lines.length));
        } else if (isTrafoTyp(typ)) {
            maps.trafos.push(rowRef(row, maps.trafos.length));
        } else if (typ.startsWith('Three Winding Transformer')) {
            maps.trafos3w.push(rowRef(row, maps.trafos3w.length));
        } else if (isSgenTyp(typ)) {
            maps.sgens.push(rowRef(row, maps.sgens.length));
        } else if (typ.startsWith('Load') && !typ.startsWith('Load DC') && !typ.startsWith('Asymmetric')) {
            maps.loads.push(rowRef(row, maps.loads.length));
        } else if (typ.startsWith('Generator') && !typ.startsWith('Static')) {
            maps.generators.push(rowRef(row, maps.generators.length));
        }
    });

    return maps;
}

function extractIndex(item) {
    if (item == null) return null;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (typeof item === 'object') {
        if (item.index != null && Number.isFinite(Number(item.index))) return Number(item.index);
        // Already enriched with a real mxCell / display name — keep as-is
        if (item.id != null && /mxCell[_#]/i.test(String(item.id))) return null;
        if (item.name != null && !/^\d+$/.test(String(item.name))) return null;
        if (item.id != null && /^\d+$/.test(String(item.id))) return Number(item.id);
        if (item.name != null && /^\d+$/.test(String(item.name))) return Number(item.name);
    }
    const s = String(item).trim();
    if (/^\d+$/.test(s)) return Number(s);
    return null;
}

function looksAlreadyNamed(item) {
    if (!item || typeof item !== 'object') return false;
    const id = item.id != null ? String(item.id) : '';
    const name = item.name != null ? String(item.name) : '';
    if (/mxCell[_#]/i.test(id) || /mxCell[_#]/i.test(name)) return true;
    if (name && !/^\d+$/.test(name) && name !== id) return true;
    if (name && !/^\d+$/.test(name) && !/^(bus|line|trafo|sgen|load|gen)_?\d+$/i.test(name)) return true;
    return false;
}

function resolveList(list, mapArr) {
    if (!Array.isArray(list)) return list;
    return list.map((item) => {
        if (looksAlreadyNamed(item)) return item;
        const idx = extractIndex(item);
        if (idx == null || !mapArr || !mapArr[idx]) {
            if (item && typeof item === 'object') return item;
            return { index: idx != null ? idx : item, id: String(item), name: String(item) };
        }
        return { ...mapArr[idx] };
    });
}

/**
 * Enrich diagnostic disconnected/isolated lists with frontend id/name.
 * Mutates and returns diagnostic.
 */
export function enrichDiagnosticElementNames(diagnostic, payloadOrMaps) {
    if (!diagnostic || typeof diagnostic !== 'object') return diagnostic;
    const maps = payloadOrMaps && payloadOrMaps.buses
        ? payloadOrMaps
        : buildPandapowerIndexMaps(payloadOrMaps);

    if (diagnostic.disconnected_elements && typeof diagnostic.disconnected_elements === 'object') {
        const d = diagnostic.disconnected_elements;
        if (d.buses) d.buses = resolveList(d.buses, maps.buses);
        if (d.lines) d.lines = resolveList(d.lines, maps.lines);
        if (d.trafos) d.trafos = resolveList(d.trafos, maps.trafos);
        if (d.sgens) d.sgens = resolveList(d.sgens, maps.sgens);
        if (d.loads) d.loads = resolveList(d.loads, maps.loads);
        if (d.generators) d.generators = resolveList(d.generators, maps.generators);
    }

    if (Array.isArray(diagnostic.isolated_buses)) {
        diagnostic.isolated_buses = resolveList(diagnostic.isolated_buses, maps.buses);
    }

    return diagnostic;
}

/**
 * Rewrite exception / detail strings that still contain raw indices or np.int64(...).
 */
export function humanizeDiagnosticException(exceptionText, diagnostic) {
    if (exceptionText == null || exceptionText === '') return exceptionText;
    let text = String(exceptionText);

    // np.int64(8) → 8
    text = text.replace(/np\.(?:int64|int32|int16|float64|float32)\((\d+)\)/g, '$1');

    const buses = diagnostic && Array.isArray(diagnostic.isolated_buses)
        ? diagnostic.isolated_buses
        : (diagnostic && diagnostic.disconnected_elements && diagnostic.disconnected_elements.buses) || [];

    if (buses.length) {
        const names = buses.map((b) => (b && typeof b === 'object' ? (b.name || b.id) : b)).filter(Boolean);
        if (names.length) {
            text = text.replace(
                /Isolated buses found:\s*\{[^}]*\}/i,
                `Isolated buses found: ${names.join(', ')}`
            );
            text = text.replace(
                /Isolated buses found:\s*\[[^\]]*\]/i,
                `Isolated buses found: ${names.join(', ')}`
            );
        }
    }

    return text;
}

/**
 * Collect highlight identifiers from an enriched diagnostic (skip bare numeric indices).
 */
export function collectDiagnosticHighlightIds(diagnostic) {
    const ids = [];
    const push = (item) => {
        if (item == null) return;
        if (typeof item === 'object') {
            const id = item.id != null ? String(item.id).trim() : '';
            const name = item.name != null ? String(item.name).trim() : '';
            // Never highlight bare integers — they collide with mxGraph cell ids
            if (id && !/^\d+$/.test(id)) ids.push(id);
            if (name && !/^\d+$/.test(name) && name !== id) ids.push(name);
            return;
        }
        const s = String(item).trim();
        if (s && !/^\d+$/.test(s)) ids.push(s);
    };

    const data = diagnostic || {};
    if (data.disconnected_elements && typeof data.disconnected_elements === 'object') {
        Object.keys(data.disconnected_elements).forEach((k) => {
            const list = data.disconnected_elements[k];
            if (Array.isArray(list)) list.forEach(push);
        });
    }
    if (Array.isArray(data.isolated_buses)) data.isolated_buses.forEach(push);
    return ids;
}

if (typeof window !== 'undefined') {
    window.buildPandapowerIndexMaps = buildPandapowerIndexMaps;
    window.enrichDiagnosticElementNames = enrichDiagnosticElementNames;
    window.humanizeDiagnosticException = humanizeDiagnosticException;
    window.collectDiagnosticHighlightIds = collectDiagnosticHighlightIds;
}
