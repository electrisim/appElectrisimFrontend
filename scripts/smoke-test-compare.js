/* Smoke test for scenarioCompare.js (and snapshotStore.js)
 *
 * Loads the dashboard module first (so window.computeNetworkHealthMetrics
 * is registered), then snapshotStore.js, then scenarioCompare.js. Exercises
 * computeScenarioDelta on synthetic baseline / current pairs covering:
 *   - identical input (zero deltas, no migrations)
 *   - bus voltage drop  (band migration good → warn)
 *   - branch overload   (band migration ok   → overload)
 *   - element added in current run only
 *   - element removed in current run only
 *   - lowercase transformers3w (OpenDSS) tolerance
 *   - snapshotStore counts metadata
 *
 * Usage: node scripts/smoke-test-compare.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const dashCode  = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'results', 'networkHealthDashboard.js'),
    'utf8'
);
const storeCode = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'utils', 'snapshotStore.js'),
    'utf8'
);
const compareCode = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'results', 'scenarioCompare.js'),
    'utf8'
);

const win = {
    addEventListener: () => {},
    removeEventListener: () => {},
    open: () => null,
    URL: { createObjectURL: () => 'blob://test', revokeObjectURL: () => {} },
    Image: function () {},
    Blob:  function () {},
    XMLSerializer: function () { this.serializeToString = () => '<svg/>'; },
};

const stubElement = () => {
    const el = {
        style: {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        innerHTML: '', textContent: '', id: '', src: '',
        children: [],
        setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {},
        appendChild: function (c) { this.children.push(c); return c; },
        querySelector: () => stubElement(),
        querySelectorAll: () => [],
        addEventListener: () => {},
        focus: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
        offsetWidth: 380,
        getContext: () => ({
            fillRect: () => {}, strokeRect: () => {}, fillText: () => {},
            beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
            stroke: () => {}, fill: () => {}, arc: () => {}, drawImage: () => {},
            setLineDash: () => {}, save: () => {}, restore: () => {},
            translate: () => {}, scale: () => {}, rotate: () => {},
        }),
        toDataURL: () => 'data:image/png;base64,AAAA',
    };
    return el;
};

const doc = {
    head:    { appendChild: () => {} },
    body:    { appendChild: () => {} },
    scripts: [],
    getElementById: () => null,
    createElement:   () => stubElement(),
    createElementNS: () => stubElement(),
    addEventListener: () => {},
};

function evalIn(code) {
    new Function('window', 'document', `
        var navigator = { clipboard: null };
        var requestAnimationFrame = function (fn) { fn && fn(); };
        var XMLSerializer = window.XMLSerializer;
        var Image = window.Image;
        var URL = window.URL;
        var Blob = window.Blob;
        var indexedDB = undefined;       // exercise the localStorage fallback
        var localStorage = (function () {
            var data = {};
            return {
                getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
                setItem: function (k, v) { data[k] = String(v); },
                removeItem: function (k) { delete data[k]; },
            };
        })();
        ${code}
    `)(win, doc);
}

evalIn(dashCode);
evalIn(storeCode);
evalIn(compareCode);

if (typeof win.computeNetworkHealthMetrics !== 'function') {
    console.error('FAIL: computeNetworkHealthMetrics not exposed (dashboard module did not load)');
    process.exit(1);
}
if (typeof win.computeScenarioDelta !== 'function') {
    console.error('FAIL: computeScenarioDelta not exposed (compare module did not load)');
    process.exit(1);
}
if (typeof win.saveSnapshot !== 'function') {
    console.error('FAIL: saveSnapshot not exposed (snapshot store did not load)');
    process.exit(1);
}

function assert(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); process.exit(1); }
    console.log('  PASS:', msg);
}

const baseRun = {
    busbars: [
        { id: 'b1', name: 'b1', vm_pu: 1.00 },
        { id: 'b2', name: 'b2', vm_pu: 0.99 },
        { id: 'b3', name: 'b3', vm_pu: 1.02 },
    ],
    lines: [
        { id: 'l1', name: 'l1', loading_percent: 30, pl_mw: 0.05 },
        { id: 'l2', name: 'l2', loading_percent: 60, pl_mw: 0.08 },
    ],
    transformers: [
        { id: 't1', name: 't1', loading_percent: 55, pl_mw: 0.02 },
    ],
    externalgrids: [{ id: 'e1', name: 'e1', p_mw: 12, q_mvar: 1 }],
    loads:         [{ id: 'ld1', name: 'ld1', p_mw: 11.85, q_mvar: 1 }],
};

// ---------- Test 1: identical input → zero deltas ------------------------
console.log('\nTest 1: identical input → no migrations, all deltas zero');
{
    const baseClone = JSON.parse(JSON.stringify(baseRun));
    const d = win.computeScenarioDelta(baseRun, baseClone);
    assert(d.statusMigrations.length === 0, 'no migrations');
    assert(d.perBus.every(r => Math.abs(r.delta) < 1e-9), 'all bus deltas ≈ 0');
    assert(d.perBranch.every(r => Math.abs(r.delta) < 1e-9), 'all branch deltas ≈ 0');
    assert(d.addedRemoved.added.length === 0 && d.addedRemoved.removed.length === 0,
        'nothing added or removed');
    assert(Math.abs(d.kpiDelta.healthScore.delta) < 1, 'health score delta < 1 (rounding)');
}

// ---------- Test 2: bus voltage drop → band migration good → warn -------
console.log('\nTest 2: bus voltage drop 1.00 → 0.92 → band good → warn');
{
    const cur = JSON.parse(JSON.stringify(baseRun));
    cur.busbars[0].vm_pu = 0.92; // good (1.00) → warn (0.92)
    const d = win.computeScenarioDelta(baseRun, cur);
    const top = d.perBus[0];
    assert(top && top.id === 'b1', 'b1 is the top mover');
    assert(top.band_base === 'good' && top.band_curr === 'warn', 'band good → warn');
    assert(top.severity === 'worsened', 'severity worsened');
    const mig = d.statusMigrations.find(m => m.kind === 'bus' && m.id === 'b1');
    assert(!!mig, 'status migration recorded for b1');
    assert(mig.from === 'good' && mig.to === 'warn', 'migration good → warn');
}

// ---------- Test 3: branch loading 60 → 110 → ok → overload --------------
console.log('\nTest 3: line loading 60 → 110 → ok → overload');
{
    const cur = JSON.parse(JSON.stringify(baseRun));
    cur.lines[1].loading_percent = 110;
    const d = win.computeScenarioDelta(baseRun, cur);
    const r = d.perBranch.find(x => x.id === 'l2');
    assert(!!r, 'branch l2 included');
    assert(r.band_base === 'good' && r.band_curr === 'danger',
        'band good → danger (overload)');
    assert(r.severity === 'worsened', 'severity worsened on overload');
    const mig = d.statusMigrations.find(m => m.id === 'l2');
    assert(!!mig && mig.to === 'danger', 'overload migration recorded');
    assert(d.perBranch[0].id === 'l2', 'biggest delta first (l2)');
}

// ---------- Test 4: static generator added in current only ---------------
console.log('\nTest 4: added static generator in current-only run');
{
    const cur = JSON.parse(JSON.stringify(baseRun));
    cur.staticgenerators = [{ id: 'sg-new', name: 'BatteryA', p_mw: 50 }];
    const d = win.computeScenarioDelta(baseRun, cur);
    const added = d.addedRemoved.added.find(x => x.id === 'sg-new');
    assert(!!added, 'sg-new appears in addedRemoved.added');
    assert(d.addedRemoved.removed.length === 0, 'nothing removed');
}

// ---------- Test 5: line removed in current run --------------------------
console.log('\nTest 5: line removed in current-only run');
{
    const cur = JSON.parse(JSON.stringify(baseRun));
    cur.lines = cur.lines.filter(l => l.id !== 'l1');
    const d = win.computeScenarioDelta(baseRun, cur);
    const removed = d.addedRemoved.removed.find(x => x.id === 'l1');
    assert(!!removed, 'line l1 appears in addedRemoved.removed');
}

// ---------- Test 6: transformers3w (OpenDSS lowercase) tolerance --------
console.log('\nTest 6: transformers3w lowercase (OpenDSS) tolerance');
{
    const aDss = {
        busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
        transformers3w: [{ id: 't3-1', name: 't3-1', loading_percent: 70 }],
    };
    const bDss = {
        busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
        transformers3w: [{ id: 't3-1', name: 't3-1', loading_percent: 105 }],
    };
    const d = win.computeScenarioDelta(aDss, bDss);
    const r = d.perBranch.find(x => x.id === 't3-1');
    assert(!!r, 'transformers3w included via lowercase key');
    assert(r.kind === 'transformer3w', 'kind transformer3w preserved');
    assert(r.severity === 'worsened', 'overload on 3W trafo flagged worsened');
}

// ---------- Test 7: cross-sheet mxCell ids match by topology --------------
console.log('\nTest 7: cross-sheet mxCell ids match by topology');
{
    const sheet1 = {
        busbars: [
            { name: 'mxCell_158', id: 'cPM_1', vm_pu: 1.02 },
            { name: 'mxCell_161', id: 'cPM_2', vm_pu: 1.01 },
            { name: 'mxCell_164', id: 'cPM_3', vm_pu: 1.06 },
        ],
        lines: [
            { name: 'mxCell_183', id: 'mxCell#183', busFrom: 'mxCell_158', busTo: 'mxCell_161', loading_percent: 25 },
        ],
        transformers: [
            { name: 'mxCell_170', id: 'mxCell#170', busFrom: 'mxCell_161', busTo: 'mxCell_164', loading_percent: 55 },
        ],
        externalgrids: [{ name: 'mxCell_173', id: 'mxCell#173', bus: 'mxCell_158' }],
        storages: [{ name: 'mxCell_179', id: 'mxCell#179', bus: 'mxCell_164', p_mw: -40, q_mvar: 0 }],
    };
    const sheet2 = {
        busbars: [
            { name: 'mxCell_200', id: 'isAD_1', vm_pu: 1.01 },
            { name: 'mxCell_203', id: 'isAD_2', vm_pu: 1.00 },
            { name: 'mxCell_206', id: 'isAD_3', vm_pu: 1.04 },
        ],
        lines: [
            { name: 'mxCell_213', id: 'mxCell#213', busFrom: 'mxCell_200', busTo: 'mxCell_203', loading_percent: 28 },
        ],
        transformers: [
            { name: 'mxCell_212', id: 'mxCell#212', busFrom: 'mxCell_203', busTo: 'mxCell_206', loading_percent: 58 },
        ],
        externalgrids: [{ name: 'mxCell_215', id: 'mxCell#215', bus: 'mxCell_200' }],
        storages: [{ name: 'mxCell_221', id: 'mxCell#221', bus: 'mxCell_206', p_mw: -40, q_mvar: 15 }],
    };
    const d = win.computeScenarioDelta(sheet1, sheet2);
    assert(d.perBus.length === 3, 'three buses matched across sheets');
    assert(d.addedRemoved.added.length === 0, 'no false added elements');
    assert(d.addedRemoved.removed.length === 0, 'no false removed elements');
    assert(d.perBranch.length >= 1, 'branches matched across sheets');
    const lv = d.perBus.find(r => Math.abs((r.vm_pu_curr || 0) - 1.04) < 0.001);
    assert(!!lv, 'LV bus voltage delta computed');
}

// ---------- Test 8: KPI delta directions ---------------------------------
console.log('\nTest 8: KPI delta direction signs');
{
    const cur = JSON.parse(JSON.stringify(baseRun));
    cur.lines[1].pl_mw = 0.50; // increase losses
    const d = win.computeScenarioDelta(baseRun, cur);
    const losses = d.kpiDelta.totalLosses;
    assert(losses && losses.delta > 0,                  'losses delta positive');
    assert(losses.direction === 'worsened',             'higher losses worsened');
    const gen = d.kpiDelta.totalGen;
    assert(gen.direction === 'neutral' || gen.direction === 'changed' || gen.direction === 'improved' || gen.direction === 'worsened',
        'gen direction set');
}

// ---------- Test 9: snapshot store counts metadata -----------------------
console.log('\nTest 9: snapshotStore.summariseCounts');
{
    const I = win._snapshotStoreInternals;
    assert(!!I, 'snapshot store internals exposed');
    const counts = I.summariseCounts({
        busbars: [{}, {}, {}],
        lines:   [{}, {}],
        transformers: [{}],
        transformers3w: [{}],
        staticgenerators: [{}, {}],
        externalgrids:    [{}],
        loads: [{}, {}, {}, {}],
    });
    assert(counts.buses === 3,                   'counts.buses = 3');
    assert(counts.lines === 2,                   'counts.lines = 2');
    assert(counts.transformers === 2,            'counts.transformers = 2 (2W + 3W)');
    assert(counts.generators === 3,              'counts.generators = sgens + extgrids');
    assert(counts.loads === 4,                   'counts.loads = 4');
}

// ---------- Test 10: snapshot store engine inference ---------------------
console.log('\nTest 10: snapshotStore.inferEngine');
{
    const I = win._snapshotStoreInternals;
    assert(I.inferEngine({}) === 'pandapower',                       'default engine pandapower');
    assert(I.inferEngine({ engine: 'OpenDSS' }) === 'opendss',        'opendss inferred from engine field');
    assert(I.inferEngine({ opendss_commands: [] }) === 'opendss',     'opendss inferred from commands');
}

// ---------- Test 11: save → setBaseline → getBaseline (LS fallback) -----
console.log('\nTest 11: snapshot store save → setBaseline → getBaseline (LS path)');
{
    return win.saveSnapshot(baseRun, { engine: 'pandapower', label: 'Run A' })
        .then((id) => {
            assert(typeof id === 'string' && id.length > 0, 'snapshot id returned');
            return win.setBaselineSnapshot(id).then(() => id);
        })
        .then((id) => win.getBaselineSnapshot().then((rec) => ({ id, rec })))
        .then(({ id, rec }) => {
            assert(rec && rec.id === id, 'baseline returned with same id');
            assert(rec.dataJson && Array.isArray(rec.dataJson.busbars), 'dataJson preserved');
            assert(rec.label === 'Run A',                              'label preserved');
            return win.listSnapshots().then((list) => {
                assert(Array.isArray(list) && list.length >= 1, 'listSnapshots returned array');
                assert(list[0].dataJson === undefined,           'list metadata strips dataJson');
            });
        })
        .then(() => console.log('\nAll scenario-compare smoke tests passed.'))
        .catch((e) => { console.error('FAIL: async:', e); process.exit(1); });
}
