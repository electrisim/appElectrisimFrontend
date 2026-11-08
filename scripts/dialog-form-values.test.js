/**
 * Dialog.getFormValues keeps its array shape and also exposes each value by parameter id.
 * DG Interconnection (values.derId) and the OpenDSS Load Flow dialog (values.mode) read the
 * values by name, so they always got undefined and DG screening never ran.
 * Run: node scripts/dialog-form-values.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'Dialog.js'),
    'utf8'
);
// Dialog.js imports browser modules, so take only the two methods and run them on a stub.
const start = src.indexOf('    getFormValues() {');
const end = src.indexOf('    showModalFallback(', start);
if (start < 0 || end < 0) throw new Error('getFormValues / showModalFallback not found in Dialog.js');
// eslint-disable-next-line no-new-func
const Stub = new Function(`return class { ${src.slice(start, end)} }`)();

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

const dialog = new Stub();
dialog.parameters = [
    { id: 'intro', type: 'section' },
    { id: 'derId', type: 'select' },
    { id: 'runHostingCapacity', type: 'checkbox' },
    { id: 'mode', type: 'radio', options: [{ value: 'Snapshot', default: true }, { value: 'Daily' }] },
    { id: 'length', type: 'number' },
];
dialog.inputs = new Map([
    ['derId', { value: 'mxCell#277' }],
    ['runHostingCapacity', { checked: true }],
    ['mode_Snapshot', { checked: false }],
    ['mode_Daily', { checked: true }],
    ['length', { value: '5' }],
]);

const values = dialog.getFormValues();
check(Array.isArray(values), true, 'still an array');
check(Array.from(values), ['mxCell#277', true, 'Daily', '5'], 'values by position');
check(values.derId, 'mxCell#277', 'select by id');
check(values.runHostingCapacity, true, 'checkbox by id');
check(values.mode, 'Daily', 'radio by id');
check(values.length, 4, 'array length is not overwritten by a parameter called "length"');
check(JSON.stringify(values), JSON.stringify(['mxCell#277', true, 'Daily', '5']), 'JSON keeps the array form');

if (failed) {
    console.error(`\n${failed} Dialog form value check(s) failed.`);
    process.exit(1);
}
console.log('\nAll Dialog form value checks passed.');
