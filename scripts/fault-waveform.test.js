/**
 * Unit checks for results/faultCurrentWaveform.js (time-domain view of a short-circuit result).
 * Run: node scripts/fault-waveform.test.js
 */
'use strict';
const path = require('path');

const fw = require(path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'results', 'faultCurrentWaveform.js'));

let failed = 0;
function near(actual, expected, tol, label) {
    if (!(Math.abs(actual - expected) <= tol)) {
        failed++;
        console.error(`FAIL ${label}: got ${actual}, expected ${expected} ± ${tol}`);
    } else {
        console.log(`ok   ${label}`);
    }
}
function truthy(v, label) {
    if (!v) { failed++; console.error(`FAIL ${label}`); } else console.log(`ok   ${label}`);
}

// kappa <-> R/X round trip (IEC 60909: kappa = 1.02 + 0.98 exp(-3 R/X))
near(fw.kappaFromRx(0.1), 1.02 + 0.98 * Math.exp(-0.3), 1e-12, 'kappa from R/X = 0.1');
near(fw.rxFromKappa(fw.kappaFromRx(0.07)), 0.07, 1e-9, 'R/X from kappa round trip');
truthy(fw.rxFromKappa(2.0) === null && fw.rxFromKappa(1.02) === null, 'kappa outside the formula range gives null');

// Model from an IEC row: ip sets the X/R (kappa 1.8 -> R/X = 0.0762...)
const ik = 25;
const row = { name: 'B1', ikss_ka: ik, ip_ka: 1.8 * Math.SQRT2 * ik, rk_ohm: 0.2, xk_ohm: 1.0 };
const m = fw.buildModel(row, { frequency: 50, faultType: '3ph' });
near(m.xr, 1 / (-Math.log((1.8 - 1.02) / 0.98) / 3), 1e-9, 'X/R taken from the study peak factor');
near(m.xrPoint, 5, 1e-12, 'X/R at the fault point kept for the note');
near(m.tau, m.xr / (2 * Math.PI * 50), 1e-12, 'DC time constant = X / (omega R)');

// Without ip the fault-point impedance is used
const m2 = fw.buildModel({ ikss_ka: 10, rk_ohm: 0.1, xk_ohm: 1.4 }, { frequency: 60 });
near(m2.xr, 14, 1e-9, 'X/R from Rk and Xk when there is no ip');
near(m2.tau * 1000, 14 / (2 * Math.PI * 60) * 1000, 1e-9, 'time constant at 60 Hz');

// ANSI rows carry their own X/R
const m3 = fw.buildModel({ i_first_sym_ka: 30, i_first_peak_ka: 78, xr_first: 20 }, { frequency: 60 });
near(m3.xr, 20, 1e-12, 'ANSI X/R used directly');
truthy(fw.buildModel({ ikss_ka: 0 }, {}) === null && fw.buildModel({}, {}) === null, 'rows without current give no model');

// The current starts at zero in every phase, whatever the closing angle
[0, 37, 90, 211].forEach((a) => {
    for (let k = 0; k < 3; k++) near(fw.phaseCurrent(m, k, a, 0), 0, 1e-9, `i(0) = 0, phase ${k}, angle ${a}`);
});
// Three phases sum to zero at any time (balanced fault)
[0.003, 0.0125, 0.05].forEach((t) => {
    const s = fw.phaseCurrent(m, 0, 50, t) + fw.phaseCurrent(m, 1, 50, t) + fw.phaseCurrent(m, 2, 50, t);
    near(s, 0, 1e-9, `phase currents sum to zero at ${t * 1000} ms`);
});
// Long after the fault the DC has gone and the peak is sqrt(2) Ik"
let late = 0;
for (let i = 0; i < 2000; i++) late = Math.max(late, Math.abs(fw.phaseCurrent(m, 0, 20, 2 + i * 0.02 / 2000)));
near(late, Math.SQRT2 * ik, 1e-3, 'steady peak is sqrt(2) Ik"');

// Worst-case peak agrees with the IEC peak factor (the formula is an approximation, within 1 %)
const worst = fw.worstAngle(m);
const peak = fw.findPeak(m, worst, 4000);
near(peak.abs / row.ip_ka, 1, 0.01, 'worst-case peak of the waveform matches ip of the study');
// ... and it is close to a voltage zero, about half a cycle after the fault starts
truthy(Math.min(worst % 180, 180 - (worst % 180)) < 12, `worst closing angle is near a voltage zero (${worst.toFixed(1)} deg)`);
near(peak.t * 1000, 10, 1.2, 'peak comes about half a cycle after the fault starts');
// The angle with no offset on L1 gives exactly the symmetrical peak
const sym = fw.findPeak({ ...m, threePhase: false }, m.phi * 180 / Math.PI, 4000);
near(sym.abs, Math.SQRT2 * ik, 1e-3, 'no DC offset when the fault starts at the impedance angle');

// Breaker duty: with tau = 45 ms the network equals the standard test
const m45 = fw.buildModel({ ikss_ka: 20, rk_ohm: 1, xk_ohm: 0.045 * 2 * Math.PI * 50 }, { frequency: 50 });
near(m45.tau * 1000, 45, 1e-9, 'X/R = 14.14 at 50 Hz is the standard 45 ms');
const d45 = fw.breakerDuty(m45, 45);
near(d45.dcPercent, 100 / Math.E, 1e-9, 'DC component is 36.8 % after one time constant');
near(d45.asymKa, 20 * Math.sqrt(1 + 2 / (Math.E * Math.E)), 1e-9, 'asymmetrical current = sqrt(Iac^2 + Idc^2)');
truthy(!d45.exceedsStandard, '45 ms does not exceed the standard');
const slow = fw.buildModel({ ikss_ka: 20, rk_ohm: 1, xk_ohm: 40 }, { frequency: 50 });
const dSlow = fw.breakerDuty(slow, 50);
truthy(dSlow.exceedsStandard && dSlow.dcPercent > dSlow.standardDcPercent, 'X/R = 40 exceeds the standard DC component');
near(dSlow.standardDcPercent, 100 * Math.exp(-50 / 45), 1e-9, 'standard DC component at 50 ms');

// Animation timeline ends at the angle it started with
const end = fw.timeline(1e6, 123);
truthy(end.done && end.progress === 1 && end.alpha === 123, 'timeline ends on the starting angle');
truthy(fw.timeline(0, 5).progress === 0, 'timeline starts with an empty chart');

if (failed) {
    console.error(`\n${failed} check(s) failed`);
    process.exit(1);
}
console.log('\nfault-waveform: all checks passed');
