/**
 * Collect ParkController cells for network payload (pandapower station control).
 */

function parseCellStyle(style) {
    if (!style) return null;
    const o = {};
    String(style).split(';').forEach((part) => {
        const i = part.indexOf('=');
        if (i > 0) o[part.slice(0, i)] = part.slice(i + 1);
    });
    return o;
}

function cellAttr(cell, name) {
    if (!cell?.value?.getAttribute) return undefined;
    return cell.value.getAttribute(name);
}

function truthy(v) {
    return v !== false && v !== 'false' && v !== '0' && v !== 0;
}

/**
 * @param {Object} graph
 * @returns {Array<Object>}
 */
export function collectParkControllers(graph) {
    const out = [];
    if (!graph?.getModel) return out;
    const cells = graph.getModel().getDescendants?.() || [];
    for (const cell of cells) {
        const style = parseCellStyle(cell.getStyle?.() || '') || {};
        if (style.shapeELXXX !== 'ParkController') continue;
        const enabled = cellAttr(cell, 'enabled');
        if (enabled != null && !truthy(enabled)) continue;
        out.push({
            typ: 'ParkController',
            name: cellAttr(cell, 'name') || 'ParkController (steady-state)',
            id: cell.mxObjectId || cell.id,
            enabled: true,
            machines_json: cellAttr(cell, 'machines_json') || '[]',
            control_mode: cellAttr(cell, 'control_mode') || 'Voltage Control',
            node_selection: cellAttr(cell, 'node_selection') || 'User Selection',
            uset_mode: cellAttr(cell, 'uset_mode') || 'bus target voltage',
            controlled_bus: cellAttr(cell, 'controlled_bus') || '',
            target_bus: cellAttr(cell, 'target_bus') || '',
            vm_set_pu: cellAttr(cell, 'vm_set_pu') || '1.0',
            enable_droop: cellAttr(cell, 'enable_droop'),
            q_rated_mvar: cellAttr(cell, 'q_rated_mvar') || '0',
            droop_percent: cellAttr(cell, 'droop_percent') || '4',
            q_measured_at: cellAttr(cell, 'q_measured_at') || '',
            q_control_type: cellAttr(cell, 'q_control_type') || 'Const. Q',
            q_set_mvar: cellAttr(cell, 'q_set_mvar') || '0',
            control_q_at: cellAttr(cell, 'control_q_at') || '',
            qv_characteristic_json: cellAttr(cell, 'qv_characteristic_json') || '[]',
            qp_characteristic_json: cellAttr(cell, 'qp_characteristic_json') || '[]',
            pf_control_type: cellAttr(cell, 'pf_control_type') || 'Const. cosphi',
            cos_phi: cellAttr(cell, 'cos_phi') || '1.0',
            cosphi_p_excitation: cellAttr(cell, 'cosphi_p_excitation') || 'Overexcited',
            cosphi_p_oe_characteristic_json:
                cellAttr(cell, 'cosphi_p_oe_characteristic_json') ||
                cellAttr(cell, 'cosphi_p_characteristic_json') ||
                '[]',
            cosphi_p_ue_characteristic_json:
                cellAttr(cell, 'cosphi_p_ue_characteristic_json') ||
                cellAttr(cell, 'cosphi_p_characteristic_json') ||
                '[]',
            cosphi_p_characteristic_json: cellAttr(cell, 'cosphi_p_characteristic_json') || '[]',
            cosphi_v_characteristic_json: cellAttr(cell, 'cosphi_v_characteristic_json') || '[]',
            tan_phi: cellAttr(cell, 'tan_phi') || '0',
            distribution_method: cellAttr(cell, 'distribution_method') || 'According to Rated Power',
            consider_q_dispatch: cellAttr(cell, 'consider_q_dispatch'),
            use_q_capability: cellAttr(cell, 'use_q_capability'),
            q_change_response: cellAttr(cell, 'q_change_response') || 'same'
        });
    }
    return out;
}

if (typeof window !== 'undefined') {
    window.collectParkControllers = collectParkControllers;
}
