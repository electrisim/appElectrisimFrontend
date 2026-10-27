/**
 * Placement rules for on-diagram load-flow result boxes.
 * Run: node scripts/result-box-placement.test.js
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

global.window = global;
global.document = { readyState: 'complete', addEventListener() {} };
global.mxPoint = function (x, y) { this.x = x; this.y = y; };
global.setTimeout = function () { return 0; };

vm.runInThisContext(
    fs.readFileSync(path.join(__dirname, '../src/main/webapp/js/electrisim/results/resultBoxes.js'), 'utf8'),
    { filename: 'resultBoxes.js' }
);

let failed = 0;
function assert(cond, msg) {
    if (!cond) {
        failed++;
        console.error('FAIL:', msg);
    }
}
function assertNear(a, b, msg) {
    assert(Math.abs(a - b) < 1e-6, msg + ' (got ' + a + ', expected ' + b + ')');
}

function makeGeo(x, y, w, h) {
    const g = { x: x, y: y, width: w, height: h, relative: false, offset: null };
    g.clone = function () {
        const n = {
            x: this.x, y: this.y, width: this.width, height: this.height,
            relative: this.relative,
            offset: this.offset ? new mxPoint(this.offset.x, this.offset.y) : null
        };
        n.clone = g.clone;
        return n;
    };
    return g;
}

function makeGraph() {
    const cells = {};
    let seq = 1;
    const model = {
        getCell(id) { return cells[String(id)] || null; },
        getStyle(c) { return (c && c.style) || ''; },
        getParent(c) { return c ? c.parent : null; },
        getChildCount(c) { return c && c.children ? c.children.length : 0; },
        getChildAt(c, i) { return c.children[i]; },
        getRoot() { return cells.root; },
        getGeometry(c) { return c.geometry; },
        setGeometry(c, g) { c.geometry = g; },
        getValue(c) { return c.value; },
        beginUpdate() {},
        endUpdate() {},
        add(parent, child) {
            if (child.parent && child.parent.children) {
                const i = child.parent.children.indexOf(child);
                if (i >= 0) child.parent.children.splice(i, 1);
            }
            child.parent = parent;
            parent.children = parent.children || [];
            parent.children.push(child);
        },
        remove(child) {
            if (child.parent && child.parent.children) {
                const i = child.parent.children.indexOf(child);
                if (i >= 0) child.parent.children.splice(i, 1);
            }
            child.parent = null;
        }
    };
    function cell(opts) {
        const c = {
            id: String(seq++),
            style: opts.style || '',
            edge: !!opts.edge,
            geometry: opts.geometry || null,
            children: [],
            parent: null,
            source: opts.source || null,
            target: opts.target || null,
            edges: [],
            value: opts.value != null ? opts.value : ''
        };
        cells[c.id] = c;
        return c;
    }
    const root = cell({});
    cells.root = root;
    const graph = {
        getModel() { return model; },
        getEdges(c) { return (c && c.edges) || []; },
        view: {
            scale: 1,
            translate: { x: 0, y: 0 },
            validate() {},
            getState(edge) {
                if (!edge || !edge.absolutePoints) return null;
                return { absolutePoints: edge.absolutePoints };
            }
        }
    };
    function link(edge, a, b) {
        edge.source = a;
        edge.target = b;
        a.edges.push(edge);
        b.edges.push(edge);
        model.add(root, edge);
    }
    function addVertex(c) { model.add(root, c); return c; }
    return { model, cell, root, graph, link, addVertex };
}

function boxAbs(parent, box) {
    const g = box.geometry;
    const p = parent.geometry;
    return {
        x: p.x + g.x * p.width + g.offset.x,
        y: p.y + g.y * p.height + g.offset.y,
        w: g.width,
        h: g.height
    };
}
function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Pure rules
assert(busQuietSideFromCounts(2, 0) === 'below', 'equipment above the bus → box below the bar');
assert(busQuietSideFromCounts(0, 3) === 'above', 'equipment below the bus → box above the bar');
assert(busQuietSideFromCounts(1, 1) === 'left', 'equipment both sides → box left of the bar');
assert(busQuietSideFromCounts(0, 0) === 'below', 'isolated bus → box below the bar');
assert(componentBoxSideFromBusy('right') === 'left', 'lead to the right → box on the left');
assert(componentBoxSideFromBusy('left') === 'right', 'lead to the left → box on the right');
assert(componentBoxSideFromBusy('below') === 'right', 'vertical lead → box on the right of the symbol');
assert(componentBoxSideFromBusy('above') === 'right', 'vertical lead upward → box on the right of the symbol');

const horiz = lineAnchorFromPoints([{ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 240, y: 40 }, { x: 240, y: 80 }]);
assertNear(horiz.geoX, 0, 'longest horizontal segment midpoint is the edge centre');
assert(horiz.vertical === false, 'overhead cable is treated as horizontal');
const vert = lineAnchorFromPoints([{ x: 0, y: 0 }, { x: 0, y: 300 }, { x: 20, y: 300 }]);
assert(vert.vertical === true, 'riser is treated as vertical');
assertNear(vert.geoX, 0, 'default line anchor is the middle of the route');
const nearStart = lineAnchorFromPoints([{ x: 0, y: 0 }, { x: 0, y: 300 }, { x: 400, y: 300 }], 48);
assert(nearStart.vertical === true, 'a box 48px from the bus stays on the first riser');
assert(nearStart.geoX < -0.7, 'that box stays next to the bus, not on the long corridor');
const vOff = lineBoxAnchor(true, 70, 80);
assert(vOff.ox > 0, 'vertical line box starts to the right of the conductor');
assertNear(vOff.oy, -40, 'vertical line box is centered on the conductor');
const hOff = lineBoxAnchor(false, 70, 80);
assertNear(hOff.ox, -35, 'horizontal line box is centered on the conductor');
assert(hOff.oy <= -80, 'horizontal line box sits fully above the conductor');

// Offshore turbine compound: static gen and trafo beside the symbols, buses on the quiet side.
{
    const G = makeGraph();
    const sgen = G.addVertex(G.cell({
        style: 'shapeELXXX=Static Generator',
        geometry: makeGeo(100, 0, 58, 58)
    }));
    const lv = G.addVertex(G.cell({
        style: 'shape=line;shapeELXXX=Bus',
        geometry: makeGeo(0, 140, 260, 12)
    }));
    const trafo = G.addVertex(G.cell({
        style: 'shapeELXXX=Transformer',
        geometry: makeGeo(90, 180, 72, 108)
    }));
    const hv = G.addVertex(G.cell({
        style: 'shape=line;shapeELXXX=Bus',
        geometry: makeGeo(0, 320, 260, 12)
    }));
    const e1 = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    const e2 = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    const e3 = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    G.link(e1, sgen, lv);
    G.link(e2, trafo, lv);
    G.link(e3, trafo, hv);

    function strayBox(owner, text) {
        const b = G.cell({
            style: 'shapeELXXX=Result;connectedTo=' + owner.id,
            geometry: makeGeo(-0.3, 0, owner === sgen || owner === trafo ? 68 : 80, owner === trafo ? 64 : 40),
            value: text
        });
        b.geometry.offset = new mxPoint(400, 500);
        const host = owner === lv || owner === hv ? owner : (owner === sgen ? e1 : e2);
        G.model.add(host, b);
        return b;
    }
    const sgenBox = strayBox(sgen, 'Static Generator\nP[MW]: 7.5');
    const trafoBox = strayBox(trafo, 'Trafo\nP_HV[MW]: -7.4');
    const lvBox = strayBox(lv, 'Bus\nU[pu]: 1.17');
    const hvBox = strayBox(hv, 'Bus\nU[pu]: 1.10');
    // duplicate empty trafo box that the old edge rule would have left in the void
    const extra = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + trafo.id,
        geometry: makeGeo(0, 0, 68, 64),
        value: 'Click Simulate to generate results'
    });
    extra.geometry.offset = new mxPoint(0, 800);
    G.model.add(e3, extra);

    repositionAllResultBoxes(G.graph);

    assert(G.model.getParent(sgenBox) === sgen, 'static generator box is parented to the symbol');
    assert(G.model.getParent(trafoBox) === trafo, 'transformer box is parented to the symbol');
    assert(extra.parent == null, 'a second box for the same transformer is removed');
    assert(G.model.getParent(trafoBox) === trafo, 'the transformer result that was just written is kept');

    const sAbs = boxAbs(sgen, sgenBox);
    const sSym = { x: 100, y: 0, w: 58, h: 58 };
    assert(!overlaps(sAbs, sSym), 'static generator box does not cover the symbol');
    assert(sAbs.x >= sSym.x + sSym.w, 'static generator box is to the right of the symbol');
    assertNear(sAbs.y + sAbs.h / 2, sSym.y + sSym.h / 2, 'static generator box is vertically centered on the symbol');

    const tAbs = boxAbs(trafo, trafoBox);
    const tSym = { x: 90, y: 180, w: 72, h: 108 };
    assert(!overlaps(tAbs, tSym), 'transformer box does not cover the symbol');
    assert(tAbs.x >= tSym.x + tSym.w, 'transformer box is to the right of the symbol');

    const lvAbs = boxAbs(lv, lvBox);
    assert(lvAbs.y + lvAbs.h <= lv.geometry.y, 'LV bus box sits fully above the bar');
    const hvAbs = boxAbs(hv, hvBox);
    const trafoMid = trafo.geometry.x + trafo.geometry.width / 2;
    assert(hvAbs.y >= hv.geometry.y + hv.geometry.height, 'HV bus box (equipment above) is below the bar');
    assert(Math.abs(hvAbs.x - trafoMid) < 40, 'HV bus box starts beside the transformer');
    assert(hvAbs.w < 120 && hvAbs.h > hvAbs.w * 0.7, 'HV bus box is square rather than a flat strip');
}

// A transformer result left on the lead is moved beside the windings, not onto the bus.
{
    const G = makeGraph();
    const hv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 0, 260, 12) }));
    const trafo = G.addVertex(G.cell({ style: 'shapeELXXX=Transformer', geometry: makeGeo(90, 40, 72, 108) }));
    const lv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 160, 260, 12) }));
    const lead = G.cell({ edge: true, style: 'shapeELXXX=Line', geometry: makeGeo(0, 0, 0, 0) });
    lead.absolutePoints = [
        { x: 126, y: 148 },
        { x: 126, y: 166 }
    ];
    G.link(lead, trafo, lv);
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + trafo.id,
        geometry: makeGeo(0, 0, 70, 64),
        value: 'Trafo\nP_HV[MW]: -14.9\nP_LV[MW]: 15.0\nQ[MVar]: -5.2\nloading[%]: 88'
    });
    box.geometry.offset = new mxPoint(-35, -32);
    G.model.add(lead, box);
    repositionAllResultBoxes(G.graph);
    assert(G.model.getParent(box) === trafo, 'transformer box leaves the lead');
    const abs = boxAbs(trafo, box);
    const sym = { x: 90, y: 40, w: 72, h: 108 };
    assert(abs.x >= sym.x + sym.w, 'transformer box sits to the right of the windings');
    assert(!overlaps(abs, sym), 'transformer box does not cover the windings');
    const bus = { x: 0, y: 160, w: 260, h: 12 };
    assert(!overlaps(abs, bus), 'transformer box does not sit on the LV bus');
}

// Transformer numbers written onto the LV bus card are moved beside the windings.
{
    const G = makeGraph();
    const hv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 0, 260, 12) }));
    const trafo = G.addVertex(G.cell({ style: 'shapeELXXX=Transformer', geometry: makeGeo(94, 28, 72, 108) }));
    const lv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 150, 260, 12) }));
    const up = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    const down = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    G.link(up, trafo, hv);
    G.link(down, trafo, lv);
    const trafoBox = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + lv.id + ';elxxxUserPos=1',
        geometry: makeGeo(0.5, 0, 72, 72),
        value: 'Trafo\nHV -14.9 / LV 15.0\nQ -5.2\n88%  [+]'
    });
    trafoBox.geometry.offset = new mxPoint(-30, -70);
    G.model.add(lv, trafoBox);
    const busBox = G.cell({
        style: 'shapeELXXX=ResultBus;connectedTo=' + lv.id,
        geometry: makeGeo(0.5, 0, 72, 72),
        value: 'Bus\n1.090 pu\n0.8 kV\nP -15.0\nQ -6.5  [+]'
    });
    busBox.geometry.offset = new mxPoint(-20, -68);
    G.model.add(lv, busBox);
    repositionAllResultBoxes(G.graph);
    assert(G.model.getParent(trafoBox) === trafo, 'transformer card leaves the LV bus');
    assert(G.model.getParent(busBox) === lv, 'LV bus card stays on the bus');
    const abs = boxAbs(trafo, trafoBox);
    const sym = { x: 94, y: 28, w: 72, h: 108 };
    assert(abs.x >= sym.x + sym.w, 'transformer card is beside the windings');
    assert(!overlaps(abs, sym), 'transformer card does not cover the windings');
}

// A saved drag flag must not keep the transformer card underneath the windings.
{
    const G = makeGraph();
    const trafo = G.addVertex(G.cell({ style: 'shapeELXXX=Transformer', geometry: makeGeo(90, 40, 72, 108) }));
    const lv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 160, 260, 12) }));
    const lead = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    G.link(lead, trafo, lv);
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + trafo.id + ';elxxxUserPos=1',
        geometry: makeGeo(0.5, 1, 72, 72),
        value: 'Trafo\nP_HV[MW]: -14.9\nP_LV[MW]: 15.0\nloading[%]: 88'
    });
    box.geometry.offset = new mxPoint(-36, 4);
    box.geometry.relative = true;
    G.model.add(trafo, box);
    repositionAllResultBoxes(G.graph);
    assert(G.model.getParent(box) === trafo, 'transformer card stays on the transformer');
    const abs = boxAbs(trafo, box);
    assert(abs.x >= trafo.geometry.x + trafo.geometry.width, 'a card left under the transformer moves beside it');
    assert(!overlaps(abs, { x: 90, y: 40, w: 72, h: 108 }), 'that card does not cover the windings');
}

// Transformer text on a bus is moved beside the nearest transformer even without a linked lead.
{
    const G = makeGraph();
    const trafo = G.addVertex(G.cell({ style: 'shapeELXXX=Transformer', geometry: makeGeo(100, 30, 72, 108) }));
    const lv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 150, 260, 12) }));
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + lv.id + ';elxxxUserPos=1',
        geometry: makeGeo(0.45, 0, 70, 64),
        value: 'HV -14.9 / LV\n15.0\nQ -5.2\n88%  [+]'
    });
    box.geometry.relative = true;
    box.geometry.offset = new mxPoint(-20, -60);
    G.model.add(lv, box);
    repositionAllResultBoxes(G.graph);
    assert(G.model.getParent(box) === trafo, 'unlinked transformer card leaves the bus');
    const abs = boxAbs(trafo, box);
    assert(abs.x >= 172, 'unlinked transformer card is to the right of the windings');
}

// Map-generated turbine transformers had `shapeELXXX=Transformerrotation=180` (missing `;`).
{
    const G = makeGraph();
    const trafo = G.addVertex(G.cell({ style: 'shape=image;shapeELXXX=Transformerrotation=180;', geometry: makeGeo(100, 30, 72, 108) }));
    const lv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 150, 260, 12) }));
    const lead = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    G.link(lead, trafo, lv);
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + lv.id,
        geometry: makeGeo(0.45, 0, 70, 64),
        value: 'HV -14.9 / LV\n15.0\nQ -5.2\n88%  [+]'
    });
    box.geometry.relative = true;
    box.geometry.offset = new mxPoint(-20, -60);
    G.model.add(lv, box);
    repositionAllResultBoxes(G.graph);
    assert(/shapeELXXX=Transformer;rotation=180/.test(trafo.style), 'malformed rotated transformer style is repaired');
    assert(G.model.getParent(box) === trafo, 'card leaves the bus for the rotated transformer');
    assert(drawnAbs(trafo, box).x >= 172, 'card sits right of the rotated transformer');
}

// draw.io turns relative children around the parent centre with the parent's rotation.
function drawnAbs(parent, box) {
    const r = boxAbs(parent, box);
    const m = String(parent.style || '').match(/(?:^|;)rotation=([-\d.]+)/);
    const rad = (m ? parseFloat(m[1]) : 0) * Math.PI / 180;
    const p = parent.geometry;
    const cx = p.x + p.width / 2;
    const cy = p.y + p.height / 2;
    const dx = r.x + r.w / 2 - cx;
    const dy = r.y + r.h / 2 - cy;
    return {
        x: cx + dx * Math.cos(rad) - dy * Math.sin(rad) - r.w / 2,
        y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) - r.h / 2,
        w: r.w,
        h: r.h
    };
}

// A transformer drawn at 90/180/270 degrees still gets its card on the right as seen on screen.
[90, 180, 270].forEach(function (deg) {
    const G = makeGraph();
    const trafo = G.addVertex(G.cell({ style: 'shapeELXXX=Transformer;rotation=' + deg, geometry: makeGeo(100, 30, 72, 108) }));
    const hv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 0, 260, 12) }));
    const lv = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 160, 260, 12) }));
    G.link(G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) }), trafo, hv);
    G.link(G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) }), trafo, lv);
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + trafo.id,
        geometry: makeGeo(1, 0.5, 70, 64),
        value: 'HV -14.9 / LV\n15.0\nQ -5.2\n88%  [+]'
    });
    box.geometry.relative = true;
    box.geometry.offset = new mxPoint(10, -32);
    G.model.add(trafo, box);
    repositionAllResultBoxes(G.graph);
    const abs = drawnAbs(trafo, box);
    const sym = absoluteResultRect(trafo, trafo);
    assert(abs.x >= sym.x + sym.w, deg + '° transformer card is drawn right of the symbol');
    assert(Math.abs((abs.y + abs.h / 2) - (sym.y + sym.h / 2)) < 2, deg + '° transformer card is level with the symbol');
    const rect = absoluteResultRect(trafo, box);
    assert(Math.abs(rect.x - abs.x) < 0.5 && Math.abs(rect.y - abs.y) < 0.5, deg + '° drawn position matches the placement maths');
});

// Positions saved in an older diagram are not treated as a manual drag.
{
    const G = makeGraph();
    const trafo = G.addVertex(G.cell({ style: 'shapeELXXX=Transformer', geometry: makeGeo(80, 20, 72, 108) }));
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + trafo.id + ';elxxxUserPos=1',
        geometry: makeGeo(0.5, 1, 68, 68),
        value: 'Trafo\nP_HV[MW]: -14.9\nP_LV[MW]: 15'
    });
    box.geometry.relative = true;
    box.geometry.offset = new mxPoint(-30, 6);
    G.model.add(trafo, box);
    repositionAllResultBoxes(G.graph);
    const abs = boxAbs(trafo, box);
    assert(abs.x >= trafo.geometry.x + trafo.geometry.width, 'a saved old position is replaced on the next load flow');
}

// A drag made in this session is kept on the next load flow.
{
    const G = makeGraph();
    const gen = G.addVertex(G.cell({ style: 'shapeELXXX=Static Generator', geometry: makeGeo(40, 40, 58, 58) }));
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + gen.id,
        geometry: makeGeo(0, 0.2, 60, 50),
        value: 'Static Generator\nP[MW]: 15'
    });
    box.geometry.relative = true;
    box.geometry.offset = new mxPoint(-80, -10);
    G.model.add(gen, box);
    G.graph._elxxxUserMovedIds = {};
    G.graph._elxxxUserMovedIds[box.id] = 1;
    repositionAllResultBoxes(G.graph);
    assertNear(box.geometry.x, 0, 'a drag in this session keeps its anchor');
    assertNear(box.geometry.offset.x, -80, 'a drag in this session keeps its offset');
}

// Line box sits at the middle of the route and clears the conductor. A bus lookup must not steal it.
{
    const G = makeGraph();
    const a = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 0, 260, 12) }));
    const b = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(400, 200, 260, 12) }));
    const line = G.cell({
        edge: true,
        style: 'shapeELXXX=Line',
        geometry: makeGeo(0, 0, 0, 0)
    });
    line.absolutePoints = [
        { x: 130, y: 6 }, { x: 130, y: -80 }, { x: 530, y: -80 }, { x: 530, y: 206 }
    ];
    G.link(line, a, b);
    const busBox = G.cell({
        style: 'shapeELXXX=ResultBus;connectedTo=' + a.id,
        geometry: makeGeo(0, 1, 80, 76),
        value: 'Bus\nU[pu]: 1'
    });
    busBox.geometry.offset = new mxPoint(0, 0);
    G.model.add(a, busBox);
    const lineBox = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + line.id,
        geometry: makeGeo(0.5, 0, 70, 80),
        value: 'Line\nP_from[MW]: 1'
    });
    lineBox.geometry.offset = new mxPoint(300, 400);
    G.model.add(line, lineBox);

    const found = findResultPlaceholder(G.graph, line);
    assert(found === lineBox, 'line lookup returns the line box, not the bus box');

    repositionAllResultBoxes(G.graph);
    const expectedLine = lineAnchorFromPoints(line.absolutePoints);
    assert(G.model.getParent(lineBox) === line, 'line box stays on the line');
    assert(expectedLine.vertical === false, 'the middle of this route is the horizontal run');
    assertNear(lineBox.geometry.x, 0, 'line box sits at the middle of the line');
    assertNear(lineBox.geometry.offset.x, -lineBox.geometry.width / 2, 'horizontal line box is centered on the conductor');
    assert(lineBox.geometry.offset.y < -lineBox.geometry.height, 'horizontal line box sits fully above the conductor');
    assert(busBox.value.indexOf('Bus') === 0, 'bus result text is not overwritten by the line');
}

// BESS hand-tuned boxes are left where the plant builder put them.
{
    const G = makeGraph();
    const poc = G.addVertex(G.cell({
        style: 'shapeELXXX=Bus',
        geometry: makeGeo(0, 0, 200, 12),
        value: { getAttribute(name) { return name === 'bessPlantRole' ? 'poc' : null; } }
    }));
    const box = G.cell({
        style: 'shapeELXXX=ResultBus;connectedTo=' + poc.id,
        geometry: makeGeo(1, 0.5, 80, 70),
        value: 'Bus'
    });
    box.geometry.offset = new mxPoint(18, -40);
    G.model.add(poc, box);
    repositionAllResultBoxes(G.graph);
    assertNear(box.geometry.x, 1, 'BESS bus box x is unchanged');
    assertNear(box.geometry.offset.x, 18, 'BESS bus box offset is unchanged');
}

// A bus-to-bus edge that is not tagged as a pandapower Line (DC line) still sits on the branch.
{
    const G = makeGraph();
    const a = G.addVertex(G.cell({ style: 'shapeELXXX=DC Bus', geometry: makeGeo(0, 0, 80, 12) }));
    const b = G.addVertex(G.cell({ style: 'shapeELXXX=DC Bus', geometry: makeGeo(0, 220, 80, 12) }));
    const dc = G.cell({ edge: true, style: 'shapeELXXX=DC Line', geometry: makeGeo(0, 0, 0, 0) });
    dc.absolutePoints = [{ x: 40, y: 6 }, { x: 40, y: 226 }];
    G.link(dc, a, b);
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + dc.id,
        geometry: makeGeo(-0.3, 0, 70, 50),
        value: 'DC Line\nP_from[MW]: 1'
    });
    box.geometry.offset = new mxPoint(250, 400);
    G.model.add(dc, box);
    repositionAllResultBoxes(G.graph);
    assert(G.model.getParent(box) === dc, 'DC line box stays on the branch');
    assertNear(box.geometry.x, 0, 'vertical line box sits at the middle of the line');
    assertNear(box.geometry.offset.y, -box.geometry.height / 2, 'vertical line box is centered on the conductor');
    assert(box.geometry.offset.x < -8, 'vertical line box is beside the conductor');
    assert(box.geometry.offset.x > -120, 'vertical line box is not pushed into empty space');
}

// Every turbine keeps its own box beside the symbol, even when the lead detours across the diagram.
{
    const G = makeGraph();
    const cable = G.cell({ edge: true, style: 'shapeELXXX=Line', geometry: makeGeo(0, 0, 0, 0) });
    const busA = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(0, 0, 400, 12) }));
    const busB = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(700, 0, 200, 12) }));
    cable.absolutePoints = [{ x: 200, y: 6 }, { x: 200, y: -200 }, { x: 900, y: -200 }, { x: 900, y: 6 }];
    G.link(cable, busA, busB);
    const lineBox = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + cable.id,
        geometry: makeGeo(0, 0, 70, 40),
        value: 'Line'
    });
    G.model.add(cable, lineBox);
    const sgens = [];
    for (let i = 0; i < 3; i++) {
        const sgen = G.addVertex(G.cell({
            style: 'shapeELXXX=Static Generator',
            geometry: makeGeo(40 + i * 140, 160, 58, 58)
        }));
        const edge = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
        edge.absolutePoints = [
            { x: sgen.geometry.x + 29, y: 160 },
            { x: sgen.geometry.x + 29, y: -180 },
            { x: 880, y: -180 },
            { x: 880, y: 12 }
        ];
        G.link(edge, sgen, busA);
        const box = G.cell({
            style: 'shapeELXXX=Result;connectedTo=' + sgen.id,
            geometry: makeGeo(-0.3, 0, 60, 40),
            value: 'Static Generator\nP[MW]: ' + (7 + i)
        });
        box.geometry.offset = new mxPoint(400, -300);
        G.model.add(edge, box);
        sgens.push({ sgen: sgen, box: box });
    }
    repositionAllResultBoxes(G.graph);
    sgens.forEach(function (item, i) {
        assert(G.model.getParent(item.box) === item.sgen, 'turbine ' + i + ' keeps its own result box');
        const abs = boxAbs(item.sgen, item.box);
        assert(abs.x >= item.sgen.geometry.x + item.sgen.geometry.width, 'turbine ' + i + ' box is beside the symbol');
    });
    const onCable = findAllResultPlaceholdersForComponent(G.graph, cable);
    assert(onCable.length === 1 && onCable[0].placeholder === lineBox, 'the cable does not claim the turbine boxes');
}

// A generator whose lead goes to a bus on the right keeps the box on the outer side.
{
    const G = makeGraph();
    const gen = G.addVertex(G.cell({ style: 'shapeELXXX=Generator', geometry: makeGeo(0, 0, 48, 48) }));
    const bus = G.addVertex(G.cell({ style: 'shapeELXXX=Bus', geometry: makeGeo(160, 10, 200, 12) }));
    const edge = G.cell({ edge: true, style: 'shapeELXXX=NotEditableLine', geometry: makeGeo(0, 0, 0, 0) });
    G.link(edge, gen, bus);
    const box = G.cell({
        style: 'shapeELXXX=Result;connectedTo=' + gen.id,
        geometry: makeGeo(-0.3, 0, 60, 40),
        value: 'Generator\nP[MW]: 10'
    });
    box.geometry.offset = new mxPoint(-30, -25);
    G.model.add(edge, box);
    repositionAllResultBoxes(G.graph);
    const abs = boxAbs(gen, box);
    assert(abs.x + abs.w <= gen.geometry.x, 'generator box is on the side away from the bus');
    assert(!overlaps(abs, { x: 0, y: 0, w: 48, h: 48 }), 'generator box does not cover the symbol');
}

assert(
    compactDiagramResult('Bus\nU[pu]: 1.055\nU[kV]: 69.632\nP[MW]: 44.632\nQ=-27.238 MVar\nPF: 0.854')
        === 'Bus\n1.055 pu\n69.6 kV\nP 44.6\nQ -27.2',
    'bus results stack into a square label'
);
assert(!looksLikeFullResult('Offshore 66kV -\n3x800 RM Cu\nP 74.3\nQ 27.2  [+]'), 'a collapsed label is not saved as the full result');
assert(!looksLikeFullResult('HV -14.9 / LV\n88%\n[+]'), 'the expand marker is not stored as the full result');
assert(/cursor:pointer/.test(resultToggleMarker(false)) && /pointer-events:auto/.test(resultToggleMarker(false)) && /\[\+\]/.test(resultToggleMarker(false)), 'the expand marker takes a single click');
assert(resultToggleMarker(true).indexOf('[–]') >= 0, 'the collapse marker stays a short mark');
assert(looksLikeFullResult('Line\nP_from[MW]: 74.3\nQ_from[MVar]: 27.2\ni_from[kA]: 0.26\nLoading[%]: 80'), 'a raw line result is kept as the full text');
var busSize = summaryBoxSize('Bus\n1.055 pu\n69.6 kV\nP 44.6\nQ -27.2  [+]');
assert(busSize.h > busSize.w * 0.75 && busSize.w > 70, 'collapsed result box is close to square');

// A whole turbine string of overlapping boxes is packed so none cover each other or the symbol.
{
    var symbol = { x: 80, y: 80, w: 58, h: 58 };
    var pile = [];
    var n;
    for (n = 0; n < 4; n++) pile.push({ x: 140, y: 70 + n * 8, w: 100, h: 72 });
    var shifts = separateBoxRects(pile, [symbol], 6);
    var moved = pile.map(function (r, i) {
        return { x: r.x + shifts[i].dx, y: r.y + shifts[i].dy, w: r.w, h: r.h };
    });
    var a, b;
    for (a = 0; a < moved.length; a++) {
        assert(!resultRectsOverlap(moved[a], symbol, 0), 'packed box ' + a + ' stays off the symbol');
        for (b = a + 1; b < moved.length; b++) {
            assert(!resultRectsOverlap(moved[a], moved[b], 4), 'packed boxes ' + a + ' and ' + b + ' do not overlap');
        }
    }
}

if (failed) {
    console.error(failed + ' assertion(s) failed');
    process.exit(1);
}
console.log('result box placement: ok');
