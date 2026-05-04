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

            segments.push({
                index: segIdx + 1,
                name,
                kmStart: km,
                kmEnd: km + len,
                iStart,
                iEnd,
                color,
                lenKm: len
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
`;
        document.head.appendChild(s);
    }

    function renderSvg(profile, renderOpts) {
        const focusPlateau = !!(renderOpts && renderOpts.focusPlateau);
        const m = { left: 54, right: 18, top: 42, bottom: 58 };
        const iw = 580;
        const ih = 292;
        const W = iw + m.left + m.right;
        const H = ih + m.top + m.bottom;

        const allYs = [];
        profile.points.forEach((p) => allYs.push(p.i));
        profile.edges.forEach((e) => {
            allYs.push(e.y1, e.y2);
        });
        const ysForScale = yValuesForScale(allYs, focusPlateau);
        let vmin = ysForScale.length ? Math.min(...ysForScale) : 0;
        let vmax = ysForScale.length ? Math.max(...ysForScale) : 1;
        if (vmax <= vmin) {
            vmin = vmin > 0 ? vmin * 0.9 : 0;
            vmax = vmax <= 0 ? 1 : vmax * 1.1 + 1e-6;
        }
        let pad = Math.max((vmax - vmin) * 0.12, 1e-4);
        const mid = (vmin + vmax) / 2;
        const minSpan = Math.max(mid * 0.04, 5e-4);
        if (vmax - vmin < minSpan) {
            pad = minSpan / 2;
        }
        vmin -= pad;
        vmax += pad;

        const xmax = Math.max(profile.lengthKmTotal, 1e-6);

        const xPx = (x) => m.left + (x / xmax) * iw;
        const yPx = (y) => m.top + ih - ((y - vmin) / (vmax - vmin)) * ih;

        const escTitle = (t) => escapeHtml(t);
        const clipId = `${PANEL_ID.replace(/-/g, '_')}_plotclip`;

        let plotBody = '';
        plotBody += `<rect x="${m.left}" y="${m.top}" width="${iw}" height="${ih}" fill="#ffffff"/>`;

        let bands = '';
        (profile.segments || []).forEach((seg) => {
            const x0 = xPx(seg.kmStart);
            const x1 = xPx(seg.kmEnd);
            const w = Math.max(x1 - x0, 1);
            bands += `<rect x="${x0.toFixed(1)}" y="${m.top}" width="${w.toFixed(
                1
            )}" height="${ih}" fill="${seg.color}" fill-opacity="0.07" stroke="none">
  <title>#${seg.index} ${escTitle(seg.name)} — ${seg.kmStart.toFixed(2)}→${seg.kmEnd.toFixed(2)} km; I: ${seg.iStart.toFixed(4)}→${seg.iEnd.toFixed(4)} kA</title>
</rect>`;
        });
        plotBody += bands;

        /* Vertical markers at segment boundaries (km) — line in plot, label below */
        let boundaryLines = '';
        let boundaryLabels = '';
        const boundaryKms = new Set();
        (profile.segments || []).forEach((seg) => {
            boundaryKms.add(seg.kmStart);
            boundaryKms.add(seg.kmEnd);
        });
        boundaryKms.forEach((kmMark) => {
            const xv = xPx(kmMark);
            const kmDec = kmMark >= 100 ? 0 : kmMark >= 10 ? 1 : 2;
            boundaryLines += `<line x1="${xv.toFixed(1)}" y1="${m.top}" x2="${xv.toFixed(
                1
            )}" y2="${(m.top + ih).toFixed(1)}" stroke="#94a3b8" stroke-dasharray="5 4" stroke-width="1.1" opacity="0.95"/>`;
            boundaryLabels += `<text x="${xv.toFixed(1)}" y="${
                m.top + ih + 12
            }" fill="#475569" font-size="10" font-weight="600" text-anchor="middle">${kmMark.toFixed(
                kmDec
            )}</text>`;
        });
        plotBody += boundaryLines;

        /* Light grid */
        let grid = '';
        const nx = Math.min(Math.max(Math.round(xmax / Math.max(xmax / 6, 1)), 5), 10);
        const ny = 5;
        for (let i = 0; i <= nx; i++) {
            const xv = xPx((i / nx) * xmax);
            grid += `<line x1="${xv.toFixed(1)}" y1="${m.top}" x2="${xv.toFixed(
                1
            )}" y2="${(m.top + ih).toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>`;
        }
        for (let j = 0; j <= ny; j++) {
            const frac = j / ny;
            const yi = yPx(vmax - frac * (vmax - vmin));
            grid += `<line x1="${m.left}" y1="${yi.toFixed(1)}" x2="${(m.left + iw).toFixed(
                1
            )}" y2="${yi.toFixed(1)}" stroke="#f1f5f9" stroke-width="1"/>`;
        }
        plotBody += grid;

        let segmentPaths = '';
        (profile.segments || []).forEach((seg) => {
            const x0 = xPx(seg.kmStart);
            const x1 = xPx(seg.kmEnd);
            const y0 = yPx(seg.iStart);
            const y1 = yPx(seg.iEnd);
            const d = `M ${x0.toFixed(2)},${y0.toFixed(2)} L ${x1.toFixed(2)},${y0.toFixed(2)} L ${x1.toFixed(2)},${y1.toFixed(2)}`;
            const tip = `#${seg.index} ${seg.name}: ${seg.kmStart.toFixed(
                3
            )}–${seg.kmEnd.toFixed(3)} km | ${seg.iStart.toFixed(4)} → ${seg.iEnd.toFixed(4)} kA`;
            segmentPaths += `<path d="${d}" fill="none" stroke="${seg.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"><title>${escTitle(
                tip
            )}</title></path>`;
        });

        let kneeDots = '';
        const segByIndex = (si) => (profile.segments || []).find((s) => s.index === si) || null;
        profile.points.forEach((p) => {
            const seg = segByIndex(p.segment);
            const col = seg ? seg.color : SEGMENT_PALETTE[0];
            const cx = xPx(p.km);
            const cy = yPx(p.i);
            const lab = `${p.tip} — km ${p.km.toFixed(4)}, I ${p.i.toFixed(5)} kA`;
            kneeDots += `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="4" fill="#fff" stroke="${col}" stroke-width="2"><title>${escTitle(
                lab
            )}</title></circle>`;
        });

        plotBody += segmentPaths;
        plotBody += kneeDots;

        const xticks = [];
        for (let i = 0; i <= nx; i++) {
            const xv = xPx((i / nx) * xmax);
            const xvValNum = (i / nx) * xmax;
            const decimals = xvValNum >= 100 ? 0 : xvValNum >= 20 ? 1 : 2;
            xticks.push(
                `<text x="${xv.toFixed(1)}" y="${H - 18}" fill="#64748b" font-size="11" text-anchor="middle">${xvValNum.toFixed(decimals)}</text>`
            );
        }

        const yticks = [];
        const yFmt = vmax - vmin < 0.02 ? (v) => v.toFixed(4) : (v) => v.toFixed(3);
        for (let j = 0; j <= ny; j++) {
            const frac = j / ny;
            const v = vmax - frac * (vmax - vmin);
            const yi = yPx(v);
            yticks.push(
                `<text x="${m.left - 8}" y="${yi + 4}" fill="#475569" font-size="11" text-anchor="end">${yFmt(
                    v
                )}</text>`
            );
        }

        const maxAll = allYs.length ? Math.max(...allYs) : 0;
        const maxScale = ysForScale.length ? Math.max(...ysForScale) : 0;
        const yClipped = focusPlateau && maxAll - maxScale > 1e-4;
        const yClipNote = yClipped
            ? `<text x="${m.left + iw}" y="16" fill="#c2410c" font-size="10" font-weight="600" text-anchor="end">Zoomed Y — values above scale: orange ▲ (hover)</text>`
            : '';

        /* Mark knees that fall outside padded [vmin,vmax] so plateau mode is not misleading */
        let offScaleMarkers = '';
        if (focusPlateau && yClipped) {
            const eps = Math.max(Math.abs(vmax) * 1e-9, 1e-9);
            const seen = new Set();
            profile.points.forEach((p) => {
                const cx = xPx(p.km);
                if (p.i > vmax + eps) {
                    const key = `${p.km.toFixed(6)}:${p.segment}:h`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    const ty = m.top + 4;
                    const tipTxt = `|I| = ${p.i.toFixed(
                        5
                    )} kA (${p.tip}) — above visible Y-zoom; exact value also in table below`;
                    offScaleMarkers += `<g aria-label="off-scale-high">
<polygon fill="#ea580c" stroke="#fff" stroke-width="1" points="${(cx - 7).toFixed(1)},${(ty + 12).toFixed(
                        1
                    )} ${cx.toFixed(1)},${ty.toFixed(1)} ${(cx + 7).toFixed(1)},${(ty + 12).toFixed(
                        1
                    )}" pointer-events="all"><title>${escTitle(tipTxt)}</title></polygon></g>`;
                } else if (p.i < vmin - eps) {
                    const key = `${p.km.toFixed(6)}:${p.segment}:l`;
                    if (seen.has(key)) return;
                    seen.add(key);
                    const by = m.top + ih - 4;
                    const tipTxt = `|I| = ${p.i.toFixed(
                        5
                    )} kA (${p.tip}) — below visible Y-zoom; exact value also in table below`;
                    offScaleMarkers += `<g aria-label="off-scale-low">
<polygon fill="#ea580c" stroke="#fff" stroke-width="1" points="${(cx - 7).toFixed(1)},${(
                        by - 12
                    ).toFixed(1)} ${cx.toFixed(1)},${by.toFixed(1)} ${(cx + 7).toFixed(1)},${(
                        by - 12
                    ).toFixed(1)}" pointer-events="all"><title>${escTitle(tipTxt)}</title></polygon></g>`;
                }
            });
        }

        return `
<svg class="lic-svg-main" width="${W}" height="${H}" role="img" aria-label="Line current vs distance chart">
<defs>
  <clipPath id="${clipId}"><rect x="${m.left}" y="${m.top}" width="${iw}" height="${ih}"/></clipPath>
</defs>
<text x="${m.left + iw / 2}" y="18" fill="#334155" font-size="13" font-weight="600" text-anchor="middle">|I| along path vs distance</text>
<text x="${m.left + iw / 2}" y="34" fill="#64748b" font-size="10" text-anchor="middle">${yClipped ? 'Hover traces \u0026 points · plateau zoom hides extreme |I|; orange \u25B2 marks |I| above chart scale · ' : ''}bold numbers under the plot = junction km</text>
${yClipNote}
<g clip-path="url(#${clipId})">
${plotBody}
</g>
<rect x="${m.left}" y="${m.top}" width="${iw}" height="${ih}" fill="none" stroke="#94a3b8" stroke-width="1"/>
${offScaleMarkers}
${boundaryLabels}
${xticks.join('')}
${yticks.join('')}
<text x="${m.left + iw / 2}" y="${H - 2}" fill="#64748b" font-size="12" font-weight="500" text-anchor="middle">Distance along path [km] · regular ticks</text>
<text transform="rotate(-90 ${14} ${m.top + ih / 2})" x="${14}" y="${m.top + ih / 2}" fill="#64748b" font-size="12" text-anchor="middle">|I| [kA]</text>
</svg>`;
    }

    function renderLegend(profile) {
        const segs = profile.segments || [];
        return segs
            .map((s) => {
                const range = `${s.kmStart.toFixed(2)}–${s.kmEnd.toFixed(2)} km`;
                const nameShort = escapeHtml(
                    s.name.length > 48 ? `${s.name.slice(0, 46)}…` : s.name
                );
                return `<span class="lic-legend-chip" title="${escapeHtml(`${s.name} (${range})`)}"><span class="lic-legend-dot" style="background:${s.color}"></span><b>#${s.index}</b> ${range} · ${nameShort}</span>`;
            })
            .join('');
    }

    function renderTable(profile) {
        const rows = (profile.segments || [])
            .map((s) => {
                const dI = s.iEnd - s.iStart;
                return `<tr>
  <td class="lic-n">${s.index}</td>
  <td class="lic-name">${escapeHtml(s.name)}</td>
  <td class="lic-n">${s.lenKm.toFixed(3)}</td>
  <td class="lic-n">${s.kmStart.toFixed(3)}</td>
  <td class="lic-n">${s.kmEnd.toFixed(3)}</td>
  <td class="lic-n">${s.iStart.toFixed(5)}</td>
  <td class="lic-n">${s.iEnd.toFixed(5)}</td>
  <td class="lic-n">${dI >= 0 ? '+' : ''}${dI.toFixed(5)}</td>
</tr>`;
            })
            .join('');
        return `
<table class="lic-table" aria-label="Segment summary">
<thead>
<tr>
  <th>#</th><th>Line (diagram name)</th><th>ΔL [km]</th><th>From km</th><th>To km</th>
  <th>I<sub>start</sub> [kA]</th><th>I<sub>end</sub> [kA]</th><th>ΔI [kA]</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>`;
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
  <h4>Line current along path · |I|[kA] vs km</h4>
  <button class="lic-close" type="button" title="Close" aria-label="Close">×</button>
</div>
<div class="lic-body">
  <div class="lic-status" style="font-size:12px;color:#64748b;margin-bottom:8px"></div>
  <div class="lic-chart-host"></div>
  <label class="lic-check">
    <input type="checkbox" class="lic-abs" checked />
    <span>Use absolute current (|I|) for AC magnitudes</span>
  </label>
  <label class="lic-check">
    <input type="checkbox" class="lic-y-focus" />
    <span><strong>Amplify plateau on chart</strong> — when one |I| is much larger than the rest, zoom the Y-axis so small trends are visible; the spike is clipped at the top but marked with <strong style="color:#ea580c">▲</strong> (hover for kA — always in table).</span>
  </label>
  <p class="lic-hint">Select a chain of Line edges, run load flow, then open this chart. Each coloured band is one line segment; dashed verticals mark bus junctions (km). Values come from pandapower <code>i_from_ka</code> / <code>i_to_ka</code> oriented along the traced path.</p>
</div>`;

        document.body.appendChild(panel);

        const statusEl = panel.querySelector('.lic-status');
        const chartHost = panel.querySelector('.lic-chart-host');
        const absEl = panel.querySelector('.lic-abs');
        const yFocusEl = panel.querySelector('.lic-y-focus');

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
                const svg = renderSvg(prof, { focusPlateau: yFocusEl.checked });
                const summary = `<div style="font-size:12px;margin:10px 0 4px;color:#334155;"><strong>${prof.segments.length} segment(s)</strong> · Total path <strong>${prof.lengthKmTotal.toFixed(3)} km</strong></div>`;
                chartHost.innerHTML =
                    `<div style="min-width:560px">` +
                    svg +
                    `<div class="lic-legend">${renderLegend(prof)}</div>` +
                    summary +
                    `<div class="lic-table-wrap">${renderTable(prof)}</div>` +
                    `</div>`;
                writeStatus(
                    `✓ Profile with <b>${prof.points.length}</b> knee points from pandapower <code>i_from</code>/<code>i_to</code> (see table for exact kA).`
                );
            } catch (err) {
                chartHost.innerHTML = '';
                writeStatus(`<span style="color:#dc2626">${escapeHtml(err.message || String(err))}</span>`);
            }
        }

        absEl.addEventListener('change', redraw);
        yFocusEl.addEventListener('change', redraw);
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
