/**
 * Unit checks for utils/harmonicLimits.js (limits used to rate Harmonic Analysis results).
 * Run: node scripts/harmonic-limits.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'utils', 'harmonicLimits.js'),
    'utf8'
);
// The module only uses `export`; strip it so the functions can run as a plain script.
const sandbox = {};
vm.runInNewContext(
    src.replace(/^export /gm, '') +
    '\n;this.harmonicVoltageLimits = harmonicVoltageLimits; this.rateBusHarmonics = rateBusHarmonics;' +
    'this.HARMONIC_LIMIT_STANDARDS = HARMONIC_LIMIT_STANDARDS;',
    sandbox
);
const { harmonicVoltageLimits, rateBusHarmonics, HARMONIC_LIMIT_STANDARDS } = sandbox;

let failed = 0;
function check(actual, expected, label) {
    const ok = typeof expected === 'number' ? Math.abs(actual - expected) < 1e-9 : actual === expected;
    if (!ok) {
        failed++;
        console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    } else {
        console.log(`PASS ${label}`);
    }
}

check(HARMONIC_LIMIT_STANDARDS.length, 3, 'three choices: IEEE, IEC, none');

// IEEE 519-2022 Table 1
check(harmonicVoltageLimits('ieee519', 0.4).thd, 8, 'IEEE 519: 0.4 kV THD 8 %');
check(harmonicVoltageLimits('ieee519', 0.4).individual(5), 5, 'IEEE 519: 0.4 kV individual 5 %');
check(harmonicVoltageLimits('ieee519', 66).thd, 5, 'IEEE 519: 66 kV THD 5 %');
check(harmonicVoltageLimits('ieee519', 69).individual(7), 3, 'IEEE 519: 69 kV individual 3 %');
check(harmonicVoltageLimits('ieee519', 110).thd, 2.5, 'IEEE 519: 110 kV THD 2.5 %');
check(harmonicVoltageLimits('ieee519', 275).thd, 1.5, 'IEEE 519: 275 kV THD 1.5 %');
check(harmonicVoltageLimits('ieee519', 400).individual(11), 1, 'IEEE 519: 400 kV individual 1 %');

// IEC planning / compatibility levels
check(harmonicVoltageLimits('iec61000', 20).thd, 6.5, 'IEC: MV THD 6.5 %');
check(harmonicVoltageLimits('iec61000', 20).individual(5), 5, 'IEC: MV 5th 5 %');
check(harmonicVoltageLimits('iec61000', 20).individual(3), 4, 'IEC: MV 3rd 4 %');
check(harmonicVoltageLimits('iec61000', 20).individual(2), 1.8, 'IEC: MV 2nd 1.8 %');
check(harmonicVoltageLimits('iec61000', 275).thd, 3, 'IEC: HV THD 3 %');
check(harmonicVoltageLimits('iec61000', 275).individual(7), 2, 'IEC: HV 7th 2 %');
check(harmonicVoltageLimits('iec61000', 275).individual(17), 1.2, 'IEC: HV 17th 1.2 %');
check(harmonicVoltageLimits('iec61000', 275).individual(25), 1.2 * 17 / 25, 'IEC: HV 25th from the formula');
check(harmonicVoltageLimits('iec61000', 0.4).thd, 8, 'IEC: LV THD 8 %');
check(harmonicVoltageLimits('iec61000', 0.4).individual(5), 6, 'IEC: LV 5th 6 %');

// no check
check(harmonicVoltageLimits('none', 20), null, 'no standard: no limits');
check(harmonicVoltageLimits('ieee519', NaN), null, 'unknown nominal voltage: no limits');

// rating a bus
let r = rateBusHarmonics('ieee519', 66, 2.0, [{ order: 5, pct: 1.5 }, { order: 7, pct: 0.5 }]);
check(r.status, 'ok', 'within THD and individual limits');
check(r.worst.order, 5, 'worst harmonic is the one closest to its limit');
r = rateBusHarmonics('ieee519', 66, 2.0, [{ order: 5, pct: 3.5 }]);
check(r.status, 'over', 'individual harmonic above its limit');
check(r.overOrders.length, 1, 'the exceeding order is listed');
check(r.thdOver, false, 'THD itself is within its limit');
r = rateBusHarmonics('ieee519', 400, 1.8, [{ order: 5, pct: 0.9 }]);
check(r.status, 'over', 'THD above its limit');
check(r.thdOver, true, 'THD flagged');
check(rateBusHarmonics('none', 66, 50, [{ order: 5, pct: 40 }]).status, 'none', 'no rating without a standard');

if (failed) {
    console.error(`${failed} check(s) failed`);
    process.exit(1);
}
console.log('All harmonic limit checks passed.');
