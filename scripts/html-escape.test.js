/**
 * Unit checks for utils/htmlEscape.js (escapeHtml used before values go into innerHTML).
 * Run: node scripts/html-escape.test.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'main', 'webapp', 'js', 'electrisim', 'utils', 'htmlEscape.js'),
    'utf8'
);
// The module only uses `export`; strip it so the function can run as a plain script.
const sandbox = {};
vm.runInNewContext(src.replace(/^export default .*$/m, '').replace(/^export /gm, '') + '\n;this.escapeHtml = escapeHtml;', sandbox);
const escapeHtml = sandbox.escapeHtml;

let failed = 0;
function check(actual, expected, label) {
    if (actual !== expected) {
        failed++;
        console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    } else {
        console.log(`PASS ${label}`);
    }
}

check(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;', 'tags are neutralised');
check(escapeHtml(`a & b "c" 'd'`), 'a &amp; b &quot;c&quot; &#39;d&#39;', 'ampersand and quotes');
check(escapeHtml(null), '', 'null becomes empty string');
check(escapeHtml(undefined), '', 'undefined becomes empty string');
check(escapeHtml(0), '0', 'zero is kept');
check(escapeHtml(12.5), '12.5', 'numbers pass through');
check(escapeHtml('IBR 1 — ok'), 'IBR 1 — ok', 'non-ASCII text is unchanged');

if (failed) {
    console.error(`\n${failed} escapeHtml check(s) failed.`);
    process.exit(1);
}
console.log('\nAll escapeHtml checks passed.');
