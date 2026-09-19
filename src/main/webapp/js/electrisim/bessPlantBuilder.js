/**
 * Build or update a utility-scale HV-connected BESS plant on the canvas.
 * Topology: External Grid → POC (HV) → HV/MV OLTC transformer → MV bus
 *   → aux load + N× (MV cable → MV/LV 2W or 3W skid → LV bus(es) → PCS inverter
 *     → DC bus → Battery rack). PCS is the Storage element (AC load-flow).
 *     Battery DC Pmax is a tighter AC Storage P limit; the DC island is shown
 *     on the SLD but stripped before AC load-flow.
 */
import {
    configureExternalGridAttributes,
    configureBusAttributes,
    configureTransformerAttributes,
    configureLineAttributes,
    configureLoadAttributes,
    configureStorageAttributes,
    configureThreeWindingTransformerAttributes,
    configureDcBusAttributes,
    configureSourceDcAttributes,
} from './configureAttributes.js';
import {
    vertexStyleFromElectrisimSymbol,
    vertexSizeFromElectrisimSymbol,
    vertexStyleImportedBusbar,
} from './electricalSymbols.js';
import { defaultStorageQCapabilityJson } from './utils/storageQCapability.js';

const BUS_H = 12;
const POC_BUS_W = 180;
const STRING_BUS_W = 100;
const COL_SPACING = 400;
const AUX_OVERHANG = 200;
const SIDE_OVERHANG = 28;
const COMP_GAP = 56;
const DC_GAP = 36;
const DC_BUS_W = 72;
/** Horizontal gap between PCS columns on one LV winding (inverter + DC bus + labels). */
const PCS_COLUMN_PITCH = 210;
/** Extra LV-bus length beyond the outermost PCS centres. */
const LV_BUS_END_PAD = 170;
/** Gap from skid centreline to the inner end of each LV bus (under the 3W stubs). */
const LV3W_INNER_GAP = 10;
/** Clearance between adjacent 3W skids. */
const SKID_GUTTER = 96;
const TRAFO3W_STYLE = vertexStyleFromElectrisimSymbol('sym-3w-transformer-v', 'Three Winding Transformer');

const BUSBAR_BASE = vertexStyleImportedBusbar('Bus');
const BUSBAR_STYLE = `${BUSBAR_BASE};verticalLabelPosition=top;verticalAlign=bottom;align=center;fontSize=10`;
const BUSBAR_STYLE_POC = `${BUSBAR_BASE};verticalLabelPosition=top;verticalAlign=bottom;align=center;fontSize=11;fontStyle=1`;
const BUSBAR_STYLE_MV = `${BUSBAR_BASE};strokeWidth=3;verticalLabelPosition=top;verticalAlign=bottom;align=left;spacingLeft=8;fontSize=11;fontStyle=1`;
const BUSBAR_STYLE_DC = `${vertexStyleImportedBusbar('DC Bus')};strokeWidth=2;strokeColor=#c2410c;verticalLabelPosition=top;verticalAlign=bottom;align=center;fontSize=9`;
const STRAIGHT_EDGE = 'edgeStyle=none;endArrow=none;startArrow=none;html=1;rounded=0;curved=0;';
const EXT_GRID_STYLE = `${vertexStyleFromElectrisimSymbol('sym-ext-grid', 'External Grid')};verticalLabelPosition=top;verticalAlign=bottom`;
const TRAFO_V_STYLE = vertexStyleFromElectrisimSymbol('sym-transformer-v', 'Transformer');
const TRAFO_H_STYLE = vertexStyleFromElectrisimSymbol('sym-transformer', 'Transformer');
const LOAD_STYLE = vertexStyleFromElectrisimSymbol('sym-load', 'Load');
/** Image styles are built at use time so a stale catalog cannot freeze a blank rectangle. */
function pcsStyle() {
    return `${vertexStyleFromElectrisimSymbol('sym-pcs', 'Storage')};noLabel=1`;
}
function batteryStyle() {
    return `${vertexStyleFromElectrisimSymbol('sym-storage-v', 'Source DC')};noLabel=1`;
}

/**
 * Result-box geometry.
 * Vertex (bus) children: x/y are 0–1 in the parent cell.
 * Edge children: x is −1 at the source, 0 at the midpoint, +1 at the target (mxGraph).
 */
const BOX = {
    extGrid: { x: -0.55, y: 0, ox: 22, oy: -28 },
    pocBus: { x: 1, y: 0.5, ox: 18, oy: -40 },
    hvTrafo: { x: -0.52, y: 0, ox: 44, oy: -8 },
    mvBus: { x: 1, y: 0.5, ox: 22, oy: -8 },
    aux: { x: -0.45, y: 0, ox: 24, oy: 12 },
    // LEFT of the MV drop, above the string-bus box.
    cable: { x: 0, y: 0, ox: -108, oy: -40 },
    stringBus: { x: 0, y: 0.5, ox: -108, oy: 10 },
    // LEFT of the 2W transformer so it does not sit on the LV-bus box.
    stringTrafo: { x: -0.55, y: 0, ox: -100, oy: 12 },
    // RIGHT of the 3W HV stem, beside the symbol (not in the LV aisle).
    stringTrafo3w: { x: -0.88, y: 0, ox: 56, oy: 14 },
    // RIGHT of the LV bus, in the gap above the bar (2W trafo box is on the left).
    lvBus: { x: 1, y: 0.5, ox: 24, oy: -76 },
    lvBusA: { x: 0, y: 0.5, ox: -96, oy: -8 },
    lvBusB: { x: 1, y: 0.5, ox: 18, oy: -8 },
    // RIGHT of the PCS — top-left of the box just past the inverter.
    storage: { x: -1, y: 0, ox: 52, oy: 4 },
    // RIGHT of the DC bar, same column as the PCS box.
    dcBus: { x: 1, y: 0.5, ox: 52, oy: -8 },
    // RIGHT of the battery rack.
    battery: { x: -1, y: 0, ox: 52, oy: 12 },
};

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
    const root = model.getRoot?.();
    const descendants = typeof model.getDescendants === 'function'
        ? (model.getDescendants(root) || [])
        : [];
    descendants.forEach((cell) => {
        const role = getCellRole(cell);
        if (!role) return;
        if (role.startsWith('cable_') || role.startsWith('lvTrafo_') || role.startsWith('lvTrafo3w_')
            || role.startsWith('lvBus_') || role.startsWith('lvBusA_') || role.startsWith('lvBusB_')
            || role.startsWith('storage_') || role.startsWith('stringBus_')
            || role.startsWith('dcBus_') || role.startsWith('battery_')) {
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

function placeCell(graph, cell, x, y, w, h) {
    if (!cell) return;
    const geo = graph.getModel().getGeometry(cell);
    if (!geo) return;
    const g = geo.clone();
    g.x = x;
    g.y = y;
    if (w != null) g.width = w;
    if (h != null) g.height = h;
    graph.getModel().setGeometry(cell, g);
}

function graphCellGeo(cell) {
    return cell?.geometry || null;
}

function pinXOnBus(bus, worldX) {
    const g = graphCellGeo(bus);
    if (!g || !g.width) return 0.5;
    return Math.max(0.02, Math.min(0.98, (worldX - g.x) / g.width));
}

function straightPins(exitX, exitY, entryX, entryY, shape) {
    return `${STRAIGHT_EDGE}` +
        `exitX=${exitX};exitY=${exitY};exitDx=0;exitDy=0;exitPerimeter=0;` +
        `entryX=${entryX};entryY=${entryY};entryDx=0;entryDy=0;entryPerimeter=0;` +
        `shapeELXXX=${shape}`;
}

function edgeStyleVertical(fromBus, toBus, worldX, shape = 'Line') {
    return straightPins(
        pinXOnBus(fromBus, worldX), 0.5,
        pinXOnBus(toBus, worldX), 0.5,
        shape
    );
}

function edgeStyleTrafoToBus(trafo, bus, winding) {
    const tg = graphCellGeo(trafo);
    const bg = graphCellGeo(bus);
    if (!tg || !bg) {
        return `${STRAIGHT_EDGE}shapeELXXX=NotEditableLine`;
    }
    const worldX = tg.x + tg.width / 2;
    const busAbove = bg.y + bg.height / 2 < tg.y + tg.height / 2;
    const exitY = winding === 'hv' || busAbove ? 0.05 : 0.95;
    return straightPins(0.5, exitY, pinXOnBus(bus, worldX), 0.5, 'NotEditableLine');
}

function edgeStyleDeviceToBus(device, bus) {
    const dg = graphCellGeo(device);
    const bg = graphCellGeo(bus);
    if (!dg || !bg) {
        return `${STRAIGHT_EDGE}shapeELXXX=NotEditableLine`;
    }
    const worldX = dg.x + dg.width / 2;
    const busAbove = (bg.y + bg.height / 2) < (dg.y + dg.height / 2);
    return straightPins(0.5, busAbove ? 0 : 1, pinXOnBus(bus, worldX), 0.5, 'NotEditableLine');
}

function edgeStyleJog(device, bus, shape = 'NotEditableLine') {
    const dg = graphCellGeo(device);
    const bg = graphCellGeo(bus);
    if (!dg || !bg) return `${STRAIGHT_EDGE}shapeELXXX=${shape}`;
    const tcx = dg.x + dg.width / 2;
    const bcx = bg.x + bg.width / 2;
    if (Math.abs(tcx - bcx) < 16) {
        return edgeStyleDeviceToBus(device, bus);
    }
    const busAbove = (bg.y + bg.height / 2) < (dg.y + dg.height / 2);
    return 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=0;html=1;' +
        'endArrow=none;startArrow=none;' +
        `exitX=0.5;exitY=${busAbove ? 0 : 1};exitDx=0;exitDy=0;exitPerimeter=0;` +
        `entryX=${pinXOnBus(bus, bcx)};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;` +
        `shapeELXXX=${shape}`;
}

/** Vertical 3W: HV at top centre; LV-A / LV-B at the two bottom stubs. */
function edgeStyleTrafo3wWinding(trafo, bus, winding) {
    if (winding === 'hv') {
        return edgeStyleTrafoToBus(trafo, bus, 'hv');
    }
    const dg = graphCellGeo(trafo);
    const bg = graphCellGeo(bus);
    if (!dg || !bg) return `${STRAIGHT_EDGE}shapeELXXX=NotEditableLine`;
    const exitX = winding === 'lvA' ? 0.375 : 0.625;
    const stubX = dg.x + exitX * dg.width;
    const innerX = winding === 'lvA' ? bg.x + bg.width * 0.88 : bg.x + bg.width * 0.12;
    const onBus = stubX >= bg.x && stubX <= bg.x + bg.width;
    const entryWorld = onBus ? stubX : innerX;
    return 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=0;html=1;' +
        'endArrow=none;startArrow=none;' +
        `exitX=${exitX};exitY=0.96;exitDx=0;exitDy=0;exitPerimeter=0;` +
        `entryX=${pinXOnBus(bus, entryWorld)};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;` +
        'shapeELXXX=NotEditableLine';
}

function lvBusWidthForPcs(n) {
    const count = Math.max(1, n | 0);
    if (count <= 1) return STRING_BUS_W;
    return (count - 1) * PCS_COLUMN_PITCH + LV_BUS_END_PAD;
}

function threeWSkidWidth(pcsPerWinding) {
    return 2 * lvBusWidthForPcs(pcsPerWinding) + 2 * LV3W_INNER_GAP;
}

function lvBusBox(bus) {
    const r = getCellRole(bus) || '';
    if (r.startsWith('lvBusA_')) return BOX.lvBusA;
    if (r.startsWith('lvBusB_')) return BOX.lvBusB;
    return BOX.lvBus;
}

function trafo3wSize() {
    return symWh('sym-3w-transformer-v', 96, 100);
}

function clearEdgeWaypoints(graph, edge) {
    if (!edge) return;
    const geo = graph.getModel().getGeometry(edge);
    if (!geo) return;
    const g = geo.clone();
    g.points = [];
    graph.getModel().setGeometry(edge, g);
}

function ensureEdge(graph, parent, a, b, style) {
    if (!a || !b) return null;
    const model = graph.getModel();
    const found = graph.getEdgesBetween?.(a, b, false)?.[0];
    if (found) {
        if (found.source !== a) model.setTerminal(found, a, true);
        if (found.target !== b) model.setTerminal(found, b, false);
        model.setStyle(found, style);
        clearEdgeWaypoints(graph, found);
        if (typeof graph.resetEdge === 'function') graph.resetEdge(found);
        clearEdgeWaypoints(graph, found);
        return found;
    }
    const edge = graph.insertEdge(parent, null, '', a, b, style);
    clearEdgeWaypoints(graph, edge);
    return edge;
}

function isResultChild(cell, model) {
    const st = (model && model.getStyle?.(cell)) || cell?.style || '';
    return st.includes('shapeELXXX=Result');
}

function stripResultChildren(graph, parentCell) {
    if (!parentCell || !graph.getModel) return;
    const model = graph.getModel();
    const n = model.getChildCount?.(parentCell) ?? 0;
    const remove = [];
    for (let i = 0; i < n; i++) {
        const ch = model.getChildAt(parentCell, i);
        if (isResultChild(ch, model)) remove.push(ch);
    }
    if (remove.length) graph.removeCells(remove, true);
}

function replaceRelativeLabels(graph, vertex, text) {
    if (!vertex || !graph.getModel || text == null) return;
    const model = graph.getModel();
    const n = model.getChildCount?.(vertex) ?? 0;
    const named = [];
    for (let i = 0; i < n; i++) {
        const ch = model.getChildAt(vertex, i);
        if (!ch || ch.edge) continue;
        if (isResultChild(ch, model)) continue;
        const geo = model.getGeometry(ch);
        if (!geo || !geo.relative || geo.width > 0 || geo.height > 0) continue;
        const val = ch.value;
        if (val == null || val === '') continue;
        named.push(ch);
    }
    if (!named.length) return;
    model.setValue(named[0], String(text));
    if (named.length > 1) graph.removeCells(named.slice(1), true);
}

function placeNameChild(graph, vertex, x, y, style = 'text;html=1;align=right;verticalAlign=middle;fontSize=10;fillColor=none;strokeColor=none') {
    if (!vertex || !graph.getModel) return;
    const model = graph.getModel();
    const n = model.getChildCount?.(vertex) ?? 0;
    for (let i = 0; i < n; i++) {
        const ch = model.getChildAt(vertex, i);
        if (!ch || ch.edge) continue;
        if (isResultChild(ch, model)) continue;
        const geo = model.getGeometry(ch);
        if (!geo || !geo.relative || geo.width > 0 || geo.height > 0) continue;
        if (ch.value == null || ch.value === '') continue;
        const g = geo.clone();
        g.x = x;
        g.y = y;
        model.setGeometry(ch, g);
        if (style) model.setStyle(ch, style);
        return;
    }
}

function nudgeResultChild(graph, parentCell, spec) {
    if (!parentCell || !graph.getModel || !spec) return;
    const model = graph.getModel();
    const n = model.getChildCount?.(parentCell) ?? 0;
    for (let i = 0; i < n; i++) {
        const ch = model.getChildAt(parentCell, i);
        if (!isResultChild(ch, model)) continue;
        const geo = model.getGeometry(ch);
        if (!geo) continue;
        const g = geo.clone();
        g.relative = true;
        if (spec.x != null) g.x = spec.x;
        if (spec.y != null) g.y = spec.y;
        if (typeof mxPoint !== 'undefined' && (spec.ox != null || spec.oy != null)) {
            g.offset = new mxPoint(spec.ox ?? 0, spec.oy ?? 0);
        }
        model.setGeometry(ch, g);
    }
}

function ensureBusPlaceholder(graph, bus, spec) {
    if (!bus) return;
    if (typeof window !== 'undefined' && typeof window.createBusResultPlaceholder === 'function') {
        try { window.createBusResultPlaceholder(graph, bus); } catch { /* ignore */ }
    }
    nudgeResultChild(graph, bus, spec);
}

function nudgeCellEdges(graph, cell, spec) {
    if (!cell) return;
    const edges = cell.edges || [];
    for (let i = 0; i < edges.length; i++) {
        nudgeResultChild(graph, edges[i], spec);
    }
}

function otherEnd(edge, cell) {
    if (!edge || !cell) return null;
    return edge.source === cell ? edge.target : edge.source;
}

function listResultChildren(graph, parentCell) {
    if (!parentCell || !graph.getModel) return [];
    const model = graph.getModel();
    const out = [];
    const n = model.getChildCount?.(parentCell) ?? 0;
    for (let i = 0; i < n; i++) {
        const ch = model.getChildAt(parentCell, i);
        if (isResultChild(ch, model)) out.push(ch);
    }
    return out;
}

function edgesWhosePeerRole(cell, pred) {
    return (cell?.edges || []).filter((e) => pred(getCellRole(otherEnd(e, cell)) || ''));
}

/** Keep one result box on `keepEdge`; drop or move boxes from the other edges. */
function parkEdgeResult(graph, keepEdge, dropEdges, spec) {
    if (!keepEdge || !graph.getModel) return;
    const model = graph.getModel();
    const keepKids = listResultChildren(graph, keepEdge);
    const extras = [];
    (dropEdges || []).forEach((e) => {
        if (!e || e === keepEdge) return;
        extras.push(...listResultChildren(graph, e));
    });
    if (!keepKids.length && extras.length) {
        model.add(keepEdge, extras[0]);
        keepKids.push(extras.shift());
    }
    if (keepKids.length > 1) extras.push(...keepKids.slice(1));
    if (extras.length) graph.removeCells(extras, true);
    nudgeResultChild(graph, keepEdge, spec);
}

export function parkPlantResultBoxes(graph) {
    const cells = findPlantCells(graph);
    ensureBusPlaceholder(graph, cells.poc, BOX.pocBus);
    ensureBusPlaceholder(graph, cells.mvBus, BOX.mvBus);
    if (cells.extGrid && cells.poc) {
        const extEdges = graph.getEdgesBetween?.(cells.extGrid, cells.poc, false) || [];
        extEdges.forEach((e) => nudgeResultChild(graph, e, BOX.extGrid));
    }
    if (cells.hvTrafo) {
        parkEdgeResult(
            graph,
            edgesWhosePeerRole(cells.hvTrafo, (r) => r === 'mvBus')[0],
            edgesWhosePeerRole(cells.hvTrafo, (r) => r === 'poc'),
            BOX.hvTrafo
        );
    }
    if (cells.aux) nudgeCellEdges(graph, cells.aux, BOX.aux);
    Object.keys(cells).forEach((k) => {
        const cell = cells[k];
        if (!cell || Array.isArray(cell)) return;
        if (/^stringBus_\d+$/.test(k)) {
            ensureBusPlaceholder(graph, cell, BOX.stringBus);
        } else if (/^lvBusA_\d+$/.test(k)) {
            ensureBusPlaceholder(graph, cell, BOX.lvBusA);
        } else if (/^lvBusB_\d+$/.test(k)) {
            ensureBusPlaceholder(graph, cell, BOX.lvBusB);
        } else if (/^lvBus_\d+$/.test(k)) {
            ensureBusPlaceholder(graph, cell, BOX.lvBus);
        } else if (/^cable_\d+$/.test(k)) {
            nudgeResultChild(graph, cell, BOX.cable);
        } else if (/^lvTrafo3w_\d+$/.test(k)) {
            parkEdgeResult(
                graph,
                edgesWhosePeerRole(cell, (r) => /^stringBus_/.test(r))[0],
                edgesWhosePeerRole(cell, (r) => /^(lvBusA|lvBusB)_/.test(r)),
                BOX.stringTrafo3w
            );
        } else if (/^lvTrafo_\d+$/.test(k)) {
            parkEdgeResult(
                graph,
                edgesWhosePeerRole(cell, (r) => /^lvBus_/.test(r))[0],
                edgesWhosePeerRole(cell, (r) => /^stringBus_/.test(r)),
                BOX.stringTrafo
            );
        } else if (/^storage_\d+$/.test(k)) {
            parkEdgeResult(
                graph,
                edgesWhosePeerRole(cell, (r) => /^(lvBus|lvBusA|lvBusB)_/.test(r))[0],
                edgesWhosePeerRole(cell, (r) => /^dcBus_/.test(r)),
                BOX.storage
            );
        } else if (/^dcBus_\d+$/.test(k)) {
            ensureBusPlaceholder(graph, cell, BOX.dcBus);
        } else if (/^battery_\d+$/.test(k)) {
            nudgeCellEdges(graph, cell, BOX.battery);
        }
    });
}

function applyBusbar(graph, cell, x, y, w, style = BUSBAR_STYLE) {
    if (!cell) return;
    graph.getModel().setStyle(cell, style);
    placeCell(graph, cell, x, y, w, BUS_H);
}

function insertBus(graph, parent, x, y, name, vnKv, role, width = STRING_BUS_W, style = BUSBAR_STYLE) {
    const v = graph.insertVertex(parent, null, '', x, y, width, BUS_H, style);
    configureBusAttributes(graph, v, { name, vn_kv: String(vnKv) });
    tagRole(graph, v, role);
    replaceRelativeLabels(graph, v, name);
    return v;
}

function placeCentered(graph, cell, cx, y) {
    if (!cell) return;
    const geo = graph.getModel().getGeometry(cell);
    if (!geo) return;
    placeCell(graph, cell, cx - geo.width / 2, y);
}

function insertTrafo3w(graph, parent, x, y, opts, role) {
    const [tw, th] = trafo3wSize();
    const v = graph.insertVertex(parent, null, '', x - tw / 2, y, tw, th, TRAFO3W_STYLE);
    configureThreeWindingTransformerAttributes(graph, v, {
        name: opts.name || 'MV_LV_Trafo3w',
        sn_hv_mva: opts.sn_hv_mva,
        sn_mv_mva: opts.sn_mv_mva,
        sn_lv_mva: opts.sn_lv_mva,
        vn_hv_kv: opts.vn_hv_kv,
        vn_mv_kv: opts.vn_mv_kv,
        vn_lv_kv: opts.vn_lv_kv,
        vk_hv_percent: opts.vk_hv_percent ?? 8,
        vk_mv_percent: opts.vk_mv_percent ?? 8,
        vk_lv_percent: opts.vk_lv_percent ?? 8,
        vkr_hv_percent: opts.vkr_hv_percent ?? 0.5,
        vkr_mv_percent: opts.vkr_mv_percent ?? 0.5,
        vkr_lv_percent: opts.vkr_lv_percent ?? 0.5,
        pfe_kw: opts.pfe_kw ?? 12,
        i0_percent: opts.i0_percent ?? 0.1,
        vector_group: opts.vector_group || 'YNyn0yn0',
        max_loading_percent: 100,
        term_label_0: 'HV',
        term_label_1: 'LV',
        term_label_2: 'LV',
    });
    tagRole(graph, v, role);
    return v;
}

function placeTrafo3w(graph, cell, cx, y) {
    if (!cell) return;
    const [tw, th] = trafo3wSize();
    graph.getModel().setStyle(cell, TRAFO3W_STYLE);
    placeCell(graph, cell, cx - tw / 2, y, tw, th);
}

function stringRoleKeys(existing) {
    return Object.keys(existing).filter((k) =>
        /^(cable_|lvTrafo_|lvTrafo3w_|lvBus_|lvBusA_|lvBusB_|storage_|stringBus_|dcBus_|battery_)/.test(k)
        && existing[k] && !Array.isArray(existing[k]));
}

function insertCable(graph, parent, fromBus, toBus, opts, role, worldX) {
    const style = edgeStyleVertical(fromBus, toBus, worldX, 'Line');
    const edge = ensureEdge(graph, parent, fromBus, toBus, style);
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
    nudgeResultChild(graph, edge, BOX.cable);
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

function pcsUnitName(params, idx) {
    return `${params.storagePrefix || 'PCS'}_${idx + 1}`;
}

function pcsSymbolSize() {
    return symWh('sym-pcs', 56, 72);
}

function storageNameplate(params, suggested, storName) {
    const sn = Number(params.storageSnMva ?? suggested.storageSnMva) || 15;
    const pDis = Math.abs(Number(params.pMaxDischarge_MW ?? suggested.storagePMaxMw) || 0);
    const pChg = Math.abs(Number(params.pMaxCharge_MW ?? suggested.storagePMaxMw) || 0);
    const batt = Math.abs(Number(params.batteryPmax_MW) || 0);
    // A converter cannot pass more MW than its own MVA, so an entered Pmax above
    // the entered Sn is held at Sn instead of being written as an impossible rating.
    const pDisLim = Math.min(batt > 0 ? Math.min(pDis, batt) : pDis, sn);
    const pChgLim = Math.min(batt > 0 ? Math.min(pChg, batt) : pChg, sn);
    const qMax = sn;
    const hours = Number(params.durationHours);
    const maxE = Number(params.maxE_mwh);
    return {
        name: storName,
        p_mw: 0,
        q_mvar: 0,
        sn_mva: sn,
        max_p_mw: pChgLim,
        min_p_mw: -pDisLim,
        max_q_mvar: qMax,
        min_q_mvar: -qMax,
        max_e_mwh: Number.isFinite(maxE) && maxE > 0
            ? maxE
            : (Number.isFinite(hours) && hours > 0 ? hours * pDisLim : 2 * pDisLim),
        reactive_capability_curve: params.useQCurve === true,
        q_capability_preset: 'pcs_circle',
        q_capability_curve_json: defaultStorageQCapabilityJson(sn, Math.max(pDisLim, pChgLim)),
        battery_dc_pmax_mw: batt || undefined,
    };
}

function insertStorage(graph, parent, bus, opts, role, offsetX = 0) {
    const [sw, sh] = pcsSymbolSize();
    const bg = graph.getCellGeometry(bus);
    const cx = bg.x + bg.width / 2 - sw / 2 + offsetX;
    const cy = bg.y + bg.height + COMP_GAP;
    const v = graph.insertVertex(parent, null, '', cx, cy, sw, sh, pcsStyle());
    const pcsName = opts.name || 'PCS';
    configureStorageAttributes(graph, v, {
        name: pcsName,
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
        q_capability_preset: opts.q_capability_preset || 'pcs_circle',
    });
    if (opts.battery_dc_pmax_mw) {
        setCellAttr(graph, v, 'battery_dc_pmax_mw', opts.battery_dc_pmax_mw);
    }
    const edge = ensureEdge(graph, parent, v, bus, edgeStyleDeviceToBus(v, bus));
    nudgeResultChild(graph, edge, BOX.storage);
    tagRole(graph, v, role);
    replaceRelativeLabels(graph, v, pcsName);
    placeNameChild(graph, v, 0, 0.28);
    return v;
}

function placeDcRack(graph, parent, storage, idx, params, existing) {
    if (!storage) return;
    const sg = graph.getCellGeometry(storage);
    if (!sg) return;
    const dcW = DC_BUS_W;
    const dcX = sg.x + sg.width / 2 - dcW / 2;
    const dcY = sg.y + sg.height + DC_GAP;
    const dcName = `DC_Bus_${idx + 1}`;
    const dcKv = Number(params.dcVoltage_kV) || 1.5;
    let dcBus = existing[`dcBus_${idx}`];
    if (!dcBus) {
        dcBus = graph.insertVertex(parent, null, '', dcX, dcY, dcW, BUS_H, BUSBAR_STYLE_DC);
        configureDcBusAttributes(graph, dcBus, { name: dcName, vn_kv: String(dcKv) });
        tagRole(graph, dcBus, `dcBus_${idx}`);
    } else {
        configureDcBusAttributes(graph, dcBus, { name: dcName, vn_kv: String(dcKv) });
        tagRole(graph, dcBus, `dcBus_${idx}`);
        applyBusbar(graph, dcBus, dcX, dcY, dcW, BUSBAR_STYLE_DC);
    }
    ensureBusPlaceholder(graph, dcBus, BOX.dcBus);

    const [bw, bh] = symWh('sym-storage-v', 40, 56);
    const battName = `Battery_${idx + 1}`;
    const battX = sg.x + sg.width / 2 - bw / 2;
    const battY = dcY + BUS_H + COMP_GAP;
    const battPmax = Math.abs(Number(params.batteryPmax_MW) || 0);
    let rack = existing[`battery_${idx}`];
    if (!rack) {
        rack = graph.insertVertex(parent, null, '', battX, battY, bw, bh, batteryStyle());
        configureSourceDcAttributes(graph, rack, { name: battName, vm_pu: '1.0' });
        tagRole(graph, rack, `battery_${idx}`);
    } else {
        configureSourceDcAttributes(graph, rack, { name: battName, vm_pu: '1.0' });
        tagRole(graph, rack, `battery_${idx}`);
        graph.getModel().setStyle(rack, batteryStyle());
        placeCell(graph, rack, battX, battY, bw, bh);
    }
    if (battPmax > 0) {
        setCellAttr(graph, rack, 'battery_dc_pmax_mw', battPmax);
        setCellAttr(graph, dcBus, 'battery_dc_pmax_mw', battPmax);
    }
    const battEdge = ensureEdge(graph, parent, rack, dcBus, edgeStyleDeviceToBus(rack, dcBus));
    nudgeResultChild(graph, battEdge, BOX.battery);
    replaceRelativeLabels(graph, dcBus, dcName);
    replaceRelativeLabels(graph, rack, battName);
    placeNameChild(graph, rack, 0, 0.5);
    const dcDrop = ensureEdge(graph, parent, storage, dcBus, edgeStyleDeviceToBus(storage, dcBus));
    stripResultChildren(graph, dcDrop);
}

function insertAuxLoad(graph, parent, bus, opts, role, x, y) {
    const [lw, lh] = symWh('sym-load', 50, 64);
    const v = graph.insertVertex(parent, null, '', x, y, lw, lh, LOAD_STYLE);
    configureLoadAttributes(graph, v, {
        name: opts.name || 'Aux_Load',
        p_mw: String(opts.p_mw ?? 0.5),
        q_mvar: String(opts.q_mvar ?? 0),
        sn_mva: String(opts.sn_mva ?? 1),
    });
    const edge = ensureEdge(graph, parent, v, bus, edgeStyleDeviceToBus(v, bus));
    nudgeResultChild(graph, edge, BOX.aux);
    tagRole(graph, v, role);
    replaceRelativeLabels(graph, v, opts.name || 'Aux_Load');
    return v;
}

/**
 * Compute suggested ratings from POC P/Q and topology inputs.
 */
export function computeSuggestedRatings(params) {
    const p = Math.abs(Number(params.pocP_MW) || 0);
    const pf = Math.min(0.999999, Math.max(0.1, Math.abs(Number(params.powerFactor) || 0.95)));
    let q = Math.abs(Number(params.pocQ_Mvar) || 0);
    if (!(q > 0) && p > 0) q = p * Math.tan(Math.acos(pf));
    const n = Math.max(1, parseInt(params.numUnits, 10) || 1);
    const aux = Number(params.auxP_MW) || 0;
    const umin = Math.min(1, Math.max(0.8, Math.abs(Number(params.umin_pu) || 0.95)));
    // Charge at the POC is Pn + aux + losses. Envelope Q is clipped when
    // transformer loading exceeds 100 %; at Umin that is S / (Sn·U). Plant X
    // also consumes Q. Size PCS / trafos so the PF rectangle still fits at Umin.
    const importP = p + aux + 0.05 * p;
    const qAtPcs = q / 0.82;
    const unitP = (importP * 1.12) / n;
    const unitQ = (qAtPcs * 1.30) / n;
    const uLv = Math.max(0.84, umin - 0.05);
    const unitSn = (Math.hypot(unitP, unitQ) / uLv) * 1.18;
    const plantMva = (Math.hypot(importP, qAtPcs) / umin) * 1.22;
    const threeW = params.stringTopology === 'three_winding';
    const pcsPerWinding = Number(params.pcsPerWinding) === 4 ? 4 : 2;
    const pcsPerSkid = threeW ? 2 * pcsPerWinding : 1;
    const stringTrafoSn = unitSn * pcsPerSkid;
    return {
        hvTrafoSnMva: Math.ceil(plantMva * 10) / 10,
        stringTrafoSnMva: Math.ceil(stringTrafoSn * 10) / 10,
        storageSnMva: Math.ceil(unitSn * 10) / 10,
        storagePMaxMw: Math.ceil(unitP * 100) / 100,
        cableMaxIKa: Math.ceil((stringTrafoSn / (Math.sqrt(3) * (Number(params.mvVoltage_kV) || 33))) * 100) / 100,
        pcsPerSkid,
    };
}

/**
 * Ratings entered by the user are written to the diagram as given; only a
 * missing or non-positive value falls back to the suggested rating.
 */
function ratingOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
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
    params.pMaxDischarge_MW = ratingOr(params.pMaxDischarge_MW, suggested.storagePMaxMw);
    params.pMaxCharge_MW = ratingOr(params.pMaxCharge_MW, suggested.storagePMaxMw);
    params.batteryPmax_MW = ratingOr(params.batteryPmax_MW, params.pMaxDischarge_MW);
    params.storageSnMva = ratingOr(params.storageSnMva, suggested.storageSnMva);
    params.hvTrafoSnMva = ratingOr(params.hvTrafoSnMva, suggested.hvTrafoSnMva);
    params.stringTrafoSnMva = ratingOr(params.stringTrafoSnMva, suggested.stringTrafoSnMva);
    params.cableMaxIKa = ratingOr(params.cableMaxIKa, suggested.cableMaxIKa);
    params.hvVkPercent = ratingOr(params.hvVkPercent, 8);
    params.stringVkPercent = ratingOr(params.stringVkPercent, 6);

    const hvKv = Number(params.hvVoltage_kV) || 132;
    const mvKv = Number(params.mvVoltage_kV) || 33;
    const lvKv = Number(params.lvVoltage_kV) || 0.69;
    const centerX = Number(params.layoutCenterX) || 520;
    const y = Number(params.layoutStartY) || 40;

    graph.getModel().beginUpdate();
    try {
        const threeW = params.stringTopology === 'three_winding';
        const pcsPerWinding = Number(params.pcsPerWinding) === 4 ? 4 : 2;
        const pcsPerSkid = threeW ? 2 * pcsPerWinding : 1;
        const nSkids = threeW ? Math.max(1, Math.ceil(nUnits / pcsPerSkid)) : nUnits;
        const skidW = threeW ? threeWSkidWidth(pcsPerWinding) : STRING_BUS_W;
        const colPitch = threeW ? skidW + SKID_GUTTER : COL_SPACING;
        const had3w = Object.keys(existing).some((k) => k.startsWith('lvTrafo3w_'));
        const had2w = Object.keys(existing).some((k) => /^lvTrafo_\d+$/.test(k));
        if ((threeW && had2w) || (!threeW && had3w)) {
            removePlantCells(graph, stringRoleKeys(existing).map((k) => existing[k]));
            stringRoleKeys(existing).forEach((k) => { delete existing[k]; });
        }
        for (let i = 0; i < 20; i++) {
            const extra = [];
            if (i >= nUnits) {
                ['storage_', 'dcBus_', 'battery_'].forEach((p) => {
                    if (existing[`${p}${i}`]) extra.push(existing[`${p}${i}`]);
                });
            }
            if (threeW) {
                if (i >= nSkids) {
                    ['stringBus_', 'cable_', 'lvTrafo3w_', 'lvBusA_', 'lvBusB_'].forEach((p) => {
                        if (existing[`${p}${i}`]) extra.push(existing[`${p}${i}`]);
                    });
                }
                ['lvTrafo_', 'lvBus_'].forEach((p) => {
                    if (existing[`${p}${i}`]) extra.push(existing[`${p}${i}`]);
                });
            } else {
                if (i >= nUnits) {
                    ['stringBus_', 'cable_', 'lvTrafo_', 'lvBus_'].forEach((p) => {
                        if (existing[`${p}${i}`]) extra.push(existing[`${p}${i}`]);
                    });
                }
                ['lvTrafo3w_', 'lvBusA_', 'lvBusB_'].forEach((p) => {
                    if (existing[`${p}${i}`]) extra.push(existing[`${p}${i}`]);
                });
            }
            removePlantCells(graph, extra);
        }

        const pocName = params.pocBusName || 'POC_HV';
        const mvBusName = params.mvBusName || 'MV_Collection';
        const extName = params.extGridName || 'Grid';
        const [ew, eh] = symWh('sym-ext-grid', 58, 58);
        const [, trH] = symWh('sym-transformer-v', 72, 108);
        const [, tw3h] = trafo3wSize();
        const [lw] = symWh('sym-load', 50, 64);

        const totalSpan = Math.max(0, (nSkids - 1) * colPitch);
        const startX = centerX - totalSpan / 2;
        const skidHalf = skidW / 2;
        const mvLeft = startX - skidHalf - SIDE_OVERHANG;
        const mvWidth = totalSpan + skidW + AUX_OVERHANG + SIDE_OVERHANG;
        const extY = y;
        const pocY = extY + eh + 72;
        const hvTrafoY = pocY + BUS_H + 28;
        const mvY = hvTrafoY + trH + 36;
        const stringY = mvY + BUS_H + 168;
        const stringTrafoY = stringY + BUS_H + 64;
        const stringTrafoH = threeW ? tw3h : trH;
        const lvY = stringTrafoY + stringTrafoH + (threeW ? 56 : 72);

        let pocBus = existing.poc;
        if (!pocBus) {
            pocBus = insertBus(graph, parent, centerX - POC_BUS_W / 2, pocY, pocName, hvKv, 'poc', POC_BUS_W, BUSBAR_STYLE_POC);
        } else {
            configureBusAttributes(graph, pocBus, { name: pocName, vn_kv: String(hvKv) });
            tagRole(graph, pocBus, 'poc');
            applyBusbar(graph, pocBus, centerX - POC_BUS_W / 2, pocY, POC_BUS_W, BUSBAR_STYLE_POC);
            replaceRelativeLabels(graph, pocBus, pocName);
        }
        ensureBusPlaceholder(graph, pocBus, BOX.pocBus);

        let extGrid = existing.extGrid;
        const extX = centerX - ew / 2;
        if (!extGrid) {
            extGrid = graph.insertVertex(parent, null, '', extX, extY, ew, eh, EXT_GRID_STYLE);
            configureExternalGridAttributes(graph, extGrid, {
                name: extName,
                vm_pu: String(params.unom_pu ?? 1),
            });
            tagRole(graph, extGrid, 'extGrid');
        } else {
            configureExternalGridAttributes(graph, extGrid, {
                name: extName,
                vm_pu: String(params.unom_pu ?? 1),
            });
            tagRole(graph, extGrid, 'extGrid');
            graph.getModel().setStyle(extGrid, EXT_GRID_STYLE);
            placeCell(graph, extGrid, extX, extY);
        }
        const extEdge = ensureEdge(graph, parent, extGrid, pocBus, edgeStyleDeviceToBus(extGrid, pocBus));
        nudgeResultChild(graph, extEdge, BOX.extGrid);

        let hvTrafo = existing.hvTrafo;
        if (!hvTrafo) {
            hvTrafo = insertTrafo(graph, parent, centerX, hvTrafoY, {
                name: params.hvTrafoName || 'POC_Transformer',
                sn_mva: params.hvTrafoSnMva ?? suggested.hvTrafoSnMva,
                vn_hv_kv: hvKv,
                vn_lv_kv: mvKv,
                vk_percent: params.hvVkPercent ?? 8,
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
        } else {
            configureTransformerAttributes(graph, hvTrafo, {
                name: params.hvTrafoName || 'POC_Transformer',
                sn_mva: String(params.hvTrafoSnMva ?? suggested.hvTrafoSnMva),
                vn_hv_kv: String(hvKv),
                vn_lv_kv: String(mvKv),
                vk_percent: String(params.hvVkPercent ?? 8),
                vkr_percent: String(params.hvVkrPercent ?? 0.4),
                tap_side: 'hv',
                tap_min: String(params.tapMin ?? -5),
                tap_max: String(params.tapMax ?? 5),
                tap_neutral: String(params.tapNeutral ?? 0),
                tap_step_percent: String(params.tapStepPercent ?? 1.25),
                tap_pos: String(params.tapPos ?? 0),
                tap_changer_type: 'Ratio',
                discrete_tap_control: params.oltcEnabled !== false ? 'true' : 'false',
                vm_lower_pu: params.oltcVmLower ?? 0.99,
                vm_upper_pu: params.oltcVmUpper ?? 1.01,
                control_side: 'lv',
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
            placeCentered(graph, hvTrafo, centerX, hvTrafoY);
        }

        let mvBus = existing.mvBus;
        if (!mvBus) {
            mvBus = insertBus(graph, parent, mvLeft, mvY, mvBusName, mvKv, 'mvBus', mvWidth, BUSBAR_STYLE_MV);
        } else {
            configureBusAttributes(graph, mvBus, { name: mvBusName, vn_kv: String(mvKv) });
            tagRole(graph, mvBus, 'mvBus');
            applyBusbar(graph, mvBus, mvLeft, mvY, mvWidth, BUSBAR_STYLE_MV);
            replaceRelativeLabels(graph, mvBus, mvBusName);
        }
        ensureBusPlaceholder(graph, mvBus, BOX.mvBus);

        const hvMvEdge = ensureEdge(graph, parent, hvTrafo, mvBus, edgeStyleTrafoToBus(hvTrafo, mvBus, 'lv'));
        const hvPocEdge = ensureEdge(graph, parent, hvTrafo, pocBus, edgeStyleTrafoToBus(hvTrafo, pocBus, 'hv'));
        parkEdgeResult(graph, hvMvEdge, [hvPocEdge], BOX.hvTrafo);

        const auxX = mvLeft + mvWidth - AUX_OVERHANG / 2 - lw / 2;
        const auxY = mvY + BUS_H + 44;
        let aux = existing.aux;
        if (!aux) {
            aux = insertAuxLoad(graph, parent, mvBus, {
                name: params.auxName || 'Aux_Load',
                p_mw: params.auxP_MW ?? 0.5,
                q_mvar: params.auxQ_Mvar ?? 0.1,
            }, 'aux', auxX, auxY);
        } else {
            configureLoadAttributes(graph, aux, {
                name: params.auxName || 'Aux_Load',
                p_mw: String(params.auxP_MW ?? 0.5),
                q_mvar: String(params.auxQ_Mvar ?? 0.1),
            });
            tagRole(graph, aux, 'aux');
            placeCell(graph, aux, auxX, auxY);
            const auxEdge = ensureEdge(graph, parent, aux, mvBus, edgeStyleDeviceToBus(aux, mvBus));
            nudgeResultChild(graph, auxEdge, BOX.aux);
            replaceRelativeLabels(graph, aux, params.auxName || 'Aux_Load');
        }

        const placePcs = (bus, idx, offsetX) => {
            const storName = pcsUnitName(params, idx);
            const pcsOpts = storageNameplate(params, suggested, storName);
            let storage = existing[`storage_${idx}`];
            if (!storage) {
                storage = insertStorage(graph, parent, bus, pcsOpts, `storage_${idx}`, offsetX);
            } else {
                configureStorageAttributes(graph, storage, {
                    ...pcsOpts,
                    sn_mva: String(pcsOpts.sn_mva),
                    max_e_mwh: String(pcsOpts.max_e_mwh),
                });
                if (pcsOpts.battery_dc_pmax_mw) {
                    setCellAttr(graph, storage, 'battery_dc_pmax_mw', pcsOpts.battery_dc_pmax_mw);
                }
                tagRole(graph, storage, `storage_${idx}`);
                const [sw, sh] = pcsSymbolSize();
                const bg = graph.getCellGeometry(bus);
                graph.getModel().setStyle(storage, pcsStyle());
                placeCell(graph, storage, bg.x + bg.width / 2 - sw / 2 + offsetX, bg.y + bg.height + COMP_GAP, sw, sh);
                const stEdge = ensureEdge(graph, parent, storage, bus, edgeStyleDeviceToBus(storage, bus));
                nudgeResultChild(graph, stEdge, BOX.storage);
                replaceRelativeLabels(graph, storage, storName);
                placeNameChild(graph, storage, 0, 0.28);
            }
            placeDcRack(graph, parent, storage, idx, params, existing);
            ensureBusPlaceholder(graph, bus, lvBusBox(bus));
        };
        const pcsOffsets = (count) => {
            if (count <= 1) return [0];
            const pitch = PCS_COLUMN_PITCH;
            const startOff = -((count - 1) * pitch) / 2;
            return Array.from({ length: count }, (_, i) => startOff + i * pitch);
        };

        const stringTrafoSn = params.stringTrafoSnMva;
        const windingSn = threeW ? Math.max(0.1, Number(stringTrafoSn) / 2) : stringTrafoSn;

        for (let s = 0; s < nSkids; s++) {
            const colX = startX + s * colPitch;
            const strBusName = `String_HV_${s + 1}`;
            let stringBus = existing[`stringBus_${s}`];
            if (!stringBus) {
                stringBus = insertBus(graph, parent, colX - STRING_BUS_W / 2, stringY, strBusName, mvKv, `stringBus_${s}`, STRING_BUS_W);
            } else {
                configureBusAttributes(graph, stringBus, { name: strBusName, vn_kv: String(mvKv) });
                tagRole(graph, stringBus, `stringBus_${s}`);
                applyBusbar(graph, stringBus, colX - STRING_BUS_W / 2, stringY, STRING_BUS_W);
                replaceRelativeLabels(graph, stringBus, strBusName);
            }
            ensureBusPlaceholder(graph, stringBus, BOX.stringBus);

            insertCable(graph, parent, mvBus, stringBus, {
                name: `MV_Cable_${s + 1}`,
                length_km: params.cableLength_km ?? 0.3,
                r_ohm_per_km: params.cableR_ohmPerKm ?? 0.08,
                x_ohm_per_km: params.cableX_ohmPerKm ?? 0.12,
                max_i_ka: params.cableMaxIKa,
            }, `cable_${s}`, colX);

            if (!threeW) {
                let lvTrafo = existing[`lvTrafo_${s}`];
                if (!lvTrafo) {
                    lvTrafo = insertTrafo(graph, parent, colX, stringTrafoY, {
                        name: `MV_LV_Trafo_${s + 1}`,
                        sn_mva: stringTrafoSn,
                        vn_hv_kv: mvKv,
                        vn_lv_kv: lvKv,
                        vk_percent: params.stringVkPercent ?? 6,
                        vkr_percent: params.stringVkrPercent ?? 0.5,
                    }, `lvTrafo_${s}`, true);
                } else {
                    configureTransformerAttributes(graph, lvTrafo, {
                        name: `MV_LV_Trafo_${s + 1}`,
                        sn_mva: String(stringTrafoSn),
                        vn_hv_kv: String(mvKv),
                        vn_lv_kv: String(lvKv),
                        vk_percent: String(params.stringVkPercent ?? 6),
                        vkr_percent: String(params.stringVkrPercent ?? 0.5),
                        max_loading_percent: '100',
                    });
                    tagRole(graph, lvTrafo, `lvTrafo_${s}`);
                    placeCentered(graph, lvTrafo, colX, stringTrafoY);
                }

                const lvName = `LV_Bus_${s + 1}`;
                let lvBus = existing[`lvBus_${s}`];
                if (!lvBus) {
                    lvBus = insertBus(graph, parent, colX - STRING_BUS_W / 2, lvY, lvName, lvKv, `lvBus_${s}`, STRING_BUS_W);
                } else {
                    configureBusAttributes(graph, lvBus, { name: lvName, vn_kv: String(lvKv) });
                    tagRole(graph, lvBus, `lvBus_${s}`);
                    applyBusbar(graph, lvBus, colX - STRING_BUS_W / 2, lvY, STRING_BUS_W);
                    replaceRelativeLabels(graph, lvBus, lvName);
                }
                const tLv = ensureEdge(graph, parent, lvTrafo, lvBus, edgeStyleTrafoToBus(lvTrafo, lvBus, 'lv'));
                const tHv = ensureEdge(graph, parent, lvTrafo, stringBus, edgeStyleTrafoToBus(lvTrafo, stringBus, 'hv'));
                parkEdgeResult(graph, tLv, [tHv], BOX.stringTrafo);
                ensureBusPlaceholder(graph, lvBus, BOX.lvBus);
                placePcs(lvBus, s, 0);
                continue;
            }

            let lvTrafo3w = existing[`lvTrafo3w_${s}`];
            const vk = params.stringVkPercent ?? 6;
            const vkr = params.stringVkrPercent ?? 0.5;
            if (!lvTrafo3w) {
                lvTrafo3w = insertTrafo3w(graph, parent, colX, stringTrafoY, {
                    name: `MV_LV_Trafo3w_${s + 1}`,
                    sn_hv_mva: stringTrafoSn,
                    sn_mv_mva: windingSn,
                    sn_lv_mva: windingSn,
                    vn_hv_kv: mvKv,
                    vn_mv_kv: lvKv,
                    vn_lv_kv: lvKv,
                    vk_hv_percent: vk,
                    vk_mv_percent: vk,
                    vk_lv_percent: vk,
                    vkr_hv_percent: vkr,
                    vkr_mv_percent: vkr,
                    vkr_lv_percent: vkr,
                    vector_group: 'YNyn0yn0',
                }, `lvTrafo3w_${s}`);
            } else {
                configureThreeWindingTransformerAttributes(graph, lvTrafo3w, {
                    name: `MV_LV_Trafo3w_${s + 1}`,
                    sn_hv_mva: stringTrafoSn,
                    sn_mv_mva: windingSn,
                    sn_lv_mva: windingSn,
                    vn_hv_kv: mvKv,
                    vn_mv_kv: lvKv,
                    vn_lv_kv: lvKv,
                    vk_hv_percent: vk,
                    vk_mv_percent: vk,
                    vk_lv_percent: vk,
                    vkr_hv_percent: vkr,
                    vkr_mv_percent: vkr,
                    vkr_lv_percent: vkr,
                    vector_group: 'YNyn0yn0',
                    max_loading_percent: 100,
                    term_label_0: 'HV',
                    term_label_1: 'LV',
                    term_label_2: 'LV',
                });
                tagRole(graph, lvTrafo3w, `lvTrafo3w_${s}`);
                placeTrafo3w(graph, lvTrafo3w, colX, stringTrafoY);
            }

            const lvW = lvBusWidthForPcs(pcsPerWinding);
            const leftX = colX - LV3W_INNER_GAP - lvW;
            const rightX = colX + LV3W_INNER_GAP;
            let lvBusA = existing[`lvBusA_${s}`];
            if (!lvBusA) {
                lvBusA = insertBus(graph, parent, leftX, lvY, `LV_Bus_${s + 1}A`, lvKv, `lvBusA_${s}`, lvW);
            } else {
                configureBusAttributes(graph, lvBusA, { name: `LV_Bus_${s + 1}A`, vn_kv: String(lvKv) });
                tagRole(graph, lvBusA, `lvBusA_${s}`);
                applyBusbar(graph, lvBusA, leftX, lvY, lvW);
                replaceRelativeLabels(graph, lvBusA, `LV_Bus_${s + 1}A`);
            }
            let lvBusB = existing[`lvBusB_${s}`];
            if (!lvBusB) {
                lvBusB = insertBus(graph, parent, rightX, lvY, `LV_Bus_${s + 1}B`, lvKv, `lvBusB_${s}`, lvW);
            } else {
                configureBusAttributes(graph, lvBusB, { name: `LV_Bus_${s + 1}B`, vn_kv: String(lvKv) });
                tagRole(graph, lvBusB, `lvBusB_${s}`);
                applyBusbar(graph, lvBusB, rightX, lvY, lvW);
                replaceRelativeLabels(graph, lvBusB, `LV_Bus_${s + 1}B`);
            }
            const eA = ensureEdge(graph, parent, lvTrafo3w, lvBusA, edgeStyleTrafo3wWinding(lvTrafo3w, lvBusA, 'lvA'));
            const eB = ensureEdge(graph, parent, lvTrafo3w, lvBusB, edgeStyleTrafo3wWinding(lvTrafo3w, lvBusB, 'lvB'));
            const eH = ensureEdge(graph, parent, lvTrafo3w, stringBus, edgeStyleTrafo3wWinding(lvTrafo3w, stringBus, 'hv'));
            parkEdgeResult(graph, eH, [eA, eB], BOX.stringTrafo3w);
            ensureBusPlaceholder(graph, lvBusA, BOX.lvBusA);
            ensureBusPlaceholder(graph, lvBusB, BOX.lvBusB);

            const startIdx = s * pcsPerSkid;
            const onSkid = Math.max(0, Math.min(pcsPerSkid, nUnits - startIdx));
            const nLeft = Math.min(pcsPerWinding, onSkid);
            const nRight = Math.max(0, onSkid - nLeft);
            pcsOffsets(nLeft).forEach((dx, k) => placePcs(lvBusA, startIdx + k, dx));
            pcsOffsets(nRight).forEach((dx, k) => placePcs(lvBusB, startIdx + nLeft + k, dx));
        }
        parkPlantResultBoxes(graph);
        return {
            created: !existing.poc,
            pocBusId: pocBus?.getId?.(),
            extGridName: extName,
            pocBusName: pocName,
            storageNames: Array.from({ length: nUnits }, (_, i) => pcsUnitName(params, i)),
            hvTrafoName: params.hvTrafoName || 'POC_Transformer',
        };
    } finally {
        graph.getModel().endUpdate();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                try { parkPlantResultBoxes(graph); } catch { /* ignore */ }
            });
        }
    }
}

export function findBessPlantElements(graph) {
    const cells = findPlantCells(graph);
    const byRole = (re) => Object.keys(cells)
        .filter((k) => re.test(k) && cells[k] && !Array.isArray(cells[k]))
        .sort((a, b) => (parseInt(a.split('_').pop(), 10) || 0) - (parseInt(b.split('_').pop(), 10) || 0))
        .map((k) => cells[k]);
    return {
        pocBus: cells.poc || null,
        extGrid: cells.extGrid || null,
        hvTrafo: cells.hvTrafo || null,
        mvBus: cells.mvBus || null,
        aux: cells.aux || null,
        storages: byRole(/^storage_\d+$/),
        dcBuses: byRole(/^dcBus_\d+$/),
        batteries: byRole(/^battery_\d+$/),
        cables: byRole(/^cable_\d+$/),
        stringBuses: byRole(/^stringBus_\d+$/),
        lvTrafos: byRole(/^lvTrafo_\d+$/),
        lvTrafo3ws: byRole(/^lvTrafo3w_\d+$/),
        lvBuses: byRole(/^lvBus_\d+$/),
        lvBusAs: byRole(/^lvBusA_\d+$/),
        lvBusBs: byRole(/^lvBusB_\d+$/),
    };
}
