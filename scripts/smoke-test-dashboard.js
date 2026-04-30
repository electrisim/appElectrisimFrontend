/* Smoke test for networkHealthDashboard.js
 * Loads the file with a minimal `window` shim, then runs computeMetrics
 * on a few synthetic result payloads and asserts the math is sensible.
 *
 * Usage: node scripts/smoke-test-dashboard.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const code = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'results', 'networkHealthDashboard.js'),
    'utf8'
);

// Minimal browser shim — enough for the IIFE to register its public API.
const win = {};
const doc = {
    getElementById: () => null,
    head: { appendChild: () => {} },
    body: { appendChild: () => {} },
    createElement: () => ({
        id: '',
        innerHTML: '',
        querySelector: () => ({ addEventListener: () => {}, textContent: '' }),
        querySelectorAll: () => [],
        appendChild: () => {},
        addEventListener: () => {},
        style: {},
        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
        getBoundingClientRect: () => ({ left: 0, top: 0 }),
        getAttribute: () => null,
        offsetWidth: 380,
    }),
};
const sandbox = `
    var window = arguments[0];
    var document = arguments[1];
    var navigator = { clipboard: null };
    var requestAnimationFrame = function (fn) { fn && fn(); };
    ${code}
`;
new Function(sandbox)(win, doc);

if (typeof win.computeNetworkHealthMetrics !== 'function') {
    console.error('FAIL: computeNetworkHealthMetrics not exposed on window');
    process.exit(1);
}

function assert(cond, msg) {
    if (!cond) {
        console.error('FAIL:', msg);
        process.exit(1);
    } else {
        console.log('  PASS:', msg);
    }
}

// --- Test 1: healthy small network ---------------------------------------
const healthy = {
    busbars: [
        { id: 'b1', name: 'b1', vm_pu: 1.00 },
        { id: 'b2', name: 'b2', vm_pu: 0.99 },
        { id: 'b3', name: 'b3', vm_pu: 1.02 },
    ],
    lines: [
        { id: 'l1', name: 'l1', loading_percent: 30, pl_mw: 0.05 },
        { id: 'l2', name: 'l2', loading_percent: 55, pl_mw: 0.08 },
    ],
    transformers: [
        { id: 't1', name: 't1', loading_percent: 60, pl_mw: 0.02 },
    ],
    externalgrids: [{ id: 'e1', name: 'e1', p_mw: 12.0 }],
    loads: [{ id: 'ld1', name: 'ld1', p_mw: 11.85 }],
};

console.log('\nTest 1: healthy network');
const m1 = win.computeNetworkHealthMetrics(healthy);
console.log('  ->', { score: m1.healthScore, gen: m1.totalGen, load: m1.totalLoad, losses: m1.totalLosses, lossPct: m1.lossPct });
assert(m1.converged === true,            'converged');
assert(m1.healthScore > 85,              'high health score for healthy network');
assert(m1.totalGen   === 12,             'total generation summed');
assert(m1.totalLoad  > 11.84 && m1.totalLoad < 11.86, 'total load summed');
assert(Math.abs(m1.totalLosses - 0.15) < 1e-9, 'losses summed from pl_mw');
assert(m1.minV === 0.99 && m1.maxV === 1.02, 'voltage min/max');
assert(m1.busBuckets.good === 3,         'all buses in good band');
assert(m1.equipmentBuckets.good === 3,   'all equipment in good band');
assert(m1.issues.length === 0,           'no issues');

// --- Test 2: stressed network with violations ----------------------------
const stressed = {
    busbars: [
        { id: 'b1', name: 'b1', vm_pu: 1.00 },
        { id: 'b2', name: 'b2', vm_pu: 0.86 }, // danger low
        { id: 'b3', name: 'b3', vm_pu: 1.07 }, // warn high
    ],
    lines: [
        { id: 'l1', name: 'l1', loading_percent: 110 }, // overloaded
        { id: 'l2', name: 'l2', loading_percent: 92  }, // warning
    ],
    externalgrids: [{ id: 'e1', name: 'e1', p_mw: 100 }],
    loads: [{ id: 'ld1', name: 'ld1', p_mw: 95 }],
};

console.log('\nTest 2: stressed network');
const m2 = win.computeNetworkHealthMetrics(stressed);
console.log('  ->', { score: m2.healthScore, issues: m2.issues.length });
assert(m2.converged === true,                     'converged');
assert(m2.healthScore < 75,                       'lower score for stressed network');
assert(m2.busBuckets.danger >= 1,                 'detects voltage danger');
assert(m2.busBuckets.warn >= 1,                   'detects voltage warning');
assert(m2.equipmentBuckets.danger >= 1,           'detects loading overload');
assert(m2.issues.length >= 3,                     'lists multiple issues');
assert(m2.issues[0].severity === 'danger',        'danger issues are first');
assert(m2.top5.length === 2,                      'top5 contains both lines');
assert(m2.top5[0].loading_percent === 110,        'top5 sorted desc by loading');

// --- Test 3: empty / non-converged ---------------------------------------
console.log('\nTest 3: empty payload');
const m3 = win.computeNetworkHealthMetrics({});
console.log('  ->', { score: m3.healthScore, conv: m3.converged });
assert(m3.converged === false,    'not converged when no data');
assert(m3.healthScore === 0,      'score 0 when not converged');

// --- Test 4: tolerant of OpenDSS lowercase key ---------------------------
console.log('\nTest 4: OpenDSS transformers3w spelling');
const m4 = win.computeNetworkHealthMetrics({
    busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
    transformers3w: [{ id: 't1', name: 't1', loading_percent: 75, pl_mw: 0.1 }],
});
assert(m4.equipmentBuckets.total === 1, 'lowercase transformers3w accepted');

// --- Test 5: 30 symmetric static generators × 15 MW ----------------------
console.log('\nTest 5: 30 sgens × 15 MW (regression for under-counting bug)');
const sgens30 = Array.from({ length: 30 }, (_, i) => ({
    id: 'sg' + i, name: 'sg' + i, p_mw: 15, q_mvar: 0,
}));
const m5 = win.computeNetworkHealthMetrics({
    busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
    staticgenerators: sgens30,
    loads: [{ id: 'ld1', name: 'ld1', p_mw: 440 }],
});
console.log('  ->', { gen: m5.totalGen, load: m5.totalLoad });
assert(Math.abs(m5.totalGen  - 450) < 1e-6, '30 × 15 MW sgens summed to 450 MW');
assert(Math.abs(m5.totalLoad - 440) < 1e-6, 'load summed to 440 MW');
const sgenRow = m5.breakdownGen.find(r => r.label.includes('Static generators'));
assert(sgenRow && sgenRow.count === 30, 'breakdown reports 30 static generators');

// --- Test 6: 30 ASYMMETRIC static gens × 15 MW total ---------------------
// This is the most likely cause of the user-reported 18.46 MW number: the
// dashboard previously ignored asymmetricstaticgenerators entirely.
console.log('\nTest 6: 30 asymmetric sgens (5+5+5 MW per phase = 15 MW each)');
const asymSgens30 = Array.from({ length: 30 }, (_, i) => ({
    id: 'asg' + i, name: 'asg' + i,
    p_a_mw: 5, p_b_mw: 5, p_c_mw: 5,
    q_a_mvar: 0, q_b_mvar: 0, q_c_mvar: 0,
}));
const m6 = win.computeNetworkHealthMetrics({
    busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
    asymmetricstaticgenerators: asymSgens30,
});
console.log('  ->', { gen: m6.totalGen });
assert(Math.abs(m6.totalGen - 450) < 1e-6,
    '30 asymmetric sgens × (5+5+5) summed to 450 MW (was 0 MW before fix)');
const asymRow = m6.breakdownGen.find(r => r.label.includes('Asymmetric static gens'));
assert(asymRow && asymRow.count === 30, 'breakdown reports 30 asymmetric sgens');

// --- Test 7: storage discharge counts as generation ----------------------
console.log('\nTest 7: storage with negative p_mw counts as generation');
const m7 = win.computeNetworkHealthMetrics({
    busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
    storages: [{ id: 's1', name: 's1', p_mw: -10, q_mvar: 0 }],
    loads: [{ id: 'ld1', name: 'ld1', p_mw: 10 }],
});
assert(Math.abs(m7.totalGen  - 10) < 1e-6, 'storage discharge counted as gen');
assert(Math.abs(m7.totalLoad - 10) < 1e-6, 'no double counting');

// --- Test 8: ext_grid acting as a sink ----------------------------------
console.log('\nTest 8: ext_grid with negative p_mw (export, slack absorbing)');
const m8 = win.computeNetworkHealthMetrics({
    busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
    externalgrids: [{ id: 'eg1', name: 'eg1', p_mw: -50 }],
    staticgenerators: [{ id: 's1', name: 's1', p_mw: 100 }],
    loads: [{ id: 'ld1', name: 'ld1', p_mw: 50 }],
});
assert(Math.abs(m8.totalGen  - 100) < 1e-6,
    'gross gen excludes ext_grid export (gross 100 MW, not 50 MW)');
assert(Math.abs(m8.totalLoad - 100) < 1e-6, 'export shows up on load side');

// --- Test 9: pvsystems (OpenDSS) -----------------------------------------
console.log('\nTest 9: pvsystems counted (OpenDSS engine)');
const m9 = win.computeNetworkHealthMetrics({
    busbars: [{ id: 'b1', name: 'b1', vm_pu: 1.0 }],
    pvsystems: [
        { id: 'pv1', name: 'pv1', p_mw: 5 },
        { id: 'pv2', name: 'pv2', p_mw: 3 },
    ],
});
assert(Math.abs(m9.totalGen - 8) < 1e-6, 'pvsystems summed correctly');

console.log('\nAll dashboard smoke tests passed.');
