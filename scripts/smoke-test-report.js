/* Smoke test for engineeringReport.js
 * Loads the dashboard module first (so computeNetworkHealthMetrics is on
 * window) and then loads the report module. Exercises the pure helpers
 * exposed under window._engineeringReportInternals on healthy and stressed
 * synthetic payloads. No DOM rendering, no PDF generation.
 *
 * Usage: node scripts/smoke-test-report.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const dashCode   = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'results', 'networkHealthDashboard.js'),
    'utf8'
);
const reportCode = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'results', 'engineeringReport.js'),
    'utf8'
);

// Minimal browser shim that survives both modules.
const win = {
    localStorage: { _data: {}, getItem(k) { return this._data[k] || null; },
                                  setItem(k, v) { this._data[k] = String(v); },
                                  removeItem(k) { delete this._data[k]; } },
    addEventListener: () => {},
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
        querySelector:    () => stubElement(),
        querySelectorAll: () => [],
        addEventListener: () => {},
        focus: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
        offsetWidth: 380,
        getContext: () => ({
            fillRect: () => {}, strokeRect: () => {},
            fillText: () => {}, beginPath: () => {}, moveTo: () => {}, lineTo: () => {},
            stroke: () => {}, fill: () => {}, arc: () => {}, drawImage: () => {},
            setLineDash: () => {}, save: () => {}, restore: () => {}, translate: () => {},
            scale: () => {}, rotate: () => {},
        }),
        toDataURL: () => 'data:image/png;base64,AAAA',
    };
    return el;
};

const doc = {
    head:  { appendChild: () => {} },
    body:  { appendChild: () => {} },
    scripts: [],
    getElementById: () => null,
    createElement: () => stubElement(),
    createElementNS: () => stubElement(),
    addEventListener: () => {},
};

function evalIn(code) {
    new Function('window', 'document', `
        var navigator = { clipboard: null };
        var requestAnimationFrame = function (fn) { fn && fn(); };
        var localStorage = window.localStorage;
        var URL = window.URL;
        var Image = window.Image;
        var Blob = window.Blob;
        var XMLSerializer = window.XMLSerializer;
        ${code}
    `)(win, doc);
}

evalIn(dashCode);
evalIn(reportCode);

if (typeof win.computeNetworkHealthMetrics !== 'function') {
    console.error('FAIL: computeNetworkHealthMetrics not exposed (dashboard module did not load)');
    process.exit(1);
}
if (!win._engineeringReportInternals) {
    console.error('FAIL: _engineeringReportInternals not exposed (report module did not load)');
    process.exit(1);
}
if (typeof win.exportEngineeringReport !== 'function') {
    console.error('FAIL: exportEngineeringReport not exposed on window');
    process.exit(1);
}

const I = win._engineeringReportInternals;

function assert(cond, msg) {
    if (!cond) { console.error('FAIL:', msg); process.exit(1); }
    console.log('  PASS:', msg);
}

// ---------- Test payloads ------------------------------------------------
const healthy = {
    busbars: [
        { id: 'b1', name: 'b1', vm_pu: 1.00, va_degree: 0   },
        { id: 'b2', name: 'b2', vm_pu: 0.99, va_degree: -1.2 },
        { id: 'b3', name: 'b3', vm_pu: 1.02, va_degree:  0.4 },
    ],
    lines: [
        { id: 'l1', name: 'l1', loading_percent: 30, pl_mw: 0.05, p_from_mw: 5, q_from_mvar: 1, i_from_ka: 0.05, p_to_mw: -4.95, q_to_mvar: -0.9, i_to_ka: 0.05 },
        { id: 'l2', name: 'l2', loading_percent: 55, pl_mw: 0.08, p_from_mw: 7, q_from_mvar: 1, i_from_ka: 0.07, p_to_mw: -6.92, q_to_mvar: -0.9, i_to_ka: 0.07 },
    ],
    transformers: [
        { id: 't1', name: 't1', loading_percent: 60, pl_mw: 0.02, p_hv_mw: 12, q_hv_mvar: 2, p_lv_mw: -11.98, q_lv_mvar: -2 },
    ],
    externalgrids: [{ id: 'e1', name: 'e1', p_mw: 12.0, q_mvar: 1.0, pf: 0.99, q_p: 0.08 }],
    loads:         [{ id: 'ld1', name: 'ld1', p_mw: 11.85, q_mvar: 1.0 }],
};

const stressed = {
    busbars: [
        { id: 'b1', name: 'b1', vm_pu: 1.00 },
        { id: 'b2', name: 'b2', vm_pu: 0.86 }, // critical low
        { id: 'b3', name: 'b3', vm_pu: 1.07 }, // warn high
        { id: 'b4', name: 'b4', vm_pu: 0.93 }, // warn low
    ],
    lines: [
        { id: 'l1', name: 'l1', loading_percent: 110 },
        { id: 'l2', name: 'l2', loading_percent: 92  },
    ],
    transformers: [{ id: 't1', name: 't1', loading_percent: 78, pl_mw: 0.05 }],
    externalgrids:           [{ id: 'e1', name: 'e1',  p_mw: 100, q_mvar: 30 }],
    staticgenerators:        Array.from({ length: 30 }, (_, i) => ({ id: 'sg' + i, name: 'sg' + i, p_mw: 15 })),
    asymmetricstaticgenerators: [{ id: 'asg1', name: 'asg1', p_a_mw: 5, p_b_mw: 5, p_c_mw: 5 }],
    storages:                [{ id: 's1', name: 's1', p_mw: -10 }],
    loads:                   [{ id: 'ld1', name: 'ld1', p_mw: 580 }],
    pvsystems:               [{ id: 'pv1', name: 'pv1', p_mw: 5 }],
};

// ---------- Test 1: KPI cells, healthy ----------------------------------
console.log('\nTest 1: buildKpiCells(healthy)');
const m1 = win.computeNetworkHealthMetrics(healthy);
const k1 = I.buildKpiCells(m1);
assert(Array.isArray(k1) && k1.length === 6, '6 KPI cards produced');
assert(k1[0].label === 'Total Generation' && parseFloat(k1[0].value) === 12, 'gen card carries 12 MW');
assert(k1[1].label === 'Total Load',                                     'load card present');
assert(k1[2].label === 'System Losses',                                  'losses card present');
assert(k1[3].label === 'Voltage Range' && k1[3].cls === 'good',         'voltage card good');
assert(k1[5].label === 'Violations'    && parseInt(k1[5].value) === 0,  'no violations on healthy net');

// ---------- Test 2: KPI cells, stressed ---------------------------------
console.log('\nTest 2: buildKpiCells(stressed)');
const m2 = win.computeNetworkHealthMetrics(stressed);
const k2 = I.buildKpiCells(m2);
assert(k2[3].cls === 'danger',                                           'voltage card flagged danger');
assert(k2[4].cls === 'danger' || k2[4].cls === 'warn',                  'loading card flagged');
assert(parseInt(k2[5].value) >= 3,                                       'violations counted');

// ---------- Test 3: breakdown rows --------------------------------------
console.log('\nTest 3: breakdown rows include trailing TOTAL');
const genRows = I.buildBreakdownRows(m2.breakdownGen, m2.totalGen);
assert(genRows[genRows.length - 1][0] === 'TOTAL', 'gen breakdown ends with TOTAL row');
const loadRows = I.buildBreakdownRows(m2.breakdownLoad, m2.totalLoad);
assert(loadRows[loadRows.length - 1][0] === 'TOTAL', 'load breakdown ends with TOTAL row');

// ---------- Test 4: bus rows sorted asc, classified ---------------------
console.log('\nTest 4: buildBusRows sorted by vm_pu and classified');
const busRows = I.buildBusRows(stressed, () => '');
assert(busRows.length === 4, '4 bus rows');
assert(busRows[0][4] === 'CRITICAL', 'lowest voltage bucket = CRITICAL');
assert(busRows.find(r => r[4] === 'WARN'), 'at least one WARN bucket');
const vmAsc = busRows.map(r => parseFloat(r[2]));
for (let i = 1; i < vmAsc.length; i++) {
    assert(vmAsc[i - 1] <= vmAsc[i], `bus row ${i} sorted ascending`);
}

// ---------- Test 5: loading rows include all branch types ---------------
console.log('\nTest 5: buildLoadingRows orders desc and supports lines + trafos');
const loadingRows = I.buildLoadingRows(stressed, () => '');
assert(loadingRows.length === 3, 'lines + trafo present (3 rows)');
assert(loadingRows[0][0] === 'Line' && parseFloat(loadingRows[0][3]) === 110, 'most-loaded first');
assert(loadingRows[0][4] === 'CRITICAL', 'overload classified');

// ---------- Test 6: detailed sections cover relevant categories ---------
console.log('\nTest 6: buildDetailedSections (stressed)');
const sections = I.buildDetailedSections(stressed);
const titles = sections.map(s => s.title);
assert(titles.includes('Buses')                       , 'has Buses section');
assert(titles.includes('Lines')                       , 'has Lines section');
assert(titles.includes('Transformers (2W)')          , 'has 2W Trafo section');
assert(titles.includes('External grids')              , 'has External grids section');
assert(titles.includes('Static generators')           , 'has SGen section');
assert(titles.includes('Asymmetric static generators'), 'has Asym SGen section');
assert(titles.includes('Storages')                    , 'has Storage section');
assert(titles.includes('Loads')                       , 'has Loads section');
assert(titles.includes('PV systems')                  , 'has PV section');

const sgenSec = sections.find(s => s.title === 'Static generators');
assert(sgenSec.rows.length === 30, 'SGen table has 30 rows');

// ---------- Test 7: tolerant of OpenDSS lowercase transformers3w --------
console.log('\nTest 7: detailed sections accept transformers3w (OpenDSS)');
const dssLike = {
    busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
    transformers3w: [{ id: 't1', name: 't1', loading_percent: 75, pl_mw: 0.1 }],
};
const dssSections = I.buildDetailedSections(dssLike);
assert(dssSections.find(s => s.title === 'Transformers (3W)'),
    'transformers3w (lowercase) becomes a 3W section');

// ---------- Test 8: scoreStatus mapping ---------------------------------
console.log('\nTest 8: scoreStatus thresholds');
assert(I.scoreStatus(0,   false).text === 'Did not converge', 'non-converged labelled');
assert(I.scoreStatus(95,  true).text  === 'Excellent',         '95 = Excellent');
assert(I.scoreStatus(80,  true).text  === 'Healthy',           '80 = Healthy');
assert(I.scoreStatus(65,  true).text  === 'Acceptable',        '65 = Acceptable');
assert(I.scoreStatus(45,  true).text  === 'Stressed',          '45 = Stressed');
assert(I.scoreStatus(20,  true).text  === 'Critical',          '20 = Critical');

// ---------- Test 9: slug helper sanitises filenames ---------------------
console.log('\nTest 9: slug() sanitises project names');
assert(I.slug('Offshore Wind / Phase 1') === 'Offshore_Wind_Phase_1' ||
       I.slug('Offshore Wind / Phase 1') === 'Offshore_Wind___Phase_1' ||
       /^Offshore_Wind/.test(I.slug('Offshore Wind / Phase 1')),
       'spaces and special chars replaced');
assert(I.slug('') === 'report', 'empty falls back to "report"');

// ---------- Test 10: stressed net under-counting fix regression ---------
console.log('\nTest 10: 30 sgens + 1 asym sgen + storage discharge + ext_grid + pv');
const k3 = I.buildKpiCells(m2);
const totalGenCard = k3.find(c => c.label === 'Total Generation');
//   30*15 + 15 (asym) + 10 (storage discharge) + 100 (ext_grid) + 5 (pv) = 580 MW
assert(Math.abs(parseFloat(totalGenCard.value) - 580) < 1e-3,
    'Total generation card sums every category (gross 580 MW)');

console.log('\nAll engineering report smoke tests passed.');
