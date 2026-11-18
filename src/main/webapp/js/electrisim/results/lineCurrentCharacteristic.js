/**
 * Electrisim — Line current vs distance along a chained path (Pandapower load flow).
 *
 * Uses pandapower line magnitudes i_from_ka / i_to_ka and each segment length_km.
 * Intended for feeder / cable routes modelled as several Line edges in sequence.
 *
 * window.showLineCurrentCharacteristicPanel(graph?)
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    const PANEL_ID = 'electrisim-line-i-profile';
    const STYLE_ID = 'electrisim-line-i-profile-style';

    /** Distinct segment stroke / band colors (cycle if many segments). */
    const SEGMENT_PALETTE = [
        '#2563eb',
        '#7c3aed',
        '#0891b2',
        '#ea580c',
        '#16a34a',
        '#db2777',
        '#ca8a04'
    ];

    const num = (v) =>
        v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v);

    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isAcLineCell(cell) {
        if (!cell || !cell.edge || !cell.style) return false;
        const st = cell.style;
        return st.includes('Line') && !st.includes('DC');
    }

    function busPair(cell) {
        const bf = cell.source?.mxObjectId?.replace('#', '_');
        const bt = cell.target?.mxObjectId?.replace('#', '_');
        return { bf, bt };
    }

    function readLengthKm(cell) {
        const attrs = cell?.value?.attributes;
        if (!attrs) return 0;
        for (let i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === 'length_km') {
                const v = parseFloat(attrs[i].nodeValue);
                return Number.isFinite(v) ? v : 0;
            }
        }
        return 0;
    }

    function readNumAttr(cell, name) {
        const attrs = cell?.value?.attributes;
        if (!attrs) return null;
        for (let i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === name) {
                const v = parseFloat(attrs[i].nodeValue);
                return Number.isFinite(v) ? v : null;
            }
        }
        return null;
    }

    /**
     * Thermal current limit of the line as pandapower uses it for loading_percent:
     * max_i_ka × df × parallel. Falls back to I / loading when the attribute is missing.
     */
    function ratedCurrentKa(cell, res, iMax) {
        const maxI = readNumAttr(cell, 'max_i_ka');
        if (maxI != null && maxI > 0) {
            const par = readNumAttr(cell, 'parallel');
            const df = readNumAttr(cell, 'df');
            return maxI * (par != null && par > 0 ? par : 1) * (df != null && df > 0 ? df : 1);
        }
        const loading = num(res?.loading_percent);
        if (loading != null && loading > 0 && iMax > 0) return iMax / (loading / 100);
        return null;
    }

    function lineDisplayName(cell) {
        const attrs = cell?.value?.attributes;
        if (attrs) {
            for (let i = 0; i < attrs.length; i++) {
                if (attrs[i].nodeName === 'name') return attrs[i].nodeValue;
            }
        }
        return cell?.id ? String(cell.id) : '?';
    }

    /**
     * Order undirected path of line cells; returns oriented rows { cell, forward }.
     */
    function orderLinesAsChain(lineCells) {
        const n = lineCells.length;
        if (n === 0) return { error: 'No line edges selected.', ordered: [] };
        if (n === 1) {
            return { ordered: [{ cell: lineCells[0], forward: true }] };
        }

        const busDeg = new Map();
        const getBuses = (c) => {
            const { bf, bt } = busPair(c);
            return [bf, bt];
        };

        for (const c of lineCells) {
            const [bf, bt] = getBuses(c);
            if (!bf || !bt) {
                return { error: 'A selected line has an open endpoint (not wired to buses).', ordered: [] };
            }
            for (const b of [bf, bt]) {
                busDeg.set(b, (busDeg.get(b) || 0) + 1);
            }
        }

        for (const [, d] of busDeg) {
            if (d > 2) {
                return {
                    error:
                        'Selection is branched at a bus (degree > 2). Chain only a single feeders path (no tees).',
                    ordered: []
                };
            }
        }

        let startBus = null;
        for (const [b, d] of busDeg) {
            if (d === 1) {
                startBus = b;
                break;
            }
        }
        /* Closed loop: every bus degree 2 → pick arbitrary bus on first segment */
        if (!startBus) {
            startBus = getBuses(lineCells[0])[0];
            if (!startBus) {
                return { error: 'Could not determine ring start bus.', ordered: [] };
            }
        }

        const remaining = new Set(lineCells);
        const ordered = [];
        let endpoint = startBus;

        while (remaining.size > 0) {
            let nextLine = null;
            for (const L of remaining) {
                const [bf, bt] = getBuses(L);
                if (bf === endpoint || bt === endpoint) {
                    nextLine = L;
                    break;
                }
            }
            if (!nextLine) {
                return { error: 'Selected lines do not form one connected electrical path.', ordered: [] };
            }
            const [bf, bt] = getBuses(nextLine);
            const forward = bf === endpoint;
            ordered.push({ cell: nextLine, forward });
            remaining.delete(nextLine);
            endpoint = forward ? bt : bf;
        }

        return { ordered };
    }

    function lineResultByCellId(linesArr, cellId) {
        if (!Array.isArray(linesArr)) return null;
        const cid = cellId != null ? String(cellId) : '';
        return linesArr.find((r) => r && String(r.id) === cid) || null;
    }

    function buildSeries(orderedRows, linesArr, opts) {
        const useAbs =
            opts && opts.useAbs === false
                ? false
                : true;
        const I = (v) => {
            const x = num(v);
            if (x === null) return 0;
            return useAbs ? Math.abs(x) : x;
        };

        const points = [];
        const edges = []; /* staircase edges for SVG */
        const segments = [];
        let km = 0;

        orderedRows.forEach((row, segIdx) => {
            const { cell, forward } = row;
            const res = lineResultByCellId(linesArr, cell.id);
            if (!res) {
                throw new Error(`No pandapower result for line "${lineDisplayName(cell)}" (${cell.id}).`);
            }
            const len = Math.max(0, readLengthKm(cell));
            const name = lineDisplayName(cell);
            const color = SEGMENT_PALETTE[segIdx % SEGMENT_PALETTE.length];

            let iStart;
            let iEnd;
            if (forward) {
                iStart = I(res.i_from_ka);
                iEnd = I(res.i_to_ka);
            } else {
                iStart = I(res.i_to_ka);
                iEnd = I(res.i_from_ka);
            }

            points.push({
                km,
                i: iStart,
                segment: segIdx + 1,
                name,
                tip: `${name} · start`,
                boundary: segIdx === 0 ? 'path_start' : 'segment_joint'
            });
            edges.push({
                x1: km,
                y1: iStart,
                x2: km + len,
                y2: iStart,
                segment: segIdx,
                color
            });
            edges.push({
                x1: km + len,
                y1: iStart,
                x2: km + len,
                y2: iEnd,
                segment: segIdx,
                color
            });

            const loading = num(res.loading_percent);
            segments.push({
                index: segIdx + 1,
                name,
                kmStart: km,
                kmEnd: km + len,
                iStart,
                iEnd,
                color,
                lenKm: len,
                ratedKa: ratedCurrentKa(cell, res, Math.max(Math.abs(iStart), Math.abs(iEnd))),
                loadingPercent: loading
            });

            km += len;
            points.push({
                km,
                i: iEnd,
                segment: segIdx + 1,
                name,
                tip: `${name} · end`,
                boundary: km === edges[edges.length - 1]?.x2 ? 'segment_end' : ''
            });
        });

        return { points, edges, segments, lengthKmTotal: km };
    }

    /**
     * If one value is much larger than the rest, drop it for Y limits only (plateau readability).
     * Compare the two largest *distinct* currents: the spike often appears several times in `allY`
     * (profile points + edge endpoints), which made `sorted[n-2] === sorted[n-1]` and disabled removal.
     */
    function yValuesForScale(allY, focusPlateau) {
        if (!focusPlateau || allY.length < 2) return allY;
        const nums = allY.map((v) => Number(v)).filter((v) => Number.isFinite(v));
        const uniqAsc = [...new Set(nums)].sort((a, b) => a - b);
        if (uniqAsc.length < 2) return allY;

        const maxV = uniqAsc[uniqAsc.length - 1];
        const second = uniqAsc[uniqAsc.length - 2];
        /* >12% above the rest ⇒ treat as lone outlier for axis scaling */
        if (maxV > second * 1.12) {
            return nums.filter((v) => v < maxV - 1e-9);
        }
        return allY;
    }

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = STYLE_ID;
        s.textContent = `
#${PANEL_ID} {
  position:fixed; z-index:100020; width:700px; max-width:96vw;
  top:72px; right:12px;
  max-height:calc(100vh - 80px);
  overflow-y:auto;
  border-radius:12px;
  border:1px solid #cbd5e1;
  box-shadow:0 12px 40px rgba(15,23,42,.18);
  background:#fafbfc; font-family:system-ui,sans-serif;
  color:#0f172a;
}
#${PANEL_ID} .lic-header {
  cursor:move;
  padding:12px 14px; border-bottom:1px solid #e2e8f0;
  display:flex; align-items:center; justify-content:space-between;
  position:sticky; top:0; z-index:2; background:#fafbfc;
}
#${PANEL_ID} .lic-header h4 { margin:0; font-size:15px; font-weight:640; }
#${PANEL_ID} .lic-body { padding:12px 14px 16px; }
#${PANEL_ID} .lic-chart-host { width:100%; overflow-x:auto; }
#${PANEL_ID} svg.lic-svg-main { display:block; max-width:100%; height:auto; border:1px solid #e5e7eb;
  border-radius:8px; background:#fff;
}
#${PANEL_ID} .lic-legend {
  display:flex; flex-wrap:wrap; gap:6px; margin:10px 0 4px; align-items:flex-start;
}
#${PANEL_ID} .lic-legend-chip {
  font-size:11px; padding:4px 8px; border-radius:999px; border:1px solid #e2e8f0;
  background:#fff; max-width:100%;
}
#${PANEL_ID} .lic-legend-dot { display:inline-block; width:10px; height:10px;
  border-radius:2px; margin-right:6px; vertical-align:-1px;
}
#${PANEL_ID} .lic-table-wrap {
  margin-top:12px; overflow-x:auto; border:1px solid #e2e8f0;
  border-radius:8px; background:#fff;
}
#${PANEL_ID} table.lic-table {
  width:100%; border-collapse:collapse; font-size:12px;
}
#${PANEL_ID} table.lic-table th {
  text-align:left; padding:8px 10px; background:#f1f5f9; color:#475569;
  font-weight:600; border-bottom:1px solid #e2e8f0; white-space:nowrap;
}
#${PANEL_ID} table.lic-table td {
  padding:7px 10px; border-bottom:1px solid #f1f5f9; vertical-align:top;
}
#${PANEL_ID} table.lic-table tr:last-child td { border-bottom:none; }
#${PANEL_ID} table.lic-table tr:nth-child(even) td { background:#fafbfc; }
#${PANEL_ID} table.lic-table .lic-n { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
#${PANEL_ID} table.lic-table .lic-name { color:#0f172a; max-width:220px; word-break:break-word; }
#${PANEL_ID} .lic-hint { font-size:11px; color:#64748b; margin-top:6px; line-height:1.35; }
#${PANEL_ID} button.lic-close {
  border:none; background:none; cursor:pointer;
  font-size:20px; line-height:1; color:#64748b;
}
#${PANEL_ID} button.lic-close:hover { color:#dc2626; }
#${PANEL_ID} label.lic-check { font-size:12px; color:#475569; display:flex;
  gap:8px; align-items:flex-start; cursor:pointer; margin:8px 0 0;
}
#${PANEL_ID} label.lic-check input { margin-top:2px; flex-shrink:0; }
#${PANEL_ID} .lic-toolbar { display:flex; gap:6px; justify-content:flex-end; margin:0 0 8px; }
#${PANEL_ID} button.lic-dl {
  font-size:12px; padding:4px 10px; border-radius:6px; border:1px solid #2563eb;
  background:#fff; color:#2563eb; cursor:pointer;
}
#${PANEL_ID} button.lic-dl:hover { background:#2563eb; color:#fff; }
#${PANEL_ID} button.lic-dl:disabled { opacity:.45; cursor:not-allowed; background:#fff; color:#2563eb; }
`;
        document.head.appendChild(s);
    }

    /** 1-2-5 step for about `target` intervals over `span`. */
    function niceStep(span, target) {
        if (!(span > 0)) return 1;
        const raw = span / Math.max(target, 1);
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const norm = raw / mag;
        const f = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
        return f * mag;
    }

    function decimalsForStep(step) {
        if (!(step > 0) || step >= 1) return 0;
        return Math.min(6, Math.ceil(-Math.log10(step) - 1e-9));
    }

    function fmtKm(v) {
        const a = Math.abs(v);
        if (a >= 100 || Math.abs(v - Math.round(v)) < 1e-9) return v.toFixed(0);
        if (a >= 10) return v.toFixed(1);
        return v.toFixed(2);
    }

    /**
     * Chart as a stand-alone SVG (inline styles + fonts only, so it can be exported as PNG/SVG
     * for a report). One distance axis with regular ticks; bus junctions are dashed verticals
     * labelled above the plot; the per-line thermal limit (max_i_ka) is a dashed red level.
     */
    function renderSvg(profile, renderOpts) {
        const focusPlateau = !!(renderOpts && renderOpts.focusPlateau);
        const interpolate = !(renderOpts && renderOpts.interpolate === false);
        const showRated = !(renderOpts && renderOpts.showRated === false);
        const segs = profile.segments || [];
        const ratedSegs = showRated ? segs.filter((s) => s.ratedKa != null && s.ratedKa > 0) : [];

        const legendCols = 2;
        const legendRows = Math.ceil(segs.length / legendCols) + (ratedSegs.length ? 1 : 0);
        const m = { left: 62, right: 22, top: 68, bottom: 50 + legendRows * 16 + 8 };
        const iw = 580;
        const ih = 292;
        const W = iw + m.left + m.right;
        const H = ih + m.top + m.bottom;

        const allYs = [];
        profile.points.forEach((p) => allYs.push(p.i));
        const ysForScale = yValuesForScale(allYs, focusPlateau).slice();
        /* The limit lines join the Y range, except in plateau zoom (they would flatten it). */
        if (!focusPlateau) ratedSegs.forEach((s) => ysForScale.push(s.ratedKa));
        let vmin = ysForScale.length ? Math.min(...ysForScale) : 0;
        let vmax = ysForScale.length ? Math.max(...ysForScale) : 1;
        if (vmax <= vmin) {
            vmin = vmin > 0 ? vmin * 0.9 : 0;
            vmax = vmax <= 0 ? 1 : vmax * 1.1 + 1e-6;
        }
        let pad = Math.max((vmax - vmin) * 0.1, 1e-4);
        const mid = (vmin + vmax) / 2;
        const minSpan = Math.max(Math.abs(mid) * 0.04, 5e-4);
        if (vmax - vmin < minSpan) pad = minSpan / 2;
        vmin -= pad;
        vmax += pad;
        if (vmin < 0 && Math.min(...allYs) >= 0) vmin = 0;
        /* Snap the Y range to round tick values. */
        const yStep = niceStep(vmax - vmin, 5);
        vmin = Math.floor(vmin / yStep + 1e-9) * yStep;
        vmax = Math.ceil(vmax / yStep - 1e-9) * yStep;
        if (vmax <= vmin) vmax = vmin + yStep;
        const yDec = decimalsForStep(yStep);

        const xmax = Math.max(profile.lengthKmTotal, 1e-6);
        const xPx = (x) => m.left + (x / xmax) * iw;
        const yPx = (y) => m.top + ih - ((y - vmin) / (vmax - vmin)) * ih;

        const esc = (t) => escapeHtml(t);
        const clipId = `${PANEL_ID.replace(/-/g, '_')}_plotclip`;

        let plotBody = `<rect x="${m.left}" y="${m.top}" width="${iw}" height="${ih}" fill="#ffffff"/>`;

        segs.forEach((seg) => {
            const x0 = xPx(seg.kmStart);
            const w = Math.max(xPx(seg.kmEnd) - x0, 1);
            plotBody += `<rect x="${x0.toFixed(1)}" y="${m.top}" width="${w.toFixed(1)}" height="${ih}" fill="${seg.color}" fill-opacity="0.06" stroke="none"><title>#${seg.index} ${esc(seg.name)} — ${seg.kmStart.toFixed(2)}→${seg.kmEnd.toFixed(2)} km; I: ${seg.iStart.toFixed(4)}→${seg.iEnd.toFixed(4)} kA</title></rect>`;
        });

        /* Regular grid (one axis). */
        const xStep = niceStep(xmax, 6);
        const xTicks = [];
        for (let v = 0; v <= xmax + xStep * 1e-6; v += xStep) xTicks.push(v);
        const yTicks = [];
        for (let v = vmin; v <= vmax + yStep * 1e-6; v += yStep) yTicks.push(v);
        xTicks.forEach((v) => {
            const xv = xPx(v);
            plotBody += `<line x1="${xv.toFixed(1)}" y1="${m.top}" x2="${xv.toFixed(1)}" y2="${m.top + ih}" stroke="#eef2f7" stroke-width="1"/>`;
        });
        yTicks.forEach((v) => {
            const yv = yPx(v);
            plotBody += `<line x1="${m.left}" y1="${yv.toFixed(1)}" x2="${m.left + iw}" y2="${yv.toFixed(1)}" stroke="#eef2f7" stroke-width="1"/>`;
        });

        /* Bus junctions: dashed verticals in the plot, km labels above it (staggered if close). */
        const junctions = [...new Set(segs.slice(1).map((s) => +s.kmStart.toFixed(9)))].sort((a, b) => a - b);
        let junctionLabels = '';
        const rowLastX = [-Infinity, -Infinity];
        junctions.forEach((km) => {
            const xv = xPx(km);
            plotBody += `<line x1="${xv.toFixed(1)}" y1="${m.top}" x2="${xv.toFixed(1)}" y2="${m.top + ih}" stroke="#94a3b8" stroke-dasharray="5 4" stroke-width="1.1"/>`;
            const label = `${fmtKm(km)} km`;
            const halfW = label.length * 3 + 4;
            let row = rowLastX.findIndex((last) => xv - halfW > last + 2);
            if (row < 0) row = rowLastX[0] <= rowLastX[1] ? 0 : 1;
            rowLastX[row] = xv + halfW;
            const ty = m.top - 6 - row * 12;
            junctionLabels += `<text x="${xv.toFixed(1)}" y="${ty}" fill="#475569" font-size="10" font-weight="600" text-anchor="middle">${label}</text>`;
            if (row > 0) {
                junctionLabels += `<line x1="${xv.toFixed(1)}" y1="${ty + 2}" x2="${xv.toFixed(1)}" y2="${m.top}" stroke="#cbd5e1" stroke-width="0.8"/>`;
            }
        });

        /* Thermal limit per line (max_i_ka × parallel × df). */
        let ratedPaths = '';
        ratedSegs.forEach((seg) => {
            const x0 = xPx(seg.kmStart);
            const x1 = xPx(seg.kmEnd);
            const yr = yPx(seg.ratedKa);
            ratedPaths += `<line x1="${x0.toFixed(2)}" y1="${yr.toFixed(2)}" x2="${x1.toFixed(2)}" y2="${yr.toFixed(2)}" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="7 4"><title>${esc(`#${seg.index} ${seg.name}: max_i_ka (rated) = ${seg.ratedKa.toFixed(3)} kA`)}</title></line>`;
            if (x1 - x0 > 70 && yr >= m.top + 10 && yr <= m.top + ih) {
                ratedPaths += `<text x="${((x0 + x1) / 2).toFixed(1)}" y="${(yr - 4).toFixed(1)}" fill="#dc2626" font-size="10" text-anchor="middle">I max ${seg.ratedKa.toFixed(3)} kA</text>`;
            }
        });

        /* Current profile: a ramp i_from → i_to inside each line, a step only at junctions. */
        let segmentPaths = '';
        let prevEnd = null;
        segs.forEach((seg) => {
            const x0 = xPx(seg.kmStart);
            const x1 = xPx(seg.kmEnd);
            const y0 = yPx(seg.iStart);
            const y1 = yPx(seg.iEnd);
            let d = interpolate
                ? `M ${x0.toFixed(2)},${y0.toFixed(2)} L ${x1.toFixed(2)},${y1.toFixed(2)}`
                : `M ${x0.toFixed(2)},${y0.toFixed(2)} L ${x1.toFixed(2)},${y0.toFixed(2)} L ${x1.toFixed(2)},${y1.toFixed(2)}`;
            if (prevEnd && interpolate) {
                /* Jump at the bus (another branch / load takes current there). */
                d = `M ${x0.toFixed(2)},${prevEnd.toFixed(2)} L ${x0.toFixed(2)},${y0.toFixed(2)} ` + d.slice(d.indexOf('L'));
            }
            prevEnd = y1;
            const tip = `#${seg.index} ${seg.name}: ${seg.kmStart.toFixed(3)}–${seg.kmEnd.toFixed(3)} km | ${seg.iStart.toFixed(4)} → ${seg.iEnd.toFixed(4)} kA`;
            segmentPaths += `<path d="${d}" fill="none" stroke="${seg.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><title>${esc(tip)}</title></path>`;
        });

        let kneeDots = '';
        const segByIndex = (si) => segs.find((s) => s.index === si) || null;
        profile.points.forEach((p) => {
            const seg = segByIndex(p.segment);
            const col = seg ? seg.color : SEGMENT_PALETTE[0];
            kneeDots += `<circle cx="${xPx(p.km).toFixed(2)}" cy="${yPx(p.i).toFixed(2)}" r="3.5" fill="#fff" stroke="${col}" stroke-width="2"><title>${esc(`${p.tip} — km ${p.km.toFixed(4)}, I ${p.i.toFixed(5)} kA`)}</title></circle>`;
        });

        plotBody += ratedPaths + segmentPaths + kneeDots;

        const xLabels = xTicks
            .map((v) => `<text x="${xPx(v).toFixed(1)}" y="${m.top + ih + 16}" fill="#475569" font-size="11" text-anchor="middle">${fmtKm(v)}</text>`)
            .join('');
        const yLabels = yTicks
            .map((v) => `<text x="${m.left - 8}" y="${(yPx(v) + 4).toFixed(1)}" fill="#475569" font-size="11" text-anchor="end">${v.toFixed(yDec)}</text>`)
            .join('');

        const maxAll = allYs.length ? Math.max(...allYs) : 0;
        const yClipped = focusPlateau && maxAll > vmax + 1e-9;
        const yClipNote = yClipped
            ? `<text x="${m.left + iw}" y="14" fill="#c2410c" font-size="10" font-weight="600" text-anchor="end">Zoomed Y — values above scale: orange ▲</text>`
            : '';

        let offScaleMarkers = '';
        if (yClipped) {
            const seen = new Set();
            profile.points.forEach((p) => {
                if (!(p.i > vmax + 1e-9)) return;
                const key = p.km.toFixed(6);
                if (seen.has(key)) return;
                seen.add(key);
                const cx = xPx(p.km);
                const ty = m.top + 4;
                offScaleMarkers += `<polygon fill="#ea580c" stroke="#fff" stroke-width="1" points="${(cx - 7).toFixed(1)},${ty + 12} ${cx.toFixed(1)},${ty} ${(cx + 7).toFixed(1)},${ty + 12}"><title>${esc(`|I| = ${p.i.toFixed(5)} kA (${p.tip}) — above the zoomed scale`)}</title></polygon>`;
            });
        }

        /* Legend inside the SVG so the downloaded image is self-explanatory. */
        let legend = '';
        const legendTop = m.top + ih + 46;
        const colW = (W - 24) / legendCols;
        segs.forEach((s, k) => {
            const col = k % legendCols;
            const row = Math.floor(k / legendCols);
            const lx = 12 + col * colW;
            const ly = legendTop + row * 16;
            const rated = s.ratedKa != null ? ` · Imax ${s.ratedKa.toFixed(2)} kA` : '';
            const maxChars = Math.floor((colW - 22) / 5.6) - rated.length - 14;
            const nm = s.name.length > maxChars ? `${s.name.slice(0, Math.max(maxChars - 1, 4))}…` : s.name;
            legend += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${s.color}"/>`;
            legend += `<text x="${lx + 15}" y="${ly}" fill="#334155" font-size="10.5"><tspan font-weight="700">#${s.index}</tspan> ${fmtKm(s.kmStart)}–${fmtKm(s.kmEnd)} km · ${esc(nm)}${esc(rated)}<title>${esc(s.name)}</title></text>`;
        });
        if (ratedSegs.length) {
            const ly = legendTop + Math.ceil(segs.length / legendCols) * 16;
            legend += `<line x1="12" y1="${ly - 4}" x2="34" y2="${ly - 4}" stroke="#dc2626" stroke-width="1.6" stroke-dasharray="7 4"/>`;
            legend += `<text x="40" y="${ly}" fill="#334155" font-size="10.5">Rated current of each line (max_i_ka × parallel × df)</text>`;
        }

        const subtitle = interpolate
            ? '|I| varies linearly between i_from_ka and i_to_ka within each line · steps only at bus junctions'
            : '|I| held at i_from_ka along each line, stepping to i_to_ka at its end';

        return `
<svg xmlns="http://www.w3.org/2000/svg" class="lic-svg-main" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui, -apple-system, Segoe UI, Arial, sans-serif" role="img" aria-label="Line current vs distance chart">
<defs><clipPath id="${clipId}"><rect x="${m.left}" y="${m.top}" width="${iw}" height="${ih}"/></clipPath></defs>
<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>
<text x="${m.left + iw / 2}" y="18" fill="#0f172a" font-size="13" font-weight="600" text-anchor="middle">Line current |I| along path vs distance</text>
<text x="${m.left + iw / 2}" y="33" fill="#64748b" font-size="10" text-anchor="middle">${esc(subtitle)}</text>
${yClipNote}
<g clip-path="url(#${clipId})">${plotBody}</g>
<rect x="${m.left}" y="${m.top}" width="${iw}" height="${ih}" fill="none" stroke="#94a3b8" stroke-width="1"/>
${offScaleMarkers}
${junctionLabels}
${xLabels}
${yLabels}
<text x="${m.left + iw / 2}" y="${m.top + ih + 34}" fill="#475569" font-size="12" font-weight="500" text-anchor="middle">Distance along path [km]</text>
<text transform="rotate(-90 16 ${m.top + ih / 2})" x="16" y="${m.top + ih / 2}" fill="#475569" font-size="12" text-anchor="middle">|I| [kA]</text>
${legend}
</svg>`;
    }

    function renderTable(profile) {
        const rows = (profile.segments || [])
            .map((s) => {
                const dI = s.iEnd - s.iStart;
                const iPeak = Math.max(Math.abs(s.iStart), Math.abs(s.iEnd));
                const util = s.ratedKa ? (iPeak / s.ratedKa) * 100 : null;
                const utilCell = util == null
                    ? '—'
                    : `<span style="color:${util > 100 ? '#dc2626' : util > 90 ? '#c2410c' : '#0f172a'};font-weight:${util > 90 ? 700 : 400}">${util.toFixed(1)}</span>`;
                return `<tr>
  <td class="lic-n"><span class="lic-legend-dot" style="background:${s.color}"></span>${s.index}</td>
  <td class="lic-name">${escapeHtml(s.name)}</td>
  <td class="lic-n">${s.lenKm.toFixed(3)}</td>
  <td class="lic-n">${s.kmStart.toFixed(3)}</td>
  <td class="lic-n">${s.kmEnd.toFixed(3)}</td>
  <td class="lic-n">${s.iStart.toFixed(5)}</td>
  <td class="lic-n">${s.iEnd.toFixed(5)}</td>
  <td class="lic-n">${dI >= 0 ? '+' : ''}${dI.toFixed(5)}</td>
  <td class="lic-n">${s.ratedKa != null ? s.ratedKa.toFixed(3) : '—'}</td>
  <td class="lic-n">${utilCell}</td>
</tr>`;
            })
            .join('');
        return `
<table class="lic-table" aria-label="Segment summary">
<thead>
<tr>
  <th>#</th><th>Line (diagram name)</th><th>ΔL [km]</th><th>From km</th><th>To km</th>
  <th>I<sub>start</sub> [kA]</th><th>I<sub>end</sub> [kA]</th><th>ΔI [kA]</th>
  <th title="max_i_ka × parallel × df">I<sub>max</sub> [kA]</th><th title="max(|I_start|, |I_end|) / I_max">Loading [%]</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>`;
    }

    function svgSourceOf(svgEl) {
        const clone = svgEl.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.removeAttribute('class');
        clone.querySelectorAll('title').forEach((t) => t.remove());
        return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
    }

    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    }

    function downloadSvg(svgEl, baseName) {
        const blob = new Blob([svgSourceOf(svgEl)], { type: 'image/svg+xml;charset=utf-8' });
        triggerDownload(blob, `${baseName}.svg`);
    }

    /** PNG at 3× resolution — sharp enough for a printed report. */
    function downloadPng(svgEl, baseName) {
        const w = parseFloat(svgEl.getAttribute('width')) || svgEl.clientWidth || 700;
        const h = parseFloat(svgEl.getAttribute('height')) || svgEl.clientHeight || 450;
        const scale = 3;
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) triggerDownload(blob, `${baseName}.png`);
            }, 'image/png');
        };
        img.onerror = () => {
            console.warn('[lineCurrentCharacteristic] PNG export failed; saving SVG instead.');
            downloadSvg(svgEl, baseName);
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgSourceOf(svgEl));
    }

    function resolveGraph(graph) {
        let g = graph;
        try {
            if (!g || typeof g.getSelectionCells !== 'function') {
                const ui =
                    (window.App && (window.App._editorUi || window.App._instance)) ||
                    window.editorUi ||
                    window.ui ||
                    null;
                if (ui && ui.editor && ui.editor.graph) g = ui.editor.graph;
            }
        } catch (e) {
            /* ignore */
        }
        return g || null;
    }

    /**
     * @param {*} graph - optional mxGraph
     */
    function showLineCurrentCharacteristicPanel(graph) {
        ensureStyle();

        const j = window.__electrisimLastLoadFlowResultJson || null;
        const g = resolveGraph(graph);
        const linesArr = Array.isArray(j?.lines) ? j.lines : [];

        document.getElementById(PANEL_ID)?.remove();

        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        panel.innerHTML = `
<div class="lic-header">
  <h4>Line current along path · |I| [kA] vs km</h4>
  <button class="lic-close" type="button" title="Close" aria-label="Close">×</button>
</div>
<div class="lic-body">
  <div class="lic-status" style="font-size:12px;color:#64748b;margin-bottom:8px"></div>
  <div class="lic-toolbar">
    <button type="button" class="lic-dl lic-dl-png" title="Download the chart as a PNG image (3× resolution) for a report">⬇ PNG</button>
    <button type="button" class="lic-dl lic-dl-svg" title="Download the chart as a vector SVG image">⬇ SVG</button>
  </div>
  <div class="lic-chart-host"></div>
  <label class="lic-check">
    <input type="checkbox" class="lic-interp" checked />
    <span><strong>Gradual current along each line</strong> — linear between <code>i_from_ka</code> and <code>i_to_ka</code> (the change inside a line is its charging current, which grows with distance). Untick for the step profile.</span>
  </label>
  <label class="lic-check">
    <input type="checkbox" class="lic-rated" checked />
    <span>Show rated current of each line (<code>max_i_ka</code> × parallel × df) as a dashed red level</span>
  </label>
  <label class="lic-check">
    <input type="checkbox" class="lic-abs" checked />
    <span>Use absolute current (|I|) for AC magnitudes</span>
  </label>
  <label class="lic-check">
    <input type="checkbox" class="lic-y-focus" />
    <span><strong>Amplify plateau on chart</strong> — when one |I| is much larger than the rest, zoom the Y-axis so small trends are visible; the spike is clipped at the top but marked with <strong style="color:#ea580c">▲</strong> (hover for kA — always in table).</span>
  </label>
  <p class="lic-hint">Select a chain of Line edges, run load flow, then open this chart. Each coloured band is one line segment; dashed verticals mark bus junctions, labelled in km above the chart. Values come from pandapower <code>i_from_ka</code> / <code>i_to_ka</code> oriented along the traced path.</p>
</div>`;

        document.body.appendChild(panel);

        const statusEl = panel.querySelector('.lic-status');
        const chartHost = panel.querySelector('.lic-chart-host');
        const absEl = panel.querySelector('.lic-abs');
        const yFocusEl = panel.querySelector('.lic-y-focus');
        const interpEl = panel.querySelector('.lic-interp');
        const ratedEl = panel.querySelector('.lic-rated');
        const pngBtn = panel.querySelector('.lic-dl-png');
        const svgBtn = panel.querySelector('.lic-dl-svg');
        pngBtn.disabled = true;
        svgBtn.disabled = true;
        const chartSvg = () => chartHost.querySelector('svg.lic-svg-main');
        const fileBase = () => `line_current_along_path_${new Date().toISOString().slice(0, 10)}`;
        pngBtn.addEventListener('click', () => { const el = chartSvg(); if (el) downloadPng(el, fileBase()); });
        svgBtn.addEventListener('click', () => { const el = chartSvg(); if (el) downloadSvg(el, fileBase()); });

        function writeStatus(html) {
            statusEl.innerHTML = html;
        }

        panel.querySelector('.lic-close').addEventListener('click', () => panel.remove());

        if (!j) {
            writeStatus(
                `<span style="color:#dc2626">No load‑flow results in memory.</span> Run pandapower load flow successfully first.`
            );
            chartHost.innerHTML = '';
            return;
        }
        if (!g) {
            writeStatus('<span style="color:#dc2626">Diagram graph unavailable.</span>');
            chartHost.innerHTML = '';
            return;
        }

        const selected = (g.getSelectionCells() || []).filter(isAcLineCell);
        if (selected.length === 0) {
            writeStatus(
                `<span style="color:#b45309">Select <b>one or more</b> AC Line edges forming a feeders path,</span> then reopen this chart from the dashboard.`
            );
            chartHost.innerHTML = '';
            return;
        }

        const orderOutcome = orderLinesAsChain(selected);
        if (!orderOutcome.ordered || orderOutcome.ordered.length === 0) {
            writeStatus(`<span style="color:#b45309">${escapeHtml(orderOutcome.error || 'Could not build line chain.')}</span>`);
            chartHost.innerHTML = '';
            return;
        }

        function redraw() {
            try {
                const prof = buildSeries(orderOutcome.ordered, linesArr, {
                    useAbs: absEl.checked
                });
                const svg = renderSvg(prof, {
                    focusPlateau: yFocusEl.checked,
                    interpolate: interpEl.checked,
                    showRated: ratedEl.checked
                });
                const summary = `<div style="font-size:12px;margin:10px 0 4px;color:#334155;"><strong>${prof.segments.length} segment(s)</strong> · Total path <strong>${prof.lengthKmTotal.toFixed(3)} km</strong></div>`;
                chartHost.innerHTML =
                    `<div style="min-width:560px">` +
                    svg +
                    summary +
                    `<div class="lic-table-wrap">${renderTable(prof)}</div>` +
                    `</div>`;
                pngBtn.disabled = false;
                svgBtn.disabled = false;
                writeStatus(
                    `✓ Profile with <b>${prof.points.length}</b> knee points from pandapower <code>i_from</code>/<code>i_to</code> (see table for exact kA).`
                );
            } catch (err) {
                chartHost.innerHTML = '';
                pngBtn.disabled = true;
                svgBtn.disabled = true;
                writeStatus(`<span style="color:#dc2626">${escapeHtml(err.message || String(err))}</span>`);
            }
        }

        absEl.addEventListener('change', redraw);
        yFocusEl.addEventListener('change', redraw);
        interpEl.addEventListener('change', redraw);
        ratedEl.addEventListener('change', redraw);
        redraw();

        /* drag header */
        const header = panel.querySelector('.lic-header');
        let drag = false,
            sx = 0,
            sy = 0,
            sl = 0,
            st = 0;
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.lic-close')) return;
            drag = true;
            sx = e.clientX;
            sy = e.clientY;
            const r = panel.getBoundingClientRect();
            sl = r.left;
            st = r.top;
            panel.style.position = 'fixed';
            panel.style.right = 'auto';
            panel.style.left = sl + 'px';
            panel.style.top = st + 'px';
            e.preventDefault();
        });
        document.addEventListener('mouseup', () => {
            drag = false;
        });
        document.addEventListener('mousemove', (e) => {
            if (!drag) return;
            const nl = sl + (e.clientX - sx);
            const nt = st + (e.clientY - sy);
            const maxL = window.innerWidth - panel.offsetWidth - 4;
            const maxT = window.innerHeight - 24;
            panel.style.left = Math.max(4, Math.min(maxL, nl)) + 'px';
            panel.style.top = Math.max(4, Math.min(maxT, nt)) + 'px';
        });
    }

    window.showLineCurrentCharacteristicPanel = showLineCurrentCharacteristicPanel;
})();
