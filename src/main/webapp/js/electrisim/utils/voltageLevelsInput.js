/**
 * Parse a "Voltage levels at PCC (p.u.)" field.
 *
 * Accepts dot or comma decimals and comma, semicolon or space separators:
 *   "0.9, 0.95, 1.0"   "0,9; 0,95; 1,0"   "0,9, 0,95, 1.0, 1.05"   "0.9 0.95 1"
 * Each value is read as digits with an optional decimal part written with "." or with a
 * "," directly followed by digits ("0,9"). Anything else between values must be a
 * separator (comma, semicolon or space).
 *
 * Returns { levels: number[] (sorted, unique), errors: string[] }. Values outside
 * minPu…maxPu (default 0.5…1.5 p.u.) and unreadable text are reported as errors, never
 * silently used or dropped.
 */
export function parseVoltageLevels(raw, { fallback = [], minPu = 0.5, maxPu = 1.5 } = {}) {
    const text = String(raw ?? '').trim();
    if (!text) return { levels: [...fallback], errors: [] };

    const levels = [];
    const errors = [];
    const numberRe = /\d+(?:\.\d+|,\d+)?|\.\d+/g;
    let last = 0;
    let m;
    while ((m = numberRe.exec(text)) !== null) {
        const gap = text.slice(last, m.index);
        if (/[^\s,;]/.test(gap)) errors.push(`"${gap.replace(/^[\s,;]+|[\s,;]+$/g, '')}" is not a number`);
        last = m.index + m[0].length;
        const v = Number(m[0].replace(',', '.'));
        if (!Number.isFinite(v)) {
            errors.push(`"${m[0]}" is not a number`);
        } else if (v < minPu || v > maxPu) {
            errors.push(`${m[0]} p.u. is outside ${minPu}…${maxPu} p.u.`);
        } else {
            levels.push(+v.toFixed(4));
        }
    }
    const tail = text.slice(last);
    if (/[^\s,;]/.test(tail)) errors.push(`"${tail.replace(/^[\s,;]+|[\s,;]+$/g, '')}" is not a number`);
    return { levels: [...new Set(levels)].sort((a, b) => a - b), errors };
}

/** Message for an alert when the field cannot be used, or '' when it is fine. */
export function voltageLevelsErrorMessage(raw, result) {
    if (!String(raw ?? '').trim()) return '';  // empty: the caller's default applies
    if (!result.errors.length && result.levels.length) return '';
    const lines = [`Voltage levels at PCC: "${String(raw ?? '').trim()}" could not be read.`];
    if (!result.levels.length && !result.errors.length) lines.push('• no values found');
    result.errors.forEach((e) => lines.push(`• ${e}`));
    lines.push('', 'Enter p.u. values separated by commas, semicolons or spaces, for example "0.9, 0.95, 1.0, 1.05" or "0,9; 0,95; 1,0; 1,05".');
    return lines.join('\n');
}
