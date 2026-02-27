/**
 * Converts map editor data to mxGraph electrical model
 * Creates buses, components from palette, and lines with length_km from map coordinates
 */

import { NODE_TYPES } from './MapEditor.js';
import {
    configureBusAttributes,
    configureExternalGridAttributes,
    configureGeneratorAttributes,
    configureStaticGeneratorAttributes,
    configureTransformerAttributes,
    configureThreeWindingTransformerAttributes,
    configureShuntReactorAttributes,
    configureCapacitorAttributes,
    configureLoadAttributes,
    configureAsymmetricLoadAttributes,
    configureImpedanceAttributes,
    configureWardAttributes,
    configureExtendedWardAttributes,
    configureMotorAttributes,
    configureStorageAttributes,
    configureSVCAttributes,
    configureSSCAttributes,
    configureDcBusAttributes,
    configureLoadDcAttributes,
    configureSourceDcAttributes,
    configureVscAttributes,
    configureB2bVscAttributes,
    configureLineAttributes
} from '../configureAttributes.js';

// ── Styles exactly matching the frontend palette (app.min.js) ──────────────

const BUS_STYLE    = 'line;strokeWidth=2;html=1;shapeELXXX=Bus;points=[[0,0.5],[0.05,0.5,0],[0.1,0.5,0],[0.15,0.5,0],[0.2,0.5,0],[0.25,0.5,0],[0.3,0.5,0],[0.35,0.5,0],[0.4,0.5,0],[0.45,0.5,0],[0.5,0.5,0],[0.55,0.5,0],[0.6,0.5,0],[0.65,0.5,0],[0.7,0.5,0],[0.75,0.5,0],[0.8,0.5,0],[0.85,0.5,0],[0.9,0.5,0],[0.95,0.5,0]]';
const DC_BUS_STYLE = 'line;strokeWidth=2;html=1;shapeELXXX=DC Bus;points=[[0,0.5],[0.2,0.5,0],[0.5,0.5,0],[0.8,0.5,0],[1,0.5,0]]';

const EXTERNAL_GRID_STYLE = 'verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.abstract.voltage_regulator;shapeELXXX=External Grid';
const GENERATOR_STYLE     = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.ac_source;shapeELXXX=Generator';
const STATIC_GEN_STYLE    = 'verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.rot_mech.synchro;shapeELXXX=Static Generator';
const SOURCE_DC_STYLE     = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.sourcedc;shapeELXXX=Source DC';

const TRANSFORMER_STYLE    = 'shapeELXXX=Transformer;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;strokeWidth=1;shape=mxgraph.electrical.signal_sources.current_source;';
const TRANSFORMER_3W_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.inductors.pot_trans_3_windings;shapeELXXX=Three Winding Transformer';

const SHUNT_REACTOR_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.inductors.choke;shapeELXXX=Shunt Reactor';
const CAPACITOR_STYLE     = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.capacitors.capacitor_4;shapeELXXX=Capacitor';
const GROUND_STYLE        = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.signal_ground;shapeELXXX=Ground';

const LOAD_STYLE  = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.signal_sources.signal_ground;shapeELXXX=Load';
const ALOAD_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.generic_component;shapeELXXX=Asymmetric Load';
const IMPEDANCE_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.impedance;shapeELXXX=Impedance';
const WARD_STYLE   = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.ward;shapeELXXX=Ward';
const EXWARD_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.extended_ward;shapeELXXX=Extended Ward';

const MOTOR_STYLE   = 'shapeELXXX=Motor;verticalLabelPosition=middle;shadow=0;dashed=0;align=center;html=1;verticalAlign=middle;strokeWidth=1;shape=ellipse;fontSize=32;perimeter=ellipsePerimeter;';
const STORAGE_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.multicell_battery;shapeELXXX=Storage';

const SVC_STYLE  = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.svc;shapeELXXX=SVC';
const TCSC_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.tcsc;shapeELXXX=TCSC';
const SSC_STYLE  = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.ssc;shapeELXXX=SSC';

const LOAD_DC_STYLE  = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.dc_load;shapeELXXX=Load DC';
const SWITCH_STYLE   = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.switch;shapeELXXX=Switch';
const VSC_STYLE      = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.vsc;shapeELXXX=VSC';
const B2B_VSC_STYLE  = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.b2b_vsc;shapeELXXX=B2B VSC';
const PVSYSTEM_STYLE = 'pointerEvents=1;verticalLabelPosition=bottom;shadow=0;dashed=0;align=center;html=1;verticalAlign=top;shape=mxgraph.electrical.miscellaneous.svc;shapeELXXX=PVSystem';

const LINE_STYLE_BASE = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=0;html=1;shapeELXXX=Line';
const NOT_EDITABLE_LINE  = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0.5;shapeELXXX=NotEditableLine';
/** Straight vertical edges for wind turbine compound: fully specified with Dx/Dy/Perimeter=0 */
const WT_EDGE_DOWN = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;shapeELXXX=NotEditableLine';
const WT_EDGE_UP   = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0.5;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0;shapeELXXX=NotEditableLine';

// ── Layout constants ───────────────────────────────────────────────────────

const BUS_W = 260;
const BUS_H = 12;
const COL_SPACING = 480;
const ROW_SPACING = 420;
const MAX_COLS = 4;
const COMP_GAP = 45;
const CABLE_DROP = 60;
const CABLE_LANE_SPACING = 35;
const SUBSTATION_BLOCK_GAP = 120;

const ABOVE_BUS_TYPES = new Set([
    NODE_TYPES.ONSHORE_GRID, NODE_TYPES.WIND_TURBINE,
    NODE_TYPES.STATIC_GENERATOR, NODE_TYPES.SOURCE_DC
]);

/** Offshore wind turbine: LV (0.69 kV) and HV (66 kV) voltage levels */
const WIND_TURBINE_VN_LV_KV = '0.69';
const WIND_TURBINE_VN_HV_KV = '66';

/** Offshore substation: 66 kV (wind farm side) and 275 kV (export side) */
const OFFSHORE_SUBSTATION_VN_LV_KV = '66';
const OFFSHORE_SUBSTATION_VN_HV_KV = '275';

const TURBINE_COL_SPACING = 320;
const STRING_ROW_SPACING = 320;
const SUBSTATION_OFFSET_RIGHT = 180;

/**
 * Topology-aware layout for offshore wind farm: turbines in horizontal strings
 * (left-to-right within each string), strings stacked vertically, substation on the right.
 */
function computeOffshoreWindFarmLayout(nodes, cables) {
    const idToIdx = new Map();
    nodes.forEach((nd, i) => idToIdx.set(nd.id, i));

    const turbines = nodes.filter(n => n.type === NODE_TYPES.OFFSHORE_WIND_TURBINE);
    const substations = nodes.filter(n => n.type === NODE_TYPES.OFFSHORE_SUBSTATION);
    if (turbines.length === 0 || substations.length === 0) return null;

    const adj = new Map();
    cables.forEach(c => {
        const a = c.from, b = c.to;
        if (!adj.has(a)) adj.set(a, new Set());
        if (!adj.has(b)) adj.set(b, new Set());
        adj.get(a).add(b);
        adj.get(b).add(a);
    });

    const substationIds = new Set(substations.map(s => s.id));
    const turbineIds = new Set(turbines.map(t => t.id));

    const getTurbineNeighbors = (id) => [...(adj.get(id) || [])].filter(n => turbineIds.has(n));

    const visited = new Set();
    const strings = [];

    for (const t of turbines) {
        if (visited.has(t.id)) continue;
        const queue = [t.id];
        visited.add(t.id);
        const component = [t.id];
        while (queue.length > 0) {
            const cur = queue.shift();
            for (const nb of getTurbineNeighbors(cur)) {
                if (!visited.has(nb)) {
                    visited.add(nb);
                    queue.push(nb);
                    component.push(nb);
                }
            }
        }
        if (component.length > 0) {
            const deg = (id) => getTurbineNeighbors(id).length;
            const endpoint = component.find(id => deg(id) === 1) || component[0];
            const ordered = [endpoint];
            const remaining = new Set(component);
            remaining.delete(endpoint);
            let current = endpoint;
            while (remaining.size > 0) {
                const neighbors = getTurbineNeighbors(current).filter(n => remaining.has(n));
                if (neighbors.length === 0) break;
                current = neighbors[0];
                ordered.push(current);
                remaining.delete(current);
            }
            if (remaining.size > 0) ordered.push(...remaining);
            strings.push(ordered);
        }
    }

    const positions = new Array(nodes.length);
    const maxTurbinesInString = Math.max(1, ...strings.map(s => s.length));
    const substationX = maxTurbinesInString * TURBINE_COL_SPACING + SUBSTATION_OFFSET_RIGHT;
    const centerY = strings.length > 0 ? (strings.length - 1) * STRING_ROW_SPACING / 2 : 0;

    strings.forEach((string, rowIndex) => {
        string.forEach((nodeId, colIndex) => {
            const idx = idToIdx.get(nodeId);
            if (idx !== undefined) {
                positions[idx] = {
                    x: colIndex * TURBINE_COL_SPACING,
                    y: rowIndex * STRING_ROW_SPACING
                };
            }
        });
    });

    substations.forEach((sub, i) => {
        const idx = idToIdx.get(sub.id);
        if (idx !== undefined) {
            positions[idx] = {
                x: substationX + (i - (substations.length - 1) / 2) * TURBINE_COL_SPACING * 0.5,
                y: centerY
            };
        }
    });

    const others = nodes.filter(n => n.type !== NODE_TYPES.OFFSHORE_WIND_TURBINE && n.type !== NODE_TYPES.OFFSHORE_SUBSTATION);
    others.forEach((nd, i) => {
        const idx = idToIdx.get(nd.id);
        if (idx !== undefined && positions[idx] === undefined) {
            positions[idx] = {
                x: substationX + (strings.length + i) * TURBINE_COL_SPACING,
                y: 0
            };
        }
    });

    return positions;
}

/**
 * Order nodes by map position (left-to-right = increasing lng) then lay them out in a grid.
 * Offshore substations are placed last to avoid overlap with wind turbine compounds.
 * Returns [{ x, y }] indexed by node index.
 */
function computeGridPositions(nodes, cables) {
    const n = nodes.length;
    if (n === 0) return [];

    const offshoreLayout = computeOffshoreWindFarmLayout(nodes, cables);
    if (offshoreLayout) return offshoreLayout;

    const idToIdx = new Map();
    nodes.forEach((nd, i) => idToIdx.set(nd.id, i));

    const hasMapCoords = nodes.some(nd => typeof nd.lng === 'number' && typeof nd.lat === 'number');
    const sortByMap = (indices) => indices.sort((i, j) => {
        const a = nodes[i], b = nodes[j];
        const lngA = typeof a.lng === 'number' ? a.lng : 0;
        const lngB = typeof b.lng === 'number' ? b.lng : 0;
        if (lngA !== lngB) return lngA - lngB;
        const latA = typeof a.lat === 'number' ? a.lat : 0;
        const latB = typeof b.lat === 'number' ? b.lat : 0;
        return latB - latA;
    });

    const turbinesAndOthers = [...Array(n).keys()].filter(i => nodes[i].type !== NODE_TYPES.OFFSHORE_SUBSTATION);
    const substations = [...Array(n).keys()].filter(i => nodes[i].type === NODE_TYPES.OFFSHORE_SUBSTATION);
    const order = hasMapCoords
        ? [...sortByMap(turbinesAndOthers), ...sortByMap(substations)]
        : [...turbinesAndOthers, ...substations];

    const numTurbines = turbinesAndOthers.length;
    const numSubstations = substations.length;
    const positions = new Array(n);
    const substationStartRow = Math.floor(numTurbines / MAX_COLS);
    order.forEach((idx, seqPos) => {
        const col = seqPos % MAX_COLS;
        const row = Math.floor(seqPos / MAX_COLS);
        const isInSubstationBlock = row >= substationStartRow && numSubstations > 0;
        positions[idx] = {
            x: col * COL_SPACING,
            y: row * ROW_SPACING + (isInSubstationBlock ? SUBSTATION_BLOCK_GAP : 0)
        };
    });
    return positions;
}

/**
 * Convert map data to mxGraph diagram
 */
export function mapToElectricalModel(graph, mapData, point = { x: 100, y: 100 }) {
    if (!graph || !mapData || !mapData.nodes || mapData.nodes.length === 0) {
        throw new Error('Invalid map data: need at least one node');
    }

    const parent = graph.getDefaultParent();
    const scale = graph.view.scale;
    const tr = graph.view.translate;
    const baseX = (point.x || 100) / scale - tr.x;
    const baseY = (point.y || 100) / scale - tr.y;

    const nodes = mapData.nodes;
    const cables = mapData.cables || [];
    const positions = computeGridPositions(nodes, cables);

    const nodeToVertex = new Map();
    const busesForResultBoxes = [];

    graph.getModel().beginUpdate();
    try {
        // 1. Create buses
        nodes.forEach((node, i) => {
            const bx = baseX + positions[i].x;
            const by = baseY + positions[i].y;
            const isDc = node.type === NODE_TYPES.DC_BUS;
            const isOffshoreWT = node.type === NODE_TYPES.OFFSHORE_WIND_TURBINE;
            const isOffshoreSub = node.type === NODE_TYPES.OFFSHORE_SUBSTATION;
            const vnKv = isOffshoreWT ? WIND_TURBINE_VN_HV_KV
                : isOffshoreSub ? OFFSHORE_SUBSTATION_VN_HV_KV
                : String(node.vn_kv || 110);
            const busVertex = graph.insertVertex(
                parent, null, '',
                bx, by, BUS_W, BUS_H,
                isDc ? DC_BUS_STYLE : BUS_STYLE
            );
            const cfgFn = isDc ? configureDcBusAttributes : configureBusAttributes;
            const busName = isOffshoreSub ? (node.name || node.id) + '_275' : (node.name || node.id);
            cfgFn(graph, busVertex, {
                name: busName,
                vn_kv: vnKv
            });
            const entry = { bus: busVertex, node };
            if (isOffshoreSub) entry.bus275 = busVertex;
            nodeToVertex.set(node.id, entry);
            busesForResultBoxes.push(busVertex);
        });

        // 2. Create components and connect to buses
        nodes.forEach((node) => {
            const { bus } = nodeToVertex.get(node.id);
            if (!bus) return;

            const geo = graph.getCellGeometry(bus);
            const bx = geo.x;
            const by = geo.y;
            const bw = geo.width;
            const vn = String(node.vn_kv || 110);
            const above = ABOVE_BUS_TYPES.has(node.type);

            const insertComp = (style, w, h, cfgFn, opts = {}) => {
                const cx = bx + bw / 2 - w / 2;
                const cy = above ? by - h - COMP_GAP : by + BUS_H + COMP_GAP;
                const v = graph.insertVertex(parent, null, '', cx, cy, w, h, style);
                if (cfgFn) cfgFn(graph, v, opts);
                graph.insertEdge(parent, null, '', v, bus, NOT_EDITABLE_LINE);
            };

            switch (node.type) {
                // ── Offshore Wind Turbine: Static Gen + LV Bus (0.69 kV) + Transformer (0.69/66 kV) + HV Bus (66 kV) ──
                case NODE_TYPES.OFFSHORE_WIND_TURBINE: {
                    const hvBus = bus;
                    const centerX = bx + bw / 2;

                    // LV bus (0.69 kV) above HV bus (66 kV)
                    const lvBusY = by - 170;
                    const lvBus = graph.insertVertex(parent, null, '', bx, lvBusY, BUS_W, BUS_H, BUS_STYLE);
                    configureBusAttributes(graph, lvBus, {
                        name: (node.name || node.id) + '_LV',
                        vn_kv: WIND_TURBINE_VN_LV_KV
                    });
                    busesForResultBoxes.push(lvBus);

                    // Static gen above LV bus, rotated 180° so output faces down
                    const pMw = String(node.p_mw || 15);
                    const sgenW = 45, sgenH = 45;
                    const sgenX = centerX - sgenW / 2;
                    const sgenY = lvBusY - 70 - sgenH;
                    const sgenStyle = STATIC_GEN_STYLE + ';rotation=180';
                    const staticGen = graph.insertVertex(parent, null, '', sgenX, sgenY, sgenW, sgenH, sgenStyle);
                    configureStaticGeneratorAttributes(graph, staticGen, { p_mw: pMw, q_mvar: '0', sn_mva: String(Number(pMw) * 1.2) });
                    graph.insertEdge(parent, null, '', staticGen, lvBus, WT_EDGE_UP);

                    // Transformer rotated 180° so LV winding at top, HV winding at bottom
                    const trafoW = 40, trafoH = 60;
                    const trafoX = centerX - trafoW / 2;
                    const trafoY = lvBusY + BUS_H + (by - lvBusY - BUS_H - trafoH) / 2;
                    const trafoStyleRotated = TRANSFORMER_STYLE + 'rotation=180;';
                    const trafo = graph.insertVertex(parent, null, '', trafoX, trafoY, trafoW, trafoH, trafoStyleRotated);
                    configureTransformerAttributes(graph, trafo, {
                        name: (node.name || node.id) + '_trafo',
                        vn_hv_kv: WIND_TURBINE_VN_HV_KV,
                        vn_lv_kv: WIND_TURBINE_VN_LV_KV,
                        sn_mva: String(Number(pMw) * 1.2)
                    });
                    graph.insertEdge(parent, null, '', trafo, lvBus, WT_EDGE_DOWN);
                    graph.insertEdge(parent, null, '', trafo, hvBus, WT_EDGE_UP);
                    break;
                }

                // ── Sources (above bus) ──
                case NODE_TYPES.ONSHORE_GRID:
                    insertComp(EXTERNAL_GRID_STYLE, 70, 58, configureExternalGridAttributes, { vm_pu: '1', va_degree: '0' });
                    break;
                case NODE_TYPES.WIND_TURBINE:
                    insertComp(GENERATOR_STYLE, 45, 45, configureGeneratorAttributes, {
                        p_mw: String(node.p_mw || 15), vm_pu: '1', sn_mva: String((node.p_mw || 15) * 1.2)
                    });
                    break;
                case NODE_TYPES.STATIC_GENERATOR:
                    insertComp(STATIC_GEN_STYLE, 45, 45, configureStaticGeneratorAttributes, {
                        p_mw: String(node.p_mw || 0), q_mvar: '0', sn_mva: '0'
                    });
                    break;
                case NODE_TYPES.SOURCE_DC:
                    insertComp(SOURCE_DC_STYLE, 20, 20, configureSourceDcAttributes, { vm_pu: '1.0' });
                    break;

                // ── Offshore Substation: 275 kV bus (top) + Transformer (66/275 kV) + 66 kV bus (bottom) ──
                case NODE_TYPES.OFFSHORE_SUBSTATION: {
                    const bus275 = bus;
                    const centerX = bx + bw / 2;

                    // Transformer 66/275 kV below 275 kV bus
                    const trafoW = 40, trafoH = 60;
                    const trafoX = centerX - trafoW / 2;
                    const trafoY = by + BUS_H + COMP_GAP;
                    const trafo = graph.insertVertex(parent, null, '', trafoX, trafoY, trafoW, trafoH, TRANSFORMER_STYLE);
                    configureTransformerAttributes(graph, trafo, {
                        name: (node.name || node.id) + '_trafo',
                        vn_hv_kv: OFFSHORE_SUBSTATION_VN_HV_KV,
                        vn_lv_kv: OFFSHORE_SUBSTATION_VN_LV_KV,
                        sn_mva: String(node.sn_mva || 100)
                    });
                    graph.insertEdge(parent, null, '', trafo, bus275, WT_EDGE_UP);

                    // 66 kV bus below transformer
                    const bus66Y = trafoY + trafoH + COMP_GAP;
                    const bus66 = graph.insertVertex(parent, null, '', bx, bus66Y, BUS_W, BUS_H, BUS_STYLE);
                    configureBusAttributes(graph, bus66, {
                        name: (node.name || node.id) + '_66',
                        vn_kv: OFFSHORE_SUBSTATION_VN_LV_KV
                    });
                    busesForResultBoxes.push(bus66);
                    graph.insertEdge(parent, null, '', trafo, bus66, WT_EDGE_DOWN);

                    const entry = nodeToVertex.get(node.id);
                    if (entry) entry.bus66 = bus66;
                    break;
                }

                // ── Transformers (below bus) ──
                case NODE_TYPES.TRANSFORMER_3W:
                    insertComp(TRANSFORMER_3W_STYLE, 67, 96, configureThreeWindingTransformerAttributes);
                    break;

                // ── Compensation (below bus) ──
                case NODE_TYPES.SHUNT_REACTOR:
                    insertComp(SHUNT_REACTOR_STYLE, 30, 60, configureShuntReactorAttributes, { q_mvar: String(node.q_mvar || 0), vn_kv: vn });
                    break;
                case NODE_TYPES.CAPACITOR:
                    insertComp(CAPACITOR_STYLE, 30, 60, configureCapacitorAttributes, { q_mvar: String(node.q_mvar || 0), vn_kv: vn });
                    break;
                case NODE_TYPES.GROUND:
                    insertComp(GROUND_STYLE, 30, 20, null);
                    break;

                // ── Load / Impedance / Ward (below bus) ──
                case NODE_TYPES.LOAD:
                    insertComp(LOAD_STYLE, 30, 20, configureLoadAttributes, { p_mw: String(node.p_mw || 0), q_mvar: '0', sn_mva: '0' });
                    break;
                case NODE_TYPES.LOAD_ASYMMETRIC:
                    insertComp(ALOAD_STYLE, 20, 20, configureAsymmetricLoadAttributes);
                    break;
                case NODE_TYPES.IMPEDANCE:
                    insertComp(IMPEDANCE_STYLE, 20, 20, configureImpedanceAttributes);
                    break;
                case NODE_TYPES.WARD:
                    insertComp(WARD_STYLE, 20, 20, configureWardAttributes);
                    break;
                case NODE_TYPES.EXTENDED_WARD:
                    insertComp(EXWARD_STYLE, 20, 20, configureExtendedWardAttributes);
                    break;

                // ── Rotating (below bus) ──
                case NODE_TYPES.MOTOR:
                    insertComp(MOTOR_STYLE, 45, 45, configureMotorAttributes, { pn_mech_mw: String(node.p_mw || 0), vn_kv: vn });
                    break;

                // ── Storage (below bus) ──
                case NODE_TYPES.STORAGE:
                    insertComp(STORAGE_STYLE, 60, 30, configureStorageAttributes, { p_mw: String(node.p_mw || 0) });
                    break;

                // ── Pandapower-only (below bus) ──
                case NODE_TYPES.SVC:
                    insertComp(SVC_STYLE, 20, 20, configureSVCAttributes);
                    break;
                case NODE_TYPES.SSC:
                    insertComp(SSC_STYLE, 20, 20, configureSSCAttributes);
                    break;
                case NODE_TYPES.TCSC:
                    insertComp(TCSC_STYLE, 20, 20, null);
                    break;
                case NODE_TYPES.SWITCH:
                    insertComp(SWITCH_STYLE, 20, 20, null);
                    break;
                case NODE_TYPES.DC_LINE:
                    break;
                case NODE_TYPES.LOAD_DC:
                    insertComp(LOAD_DC_STYLE, 20, 20, configureLoadDcAttributes, { p_mw: String(node.p_mw || 0) });
                    break;
                case NODE_TYPES.VSC:
                    insertComp(VSC_STYLE, 20, 20, configureVscAttributes);
                    break;
                case NODE_TYPES.B2B_VSC:
                    insertComp(B2B_VSC_STYLE, 20, 20, configureB2bVscAttributes);
                    break;

                // ── OpenDSS (below bus) ──
                case NODE_TYPES.PVSYSTEM:
                    insertComp(PVSYSTEM_STYLE, 20, 20, null);
                    break;

                // ── Bus-only types ──
                case NODE_TYPES.BUS:
                case NODE_TYPES.DC_BUS:
                default:
                    break;
            }
        });

        // 3. Create lines between buses
        const getBusForCable = (entry, otherEntry) => {
            if (!entry.bus275) return entry.bus;
            const otherType = otherEntry?.node?.type;
            const use275 = otherType === NODE_TYPES.ONSHORE_GRID || otherType === NODE_TYPES.BUS;
            return use275 ? entry.bus275 : entry.bus66 || entry.bus;
        };

        let globalMinBusY = Infinity;
        cables.forEach((cable) => {
            const fromEntry = nodeToVertex.get(cable.from);
            const toEntry = nodeToVertex.get(cable.to);
            if (!fromEntry || !toEntry) return;
            const fromBus = getBusForCable(fromEntry, toEntry);
            const toBus = getBusForCable(toEntry, fromEntry);
            const fromGeo = graph.getCellGeometry(fromBus);
            const toGeo = graph.getCellGeometry(toBus);
            globalMinBusY = Math.min(globalMinBusY, fromGeo.y, toGeo.y);
        });
        const globalBaseAboveY = (globalMinBusY === Infinity ? 0 : globalMinBusY) - CABLE_DROP;

        const isSubCable = (c) => {
            const fe = nodeToVertex.get(c.from), te = nodeToVertex.get(c.to);
            return fe?.node?.type === NODE_TYPES.OFFSHORE_SUBSTATION || te?.node?.type === NODE_TYPES.OFFSHORE_SUBSTATION;
        };
        const substationCables = cables.filter(c => isSubCable(c));
        const nonSubstationCables = cables.filter(c => !isSubCable(c));
        substationCables.sort((a, b) => {
            const getTurbineY = (c) => {
                const fe = nodeToVertex.get(c.from), te = nodeToVertex.get(c.to);
                const turbineEntry = fe?.node?.type === NODE_TYPES.OFFSHORE_SUBSTATION ? te : fe;
                if (!turbineEntry) return 0;
                const bus = turbineEntry.bus;
                return graph.getCellGeometry(bus)?.y || 0;
            };
            return getTurbineY(a) - getTurbineY(b);
        });
        const sortedCables = [...nonSubstationCables, ...substationCables];

        sortedCables.forEach((cable, cableIndex) => {
            const fromEntry = nodeToVertex.get(cable.from);
            const toEntry = nodeToVertex.get(cable.to);
            if (!fromEntry || !toEntry) return;

            const fromBus = getBusForCable(fromEntry, toEntry);
            const toBus = getBusForCable(toEntry, fromEntry);

            const fromGeo = graph.getCellGeometry(fromBus);
            const toGeo = graph.getCellGeometry(toBus);
            const fromCenterX = fromGeo.x + fromGeo.width / 2;
            const toCenterX = toGeo.x + toGeo.width / 2;
            const sameColumn = Math.abs(fromCenterX - toCenterX) < 50;
            const sameRow = Math.abs(fromGeo.y - toGeo.y) < 50;
            const fromIsSubstation = fromEntry?.node?.type === NODE_TYPES.OFFSHORE_SUBSTATION;
            const toIsSubstation = toEntry?.node?.type === NODE_TYPES.OFFSHORE_SUBSTATION;
            const hasSubstation = fromIsSubstation || toIsSubstation;
            let points;
            let lineStyle;
            if (sameColumn) {
                const midY = (fromGeo.y + toGeo.y) / 2;
                points = [new mxPoint(fromCenterX, midY)];
                const sourceAbove = fromGeo.y < toGeo.y;
                const exitY = sourceAbove ? '1' : '0';
                const entryY = sourceAbove ? '0' : '1';
                lineStyle = LINE_STYLE_BASE + `;exitX=0.5;exitY=${exitY};entryX=0.5;entryY=${entryY};exitDx=0;exitDy=0;entryDx=0;entryDy=0;exitPerimeter=0;entryPerimeter=0`;
            } else if (sameRow && !hasSubstation) {
                const midX = (fromCenterX + toCenterX) / 2;
                points = [new mxPoint(midX, fromGeo.y)];
                const sourceLeft = fromGeo.x < toGeo.x;
                const exitX = sourceLeft ? '1' : '0';
                const entryX = sourceLeft ? '0' : '1';
                lineStyle = LINE_STYLE_BASE + `;exitX=${exitX};exitY=0.5;entryX=${entryX};entryY=0.5;exitDx=0;exitDy=0;entryDx=0;entryDy=0;exitPerimeter=0;entryPerimeter=0`;
            } else if (hasSubstation) {
                const turbineGeo = fromIsSubstation ? toGeo : fromGeo;
                const subGeo = fromIsSubstation ? fromGeo : toGeo;
                const turnX = subGeo.x - 20 - cableIndex * CABLE_LANE_SPACING;
                const turbineY = turbineGeo.y + turbineGeo.height / 2;
                const subY = subGeo.y + subGeo.height / 2;
                points = [
                    new mxPoint(turnX, turbineY),
                    new mxPoint(turnX, subY)
                ];
                lineStyle = LINE_STYLE_BASE + `;exitX=1;exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0`;
            } else {
                const sourceLeftOfTarget = fromGeo.x < toGeo.x;
                const exitX = sourceLeftOfTarget ? '1' : '0';
                const entryX = sourceLeftOfTarget ? '0' : '1';
                const fromAbsX = sourceLeftOfTarget ? fromGeo.x + fromGeo.width : fromGeo.x;
                const toAbsX = sourceLeftOfTarget ? toGeo.x : toGeo.x + toGeo.width;
                const aboveY = globalBaseAboveY - cableIndex * CABLE_LANE_SPACING;
                points = [new mxPoint(fromAbsX, aboveY), new mxPoint(toAbsX, aboveY)];
                lineStyle = LINE_STYLE_BASE + `;exitX=${exitX};exitY=0.5;exitDx=0;exitDy=0;exitPerimeter=0;entryX=${entryX};entryY=0.5;entryDx=0;entryDy=0;entryPerimeter=0`;
            }

            const edge = graph.insertEdge(parent, null, cable.id || cable.name, fromBus, toBus, lineStyle);

            let edgeGeo = graph.getCellGeometry(edge);
            if (edgeGeo && points.length > 0) {
                edgeGeo = edgeGeo.clone();
                edgeGeo.points = points;
                graph.getModel().setGeometry(edge, edgeGeo);
            }
            const busLabel = (entry, bus) => {
                if (!entry) return '';
                if (entry.bus275 && bus === entry.bus275) return (entry.node.name || entry.node.id) + '_275';
                if (entry.bus66 && bus === entry.bus66) return (entry.node.name || entry.node.id) + '_66';
                return (entry.node.name || entry.node.id);
            };
            const fromBusName = busLabel(fromEntry, fromBus);
            const toBusName = busLabel(toEntry, toBus);
            configureLineAttributes(graph, edge, {
                name: cable.id || cable.name,
                from_bus: fromBusName,
                to_bus: toBusName,
                length_km: String(cable.length_km || 1),
                r_ohm_per_km: String(cable.r_ohm_per_km || 0.122),
                x_ohm_per_km: String(cable.x_ohm_per_km || 0.112)
            });
        });

        // 4. Add result placeholders to all generated buses (resultBoxes.js)
        if (typeof window.createBusResultPlaceholder === 'function') {
            busesForResultBoxes.forEach((busCell) => {
                try {
                    window.createBusResultPlaceholder(graph, busCell);
                } catch (e) {
                    console.warn('mapToElectricalModel: createBusResultPlaceholder failed for bus', e);
                }
            });
        }

        return { nodeToVertex, nodeCount: nodes.length, cableCount: cables.length };
    } finally {
        graph.getModel().endUpdate();
    }
}
