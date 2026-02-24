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

const LINE_STYLE         = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=0;entryX=0.5;entryY=0.5;shapeELXXX=Line';
const NOT_EDITABLE_LINE  = 'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;exitX=0.5;exitY=1;entryX=0.5;entryY=0.5;shapeELXXX=NotEditableLine';

// ── Layout constants ───────────────────────────────────────────────────────

const BUS_W = 200;
const BUS_H = 10;
const COL_SPACING = 380;
const ROW_SPACING = 350;
const MAX_COLS = 4;
const COMP_GAP = 30;

const ABOVE_BUS_TYPES = new Set([
    NODE_TYPES.ONSHORE_GRID, NODE_TYPES.WIND_TURBINE,
    NODE_TYPES.STATIC_GENERATOR, NODE_TYPES.SOURCE_DC
]);

/**
 * BFS-order nodes then lay them out in a grid (max MAX_COLS per row).
 * Returns [{ x, y }] indexed by node index.
 */
function computeGridPositions(nodes, cables) {
    const n = nodes.length;
    if (n === 0) return [];

    const idToIdx = new Map();
    nodes.forEach((nd, i) => idToIdx.set(nd.id, i));

    const adj = Array.from({ length: n }, () => []);
    (cables || []).forEach(c => {
        const a = idToIdx.get(c.from);
        const b = idToIdx.get(c.to);
        if (a != null && b != null && a !== b) {
            adj[a].push(b);
            adj[b].push(a);
        }
    });

    // Root: prefer External Grid, then any source, then first
    let root = 0;
    for (let i = 0; i < n; i++) {
        if (nodes[i].type === NODE_TYPES.ONSHORE_GRID) { root = i; break; }
        if (root === 0 && ABOVE_BUS_TYPES.has(nodes[i].type)) root = i;
    }

    // BFS ordering
    const visited = new Array(n).fill(false);
    const order = [];
    visited[root] = true;
    const queue = [root];
    let head = 0;
    while (head < queue.length) {
        const u = queue[head++];
        order.push(u);
        for (const v of adj[u]) {
            if (!visited[v]) { visited[v] = true; queue.push(v); }
        }
    }
    // Pick up any disconnected nodes
    for (let i = 0; i < n; i++) {
        if (!visited[i]) order.push(i);
    }

    // Lay out in grid: BFS-order position → (col, row)
    const positions = new Array(n);
    order.forEach((idx, seqPos) => {
        const col = seqPos % MAX_COLS;
        const row = Math.floor(seqPos / MAX_COLS);
        positions[idx] = {
            x: col * COL_SPACING,
            y: row * ROW_SPACING
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

    graph.getModel().beginUpdate();
    try {
        // 1. Create buses
        nodes.forEach((node, i) => {
            const bx = baseX + positions[i].x;
            const by = baseY + positions[i].y;
            const isDc = node.type === NODE_TYPES.DC_BUS;
            const busVertex = graph.insertVertex(
                parent, null, '',
                bx, by, BUS_W, BUS_H,
                isDc ? DC_BUS_STYLE : BUS_STYLE
            );
            const cfgFn = isDc ? configureDcBusAttributes : configureBusAttributes;
            cfgFn(graph, busVertex, {
                name: node.name || node.id,
                vn_kv: String(node.vn_kv || 110)
            });
            nodeToVertex.set(node.id, { bus: busVertex, node });
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

                // ── Transformers (below bus) ──
                case NODE_TYPES.OFFSHORE_SUBSTATION:
                    insertComp(TRANSFORMER_STYLE, 40, 60, configureTransformerAttributes);
                    break;
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
        cables.forEach((cable) => {
            const fromEntry = nodeToVertex.get(cable.from);
            const toEntry = nodeToVertex.get(cable.to);
            if (!fromEntry || !toEntry) return;

            const edge = graph.insertEdge(parent, null, cable.id || cable.name, fromEntry.bus, toEntry.bus, LINE_STYLE);
            configureLineAttributes(graph, edge, {
                name: cable.id || cable.name,
                from_bus: fromEntry.node.name,
                to_bus: toEntry.node.name,
                length_km: String(cable.length_km || 1),
                r_ohm_per_km: String(cable.r_ohm_per_km || 0.122),
                x_ohm_per_km: String(cable.x_ohm_per_km || 0.112)
            });
        });

        return { nodeToVertex, nodeCount: nodes.length, cableCount: cables.length };
    } finally {
        graph.getModel().endUpdate();
    }
}
