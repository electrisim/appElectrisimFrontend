/**
 * Apply electrisim_import_sidecar from pandapower JSON import onto diagram cells.
 */
function parseSidecar(modelData) {
    try {
        const raw = modelData?._object?.electrisim_import_sidecar?._object;
        if (!raw) return null;
        return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
        console.warn('Failed to parse electrisim_import_sidecar', e);
        return null;
    }
}

function cellElementName(cell) {
    try {
        const v = cell?.value;
        if (!v?.attributes) return null;
        for (let i = 0; i < v.attributes.length; i++) {
            const a = v.attributes[i];
            if (a.nodeName === 'name' && a.nodeValue) return String(a.nodeValue).trim();
        }
        if (v.attributes[0]?.nodeValue) return String(v.attributes[0].nodeValue).trim();
    } catch (e) { /* ignore */ }
    return null;
}

function setAttr(cell, key, val) {
    if (val == null || val === '') return;
    try {
        const v = cell.value;
        if (!v?.setAttribute) return;
        v.setAttribute(key, String(val));
    } catch (e) { /* ignore */ }
}

export function applyElectrisimImportSidecar(graph, modelData) {
    const sidecar = parseSidecar(modelData);
    if (!sidecar || !graph) return;

    const ufnRaw = modelData?._object?.user_friendly_names?._object;
    let ufn = {};
    try {
        ufn = typeof ufnRaw === 'string' ? JSON.parse(ufnRaw) : (ufnRaw || {});
    } catch (e) { ufn = {}; }

    const model = graph.getModel();
    const root = model.getRoot();
    const cells = model.getDescendants(root) || [];

    for (const cell of cells) {
        if (!cell || !cell.value) continue;
        const nm = cellElementName(cell);
        const ppName = cell.value.getAttribute?.('pp_element_name') || cell.value.getAttribute?.('pp_bus_name') || '';
        const keys = [ppName, nm].filter(Boolean);
        if (!keys.length) continue;
        const pick = (bag) => {
            if (!bag) return null;
            for (let i = 0; i < keys.length; i++) if (bag[keys[i]]) return bag[keys[i]];
            return null;
        };
        const style = cell.getStyle?.() || '';
        const isSwitch = style.includes('sym-switch') || style.includes('Switch');
        const objName = cell.value.getAttribute?.('name') || '';

        const sw = pick(sidecar.switch);
        if (sw && (isSwitch || objName === 'Switch')) {
            const s = sw;
            setAttr(cell, 'interrupting_rating_ka', s.interrupting_rating_ka);
            setAttr(cell, 'momentary_rating_ka', s.momentary_rating_ka);
            setAttr(cell, 'in_ka', s.in_ka);
            setAttr(cell, 'type', s.type);
            setAttr(cell, 'ansi_device_class', s.ansi_device_class);
        }
        const gen = pick(sidecar.gen);
        if (gen && (objName === 'Generator' || style.includes('Generator'))) {
            const g = gen;
            setAttr(cell, 'vn_kv', g.vn_kv);
            setAttr(cell, 'xdss_pu', g.xdss_pu);
            setAttr(cell, 'rdss_ohm', g.rdss_ohm ?? g.rdss_pu);
        }
        const sgRow = pick(sidecar.sgen);
        if (sgRow && (objName === 'Static Generator' || objName === 'Wind Turbine' || style.includes('wind'))) {
            const sg = sgRow;
            setAttr(cell, 'generator_type', sg.generator_type);
            setAttr(cell, 'max_ik_ka', sg.max_ik_ka);
            setAttr(cell, 'rx', sg.rx);
            setAttr(cell, 'k', sg.k);
            setAttr(cell, 'current_source', sg.current_source);
            setAttr(cell, 'lrc_pu', sg.lrc_pu);
        }
        const stRow = pick(sidecar.storage);
        if (stRow && (objName === 'Storage' || objName.includes('Storage'))) {
            const st = stRow;
            setAttr(cell, 'max_ik_ka', st.max_ik_ka);
            setAttr(cell, 'rx', st.rx);
            setAttr(cell, 'current_source', st.current_source);
        }
        const trRow = pick(sidecar.trafo);
        if (trRow && (objName === 'Transformer' || style.includes('Transformer'))) {
            const tr = trRow;
            setAttr(cell, 'vector_group', tr.vector_group);
            setAttr(cell, 'vk0_percent', tr.vk0_percent);
            setAttr(cell, 'vkr0_percent', tr.vkr0_percent);
            setAttr(cell, 'rn_ohm', tr.rn_ohm);
            setAttr(cell, 'xn_ohm', tr.xn_ohm);
        }
        for (let ui = 0; ui < keys.length; ui++) {
            if (ufn[keys[ui]]) {
                setAttr(cell, 'userFriendlyName', ufn[keys[ui]]);
                break;
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.applyElectrisimImportSidecar = applyElectrisimImportSidecar;
}
