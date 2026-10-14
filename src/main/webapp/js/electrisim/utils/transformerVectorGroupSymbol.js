/**
 * IEC 60076 vector-group marks drawn inside transformer winding circles.
 *
 * Capital / lowercase letters only say which winding the symbol belongs to
 * (HV, then MV, then LV). The glyph itself follows the usual single-line practice:
 *   D / d  equilateral triangle, one vertex on the clock hour
 *   Y / y  star, one limb on the clock hour
 *   Z / z  zigzag (two equal half-windings, 60° apart)
 *   N / n  neutral brought out and earthed (earth symbol in the downward gap)
 * HV is the reference and stays at 12 o'clock. Each clock hour is 30°.
 */

const INK = '#1a1a2e';
const WINDING_STROKE = 1.4;
const EARTH_STROKE = 1.15;

const STAR_ARM = 6.05;
const DELTA_R = 6.85;
const ZIGZAG_SEG = 3.05;

const CONN = { Y: 'Y', D: 'D', Z: 'Z', A: 'Y' };

function num(n) {
    const v = Math.round(n * 100) / 100;
    if (Object.is(v, -0)) {
        return '0';
    }
    return String(v);
}

/** Clockwise degrees from 12 o'clock → SVG coordinates (y down). */
function polar(degFromUp, len) {
    const r = (degFromUp * Math.PI) / 180;
    return [len * Math.sin(r), -len * Math.cos(r)];
}

function windingLine(x1, y1, x2, y2, width, cap) {
    return '<line x1="' + num(x1) + '" y1="' + num(y1) + '" x2="' + num(x2) + '" y2="' + num(y2) +
        '" stroke="' + INK + '" stroke-width="' + (width == null ? WINDING_STROKE : width) +
        '" stroke-linecap="' + (cap || 'round') + '" stroke-linejoin="round"/>';
}

/**
 * Parse an IEC / pandapower vector group into up to `maxWindings` windings.
 * Accepts "Dyn11", "YNd5", "YNyn0d5", "YN0yn0yn0", and the same with spaces.
 * Clock hours may also be given in degrees (multiple of 30, up to 330).
 */
export function parseVectorGroupWindings(vectorGroup, maxWindings) {
    const limit = maxWindings == null ? 3 : maxWindings;
    const s = String(vectorGroup == null ? '' : vectorGroup).replace(/[\s_-]+/g, '');
    const out = [];
    let i = 0;
    while (i < s.length && out.length < limit) {
        const upper = s.charAt(i).toUpperCase();
        if (!CONN[upper]) {
            i += 1;
            continue;
        }
        i += 1;
        let grounded = false;
        if (i < s.length && (s.charAt(i) === 'N' || s.charAt(i) === 'n')) {
            grounded = true;
            i += 1;
        }
        let clock = null;
        if (i < s.length && s.charAt(i) >= '0' && s.charAt(i) <= '9') {
            let numStr = '';
            while (i < s.length && s.charAt(i) >= '0' && s.charAt(i) <= '9') {
                numStr += s.charAt(i);
                i += 1;
            }
            const n = parseInt(numStr, 10);
            if (n >= 0 && n <= 11) {
                clock = n;
            } else if (n % 30 === 0 && n / 30 <= 11) {
                clock = n / 30;
            }
        }
        const kind = CONN[upper];
        out.push({
            kind: kind,
            grounded: grounded && kind !== 'D',
            clock: clock
        });
    }
    return out;
}

/** Nearest hour on a 0–11 clock, from a phase-shift angle in degrees. */
export function clockHourFromDegrees(value) {
    if (value == null || String(value).trim() === '') {
        return null;
    }
    const deg = Number(value);
    if (!Number.isFinite(deg)) {
        return null;
    }
    return ((Math.round(deg / 30) % 12) + 12) % 12;
}

/**
 * Earth lead sits in a 120° gap between limbs, as close to 6 o'clock as that allows,
 * so the neutral reads as earthed and does not lie on top of a phase limb.
 */
function earthGapDeg(clockHour) {
    const base = ((clockHour % 12) + 12) % 12 * 30;
    const gaps = [60, 180, 300].map(function (g) { return (g + base) % 360; });
    const down = 180;
    let best = gaps[0];
    let bestDist = 999;
    let bestRight = -999;
    for (let i = 0; i < gaps.length; i++) {
        const g = gaps[i];
        let d = Math.abs(g - down);
        if (d > 180) {
            d = 360 - d;
        }
        const right = Math.sin((g * Math.PI) / 180);
        if (d < bestDist - 0.01 || (Math.abs(d - bestDist) <= 0.01 && right > bestRight)) {
            best = g;
            bestDist = d;
            bestRight = right;
        }
    }
    return best;
}

function earthMarkup(clockHour) {
    const angle = earthGapDeg(clockHour);
    const dir = polar(angle, 1);
    const ux = dir[0];
    const uy = dir[1];
    const px = -uy;
    const py = ux;
    function at(dist) {
        return [ux * dist, uy * dist];
    }
    function bar(dist, half) {
        const c = at(dist);
        return windingLine(c[0] - px * half, c[1] - py * half, c[0] + px * half, c[1] + py * half, EARTH_STROKE, 'butt');
    }
    const a = at(1.15);
    const b = at(4.55);
    return windingLine(a[0], a[1], b[0], b[1], EARTH_STROKE, 'round') +
        bar(5.05, 2.7) +
        bar(6.9, 1.75) +
        bar(8.75, 0.9);
}

function starMarkup(clockHour) {
    const rot = ((clockHour % 12) + 12) % 12 * 30;
    let s = '';
    const arms = [0, 120, 240];
    for (let i = 0; i < arms.length; i++) {
        const p = polar(arms[i] + rot, STAR_ARM);
        s += windingLine(0, 0, p[0], p[1]);
    }
    return s;
}

function deltaMarkup(clockHour) {
    const rot = ((clockHour % 12) + 12) % 12 * 30;
    const pts = [0, 120, 240].map(function (a) { return polar(a + rot, DELTA_R); });
    const points = pts.map(function (p) { return num(p[0]) + ',' + num(p[1]); }).join(' ');
    return '<polygon points="' + points + '" fill="none" stroke="' + INK + '" stroke-width="' + WINDING_STROKE +
        '" stroke-linejoin="round"/>';
}

function zigzagMarkup(clockHour) {
    const rot = ((clockHour % 12) + 12) % 12 * 30;
    let s = '';
    const axes = [0, 120, 240];
    for (let i = 0; i < axes.length; i++) {
        const tipDeg = axes[i] + rot;
        const mid = polar(tipDeg - 30, ZIGZAG_SEG);
        const outer = polar(tipDeg + 30, ZIGZAG_SEG);
        const tip = [mid[0] + outer[0], mid[1] + outer[1]];
        s += windingLine(0, 0, mid[0], mid[1]);
        s += windingLine(mid[0], mid[1], tip[0], tip[1]);
    }
    return s;
}

export function renderWindingSymbol(winding, cx, cy) {
    if (!winding || !winding.kind) {
        return '';
    }
    const clock = winding.clock == null ? 0 : ((winding.clock % 12) + 12) % 12;
    let body;
    if (winding.kind === 'D') {
        body = deltaMarkup(clock);
    } else if (winding.kind === 'Z') {
        body = zigzagMarkup(clock);
    } else {
        body = starMarkup(clock);
    }
    if (winding.grounded && winding.kind !== 'D') {
        body += earthMarkup(clock);
    }
    return '<g transform="translate(' + num(cx) + ' ' + num(cy) + ')">' + body + '</g>';
}

/**
 * One SVG fragment per circle. `centers` is HV, LV or HV, MV, LV.
 * `fallbackClocks[i]` is used only when that winding's hour is omitted from the string
 * (for example vector group "Dyn" with shift_degree 330 → hour 11 on LV).
 * The HV mark is always drawn at 12 o'clock.
 */
export function renderVectorGroupSymbols(vectorGroup, centers, fallbackClocks) {
    const windings = parseVectorGroupWindings(vectorGroup, centers.length);
    const parts = [];
    for (let i = 0; i < centers.length; i++) {
        const w = windings[i];
        if (!w) {
            parts.push('');
            continue;
        }
        let clock = 0;
        if (i > 0) {
            if (w.clock != null) {
                clock = w.clock;
            } else if (fallbackClocks && fallbackClocks[i] != null) {
                clock = fallbackClocks[i];
            }
        }
        parts.push(renderWindingSymbol({
            kind: w.kind,
            grounded: w.grounded,
            clock: clock
        }, centers[i].x, centers[i].y));
    }
    return parts;
}
