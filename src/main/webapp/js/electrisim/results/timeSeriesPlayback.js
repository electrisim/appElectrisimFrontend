/**
 * Time Series Playback: plays a time-series result on the single-line diagram.
 *
 * - Canvas overlay above the diagram (same approach as loadFlowColouring.js): line and transformer
 *   loading colours, bus voltage colours, moving flow dots, and MW / % labels.
 * - Control bar: play / pause, step, scrub, speed, totals chart with a playhead, KPIs.
 * - Export video: renders the diagram once (draw.io exportToCanvas), draws the overlay on top for
 *   every frame and records the canvas with MediaRecorder (MP4 where the browser supports it, else WebM).
 *
 * API: window.startTimeSeriesPlayback(graph, results), window.stopTimeSeriesPlayback()
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    var OVERLAY_ID = 'ets-playback-overlay';
    var BAR_ID = 'ets-playback-bar';
    var STYLE_ID = 'ets-playback-style';
    var STEP_SECONDS = 0.8;           // one time step per 0.8 s at 1x
    var FLOW_DOT_SPACING = 26;        // px on screen
    var MAX_LINES_WITH_DOTS = 800;

    var COL = {
        gen: '#f59e0b',
        load: '#2563eb',
        battCharge: '#0d9488',
        battDischarge: '#9333ea',
        grid: '#475569',
        text: '#0f172a',
        muted: '#64748b'
    };

    var active = null;

    // ---------- helpers ----------

    function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

    function lerpRgb(stops, x) {
        if (!isFinite(x)) return [148, 163, 184];
        if (x <= stops[0][0]) return stops[0][1];
        var last = stops[stops.length - 1];
        if (x >= last[0]) return last[1];
        for (var i = 1; i < stops.length; i++) {
            if (x <= stops[i][0]) {
                var lo = stops[i - 1], hi = stops[i];
                var t = (x - lo[0]) / (hi[0] - lo[0]);
                return [lo[1][0] + (hi[1][0] - lo[1][0]) * t, lo[1][1] + (hi[1][1] - lo[1][1]) * t, lo[1][2] + (hi[1][2] - lo[1][2]) * t];
            }
        }
        return last[1];
    }

    // Same scale as the load-flow arrows (flowDirectionVisualization.js).
    var LOADING_STOPS = [[0, [46, 125, 50]], [60, [249, 168, 37]], [85, [239, 108, 0]], [100, [198, 40, 40]]];
    // Same scale as the load-flow voltage colouring (|V - 1| in pu).
    var VOLTAGE_STOPS = [[0, [56, 196, 72]], [0.03, [120, 210, 60]], [0.05, [230, 210, 40]], [0.08, [235, 140, 30]], [0.1, [210, 50, 45]]];

    function rgba(rgb, a) { return 'rgba(' + Math.round(rgb[0]) + ',' + Math.round(rgb[1]) + ',' + Math.round(rgb[2]) + ',' + a + ')'; }
    function loadingRgb(p) { return lerpRgb(LOADING_STOPS, Number(p)); }
    function voltageRgb(vm) { return lerpRgb(VOLTAGE_STOPS, Math.abs(Number(vm) - 1)); }

    function fmtMw(v) {
        var a = Math.abs(v);
        if (a >= 100) return v.toFixed(0);
        if (a >= 10) return v.toFixed(1);
        return v.toFixed(2);
    }

    function getGraph() {
        try {
            var ui = (window.App && window.App._editorUi) || window.editorUi || window.ui;
            return ui && ui.editor && ui.editor.graph;
        } catch (_) { return null; }
    }

    function getEditorUi() {
        return (window.App && window.App._editorUi) || window.editorUi || window.ui || null;
    }

    function networkTitle() {
        try {
            var f = getEditorUi() && getEditorUi().getCurrentFile && getEditorUi().getCurrentFile();
            var t = f && f.getTitle && f.getTitle();
            if (t) return String(t).replace(/\.(drawio|xml|electrisim)$/i, '');
        } catch (_) { /* ignore */ }
        return 'Network';
    }

    // ---------- data model ----------

    function indexRows(rows, fields, steps) {
        var byKey = new Map();
        (rows || []).forEach(function (r) {
            if (!r) return;
            var key = String(r.id != null && r.id !== '' ? r.id : r.name);
            var e = byKey.get(key);
            if (!e) {
                e = { key: key, row: r, v: {} };
                fields.forEach(function (f) { e.v[f] = new Float64Array(steps).fill(NaN); });
                byKey.set(key, e);
            }
            var t = Number(r.time_step);
            if (t >= 0 && t < steps) {
                fields.forEach(function (f) {
                    var x = Number(r[f]);
                    e.v[f][t] = isFinite(x) ? x : NaN;
                });
            }
        });
        return Array.from(byKey.values());
    }

    function stepCount(results) {
        var n = parseInt(results.time_steps, 10);
        if (n > 0) return n;
        var mx = -1;
        (results.busbars || []).forEach(function (r) { if (r.time_step > mx) mx = r.time_step; });
        return mx + 1;
    }

    function sampleAt(arr, pos) {
        if (!arr) return NaN;
        var i0 = Math.floor(pos), i1 = Math.min(arr.length - 1, i0 + 1);
        var t = pos - i0;
        var a = arr[clamp(i0, 0, arr.length - 1)], b = arr[i1];
        if (!isFinite(a)) return b;
        if (!isFinite(b)) return a;
        return a + (b - a) * t;
    }

    function sumSeries(entries, field, steps) {
        if (!entries.length) return null;
        var out = new Float64Array(steps);
        entries.forEach(function (e) {
            var v = e.v[field];
            for (var t = 0; t < steps; t++) if (isFinite(v[t])) out[t] += v[t];
        });
        return out;
    }

    function buildModel(graph, results) {
        var steps = stepCount(results);
        var m = {
            steps: steps,
            stamps: results.time_stamps || [],
            buses: indexRows(results.busbars, ['vm_pu'], steps),
            lines: indexRows(results.lines, ['loading_percent', 'p_from_mw'], steps),
            trafos: indexRows([].concat(results.transformers || [], results.transformers3w || [], results.transformers3W || []), ['loading_percent'], steps),
            sgens: indexRows([].concat(results.sgens || [], results.gens || []), ['p_mw'], steps),
            loads: indexRows(results.loads, ['p_mw'], steps),
            storages: indexRows(results.storages, ['p_mw'], steps),
            grids: indexRows(results.externalgrids, ['p_mw'], steps)
        };
        m.totals = {
            gen: sumSeries(m.sgens, 'p_mw', steps),
            load: sumSeries(m.loads, 'p_mw', steps),
            batt: sumSeries(m.storages, 'p_mw', steps),
            grid: sumSeries(m.grids, 'p_mw', steps)
        };
        var pmax = 0;
        m.lines.forEach(function (e) {
            var v = e.v.p_from_mw;
            for (var t = 0; t < steps; t++) if (isFinite(v[t])) pmax = Math.max(pmax, Math.abs(v[t]));
        });
        m.linePmax = pmax || 1;
        resolveGeometry(graph, m);
        return m;
    }

    // ---------- geometry (model coordinates, independent of zoom and scroll) ----------

    function toModel(view, p) {
        return { x: p.x / view.scale - view.translate.x, y: p.y / view.scale - view.translate.y };
    }

    function boxOf(graph, cell) {
        var view = graph.view;
        var st = view && view.getState(cell);
        if (!st) return null;
        var p = toModel(view, { x: st.x, y: st.y });
        return { x: p.x, y: p.y, w: st.width / view.scale, h: st.height / view.scale };
    }

    function center(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }

    function distToBox(p, b) {
        var dx = Math.max(b.x - p.x, 0, p.x - (b.x + b.w));
        var dy = Math.max(b.y - p.y, 0, p.y - (b.y + b.h));
        return Math.sqrt(dx * dx + dy * dy);
    }

    function pathOf(graph, cell) {
        var view = graph.view;
        if (cell.edge) {
            var st = view.getState(cell);
            if (!st || !st.absolutePoints || st.absolutePoints.length < 2) return null;
            return st.absolutePoints.filter(Boolean).map(function (p) { return toModel(view, p); });
        }
        // Line drawn as a vertex between two connection edges: bus - edge - line - edge - bus.
        var box = boxOf(graph, cell);
        if (!box) return null;
        var model = graph.getModel();
        var ends = [];
        var edges = model.getEdges(cell) || [];
        edges.forEach(function (e) {
            var other = model.getTerminal(e, true) === cell ? model.getTerminal(e, false) : model.getTerminal(e, true);
            var ob = other && boxOf(graph, other);
            if (ob) ends.push(center(ob));
        });
        if (ends.length >= 2) return [ends[0], center(box), ends[1]];
        return [{ x: box.x, y: box.y + box.h / 2 }, { x: box.x + box.w, y: box.y + box.h / 2 }];
    }

    function resolveGeometry(graph, m) {
        var map = null;
        if (typeof window.buildGraphCellLookupMap === 'function') {
            try { map = window.buildGraphCellLookupMap(graph); } catch (_) { map = null; }
        }
        function resolve(row) {
            if (!map || typeof window.resolveGraphCellForResult !== 'function') return null;
            try { return window.resolveGraphCellForResult(map, row, graph); } catch (_) { return null; }
        }
        var busBoxByKey = new Map();
        m.buses.forEach(function (e) {
            e.cell = resolve(e.row);
            e.box = e.cell ? boxOf(graph, e.cell) : null;
            if (e.box) busBoxByKey.set(e.key, e.box);
        });
        m.lines.forEach(function (e) {
            e.cell = resolve(e.row);
            e.path = e.cell ? pathOf(graph, e.cell) : null;
            e.phase = 0;
            if (!e.path) return;
            // Orient the path from the line's from-bus, so a positive p_from_mw flows along it.
            var fromKey = e.row.from_bus != null ? String(e.row.from_bus) : null;
            var fromBox = fromKey ? busBoxByKey.get(fromKey) : null;
            if (!fromBox && fromKey) {
                var c = resolve({ id: fromKey, name: fromKey });
                fromBox = c ? boxOf(graph, c) : null;
            }
            if (fromBox) {
                var a = e.path[0], b = e.path[e.path.length - 1];
                if (distToBox(b, fromBox) < distToBox(a, fromBox)) e.path = e.path.slice().reverse();
                e.oriented = true;
            }
        });
        ['trafos', 'sgens', 'storages', 'grids'].forEach(function (k) {
            m[k].forEach(function (e) {
                e.cell = resolve(e.row);
                e.box = e.cell ? boxOf(graph, e.cell) : null;
            });
        });
    }

    // ---------- drawing (shared by the live overlay and the video export) ----------

    function pill(ctx, placed, x, y, text, bg, fg, k) {
        ctx.font = '600 ' + Math.round(11 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
        var w = ctx.measureText(text).width + 12 * k;
        var h = 18 * k;
        var r = { x: x - w / 2, y: y - h / 2, w: w, h: h };
        for (var i = 0; i < placed.length; i++) {
            var q = placed[i];
            if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) return false;
        }
        placed.push(r);
        ctx.fillStyle = bg;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(r.x, r.y, r.w, r.h, h / 2); else ctx.rect(r.x, r.y, r.w, r.h);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y + 0.5 * k);
        return true;
    }

    /**
     * Draws the state at fractional step `pos`.
     * xf(p) maps a model point to canvas pixels; zoom is pixels per model unit; k scales strokes and text.
     */
    function drawOverlay(ctx, m, pos, xf, zoom, k, opts, clip) {
        var placed = [];
        var lw = Math.max(2.5 * k, Math.min(7 * k, 4 * zoom));

        function visible(p) {
            return !clip || (p.x > clip.x - 60 && p.y > clip.y - 60 && p.x < clip.x + clip.w + 60 && p.y < clip.y + clip.h + 60);
        }

        // Lines: loading colour
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        m.lines.forEach(function (e) {
            if (!e.path) return;
            var ld = sampleAt(e.v.loading_percent, pos);
            if (!isFinite(ld)) return;
            var pts = e.path.map(xf);
            e._screen = pts;
            ctx.strokeStyle = rgba(loadingRgb(ld), 0.82);
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
            ctx.stroke();
        });

        // Flow dots
        if (opts.flow && m.lines.length <= MAX_LINES_WITH_DOTS) {
            var spacing = FLOW_DOT_SPACING * k;
            ctx.fillStyle = '#ffffff';
            m.lines.forEach(function (e) {
                var pts = e._screen;
                if (!pts || !e.oriented) return;
                var p = sampleAt(e.v.p_from_mw, pos);
                if (!isFinite(p) || Math.abs(p) < 1e-4) return;
                var total = 0, segs = [];
                for (var i = 1; i < pts.length; i++) {
                    var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
                    var L = Math.sqrt(dx * dx + dy * dy);
                    segs.push(L);
                    total += L;
                }
                if (total < spacing * 0.8) return;
                var off = ((e.phase % spacing) + spacing) % spacing;
                var r = Math.max(1.8 * k, lw * 0.36);
                for (var d = off; d < total; d += spacing) {
                    var dd = p >= 0 ? d : total - d;
                    var acc = 0;
                    for (var s = 0; s < segs.length; s++) {
                        if (dd <= acc + segs[s] || s === segs.length - 1) {
                            var t = segs[s] > 0 ? (dd - acc) / segs[s] : 0;
                            var x = pts[s].x + (pts[s + 1].x - pts[s].x) * t;
                            var y = pts[s].y + (pts[s + 1].y - pts[s].y) * t;
                            ctx.beginPath();
                            ctx.arc(x, y, r, 0, Math.PI * 2);
                            ctx.fill();
                            break;
                        }
                        acc += segs[s];
                    }
                }
            });
        }

        // Buses: voltage colour
        m.buses.forEach(function (e) {
            if (!e.box) return;
            var vm = sampleAt(e.v.vm_pu, pos);
            if (!isFinite(vm)) return;
            var a = xf({ x: e.box.x, y: e.box.y });
            var b = xf({ x: e.box.x + e.box.w, y: e.box.y + e.box.h });
            if (!visible(a) && !visible(b)) return;
            var pad = 2 * k;
            ctx.fillStyle = rgba(voltageRgb(vm), 0.9);
            ctx.fillRect(a.x - pad, a.y - pad, Math.max(3 * k, b.x - a.x + 2 * pad), Math.max(3 * k, b.y - a.y + 2 * pad));
        });

        // Transformers: outline + loading
        m.trafos.forEach(function (e) {
            if (!e.box) return;
            var ld = sampleAt(e.v.loading_percent, pos);
            if (!isFinite(ld)) return;
            var a = xf({ x: e.box.x, y: e.box.y });
            var b = xf({ x: e.box.x + e.box.w, y: e.box.y + e.box.h });
            var rgb = loadingRgb(ld);
            ctx.strokeStyle = rgba(rgb, 0.95);
            ctx.lineWidth = 3 * k;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(a.x - 3 * k, a.y - 3 * k, b.x - a.x + 6 * k, b.y - a.y + 6 * k, 6 * k);
            else ctx.rect(a.x - 3 * k, a.y - 3 * k, b.x - a.x + 6 * k, b.y - a.y + 6 * k);
            ctx.stroke();
            if (opts.labels) pill(ctx, placed, (a.x + b.x) / 2, a.y - 13 * k, Math.round(ld) + ' %', rgba(rgb, 1), '#fff', k);
        });

        if (!opts.labels) return;

        // Overloaded / heavily loaded lines
        m.lines.forEach(function (e) {
            var pts = e._screen;
            if (!pts) return;
            var ld = sampleAt(e.v.loading_percent, pos);
            if (!(ld >= 90)) return;
            var mid = pts[Math.floor((pts.length - 1) / 2)], nxt = pts[Math.min(pts.length - 1, Math.floor((pts.length - 1) / 2) + 1)];
            pill(ctx, placed, (mid.x + nxt.x) / 2, (mid.y + nxt.y) / 2, Math.round(ld) + ' %', rgba(loadingRgb(ld), 1), '#fff', k);
        });

        function below(e) {
            var c = xf({ x: e.box.x + e.box.w / 2, y: e.box.y + e.box.h });
            return { x: c.x, y: c.y + 12 * k };
        }

        m.storages.forEach(function (e) {
            if (!e.box) return;
            var p = sampleAt(e.v.p_mw, pos);
            if (!isFinite(p)) return;
            var at = below(e);
            if (Math.abs(p) < 1e-3) pill(ctx, placed, at.x, at.y, 'idle', '#94a3b8', '#fff', k);
            else if (p > 0) pill(ctx, placed, at.x, at.y, '▲ ' + fmtMw(p) + ' MW charging', COL.battCharge, '#fff', k);
            else pill(ctx, placed, at.x, at.y, '▼ ' + fmtMw(-p) + ' MW discharging', COL.battDischarge, '#fff', k);
        });

        m.grids.forEach(function (e) {
            if (!e.box) return;
            var p = sampleAt(e.v.p_mw, pos);
            if (!isFinite(p)) return;
            var at = below(e);
            pill(ctx, placed, at.x, at.y, (p >= 0 ? 'Import ' : 'Export ') + fmtMw(Math.abs(p)) + ' MW', p >= 0 ? COL.grid : '#15803d', '#fff', k);
        });

        m.sgens.forEach(function (e) {
            if (!e.box) return;
            var p = sampleAt(e.v.p_mw, pos);
            if (!isFinite(p)) return;
            var at = below(e);
            pill(ctx, placed, at.x, at.y, fmtMw(p) + ' MW', p > 1e-3 ? COL.gen : '#cbd5e1', p > 1e-3 ? '#1f1300' : '#334155', k);
        });
    }

    function advanceFlow(m, pos, dt, k) {
        m.lines.forEach(function (e) {
            var p = sampleAt(e.v.p_from_mw, pos);
            if (!isFinite(p)) return;
            var speed = (14 + 60 * Math.sqrt(Math.min(1, Math.abs(p) / m.linePmax))) * k;
            e.phase += speed * dt;
        });
    }

    function stats(m, pos) {
        var s = { maxLd: -1, maxName: '', vmin: Infinity, vmax: -Infinity, vminName: '' };
        m.lines.concat(m.trafos).forEach(function (e) {
            var ld = sampleAt(e.v.loading_percent, pos);
            if (ld > s.maxLd) { s.maxLd = ld; s.maxName = e.row.name || e.key; }
        });
        m.buses.forEach(function (e) {
            var vm = sampleAt(e.v.vm_pu, pos);
            if (!isFinite(vm)) return;
            if (vm < s.vmin) { s.vmin = vm; s.vminName = e.row.name || e.key; }
            if (vm > s.vmax) s.vmax = vm;
        });
        ['gen', 'load', 'batt', 'grid'].forEach(function (k) { s[k] = m.totals[k] ? sampleAt(m.totals[k], pos) : null; });
        return s;
    }

    function clockLabel(m, pos) {
        var i = clamp(Math.round(pos), 0, m.steps - 1);
        var hour = i % 24, day = Math.floor(i / 24) + 1;
        var stamp = m.stamps[i];
        var mm = /(\d{1,2}):(\d{2})/.exec(String(stamp || ''));
        var hh = mm ? mm[1].padStart(2, '0') + ':' + mm[2] : String(hour).padStart(2, '0') + ':00';
        return { time: hh, day: m.steps > 24 ? 'Day ' + day : '', step: 'Step ' + (i + 1) + ' / ' + m.steps };
    }

    function chartSeries(m) {
        var out = [];
        if (m.totals.gen) out.push({ key: 'gen', label: 'Generation', color: COL.gen, v: m.totals.gen });
        if (m.totals.load) out.push({ key: 'load', label: 'Load', color: COL.load, v: m.totals.load });
        if (m.totals.batt) out.push({ key: 'batt', label: 'Battery (+ charging)', color: COL.battCharge, v: m.totals.batt });
        if (m.totals.grid) out.push({ key: 'grid', label: 'Grid import', color: COL.grid, v: m.totals.grid, dash: true });
        return out;
    }

    function drawChart(ctx, x, y, w, h, m, pos, k, legend) {
        var series = chartSeries(m);
        var lo = 0, hi = 0;
        series.forEach(function (s) {
            for (var t = 0; t < s.v.length; t++) if (isFinite(s.v[t])) { lo = Math.min(lo, s.v[t]); hi = Math.max(hi, s.v[t]); }
        });
        if (hi - lo < 1e-6) hi = lo + 1;
        var padTop = legend ? 20 * k : 4 * k;
        var py = y + padTop, ph = h - padTop - 4 * k;
        var n = Math.max(2, m.steps);
        function X(t) { return x + (t / (n - 1)) * w; }
        function Y(v) { return py + (1 - (v - lo) / (hi - lo)) * ph; }

        ctx.save();
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(x, py, w, ph);
        if (lo < 0) {
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1 * k;
            ctx.beginPath(); ctx.moveTo(x, Y(0)); ctx.lineTo(x + w, Y(0)); ctx.stroke();
        }
        // Day separators
        if (m.steps > 24) {
            ctx.strokeStyle = '#e2e8f0';
            for (var d = 24; d < m.steps; d += 24) { ctx.beginPath(); ctx.moveTo(X(d), py); ctx.lineTo(X(d), py + ph); ctx.stroke(); }
        }
        series.forEach(function (s) {
            ctx.strokeStyle = s.color;
            ctx.lineWidth = 2 * k;
            ctx.setLineDash(s.dash ? [5 * k, 4 * k] : []);
            ctx.beginPath();
            var started = false;
            for (var t = 0; t < s.v.length; t++) {
                if (!isFinite(s.v[t])) continue;
                if (!started) { ctx.moveTo(X(t), Y(s.v[t])); started = true; } else ctx.lineTo(X(t), Y(s.v[t]));
            }
            ctx.stroke();
        });
        ctx.setLineDash([]);
        // Playhead
        var hx = X(pos);
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 1.5 * k;
        ctx.beginPath(); ctx.moveTo(hx, py - 2 * k); ctx.lineTo(hx, py + ph); ctx.stroke();
        series.forEach(function (s) {
            var v = sampleAt(s.v, pos);
            if (!isFinite(v)) return;
            ctx.fillStyle = s.color;
            ctx.beginPath(); ctx.arc(hx, Y(v), 3.5 * k, 0, Math.PI * 2); ctx.fill();
        });
        if (legend) {
            ctx.font = '600 ' + Math.round(11 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
            ctx.textBaseline = 'middle';
            ctx.textAlign = 'left';
            var lx = x;
            series.forEach(function (s) {
                ctx.fillStyle = s.color;
                ctx.fillRect(lx, y + 6 * k, 14 * k, 3 * k);
                ctx.fillStyle = COL.muted;
                ctx.fillText(s.label, lx + 18 * k, y + 8 * k);
                lx += ctx.measureText(s.label).width + 34 * k;
            });
            ctx.textAlign = 'right';
            ctx.fillText('MW', x + w, y + 8 * k);
        }
        ctx.restore();
    }

    // ---------- live overlay + control bar ----------

    function injectStyle() {
        if (document.getElementById(STYLE_ID)) return;
        var st = document.createElement('style');
        st.id = STYLE_ID;
        st.textContent = [
            '#' + BAR_ID + '{position:fixed;z-index:9995;background:rgba(255,255,255,.97);border:1px solid #e2e8f0;border-radius:12px;',
            'box-shadow:0 8px 28px rgba(15,23,42,.18);padding:8px 12px 10px;font-family:Inter,"Segoe UI",Arial,sans-serif;color:#0f172a;box-sizing:border-box;}',
            '#' + BAR_ID + ' .ets-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}',
            '#' + BAR_ID + ' button{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:5px 9px;font-size:13px;cursor:pointer;color:#0f172a;line-height:1;}',
            '#' + BAR_ID + ' button:hover{background:#f1f5f9;}',
            '#' + BAR_ID + ' .ets-play{background:#0f766e;border-color:#0f766e;color:#fff;width:38px;font-size:15px;}',
            '#' + BAR_ID + ' .ets-play:hover{background:#115e59;}',
            '#' + BAR_ID + ' .ets-export{background:linear-gradient(135deg,#0f766e,#0e7490);border:none;color:#fff;font-weight:600;}',
            '#' + BAR_ID + ' .ets-clock{font-size:20px;font-weight:700;font-variant-numeric:tabular-nums;min-width:58px;}',
            '#' + BAR_ID + ' .ets-day{font-size:11px;color:#64748b;}',
            '#' + BAR_ID + ' .ets-slider{flex:1 1 160px;min-width:120px;accent-color:#0f766e;}',
            '#' + BAR_ID + ' select{border:1px solid #cbd5e1;border-radius:7px;padding:4px;font-size:12px;}',
            '#' + BAR_ID + ' label{font-size:12px;color:#334155;display:flex;align-items:center;gap:3px;cursor:pointer;}',
            '#' + BAR_ID + ' .ets-row2{display:flex;gap:12px;margin-top:6px;align-items:stretch;}',
            '#' + BAR_ID + ' .ets-chart{flex:1 1 auto;min-width:0;height:78px;cursor:pointer;}',
            '#' + BAR_ID + ' .ets-kpis{display:grid;grid-template-columns:auto auto;gap:2px 10px;font-size:11px;align-content:center;white-space:nowrap;}',
            '#' + BAR_ID + ' .ets-kpis b{font-size:12px;font-variant-numeric:tabular-nums;}',
            '#' + BAR_ID + ' .ets-kpis span{color:#64748b;}',
            '#' + BAR_ID + ' .ets-legend{display:flex;gap:10px;font-size:10.5px;color:#64748b;align-items:center;margin-left:auto;}',
            '#' + BAR_ID + ' .ets-sw{display:inline-block;width:26px;height:6px;border-radius:3px;vertical-align:middle;margin-right:3px;}',
            '@media (max-width:760px){#' + BAR_ID + ' .ets-kpis{display:none;}#' + BAR_ID + ' .ets-legend{display:none;}}',
            '.ets-modal-bg{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:10050;display:flex;align-items:center;justify-content:center;padding:16px;}',
            '.ets-modal{background:#fff;border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.3);width:min(520px,100%);padding:20px 22px;font-family:Inter,"Segoe UI",Arial,sans-serif;color:#0f172a;box-sizing:border-box;}',
            '.ets-modal h3{margin:0 0 4px;font-size:18px;}',
            '.ets-modal p{margin:0 0 14px;font-size:12.5px;color:#475569;line-height:1.45;}',
            '.ets-modal label{display:block;font-size:12px;font-weight:600;color:#334155;margin:10px 0 4px;}',
            '.ets-modal input,.ets-modal select{width:100%;box-sizing:border-box;padding:7px 9px;border:1px solid #cbd5e1;border-radius:7px;font-size:13px;}',
            '.ets-modal .ets-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px;}',
            '.ets-modal button{border:1px solid #cbd5e1;background:#fff;border-radius:7px;padding:8px 14px;font-size:13px;cursor:pointer;}',
            '.ets-modal .ets-primary{background:#0f766e;border-color:#0f766e;color:#fff;font-weight:600;}',
            '.ets-modal canvas{width:100%;height:auto;border-radius:8px;border:1px solid #e2e8f0;display:block;margin-top:10px;}',
            '.ets-progress{height:6px;background:#e2e8f0;border-radius:3px;margin-top:10px;overflow:hidden;}',
            '.ets-progress div{height:100%;width:0;background:#0f766e;transition:width .2s;}'
        ].join('');
        document.head.appendChild(st);
    }

    function buildBar(a) {
        injectStyle();
        var bar = document.createElement('div');
        bar.id = BAR_ID;
        var legend = '<span><i class="ets-sw" style="background:linear-gradient(90deg,#2e7d32,#f9a825,#ef6c00,#c62828)"></i>Loading 0 → 100 %</span>' +
            '<span><i class="ets-sw" style="background:linear-gradient(90deg,#38c448,#e6d228,#d2322d)"></i>|V − 1| 0 → 0.1 pu</span>';
        bar.innerHTML =
            '<div class="ets-row">' +
            '<button type="button" class="ets-play" title="Play / pause">▶</button>' +
            '<button type="button" class="ets-prev" title="Previous step">⏮</button>' +
            '<button type="button" class="ets-next" title="Next step">⏭</button>' +
            '<div><div class="ets-clock">00:00</div><div class="ets-day"></div></div>' +
            '<input type="range" class="ets-slider" min="0" step="0.01" value="0" aria-label="Time step">' +
            '<select class="ets-speed" title="Speed"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option><option value="4">4×</option></select>' +
            '<label><input type="checkbox" class="ets-loop" checked>Loop</label>' +
            '<label><input type="checkbox" class="ets-flow" checked>Flow</label>' +
            '<label><input type="checkbox" class="ets-labels" checked>Labels</label>' +
            '<button type="button" class="ets-results" title="Open the time series results tables and charts">Results</button>' +
            '<button type="button" class="ets-export" title="Record the playback as a video">Export video</button>' +
            '<button type="button" class="ets-close" title="Close playback">✕</button>' +
            '</div>' +
            '<div class="ets-row2"><canvas class="ets-chart"></canvas><div class="ets-kpis"></div></div>' +
            '<div class="ets-row" style="margin-top:4px;"><span class="ets-step" style="font-size:11px;color:#64748b;"></span><div class="ets-legend">' + legend + '</div></div>';
        document.body.appendChild(bar);

        var q = function (s) { return bar.querySelector(s); };
        a.el = {
            bar: bar, play: q('.ets-play'), slider: q('.ets-slider'), clock: q('.ets-clock'), day: q('.ets-day'),
            speed: q('.ets-speed'), loop: q('.ets-loop'), flow: q('.ets-flow'), labels: q('.ets-labels'),
            chart: q('.ets-chart'), kpis: q('.ets-kpis'), step: q('.ets-step')
        };
        a.el.slider.max = String(Math.max(0, a.m.steps - 1));
        a.el.flow.checked = a.m.lines.length <= MAX_LINES_WITH_DOTS;
        a.el.labels.checked = (a.m.sgens.length + a.m.storages.length) <= 60;

        a.el.play.addEventListener('click', function () { setPlaying(!a.playing); });
        q('.ets-prev').addEventListener('click', function () { setPlaying(false); seek(Math.ceil(a.pos) - 1); });
        q('.ets-next').addEventListener('click', function () { setPlaying(false); seek(Math.floor(a.pos) + 1); });
        a.el.slider.addEventListener('input', function () { seek(parseFloat(a.el.slider.value)); });
        a.el.slider.addEventListener('pointerdown', function () { setPlaying(false); });
        q('.ets-close').addEventListener('click', stopTimeSeriesPlayback);
        q('.ets-results').addEventListener('click', function () {
            if (window.TimeSeriesSimulationResultsDialog) new window.TimeSeriesSimulationResultsDialog(a.results, {}).show();
        });
        q('.ets-export').addEventListener('click', function () { setPlaying(false); openExportDialog(a); });
        var seekFromChart = function (ev) {
            var r = a.el.chart.getBoundingClientRect();
            seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * (a.m.steps - 1));
        };
        a.el.chart.addEventListener('pointerdown', function (ev) {
            setPlaying(false);
            seekFromChart(ev);
            a.el.chart.setPointerCapture(ev.pointerId);
            var move = function (e2) { seekFromChart(e2); };
            var up = function () { a.el.chart.removeEventListener('pointermove', move); a.el.chart.removeEventListener('pointerup', up); };
            a.el.chart.addEventListener('pointermove', move);
            a.el.chart.addEventListener('pointerup', up);
        });
    }

    function placeBar(a) {
        var c = a.graph.container.getBoundingClientRect();
        var w = Math.min(1040, Math.max(320, c.width - 24));
        var bar = a.el.bar;
        bar.style.width = w + 'px';
        bar.style.left = Math.round(c.left + (c.width - w) / 2) + 'px';
        bar.style.top = 'auto';
        bar.style.bottom = Math.max(8, Math.round(window.innerHeight - c.bottom + 12)) + 'px';
    }

    function setPlaying(on) {
        var a = active;
        if (!a) return;
        if (on && a.pos >= a.m.steps - 1) a.pos = 0;
        a.playing = !!on;
        a.el.play.textContent = a.playing ? '❚❚' : '▶';
    }

    function seek(pos) {
        var a = active;
        if (!a) return;
        a.pos = clamp(pos, 0, a.m.steps - 1);
    }

    function ensureOverlay(a) {
        var cv = document.getElementById(OVERLAY_ID);
        if (!cv) {
            cv = document.createElement('canvas');
            cv.id = OVERLAY_ID;
            cv.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;z-index:9990;';
            document.body.appendChild(cv);
        }
        a.overlay = cv;
        return cv;
    }

    function updateUi(a) {
        var lab = clockLabel(a.m, a.pos);
        a.el.clock.textContent = lab.time;
        a.el.day.textContent = lab.day;
        a.el.step.textContent = lab.step;
        if (document.activeElement !== a.el.slider) a.el.slider.value = String(a.pos);
        var s = stats(a.m, a.pos);
        var rows = [];
        if (s.maxLd >= 0) rows.push('<span>Max loading</span><b style="color:' + rgba(loadingRgb(s.maxLd), 1) + '">' + Math.round(s.maxLd) + ' %</b>');
        if (isFinite(s.vmin)) rows.push('<span>V min / max</span><b>' + s.vmin.toFixed(3) + ' / ' + s.vmax.toFixed(3) + ' pu</b>');
        if (s.gen != null) rows.push('<span>Generation</span><b>' + fmtMw(s.gen) + ' MW</b>');
        if (s.load != null) rows.push('<span>Load</span><b>' + fmtMw(s.load) + ' MW</b>');
        if (s.batt != null) rows.push('<span>Battery</span><b style="color:' + (s.batt >= 0 ? COL.battCharge : COL.battDischarge) + '">' + (s.batt >= 0 ? '▲ ' : '▼ ') + fmtMw(Math.abs(s.batt)) + ' MW</b>');
        if (s.grid != null) rows.push('<span>Grid</span><b>' + (s.grid >= 0 ? 'import ' : 'export ') + fmtMw(Math.abs(s.grid)) + ' MW</b>');
        var html = rows.join('');
        if (html !== a._kpiHtml) { a.el.kpis.innerHTML = html; a._kpiHtml = html; }

        var cv = a.el.chart;
        var dpr = window.devicePixelRatio || 1;
        var w = cv.clientWidth, h = cv.clientHeight;
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        var ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        drawChart(ctx, 0, 0, w, h, a.m, a.pos, 1, true);
    }

    function frame(ts) {
        var a = active;
        if (!a) return;
        var dt = a.lastTs ? Math.min(0.1, (ts - a.lastTs) / 1000) : 0;
        a.lastTs = ts;
        if (a.playing) {
            a.pos += dt * parseFloat(a.el.speed.value || '1') / STEP_SECONDS;
            if (a.pos >= a.m.steps - 1) {
                if (a.el.loop.checked) a.pos = 0;
                else { a.pos = a.m.steps - 1; setPlaying(false); }
            }
        }
        advanceFlow(a.m, a.pos, dt, 1);

        var g = a.graph;
        var rect = g.container.getBoundingClientRect();
        var cv = ensureOverlay(a);
        var dpr = window.devicePixelRatio || 1;
        var w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
        cv.style.left = rect.left + 'px';
        cv.style.top = rect.top + 'px';
        cv.style.width = w + 'px';
        cv.style.height = h + 'px';
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
        var ctx = cv.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        var view = g.view, s = view.scale, tr = view.translate, sl = g.container.scrollLeft || 0, st = g.container.scrollTop || 0;
        var xf = function (p) { return { x: (p.x + tr.x) * s - sl, y: (p.y + tr.y) * s - st }; };
        drawOverlay(ctx, a.m, a.pos, xf, s, 1, { flow: a.el.flow.checked, labels: a.el.labels.checked }, { x: 0, y: 0, w: w, h: h });

        placeBar(a);
        updateUi(a);
        a.raf = requestAnimationFrame(frame);
    }

    function startTimeSeriesPlayback(graph, results) {
        graph = graph || getGraph();
        if (!graph || !results) return null;
        stopTimeSeriesPlayback();
        try { if (window.stopLoadFlowDiagramColour) window.stopLoadFlowDiagramColour(); } catch (_) { /* ignore */ }
        try { if (window.stopLoadFlowPowerAnimation) window.stopLoadFlowPowerAnimation(); } catch (_) { /* ignore */ }
        var m = buildModel(graph, results);
        if (!m.steps) return null;
        var a = { graph: graph, results: results, m: m, pos: 0, playing: false, lastTs: 0 };
        active = a;
        buildBar(a);
        a.onModelChange = function () { try { resolveGeometry(graph, m); } catch (_) { /* ignore */ } };
        try { graph.getModel().addListener(mxEvent.CHANGE, a.onModelChange); } catch (_) { /* ignore */ }
        a.raf = requestAnimationFrame(frame);
        setPlaying(true);
        return a;
    }

    function stopTimeSeriesPlayback() {
        var a = active;
        active = null;
        if (!a) return;
        if (a.raf) cancelAnimationFrame(a.raf);
        try { a.graph.getModel().removeListener(a.onModelChange); } catch (_) { /* ignore */ }
        if (a.el && a.el.bar && a.el.bar.parentNode) a.el.bar.parentNode.removeChild(a.el.bar);
        var cv = document.getElementById(OVERLAY_ID);
        if (cv && cv.parentNode) cv.parentNode.removeChild(cv);
    }

    // ---------- video export ----------

    var FORMATS = {
        landscape: { w: 1920, h: 1080, label: '16:9 landscape (1920 × 1080)' },
        portrait: { w: 1080, h: 1350, label: '4:5 LinkedIn / Instagram feed (1080 × 1350)' },
        square: { w: 1080, h: 1080, label: '1:1 square (1080 × 1080)' }
    };

    function pickMime() {
        var c = ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
        if (typeof MediaRecorder === 'undefined') return null;
        for (var i = 0; i < c.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i];
        return '';
    }

    function renderDiagram(graph, border, scale) {
        return new Promise(function (resolve, reject) {
            var ui = getEditorUi();
            var editor = ui && ui.editor;
            if (!editor || typeof editor.exportToCanvas !== 'function') { reject(new Error('Diagram export is not available.')); return; }
            var view = graph.view;
            var bounds = graph.getGraphBounds();
            var vs = view.scale, tr = view.translate;
            // Graph.getSvg: svg = view / vs + floor((border - bounds.x) / vs), with view = (model + translate) * vs
            var ox = tr.x + Math.floor((border - bounds.x) / vs);
            var oy = tr.y + Math.floor((border - bounds.y) / vs);
            var svgW = Math.max(1, Math.ceil(bounds.width / vs) + 2 * border);
            editor.exportToCanvas(function (canvas) {
                // exportToCanvas may lower the scale for very large diagrams, so measure it.
                resolve({ canvas: canvas, scale: canvas.width / svgW, ox: ox, oy: oy });
            }, null, null, '#ffffff', function (e) { reject(e || new Error('Diagram export failed.')); },
            false, true, scale, false, false, null, graph, border, false, false, false);
        });
    }

    function exportWindow(m, pos) {
        if (m.steps <= 72) return { start: 0, end: m.steps - 1 };
        var start = Math.floor(clamp(pos, 0, m.steps - 1) / 24) * 24;
        return { start: start, end: Math.min(m.steps - 1, start + 23) };
    }

    function drawVideoFrame(ctx, W, H, m, pos, diag, title, opts, win) {
        var k = Math.min(W, H) / 1080;
        var portrait = H > W;
        var pad = 44 * k;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Header
        var headH = (portrait ? 150 : 128) * k;
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        ctx.fillStyle = COL.text;
        ctx.font = '800 ' + Math.round(40 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
        var maxTitleW = W - pad * 2 - 230 * k;
        var t = title;
        while (ctx.measureText(t).width > maxTitleW && t.length > 8) t = t.slice(0, -2);
        if (t !== title) t = t.replace(/\s*\S*$/, '') + '…';
        ctx.fillText(t, pad, pad + 38 * k);
        ctx.fillStyle = COL.muted;
        ctx.font = '500 ' + Math.round(22 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
        ctx.fillText('Time series load flow · ' + m.buses.length + ' buses · one AC power flow per hour', pad, pad + 76 * k);
        var lab = clockLabel(m, pos);
        ctx.textAlign = 'right';
        ctx.fillStyle = COL.text;
        ctx.font = '800 ' + Math.round(64 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
        ctx.fillText(lab.time, W - pad, pad + 50 * k);
        if (lab.day) {
            ctx.fillStyle = COL.muted;
            ctx.font = '600 ' + Math.round(20 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
            ctx.fillText(lab.day, W - pad, pad + 80 * k);
        }

        // Footer: KPI chips + chart
        var footH = (portrait ? 330 : 250) * k;
        var fy = H - footH;
        var s = stats(m, pos);
        var chips = [];
        if (s.maxLd >= 0) chips.push({ l: 'Max loading', v: Math.round(s.maxLd) + ' %', c: rgba(loadingRgb(s.maxLd), 1) });
        if (isFinite(s.vmin)) {
            var worstV = Math.abs(s.vmax - 1) > Math.abs(s.vmin - 1) ? s.vmax : s.vmin;
            chips.push({ l: 'Voltage range', v: s.vmin.toFixed(3) + ' – ' + s.vmax.toFixed(3) + ' pu', c: rgba(voltageRgb(worstV), 1) });
        }
        if (s.gen != null) chips.push({ l: 'Generation', v: fmtMw(s.gen) + ' MW', c: COL.gen });
        if (s.load != null) chips.push({ l: 'Load', v: fmtMw(s.load) + ' MW', c: COL.load });
        if (s.batt != null) chips.push({ l: s.batt >= 0 ? 'Battery charging' : 'Battery discharging', v: fmtMw(Math.abs(s.batt)) + ' MW', c: s.batt >= 0 ? COL.battCharge : COL.battDischarge });
        if (s.grid != null) chips.push({ l: s.grid >= 0 ? 'Grid import' : 'Grid export', v: fmtMw(Math.abs(s.grid)) + ' MW', c: COL.grid });
        var perRow = portrait ? 3 : chips.length;
        var gap = 12 * k;
        var cw = (W - pad * 2 - gap * (perRow - 1)) / Math.max(1, perRow);
        var ch = 64 * k;
        chips.forEach(function (c, i) {
            var r = Math.floor(i / perRow), col = i % perRow;
            var x = pad + col * (cw + gap), y = fy + r * (ch + gap);
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, cw, ch, 10 * k); else ctx.rect(x, y, cw, ch);
            ctx.fill();
            ctx.fillStyle = c.c;
            ctx.fillRect(x, y + 10 * k, 5 * k, ch - 20 * k);
            ctx.textAlign = 'left';
            ctx.fillStyle = COL.muted;
            ctx.font = '600 ' + Math.round(16 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
            ctx.fillText(c.l, x + 18 * k, y + 25 * k);
            ctx.fillStyle = COL.text;
            ctx.font = '800 ' + Math.round(24 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
            ctx.fillText(c.v, x + 18 * k, y + 52 * k);
        });
        var chipRows = Math.ceil(chips.length / perRow);
        var chartY = fy + chipRows * (ch + gap) + 4 * k;
        var chartH = H - chartY - 52 * k;
        if (chartH > 40 * k) drawChart(ctx, pad, chartY, W - pad * 2, chartH, m, pos, 1.6 * k, true);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#94a3b8';
        ctx.font = '600 ' + Math.round(18 * k) + 'px Inter, "Segoe UI", Arial, sans-serif';
        ctx.fillText('electrisim.com', W - pad, H - 18 * k);
        ctx.textAlign = 'left';
        ctx.fillText('Line / transformer loading 0 → 100 % green → red · bus colour = voltage', pad, H - 18 * k);

        // Diagram
        var area = { x: pad, y: headH + 6 * k, w: W - pad * 2, h: fy - headH - 22 * k };
        var img = diag.canvas;
        var f = Math.min(area.w / img.width, area.h / img.height);
        var dw = img.width * f, dh = img.height * f;
        var dx = area.x + (area.w - dw) / 2, dy = area.y + (area.h - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
        var z = diag.scale * f;
        var xf = function (p) { return { x: dx + (p.x + diag.ox) * z, y: dy + (p.y + diag.oy) * z }; };
        ctx.save();
        ctx.beginPath();
        ctx.rect(area.x - 4 * k, area.y - 4 * k, area.w + 8 * k, area.h + 8 * k);
        ctx.clip();
        drawOverlay(ctx, m, pos, xf, z, Math.max(1.1 * k, Math.min(1.6 * k, z * 1.2)), opts, null);
        ctx.restore();
    }

    function openExportDialog(a) {
        injectStyle();
        var win = exportWindow(a.m, a.pos);
        var nSteps = win.end - win.start + 1;
        var bg = document.createElement('div');
        bg.className = 'ets-modal-bg';
        var mime = pickMime();
        var ext = mime && mime.indexOf('mp4') >= 0 ? 'MP4' : 'WebM';
        var defaultTitle = (nSteps >= 24 ? '24 hours' : nSteps + ' hours') + ' of ' + networkTitle();
        bg.innerHTML =
            '<div class="ets-modal" role="dialog" aria-label="Export playback video">' +
            '<h3>Export playback video</h3>' +
            '<p>Records the playback with a title, the totals chart and key numbers, ready to post. ' +
            (a.m.steps > 72 ? 'This run is long, so the video covers the day you are viewing (steps ' + (win.start + 1) + '–' + (win.end + 1) + '). ' : '') +
            'The video is recorded in real time, so keep this tab open until it finishes.</p>' +
            '<label for="ets-v-title">Title</label><input id="ets-v-title" type="text" maxlength="80">' +
            '<label for="ets-v-format">Format</label><select id="ets-v-format">' +
            Object.keys(FORMATS).map(function (k) { return '<option value="' + k + '">' + FORMATS[k].label + '</option>'; }).join('') + '</select>' +
            '<label for="ets-v-len">Length</label><select id="ets-v-len"><option value="12">About 12 s</option><option value="20" selected>About 20 s</option><option value="30">About 30 s</option></select>' +
            '<div class="ets-rec" style="display:none;"><canvas></canvas><div class="ets-progress"><div></div></div><p class="ets-status" style="margin:8px 0 0;"></p></div>' +
            '<div class="ets-actions"><button type="button" class="ets-cancel">Cancel</button><button type="button" class="ets-primary ets-go">Record ' + ext + '</button></div>' +
            '</div>';
        document.body.appendChild(bg);
        var q = function (s) { return bg.querySelector(s); };
        q('#ets-v-title').value = defaultTitle;
        var cancelled = false, recording = null;
        var close = function () { cancelled = true; if (recording) try { recording.stop(); } catch (_) { /* ignore */ } if (bg.parentNode) bg.parentNode.removeChild(bg); };
        q('.ets-cancel').addEventListener('click', close);
        bg.addEventListener('mousedown', function (e) { if (e.target === bg && !recording) close(); });
        if (mime === null) {
            q('.ets-go').disabled = true;
            q('p').textContent = 'This browser cannot record video (MediaRecorder is missing). Try Chrome or Edge.';
            return;
        }
        q('.ets-go').addEventListener('click', function () {
            var fmt = FORMATS[q('#ets-v-format').value] || FORMATS.landscape;
            var length = parseFloat(q('#ets-v-len').value) || 20;
            var title = q('#ets-v-title').value.trim() || defaultTitle;
            q('.ets-go').disabled = true;
            q('#ets-v-title').disabled = q('#ets-v-format').disabled = q('#ets-v-len').disabled = true;
            q('.ets-rec').style.display = 'block';
            var status = q('.ets-status'), bar = q('.ets-progress div');
            status.textContent = 'Rendering the diagram…';
            var canvas = q('.ets-rec canvas');
            canvas.width = fmt.w;
            canvas.height = fmt.h;
            var bounds = a.graph.getGraphBounds();
            var modelW = bounds.width / a.graph.view.scale, modelH = bounds.height / a.graph.view.scale;
            var scale = clamp(Math.min(fmt.w * 1.6 / Math.max(1, modelW), fmt.h * 1.6 / Math.max(1, modelH)), 0.5, 4);
            a.graph.clearSelection();
            renderDiagram(a.graph, 20, scale).then(function (diag) {
                if (cancelled) return;
                var ctx = canvas.getContext('2d');
                var opts = { flow: a.el.flow.checked, labels: a.el.labels.checked };
                var steps = win.end - win.start;
                var stepSec = clamp(length / Math.max(1, steps), 0.12, 1.2);
                var intro = 1.0, outro = 1.8;
                var total = intro + steps * stepSec + outro;
                var stream = canvas.captureStream(30);
                var chunks = [];
                var rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12000000 } : { videoBitsPerSecond: 12000000 });
                recording = rec;
                rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
                rec.onstop = function () {
                    stream.getTracks().forEach(function (tr) { tr.stop(); });
                    if (cancelled) return;
                    var type = rec.mimeType || mime || 'video/webm';
                    var blob = new Blob(chunks, { type: type });
                    var fileExt = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
                    var name = 'electrisim-time-series-' + networkTitle().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-|-$/g, '').toLowerCase() + '.' + fileExt;
                    var url = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.href = url;
                    link.download = name;
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
                    recording = null;
                    status.textContent = 'Saved ' + name + ' (' + (blob.size / 1048576).toFixed(1) + ' MB).';
                    bar.style.width = '100%';
                    q('.ets-cancel').textContent = 'Close';
                };
                // Reset flow phases so the video starts clean
                a.m.lines.forEach(function (e) { e.phase = 0; });
                var t0 = null, last = null;
                var tick = function (ts) {
                    if (cancelled) return;
                    if (t0 === null) { t0 = ts; last = ts; }
                    var el = (ts - t0) / 1000;
                    var dt = Math.min(0.1, (ts - last) / 1000);
                    last = ts;
                    var pos = win.start + clamp((el - intro) / stepSec, 0, steps);
                    advanceFlow(a.m, pos, dt, Math.min(fmt.w, fmt.h) / 1080);
                    drawVideoFrame(ctx, fmt.w, fmt.h, a.m, pos, diag, title, opts, win);
                    bar.style.width = Math.round(100 * Math.min(1, el / total)) + '%';
                    status.textContent = 'Recording… ' + Math.max(0, Math.ceil(total - el)) + ' s left';
                    if (el < total) requestAnimationFrame(tick);
                    else { status.textContent = 'Saving…'; rec.stop(); }
                };
                rec.start(250);
                requestAnimationFrame(tick);
            }).catch(function (err) {
                status.textContent = 'Could not export the video: ' + ((err && err.message) || err);
                q('.ets-go').disabled = false;
            });
        });
    }

    window.startTimeSeriesPlayback = startTimeSeriesPlayback;
    window.stopTimeSeriesPlayback = stopTimeSeriesPlayback;
    window.__timeSeriesPlaybackInternals = {
        buildModel: buildModel, drawVideoFrame: drawVideoFrame, renderDiagram: renderDiagram, advanceFlow: advanceFlow,
        exportWindow: exportWindow, stats: stats, active: function () { return active; }
    };
})();
