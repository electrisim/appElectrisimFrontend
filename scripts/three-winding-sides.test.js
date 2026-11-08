/**
 * Which busbar is HV / MV / LV for a three-winding transformer.
 * The nearest-port rule only fits the stencil and sym-3w-transformer.svg. Other symbols (draw.io's
 * pot_trans_3_windings in the multivoltage template) used to get 110 kV on the MV winding; they now
 * fall back to the busbars' rated voltages.
 * Run: node scripts/three-winding-sides.test.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const utilsDir = path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'utils');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'elx-3w-'));
fs.copyFileSync(path.join(utilsDir, 'devLog.js'), path.join(tmp, 'devLog.mjs'));
fs.writeFileSync(
    path.join(tmp, 'gridUtils.mjs'),
    fs.readFileSync(path.join(utilsDir, 'gridUtils.js'), 'utf8').replace("'./devLog.js'", "'./devLog.mjs'")
);
globalThis.window = {};

let failed = 0;
function check(actual, expected, label) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
        failed++;
        console.error(`FAIL ${label}: got ${a}, expected ${e}`);
    } else {
        console.log(`PASS ${label}`);
    }
}

let nextId = 1;
function bus(vnKv) {
    const attrs = { vn_kv: vnKv == null ? '' : String(vnKv) };
    return {
        id: `bus${nextId}`,
        mxObjectId: `mxCell#${nextId++}`,
        style: 'line;shapeELXXX=Bus',
        value: { getAttribute: (k) => (k in attrs ? attrs[k] : null) }
    };
}
/** Transformer whose edges go to `buses` in that order, each pinned at `ports[i]` (exitX, exitY). */
function trafo(style, buses, ports) {
    const cell = { id: `t${nextId}`, mxObjectId: `mxCell#${nextId++}`, style, edges: [] };
    buses.forEach((b, i) => {
        const p = ports ? ports[i] : null;
        cell.edges.push({
            source: cell,
            target: b,
            style: p ? `edgeStyle=orthogonalEdgeStyle;exitX=${p[0]};exitY=${p[1]};shapeELXXX=NotEditableLine` : ''
        });
    });
    return cell;
}
const nameOf = (b) => b.mxObjectId.replace('#', '_');

(async () => {
    const g = await import(pathToFileURL(path.join(tmp, 'gridUtils.mjs')).href);

    // multivoltage template: pot_trans_3_windings, edges to 10 kV, 20 kV, 110 kV.
    {
        const lv = bus(10), mv = bus(20), hv = bus(110);
        const t = trafo('shape=mxgraph.electrical.inductors.pot_trans_3_windings;shapeELXXX=Three Winding Transformer',
            [lv, mv, hv], [[0.285, 1], [0.715, 1], [0.5, 0]]);
        check(g.resolveThreeWindingEdgeSides(t), null, 'unknown symbol: ports are not guessed');
        check(g.getThreeWindingConnections(t), { hv_bus: nameOf(hv), mv_bus: nameOf(mv), lv_bus: nameOf(lv) },
            'unknown symbol: sides follow the busbar voltages');
    }
    // Same symbol, edges in another order.
    {
        const lv = bus(10), mv = bus(20), hv = bus(110);
        const t = trafo('shape=mxgraph.electrical.inductors.pot_trans_3_windings;shapeELXXX=Three Winding Transformer',
            [mv, hv, lv], [[0.715, 1], [0.5, 0], [0.285, 1]]);
        check(g.getThreeWindingConnections(t), { hv_bus: nameOf(hv), mv_bus: nameOf(mv), lv_bus: nameOf(lv) },
            'unknown symbol, other edge order: sides follow the busbar voltages');
    }
    // Stencil with known ports keeps the drawn wiring, even when the voltages look swapped
    // (the backend warns about that case).
    {
        const a = bus(20), b = bus(110), c = bus(10);
        const t = trafo('shape=mxgraph.electrical.abstract.three_winding_transformer;shapeELXXX=Three Winding Transformer',
            [a, b, c], [[0.033, 0.389], [0.967, 0.389], [0.5, 0.916]]);
        check(g.getThreeWindingConnections(t), { hv_bus: nameOf(a), mv_bus: nameOf(b), lv_bus: nameOf(c) },
            'stencil: sides follow the ports');
    }
    // BESS builder: vertical image, edges in [LV, MV, HV] order, two 0.69 kV windings.
    {
        const lv = bus(0.69), mv = bus(0.69), hv = bus(33);
        const t = trafo('shape=image;image=images/electrical/sym-3w-transformer-v.svg;shapeELXXX=Three Winding Transformer',
            [lv, mv, hv], null);
        check(g.getThreeWindingConnections(t), { hv_bus: nameOf(hv), mv_bus: nameOf(mv), lv_bus: nameOf(lv) },
            'BESS vertical symbol: equal LV/MV voltages keep the edge order');
    }
    // Missing voltage: legacy [LV, MV, HV] edge order.
    {
        const lv = bus(null), mv = bus(20), hv = bus(110);
        const t = trafo('shape=mxgraph.electrical.inductors.pot_trans_3_windings;shapeELXXX=Three Winding Transformer',
            [lv, mv, hv], null);
        check(g.getThreeWindingConnections(t), { hv_bus: nameOf(hv), mv_bus: nameOf(mv), lv_bus: nameOf(lv) },
            'missing voltage: legacy edge order');
    }

    fs.rmSync(tmp, { recursive: true, force: true });
    if (failed) {
        console.error(`${failed} check(s) failed`);
        process.exit(1);
    }
    console.log('All three-winding side checks passed.');
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
