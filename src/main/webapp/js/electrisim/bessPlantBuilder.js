/**
 * Build or update a utility-scale HV-connected BESS plant on the canvas.
 * Topology: External Grid → POC (HV) → HV/MV OLTC transformer → MV bus
 *   → aux load + N× (MV cable → MV/LV transformer → LV bus → Storage/PCS)
 */
import {
    configureExternalGridAttributes,
    configureBusAttributes,
    configureTransformerAttributes,
    configureLineAttributes,
    configureLoadAttributes,
    configureStorageAttributes,
} from './configureAttributes.js';
import {
    vertexStyleFromElectrisimSymbol,
    vertexSizeFromElectrisimSymbol,
} from './electricalSymbols.js';

const BUS_W = 88;
const BUS_H = 10;
const COL_SPACING = 220;
const ROW_SPACING = 110;
const COMP_GAP = 28;

const BUS_STYLE = vertexStyleFromElectrisimSymbol('sym-bus', 'Bus');
const EXT_GRID_STYLE = vertexStyleFromElectrisimSymbol('sym-ext-grid', 'External Grid');
const TRAFO_V_STYLE = vertexStyleFromElectrisimSymbol('sym-transformer-v', 'Transformer');
const TRAFO_H_STYLE = vertexStyleFromElectrisimSymbol('sym-transformer', 'Transformer');
const LOAD_STYLE = vertexStyleFromElectrisimSymbol('sym-load', 'Load');
const STORAGE_STYLE = vertexStyleFromElectrisimSymbol('sym-storage', 'Storage');

const NOT_EDITABLE_LINE =
    'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;shapeELXXX=NotEditableLine';
const LINE_STYLE =
    'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;shapeELXXX=Line';

function tagRole(graph, cell, role) {
    if (!cell?.value?.setAttribute) return;
    cell.value.setAttribute('bessPlantRole', role);
}

function setCellAttr(graph, cell, name, value) {
    if (!cell?.value?.setAttribute) return;
    cell.value.setAttribute(name, String(value));
}

function getCellRole(cell) {
    try {
        return cell?.value?.getAttribute?.('bessPlantRole') || null;
    } catch {
        return null;
    }
}

function findPlantCells(graph) {
    const byRole = {};
    const model = graph.getModel();
    (model.getDescendants?.() || []).forEach((cell) => {
        const role = getCellRole(cell);
        if (!role) return;
        if (role.startsWith('cable_') || role.startsWith('lvTrafo_') || role.startsWith('lvBus_') || role.startsWith('storage_') || role.startsWith('stringBus_')) {
            const base = role.replace(/_\d+$/, '');
            if (!byRole[base]) byRole[base] = [];
            byRole[base].push(cell);
            byRole[role] = cell;
        } else {
            byRole[role] = cell;
        }
    });
    return byRole;
}

function removePlantCells(graph, cells) {
    if (!cells?.length) return;
    graph.getModel().beginUpdate();
    try {
        graph.removeCells(cells.filter(Boolean), true);
    } finally {
        graph.getModel().endUpdate();
    }
}

function symWh(symbolKey, fw = 56, fh = 56) {
    const [w, h] = vertexSizeFromElectrisimSymbol(symbolKey, fw, fh);
    return [w, h];
}

function insertBus(graph, parent, x, y, name, vnKv, role) {
    const v = graph.insertVertex(parent, null, '', x, y, BUS_W, BUS_H, BUS_STYLE);
    configureBusAttributes(graph, v, { name, vn_kv: String(vnKv) });
    tagRole(graph, v, role);
    return v;
}

function connect(graph, parent, source, target, style = NOT_EDITABLE_LINE) {
    return graph.insertEdge(parent, null, '', source, target, style);
}

function insertCable(graph, parent, fromBus, toBus, opts, role) {
    const geoFrom = graph.getCellGeometry(fromBus);
    const geoTo = graph.getCellGeometry(toBus);
    const mx = (geoFrom.x + geoTo.x) / 2;
    const my = (geoFrom.y + geoTo.y) / 2;
    const edge = graph.insertEdge(parent, null, opts.name || 'Cable', fromBus, toBus, LINE_STYLE);
    configureLineAttributes(graph, edge, {
        name: opts.name || 'Cable',
        from_bus: opts.from_bus || '',
        to_bus: opts.to_bus || '',
        length_km: String(opts.length_km ?? 0.5),
        r_ohm_per_km: String(opts.r_ohm_per_km ?? 0.08),
        x_ohm_per_km: String(opts.x_ohm_per_km ?? 0.12),
        c_nf_per_km: String(opts.c_nf_per_km ?? 0),
        max_i_ka: String(opts.max_i_ka ?? 1),
        max_loading_percent: String(opts.max_loading_percent ?? 100),
    });
    tagRole(graph, edge, role);
    return edge;
}

function insertTrafo(graph, parent, x, y, opts, role, vertical = true) {
    const style = vertical ? TRAFO_V_STYLE : TRAFO_H_STYLE;
    const sym = vertical ? 'sym-transformer-v' : 'sym-transformer';
    const [tw, th] = symWh(sym, 72, 108);
    const v = graph.insertVertex(parent, null, '', x - tw / 2, y, tw, th, style);
    configureTransformerAttributes(graph, v, {
        name: opts.name || 'Transformer',
        sn_mva: String(opts.sn_mva ?? 10),
        vn_hv_kv: String(opts.vn_hv_kv ?? 33),
        vn_lv_kv: String(opts.vn_lv_kv ?? 0.69),
        vk_percent: String(opts.vk_percent ?? 10),
        vkr_percent: String(opts.vkr_percent ?? 0.5),
        pfe_kw: String(opts.pfe_kw ?? 10),
        i0_percent: String(opts.i0_percent ?? 0.1),
        tap_side: opts.tap_side || 'hv',
        tap_pos: String(opts.tap_pos ?? 0),
        tap_neutral: String(opts.tap_neutral ?? 0),
        tap_min: String(opts.tap_min ?? 0),
        tap_max: String(opts.tap_max ?? 0),
        tap_step_percent: String(opts.tap_step_percent ?? 0),
        discrete_tap_control: opts.discrete_tap_control ? 'true' : 'false',
        vm_lower_pu: String(opts.vm_lower_pu ?? 0.99),
        vm_upper_pu: String(opts.vm_upper_pu ?? 1.01),
        control_side: opts.control_side || 'lv',
        tap_changer_type: opts.tap_changer_type || 'Ratio',
        max_loading_percent: String(opts.max_loading_percent ?? 100),
    });
    tagRole(graph, v, role);
    if (opts.discrete_tap_control) {
        setCellAttr(graph, v, 'discrete_tap_control', 'true');
        setCellAttr(graph, v, 'vm_lower_pu', opts.vm_lower_pu ?? 0.99);
        setCellAttr(graph, v, 'vm_upper_pu', opts.vm_upper_pu ?? 1.01);
                setCellAttr(graph, v, 'control_side', opts.control_side || 'lv');
                setCellAttr(graph, v, 'tap_changer_type', opts.tap_changer_type || 'Ratio');
    }
    return v;
}

function storageNameplate(params, suggested, storName) {
    const sn = Number(params.storageSnMva ?? suggested.storageSnMva) || 15;
    const pDis = Math.abs(Number(params.pMaxDischarge_MW ?? suggested.storagePMaxMw) || 0);
    const pChg = Math.abs(Number(params.pMaxCharge_MW ?? suggested.storagePMaxMw) || 0);
    const pAbs = Math.max(pDis, pChg);
    const qMax = Math.sqrt(Math.max(0, sn * sn - pAbs * pAbs));
    const hours = Number(params.durationHours);
    const maxE = Number(params.maxE_mwh);
    return {
        name: storName,
        p_mw: 0,
        q_mvar: 0,
        sn_mva: sn,
        max_p_mw: pChg,
        min_p_mw: -pDis,
        max_q_mvar: qMax,
        min_q_mvar: -qMax,
        max_e_mwh: Number.isFinite(maxE) && maxE > 0
            ? maxE
            : (Number.isFinite(hours) && hours > 0 ? hours * pDis : 2 * pDis),
        reactive_capability_curve: params.useQCurve === true,
    };
}

function insertStorage(graph, parent, bus, opts, role) {
    const [sw, sh] = symWh('sym-storage', 54, 54);
    const bg = graph.getCellGeometry(bus);
    const cx = bg.x + bg.width / 2 - sw / 2;
    const cy = bg.y + bg.height + COMP_GAP;
    const v = graph.insertVertex(parent, null, '', cx, cy, sw, sh, STORAGE_STYLE);
    configureStorageAttributes(graph, v, {
        name: opts.name || 'Storage',
        p_mw: String(opts.p_mw ?? 0),
        q_mvar: String(opts.q_mvar ?? 0),
        sn_mva: String(opts.sn_mva ?? opts.p_max_mw ?? 5),
        max_p_mw: opts.max_p_mw ?? 0,
        min_p_mw: opts.min_p_mw ?? 0,
        max_q_mvar: opts.max_q_mvar ?? 0,
        min_q_mvar: opts.min_q_mvar ?? 0,
        max_e_mwh: String(opts.max_e_mwh ?? 0),
        reactive_capability_curve: opts.reactive_capability_curve ?? false,
        q_capability_curve_json: opts.q_capability_curve_json,
    });
    connect(graph, parent, v, bus);
    tagRole(graph, v, role);
    return v;
}

function insertAuxLoad(graph, parent, bus, opts, role) {
    const [lw, lh] = symWh('sym-load', 50, 64);
    const bg = graph.getCellGeometry(bus);
    const cx = bg.x + bg.width + 40;
    const cy = bg.y + bg.height / 2 - lh / 2;
    const v = graph.insertVertex(parent, null, '', cx, cy, lw, lh, LOAD_STYLE);
    configureLoadAttributes(graph, v, {
        name: opts.name || 'Aux_Load',
        p_mw: String(opts.p_mw ?? 0.5),
        q_mvar: String(opts.q_mvar ?? 0),
        sn_mva: String(opts.sn_mva ?? 1),
    });
    connect(graph, parent, v, bus);
    tagRole(graph, v, role);
    return v;
}

/**
 * Compute suggested ratings from POC P/Q and topology inputs.
 */
export function computeSuggestedRatings(params) {
    const p = Math.abs(Number(params.pocP_MW) || 0);
    const q = Math.abs(Number(params.pocQ_Mvar) || 0);
    const pf = Number(params.powerFactor);
    const sPoc = pf > 0 && pf <= 1 ? p / pf : Math.hypot(p, q);
    const n = Math.max(1, parseInt(params.numUnits, 10) || 1);
    const aux = Number(params.auxP_MW) || 0;
    const margin = 1.05;
    const plantMva = sPoc * margin + aux;
    const unitP = (p * margin) / n;
    const unitSn = Math.max(unitP, Math.hypot(unitP, q / n)) * 1.1;
    return {
        hvTrafoSnMva: Math.ceil(plantMva * 10) / 10,
        stringTrafoSnMva: Math.ceil(unitSn * 10) / 10,
        storageSnMva: Math.ceil(unitSn * 10) / 10,
        storagePMaxMw: Math.ceil(unitP * 100) / 100,
        cableMaxIKa: Math.ceil((unitSn / (Math.sqrt(3) * (Number(params.mvVoltage_kV) || 33))) * 100) / 100,
    };
}

/**
 * @param {mxGraph} graph
 * @param {Object} params - wizard inputs
 * @returns {{ created: boolean, cellIds: Object }}
 */
export function buildOrUpdateBessPlant(graph, params) {
    if (!graph) throw new Error('Graph not available');
    const parent = graph.getDefaultParent();
    const existing = findPlantCells(graph);
    const nUnits = Math.max(1, Math.min(20, parseInt(params.numUnits, 10) || 1));
    const suggested = computeSuggestedRatings(params);

    const hvKv = Number(params.hvVoltage_kV) || 132;
    const mvKv = Number(params.mvVoltage_kV) || 33;
    const lvKv = Number(params.lvVoltage_kV) || 0.69;
    const centerX = Number(params.layoutCenterX) || 420;
    let y = Number(params.layoutStartY) || 60;

    graph.getModel().beginUpdate();
    try {
        // Remove extra strings if unit count decreased
        for (let i = nUnits; i < 20; i++) {
            const toRemove = ['stringBus_', 'cable_', 'lvTrafo_', 'lvBus_', 'storage_'].flatMap((prefix) => {
                const c = existing[`${prefix}${i}`];
                return c ? [c] : [];
            });
            removePlantCells(graph, toRemove);
        }

        const pocName = params.pocBusName || 'POC_HV';
        const mvBusName = params.mvBusName || 'MV_Collection';
        const extName = params.extGridName || 'Grid';

        // --- External grid (left of POC) ---
        let extGrid = existing.extGrid;
        let pocBus = existing.poc;
        if (!pocBus) {
            pocBus = insertBus(graph, parent, centerX - BUS_W / 2, y, pocName, hvKv, 'poc');
        } else {
            configureBusAttributes(graph, pocBus, { name: pocName, vn_kv: String(hvKv) });
            tagRole(graph, pocBus, 'poc');
        }
        y += ROW_SPACING;

        if (!extGrid) {
            const [ew, eh] = symWh('sym-ext-grid', 58, 58);
            extGrid = graph.insertVertex(
                parent, null, '', centerX - BUS_W / 2 - ew - 50, y - ROW_SPACING - eh / 2, ew, eh, EXT_GRID_STYLE
            );
            configureExternalGridAttributes(graph, extGrid, {
                name: extName,
                vm_pu: String(params.unom_pu ?? 1),
            });
            tagRole(graph, extGrid, 'extGrid');
            connect(graph, parent, extGrid, pocBus);
        } else {
            configureExternalGridAttributes(graph, extGrid, {
                name: extName,
                vm_pu: String(params.unom_pu ?? 1),
            });
            tagRole(graph, extGrid, 'extGrid');
        }

        // --- HV/MV transformer ---
        let hvTrafo = existing.hvTrafo;
        const hvTrafoY = y;
        if (!hvTrafo) {
            hvTrafo = insertTrafo(graph, parent, centerX, hvTrafoY, {
                name: params.hvTrafoName || 'POC_Transformer',
                sn_mva: params.hvTrafoSnMva ?? suggested.hvTrafoSnMva,
                vn_hv_kv: hvKv,
                vn_lv_kv: mvKv,
                vk_percent: params.hvVkPercent ?? 12,
                vkr_percent: params.hvVkrPercent ?? 0.4,
                tap_min: params.tapMin ?? -5,
                tap_max: params.tapMax ?? 5,
                tap_neutral: params.tapNeutral ?? 0,
                tap_step_percent: params.tapStepPercent ?? 1.25,
                tap_pos: params.tapPos ?? 0,
                tap_changer_type: 'Ratio',
                discrete_tap_control: params.oltcEnabled !== false,
                vm_lower_pu: params.oltcVmLower ?? 0.99,
                vm_upper_pu: params.oltcVmUpper ?? 1.01,
                control_side: 'lv',
            }, 'hvTrafo', true);
            connect(graph, parent, hvTrafo, pocBus, NOT_EDITABLE_LINE);
        } else {
            configureTransformerAttributes(graph, hvTrafo, {
                name: params.hvTrafoName || 'POC_Transformer',
                sn_mva: String(params.hvTrafoSnMva ?? suggested.hvTrafoSnMva),
                vn_hv_kv: String(hvKv),
                vn_lv_kv: String(mvKv),
                vk_percent: String(params.hvVkPercent ?? 12),
                vkr_percent: String(params.hvVkrPercent ?? 0.4),
                tap_side: 'hv',
                tap_min: String(params.tapMin ?? -5),
                tap_max: String(params.tapMax ?? 5),
                tap_neutral: String(params.tapNeutral ?? 0),
                tap_step_percent: String(params.tapStepPercent ?? 1.25),
                tap_pos: String(params.tapPos ?? 0),
                tap_changer_type: 'Ratio',
                discrete_tap_control: params.oltcEnabled !== false ? 'true' : 'false',
                max_loading_percent: '100',
            });
            if (params.oltcEnabled !== false) {
                setCellAttr(graph, hvTrafo, 'discrete_tap_control', 'true');
                setCellAttr(graph, hvTrafo, 'vm_lower_pu', params.oltcVmLower ?? 0.99);
                setCellAttr(graph, hvTrafo, 'vm_upper_pu', params.oltcVmUpper ?? 1.01);
                setCellAttr(graph, hvTrafo, 'control_side', 'lv');
                setCellAttr(graph, hvTrafo, 'tap_changer_type', 'Ratio');
            }
            tagRole(graph, hvTrafo, 'hvTrafo');
        }
        y += ROW_SPACING + 40;

        // --- MV collection bus ---
        let mvBus = existing.mvBus;
        if (!mvBus) {
            mvBus = insertBus(graph, parent, centerX - BUS_W / 2, y, mvBusName, mvKv, 'mvBus');
            connect(graph, parent, hvTrafo, mvBus, NOT_EDITABLE_LINE);
        } else {
            configureBusAttributes(graph, mvBus, { name: mvBusName, vn_kv: String(mvKv) });
            tagRole(graph, mvBus, 'mvBus');
        }
        y += ROW_SPACING;

        // --- Aux load ---
        let aux = existing.aux;
        if (!aux) {
            aux = insertAuxLoad(graph, parent, mvBus, {
                name: params.auxName || 'Aux_Load',
                p_mw: params.auxP_MW ?? 0.5,
                q_mvar: params.auxQ_Mvar ?? 0.1,
            }, 'aux');
        } else {
            configureLoadAttributes(graph, aux, {
                name: params.auxName || 'Aux_Load',
                p_mw: String(params.auxP_MW ?? 0.5),
                q_mvar: String(params.auxQ_Mvar ?? 0.1),
            });
            tagRole(graph, aux, 'aux');
        }

        // --- N BESS strings ---
        const totalWidth = (nUnits - 1) * COL_SPACING;
        const startX = centerX - totalWidth / 2;

        for (let i = 0; i < nUnits; i++) {
            const colX = startX + i * COL_SPACING;
            const idx = i;
            const strBusName = `String_HV_${idx + 1}`;
            const lvName = `LV_Bus_${idx + 1}`;
            const storName = params.storagePrefix ? `${params.storagePrefix}_${idx + 1}` : `BESS_${idx + 1}`;

            let stringBus = existing[`stringBus_${idx}`];
            if (!stringBus) {
                stringBus = insertBus(graph, parent, colX - BUS_W / 2, y, strBusName, mvKv, `stringBus_${idx}`);
            } else {
                configureBusAttributes(graph, stringBus, { name: strBusName, vn_kv: String(mvKv) });
                tagRole(graph, stringBus, `stringBus_${idx}`);
            }

            let cable = existing[`cable_${idx}`];
            if (!cable) {
                cable = insertCable(graph, parent, mvBus, stringBus, {
                    name: `MV_Cable_${idx + 1}`,
                    length_km: params.cableLength_km ?? 0.3,
                    r_ohm_per_km: params.cableR_ohmPerKm ?? 0.08,
                    x_ohm_per_km: params.cableX_ohmPerKm ?? 0.12,
                    max_i_ka: params.cableMaxIKa ?? suggested.cableMaxIKa,
                }, `cable_${idx}`);
            } else {
                configureLineAttributes(graph, cable, {
                    name: `MV_Cable_${idx + 1}`,
                    length_km: String(params.cableLength_km ?? 0.3),
                    r_ohm_per_km: String(params.cableR_ohmPerKm ?? 0.08),
                    x_ohm_per_km: String(params.cableX_ohmPerKm ?? 0.12),
                    max_i_ka: String(params.cableMaxIKa ?? suggested.cableMaxIKa),
                    max_loading_percent: '100',
                });
                tagRole(graph, cable, `cable_${idx}`);
            }

            const trafoY = y + ROW_SPACING;
            let lvTrafo = existing[`lvTrafo_${idx}`];
            if (!lvTrafo) {
                lvTrafo = insertTrafo(graph, parent, colX, trafoY, {
                    name: `MV_LV_Trafo_${idx + 1}`,
                    sn_mva: params.stringTrafoSnMva ?? suggested.stringTrafoSnMva,
                    vn_hv_kv: mvKv,
                    vn_lv_kv: lvKv,
                    vk_percent: params.stringVkPercent ?? 8,
                    vkr_percent: params.stringVkrPercent ?? 0.5,
                }, `lvTrafo_${idx}`, true);
                connect(graph, parent, lvTrafo, stringBus, NOT_EDITABLE_LINE);
            } else {
                configureTransformerAttributes(graph, lvTrafo, {
                    name: `MV_LV_Trafo_${idx + 1}`,
                    sn_mva: String(params.stringTrafoSnMva ?? suggested.stringTrafoSnMva),
                    vn_hv_kv: String(mvKv),
                    vn_lv_kv: String(lvKv),
                    vk_percent: String(params.stringVkPercent ?? 8),
                    vkr_percent: String(params.stringVkrPercent ?? 0.5),
                    max_loading_percent: '100',
                });
                tagRole(graph, lvTrafo, `lvTrafo_${idx}`);
            }

            const lvY = trafoY + ROW_SPACING + 50;
            let lvBus = existing[`lvBus_${idx}`];
            if (!lvBus) {
                lvBus = insertBus(graph, parent, colX - BUS_W / 2, lvY, lvName, lvKv, `lvBus_${idx}`);
                connect(graph, parent, lvTrafo, lvBus, NOT_EDITABLE_LINE);
            } else {
                configureBusAttributes(graph, lvBus, { name: lvName, vn_kv: String(lvKv) });
                tagRole(graph, lvBus, `lvBus_${idx}`);
            }

            let storage = existing[`storage_${idx}`];
            const pcsOpts = storageNameplate(params, suggested, storName);
            if (!storage) {
                storage = insertStorage(graph, parent, lvBus, pcsOpts, `storage_${idx}`);
            } else {
                configureStorageAttributes(graph, storage, {
                    ...pcsOpts,
                    sn_mva: String(pcsOpts.sn_mva),
                    max_e_mwh: String(pcsOpts.max_e_mwh),
                });
                tagRole(graph, storage, `storage_${idx}`);
            }
        }

        return {
            created: !existing.poc,
            pocBusId: pocBus?.getId?.(),
            extGridName: extName,
            pocBusName: pocName,
            storageNames: Array.from({ length: nUnits }, (_, i) =>
                params.storagePrefix ? `${params.storagePrefix}_${i + 1}` : `BESS_${i + 1}`
            ),
            hvTrafoName: params.hvTrafoName || 'POC_Transformer',
        };
    } finally {
        graph.getModel().endUpdate();
    }
}

export function findBessPlantElements(graph) {
    const cells = findPlantCells(graph);
    return {
        pocBus: cells.poc || null,
        extGrid: cells.extGrid || null,
        hvTrafo: cells.hvTrafo || null,
        mvBus: cells.mvBus || null,
        storages: Object.keys(cells)
            .filter((k) => /^storage_\d+$/.test(k))
            .sort()
            .map((k) => cells[k]),
    };
}
