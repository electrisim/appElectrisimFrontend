/**
 * Animated P / Q power-flow markers on the diagram after load flow (SVG overlay, not mxGraph cells).
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    var FLOW_EPS = 0.001;
    var COLOR_P = '#F9A825';
    var COLOR_Q = '#1565C0';
    var LEGEND_ID = 'electrisim-loadflow-animation-legend';
    var OVERLAY_ID = 'electrisim-loadflow-animation-overlay';
    var LS_KEY = 'electrisimAnimatePowerFlow';

    var active = {
        raf: null,
        graph: null,
        branches: [],
        svg: null,
        legend: null,
        phaseP: 0,
        phaseQ: 0,
        lastTs: 0,
        visibleHandler: null,
        scrollHandler: null
    };

    function savePref(on) {
        try {
            localStorage.setItem(LS_KEY, on ? '1' : '0');
        } catch (_) { /* ignore */ }
    }

    function readPref() {
        try {
            return localStorage.getItem(LS_KEY) === '1';
        } catch (_) {
            return false;
        }
    }

    function clamp01(t) {
        return t < 0 ? 0 : (t > 1 ? 1 : t);
    }

    function scaleMag(val, maxAbs) {
        var v = Math.abs(Number(val));
        var mx = Math.abs(Number(maxAbs));
        if (!isFinite(v) || !isFinite(mx) || mx <= 0) return 0.5;
        return Math.sqrt(clamp01(v / mx));
    }

    function isLineBranch(cell) {
        return Boolean(cell && cell.style && cell.style.indexOf('shapeELXXX=Line') >= 0);
    }

    function isLineVertex(cell) {
        return isLineBranch(cell) && !cell.edge;
    }

    function cellSemanticId(c) {
        if (!c) return '';
        return String(c.mxObjectId || '').replace('#', '_');
    }

    function findBusBySemanticId(model, semanticId) {
        if (!model || !semanticId) return null;
        var root = model.getRoot && model.getRoot();
        if (!root) return null;
        var found = null;
        function visit(cell) {
            if (!cell || found) return;
            if (cellSemanticId(cell) === semanticId) {
                found = cell;
                return;
            }
            var n = cell.getChildCount ? cell.getChildCount() : 0;
            for (var i = 0; i < n; i++) visit(model.getChildAt(cell, i));
        }
        visit(root);
        return found;
    }

    function busCenter(graph, busCell) {
        if (graph && graph.view && busCell) {
            var st = graph.view.getState(busCell);
            if (st) return { x: st.x + st.width / 2, y: st.y + st.height / 2 };
        }
        if (!busCell || !busCell.geometry) return null;
        return {
            x: busCell.geometry.x + (busCell.geometry.width || 0) / 2,
            y: busCell.geometry.y + (busCell.geometry.height || 0) / 2
        };
    }

    function edgePathPoints(graph, edge) {
        var state = graph.view && graph.view.getState(edge);
        if (!state || !state.absolutePoints || state.absolutePoints.length < 2) return null;
        var pts = [];
        for (var i = 0; i < state.absolutePoints.length; i++) {
            var p = state.absolutePoints[i];
            pts.push({ x: p.x, y: p.y });
        }
        return pts;
    }

    function lineVertexPathPoints(graph, branchCell, model, dirInfo) {
        if (!dirInfo) return null;
        var fromCell = findBusBySemanticId(model, dirInfo.flowFromId);
        var toCell = findBusBySemanticId(model, dirInfo.flowToId);
        var a = busCenter(graph, fromCell);
        var b = busCenter(graph, toCell);
        if (a && b) return [a, b];
        var st = graph.view && graph.view.getState(branchCell);
        if (st) {
            return [
                { x: st.x + st.width / 2, y: st.y + st.height / 2 },
                { x: st.x + st.width / 2, y: st.y + st.height / 2 }
            ];
        }
        return null;
    }

    function branchPathPoints(graph, branchCell, model, dirInfo) {
        if (!branchCell || !graph) return null;
        if (branchCell.edge) return edgePathPoints(graph, branchCell);
        if (isLineVertex(branchCell)) return lineVertexPathPoints(graph, branchCell, model, dirInfo);
        var edges = branchCell.edges;
        if (edges && edges.length) {
            var e = edges[0];
            if (e && e.edge) return edgePathPoints(graph, e);
        }
        var st = graph.view && graph.view.getState(branchCell);
        if (st && st.absolutePoints && st.absolutePoints.length >= 2) {
            return edgePathPoints(graph, branchCell);
        }
        return lineVertexPathPoints(graph, branchCell, model, dirInfo);
    }

    function pathLength(pts) {
        var len = 0;
        for (var i = 1; i < pts.length; i++) {
            len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        }
        return len;
    }

    function pointAtDistance(pts, dist) {
        if (!pts || pts.length < 2) return null;
        var total = pathLength(pts);
        if (total <= 0) return { x: pts[0].x, y: pts[0].y, angle: 0 };
        var d = dist % total;
        if (d < 0) d += total;
        var acc = 0;
        for (var i = 1; i < pts.length; i++) {
            var dx = pts[i].x - pts[i - 1].x;
            var dy = pts[i].y - pts[i - 1].y;
            var seg = Math.hypot(dx, dy);
            if (acc + seg >= d || i === pts.length - 1) {
                var t = seg > 0 ? (d - acc) / seg : 0;
                t = Math.max(0, Math.min(1, t));
                return {
                    x: pts[i - 1].x + dx * t,
                    y: pts[i - 1].y + dy * t,
                    angle: Math.atan2(dy, dx)
                };
            }
            acc += seg;
        }
        var last = pts[pts.length - 1];
        var prev = pts[pts.length - 2];
        return {
            x: last.x,
            y: last.y,
            angle: Math.atan2(last.y - prev.y, last.x - prev.x)
        };
    }

    function reversePath(pts) {
        return pts.slice().reverse();
    }

    function resolveCell(graph, row) {
        if (typeof window.buildGraphCellLookupMap !== 'function' ||
            typeof window.resolveGraphCellForResult !== 'function') {
            return null;
        }
        try {
            var map = window.__electrisimLfAnimLookup;
            if (!map) map = window.buildGraphCellLookupMap(graph);
            return window.resolveGraphCellForResult(map, row, graph);
        } catch (_) {
            return null;
        }
    }

    function branchDrawableCell(graph, resultCell) {
        if (!resultCell) return null;
        if (resultCell.edge) return resultCell;
        if (isLineBranch(resultCell)) return resultCell;
        var edges = graph.getEdges && graph.getEdges(resultCell);
        if (edges && edges.length) return edges[0];
        return resultCell;
    }

    function maxAbsFromRows(rows, keys) {
        var max = 0;
        (rows || []).forEach(function (row) {
            keys.forEach(function (k) {
                var v = Math.abs(Number(row[k]));
                if (isFinite(v) && v > max) max = v;
            });
        });
        return max;
    }

    function collectBranchSpecs(graph, dataJson) {
        if (!window.resolveBranchFlowDirection) return [];
        var model = graph.getModel();
        var lines = dataJson.lines || [];
        var trafos = dataJson.transformers || [];
        var switches = dataJson.switches || [];
        var maxP = maxAbsFromRows(lines.concat(trafos).concat(switches), ['p_from_mw', 'p_to_mw', 'p_hv_mw', 'p_lv_mw']);
        var maxQ = maxAbsFromRows(lines.concat(trafos).concat(switches), ['q_from_mvar', 'q_to_mvar', 'q_hv_mvar', 'q_lv_mvar']);

        var specs = [];

        function addRow(row, opts) {
            opts = opts || {};
            var resultCell = resolveCell(graph, row);
            if (!resultCell) return;
            var branchCell = branchDrawableCell(graph, resultCell);
            if (!branchCell) return;

            var pDir = window.resolveBranchFlowDirection(row, branchCell, model, {
                pFromKey: opts.pFromKey || 'p_from_mw',
                pToKey: opts.pToKey || 'p_to_mw',
                getEndpointsFn: opts.getEndpointsFn
            });
            var qDir = window.resolveBranchFlowDirection(row, branchCell, model, {
                pFromKey: opts.qFromKey || 'q_from_mvar',
                pToKey: opts.qToKey || 'q_to_mvar',
                getEndpointsFn: opts.getEndpointsFn
            });

            var pMag = pDir && pDir.hasFlow ? Number(pDir.pMw) : 0;
            var qMag = 0;
            var qKind = 'inductive';
            if (qDir && qDir.hasFlow) {
                var qFrom = Number(row[opts.qFromKey || 'q_from_mvar']);
                var qTo = Number(row[opts.qToKey || 'q_to_mvar']);
                if (!isFinite(qFrom)) qFrom = 0;
                if (!isFinite(qTo)) qTo = 0;
                qMag = Math.abs(qFrom) >= Math.abs(qTo) ? Math.abs(qFrom) : Math.abs(qTo);
                qKind = reactiveKind(qFrom, qTo);
            }

            if (pMag < FLOW_EPS && qMag < FLOW_EPS) return;

            var pathFwd = branchPathPoints(graph, branchCell, model, pDir);
            if (!pathFwd || pathFwd.length < 2) return;

            specs.push({
                branchCell: branchCell,
                pathFwd: pathFwd,
                pDir: pDir,
                qDir: qDir,
                pMag: pMag,
                qMag: qMag,
                qKind: qKind,
                pScale: scaleMag(pMag, maxP),
                qScale: scaleMag(qMag, maxQ),
                pathLen: pathLength(pathFwd)
            });
        }

        lines.forEach(function (row) { addRow(row, {}); });

        trafos.forEach(function (row) {
            addRow(row, {
                pFromKey: 'p_hv_mw',
                pToKey: 'p_lv_mw',
                qFromKey: 'q_hv_mvar',
                qToKey: 'q_lv_mvar'
            });
        });

        switches.forEach(function (row) {
            if (row.closed === false || row.closed === 'false') return;
            addRow(row, {});
        });

        return specs;
    }

    function chevronPolygon(size) {
        var h = size;
        var w = size * 1.35;
        return (w / 2) + ',0 ' + (-w / 2) + ',-' + (h / 2) + ' ' + (-w / 2) + ',' + (h / 2);
    }

    function toClientPoint(graph, x, y) {
        var c = graph.container;
        if (!c) return { x: x, y: y };
        var rect = c.getBoundingClientRect();
        return {
            x: rect.left + x - (c.scrollLeft || 0),
            y: rect.top + y - (c.scrollTop || 0)
        };
    }

    /** +Q balance: branch absorbs reactive power (inductive). −Q: branch supplies it (capacitive). */
    function reactiveKind(qFrom, qTo) {
        var balance = (Number(qFrom) || 0) + (Number(qTo) || 0);
        return balance >= 0 ? 'inductive' : 'capacitive';
    }

    function appendReactiveGlyph(g, kind, size, color) {
        if (kind !== 'inductive' && kind !== 'capacitive') return;
        var back = -(size * 1.35) / 2;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', '1.6');
        path.setAttribute('stroke-linecap', 'round');
        if (kind === 'inductive') {
            var s = Math.max(2.2, size * 0.32);
            var x0 = back - s * 4.2;
            path.setAttribute('d',
                'M ' + x0 + ',0' +
                ' a ' + s + ',' + s + ' 0 1 0 ' + (s * 2) + ',0' +
                ' a ' + s + ',' + s + ' 0 1 0 ' + (s * 2) + ',0');
        } else {
            var h = Math.max(3.2, size * 0.42);
            var x1 = back - size * 0.85;
            var x2 = back - size * 0.35;
            path.setAttribute('d',
                'M ' + x1 + ',' + (-h) + ' L ' + x1 + ',' + h +
                ' M ' + x2 + ',' + (-h) + ' L ' + x2 + ',' + h);
        }
        g.appendChild(path);
    }

    function drawChevron(svg, x, y, angle, color, size, sideOffset, kind) {
        var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        var ox = 0;
        var oy = 0;
        if (sideOffset) {
            ox = Math.cos(angle + Math.PI / 2) * sideOffset;
            oy = Math.sin(angle + Math.PI / 2) * sideOffset;
        }
        g.setAttribute('transform', 'translate(' + (x + ox) + ',' + (y + oy) + ') rotate(' + (angle * 180 / Math.PI) + ')');
        var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('points', chevronPolygon(size));
        poly.setAttribute('fill', color);
        poly.setAttribute('stroke', color);
        poly.setAttribute('stroke-width', '0.5');
        poly.setAttribute('opacity', '0.92');
        g.appendChild(poly);
        appendReactiveGlyph(g, kind, size, color);
        svg.appendChild(g);
    }

    function pathForDirection(pathFwd, dirInfo) {
        if (!dirInfo || !dirInfo.hasFlow) return pathFwd;
        if (dirInfo.reversed) return reversePath(pathFwd);
        return pathFwd;
    }

    function ensureOverlay() {
        var existing = document.getElementById(OVERLAY_ID);
        if (existing && existing.parentNode === document.body) return existing;
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = OVERLAY_ID;
        svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;overflow:hidden;z-index:10000;';
        document.body.appendChild(svg);
        return svg;
    }

    function fitOverlayToDiagram(graph) {
        var svg = active.svg;
        var container = graph && graph.container;
        if (!svg || !container) return { x: 0, y: 0 };
        var rect = container.getBoundingClientRect();
        svg.style.left = rect.left + 'px';
        svg.style.top = rect.top + 'px';
        svg.style.width = Math.max(0, rect.width) + 'px';
        svg.style.height = Math.max(0, rect.height) + 'px';
        return { x: rect.left, y: rect.top };
    }

    function ensureLegendStyles() {
        if (document.getElementById('electrisim-lf-anim-legend-style')) return;
        var style = document.createElement('style');
        style.id = 'electrisim-lf-anim-legend-style';
        style.textContent = [
            '#' + LEGEND_ID + '{position:fixed;z-index:10001;left:20px;bottom:20px;width:340px;',
            'padding:14px 16px 12px;border-radius:14px;background:#fff;color:#1a1d21;',
            'border:1px solid rgba(15,23,42,.08);box-shadow:0 12px 40px rgba(15,23,42,.16);',
            'font:13px/1.35 "Segoe UI",system-ui,sans-serif;pointer-events:auto;}',
            '#' + LEGEND_ID + ' .lf-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;}',
            '#' + LEGEND_ID + ' .lf-close{border:0;background:transparent;color:#64748b;font-size:18px;line-height:1;width:22px;height:22px;border-radius:6px;cursor:pointer;padding:0;}',
            '#' + LEGEND_ID + ' .lf-close:hover{background:#f1f5f9;color:#0f172a;}',
            '#' + LEGEND_ID + ' .lf-title{font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#334155;}',
            '#' + LEGEND_ID + ' .lf-switch{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;font-size:12px;font-weight:600;color:#475569;}',
            '#' + LEGEND_ID + ' .lf-switch input{position:absolute;opacity:0;width:0;height:0;}',
            '#' + LEGEND_ID + ' .lf-knob{width:36px;height:20px;border-radius:999px;background:#cbd5e1;position:relative;transition:background .15s;}',
            '#' + LEGEND_ID + ' .lf-knob:after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .15s;}',
            '#' + LEGEND_ID + ' .lf-switch input:checked + .lf-knob{background:#0f766e;}',
            '#' + LEGEND_ID + ' .lf-switch input:checked + .lf-knob:after{transform:translateX(16px);}',
            '#' + LEGEND_ID + ' .lf-row{display:flex;align-items:center;gap:10px;margin:0 0 8px;}',
            '#' + LEGEND_ID + ' .lf-mark{width:44px;height:22px;flex:0 0 44px;}',
            '#' + LEGEND_ID + ' .lf-name{font-weight:650;font-size:13px;color:#0f172a;}',
            '#' + LEGEND_ID + ' .lf-sub{display:block;font-size:12px;color:#64748b;font-weight:400;}',
            '#' + LEGEND_ID + ' .lf-scale{height:8px;border-radius:99px;margin-top:4px;background:linear-gradient(90deg,#d2322d 0%,#ebb01e 35%,#38c448 50%,#ebb01e 65%,#d2322d 100%);}',
            '#' + LEGEND_ID + ' .lf-note{margin-top:8px;padding-top:8px;border-top:1px solid #e2e8f0;font-size:12px;color:#475569;}'
        ].join('');
        document.head.appendChild(style);
    }

    function chevronMark(color, kind) {
        var tail = '';
        if (kind === 'inductive') {
            tail = '<path d="M2,11 a3,3 0 1 0 6,0 a3,3 0 1 0 6,0" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/>';
        } else if (kind === 'capacitive') {
            tail = '<path d="M6,6 L6,16 M10,6 L10,16" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/>';
        }
        return '<svg class="lf-mark" viewBox="0 0 44 22" aria-hidden="true">' + tail +
            '<polygon points="36,11 18,4 18,18" fill="' + color + '"/></svg>';
    }

    function ensureLegend(animationOn) {
        ensureLegendStyles();
        if (typeof window.hideFlowConventionLegend === 'function') window.hideFlowConventionLegend();
        var el = document.getElementById(LEGEND_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = LEGEND_ID;
            el.innerHTML = [
                '<div class="lf-head"><span class="lf-title">Power flow</span>',
                '<span style="display:flex;align-items:center;gap:8px"><label class="lf-switch"><span>Colour</span><input type="checkbox" class="lf-colour"><span class="lf-knob"></span></label><label class="lf-switch"><span>Animate</span><input type="checkbox" class="lf-animate"><span class="lf-knob"></span></label>',
                '<button type="button" class="lf-close" aria-label="Close">×</button></span></div>',
                '<div class="lf-row">' + chevronMark(COLOR_P) + '<div><span class="lf-name">Active power</span><span class="lf-sub">P · MW · arrow travels with the flow</span></div></div>',
                '<div class="lf-row">' + chevronMark(COLOR_Q, 'inductive') + '<div><span class="lf-name">Inductive Q</span><span class="lf-sub">Coil · line absorbs reactive power</span></div></div>',
                '<div class="lf-row">' + chevronMark(COLOR_Q, 'capacitive') + '<div><span class="lf-name">Capacitive Q</span><span class="lf-sub">Bars · line supplies reactive power</span></div></div>',
                '<div class="lf-scale" aria-hidden="true"></div>',
                '<div class="lf-note">Green is about 1 pu. Yellow and red mark buses further from nominal. Arrows show power flow.</div>'
            ].join('');
            var input = el.querySelector('.lf-animate');
            if (input) {
                input.addEventListener('change', function () {
                    setAnimationRunning(input.checked);
                });
            }
            var colourInput = el.querySelector('.lf-colour');
            if (colourInput) {
                colourInput.checked = typeof window.readSavedColourDiagram === 'function' && window.readSavedColourDiagram();
                colourInput.addEventListener('change', function () {
                    if (typeof window.setLoadFlowDiagramColour === 'function') {
                        window.setLoadFlowDiagramColour(colourInput.checked);
                    }
                });
            }
            var closeBtn = el.querySelector('.lf-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', function () {
                    removeLegend();
                });
            }
            document.body.appendChild(el);
        }
        var box = el.querySelector('.lf-animate');
        if (box) box.checked = !!animationOn;
        var colourBox = el.querySelector('.lf-colour');
        if (colourBox && typeof window.readSavedColourDiagram === 'function') colourBox.checked = window.readSavedColourDiagram();
        return el;
    }

    var arrowClearGen = 0;

    function removeStaticArrows(graph) {
        if (!graph || typeof window.clearFlowArrows !== 'function') return;
        var gen = ++arrowClearGen;
        var n = 0;
        function again() {
            if (gen !== arrowClearGen) return;
            window.clearFlowArrows(graph);
            n += 1;
            if (n < 20) requestAnimationFrame(again);
        }
        again();
    }

    function setAnimationRunning(on) {
        savePref(!!on);
        var box = document.querySelector('#' + LEGEND_ID + ' input');
        if (box) box.checked = !!on;
        if (!on) {
            if (active.raf) cancelAnimationFrame(active.raf);
            active.raf = null;
            removeOverlay();
            active.svg = null;
            removeStaticArrows(active.graph);
            return;
        }
        arrowClearGen += 1;
        if (!active.graph || !active.dataJson) return;
        active.svg = ensureOverlay();
        active.branchCache = null;
        active.lastTs = 0;
        if (!active.raf) active.raf = requestAnimationFrame(paintFrame);
    }

    function removeLegend() {
        var el = document.getElementById(LEGEND_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function removeOverlay() {
        var el = document.getElementById(OVERLAY_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function detachListeners() {
        if (active.visibleHandler) {
            document.removeEventListener('visibilitychange', active.visibleHandler);
            active.visibleHandler = null;
        }
        if (active.scrollHandler && active.graph && active.graph.container) {
            active.graph.container.removeEventListener('scroll', active.scrollHandler);
        }
        active.scrollHandler = null;
    }

    function svgPathNode(graph, cell) {
        var state = graph.view && graph.view.getState(cell);
        if (!state || !state.shape || !state.shape.node) return null;
        var node = state.shape.node;
        if (typeof node.getTotalLength === 'function') return node;
        if (node.querySelector) {
            var path = node.querySelector('path');
            if (path && typeof path.getTotalLength === 'function') return path;
        }
        return null;
    }

    function screenOf(pathNode, ctm, distance) {
        var p = pathNode.getPointAtLength(distance);
        return new DOMPoint(p.x, p.y).matrixTransform(ctm);
    }

    function terminalScreenCenter(graph, cell) {
        if (!graph || !graph.view || !cell) return null;
        var state = graph.view.getState(cell);
        if (!state) return null;
        if (state.shape && state.shape.node && state.shape.node.getBoundingClientRect) {
            var rect = state.shape.node.getBoundingClientRect();
            if (rect.width > 0 || rect.height > 0) {
                return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            }
        }
        return toClientPoint(graph, state.x + state.width / 2, state.y + state.height / 2);
    }

    /** True when path length increases from the edge source toward the target. */
    function pathRunsSourceToTarget(graph, cell, pathNode) {
        if (!cell || !cell.source || !cell.target || !pathNode) return true;
        var src = terminalScreenCenter(graph, cell.source);
        var tgt = terminalScreenCenter(graph, cell.target);
        var ctm = pathNode.getScreenCTM();
        if (!src || !tgt || !ctm || typeof DOMPoint === 'undefined') return true;
        var len = pathNode.getTotalLength();
        if (!(len > 1)) return true;
        var a = screenOf(pathNode, ctm, 0);
        var b = screenOf(pathNode, ctm, len);
        var withFlow = Math.hypot(a.x - src.x, a.y - src.y) + Math.hypot(b.x - tgt.x, b.y - tgt.y);
        var against = Math.hypot(a.x - tgt.x, a.y - tgt.y) + Math.hypot(b.x - src.x, b.y - src.y);
        return withFlow <= against;
    }

    function screenPointOnPath(pathNode, fraction, motionSign) {
        var len = pathNode.getTotalLength();
        if (!(len > 1)) return null;
        var f = ((fraction % 1) + 1) % 1;
        var d = f * len;
        var step = (motionSign < 0 ? -1 : 1) * Math.min(10, Math.max(4, len * 0.015));
        var d2 = d + step;
        if (d2 < 0) d2 += len;
        if (d2 > len) d2 -= len;
        var ctm = pathNode.getScreenCTM();
        if (!ctm || typeof DOMPoint === 'undefined') return null;
        var s1 = screenOf(pathNode, ctm, d);
        var s2 = screenOf(pathNode, ctm, d2);
        return {
            x: s1.x,
            y: s1.y,
            angle: Math.atan2(s2.y - s1.y, s2.x - s1.x),
            len: len
        };
    }

    function paintFrame(ts) {
        if (!active.graph || !active.svg) {
            active.raf = null;
            return;
        }
        var graph = active.graph;
        if (graph.getModel && !graph.getModel().cells) {
            stopLoadFlowPowerAnimation();
            return;
        }

        if (document.hidden) {
            active.lastTs = ts;
            active.raf = requestAnimationFrame(paintFrame);
            return;
        }

        var dt = active.lastTs ? Math.min(48, ts - active.lastTs) : 16;
        active.lastTs = ts;
        active.phaseP += dt * 0.00028;
        active.phaseQ += dt * 0.00024;

        try {
            var origin = fitOverlayToDiagram(graph);
            while (active.svg.firstChild) active.svg.removeChild(active.svg.firstChild);

            var model = graph.getModel();
            if (!active.branchCache || !active.branchCache.length) {
                active.branchCache = collectBranchSpecs(graph, active.dataJson || {});
            }

            active.branchCache.forEach(function (spec) {
                if (!model.contains(spec.branchCell)) return;
                var pathNode = svgPathNode(graph, spec.branchCell);
                var pathLen = pathNode ? pathNode.getTotalLength() : 0;
                if (pathNode && spec.pathForward == null) {
                    spec.pathForward = pathRunsSourceToTarget(graph, spec.branchCell, pathNode);
                }

                function drawFlow(mag, scale, color, phase, reversed, side, kind) {
                    if (mag < FLOW_EPS) return;
                    var count = 3;
                    var speed = 0.12 + scale * 0.16;
                    var travel = ((phase * speed) % 1 + 1) % 1;
                    var i;
                    if (pathNode && pathLen > 8) {
                        var moveWithPath = (!reversed) === (spec.pathForward !== false);
                        count = Math.max(2, Math.min(5, Math.floor(pathLen / 80)));
                        var size = 7 + scale * 7;
                        for (i = 0; i < count; i++) {
                            var frac = (travel + i / count) % 1;
                            if (!moveWithPath) frac = 1 - frac;
                            var sp = screenPointOnPath(pathNode, frac, moveWithPath ? 1 : -1);
                            if (sp) drawChevron(active.svg, sp.x - origin.x, sp.y - origin.y, sp.angle, color, size, side, kind);
                        }
                        return;
                    }
                    var fresh = branchPathPoints(graph, spec.branchCell, model, spec.pDir);
                    if (!fresh || fresh.length < 2) fresh = spec.pathFwd;
                    if (!fresh || fresh.length < 2) return;
                    var poly = reversed ? reversePath(fresh) : fresh;
                    var len = pathLength(poly);
                    if (len <= 8) return;
                    count = Math.max(2, Math.min(5, Math.floor(len / 70)));
                    for (i = 0; i < count; i++) {
                        var pt = pointAtDistance(poly, ((travel + i / count) % 1) * len);
                        if (!pt) continue;
                        var pc = toClientPoint(graph, pt.x, pt.y);
                        drawChevron(active.svg, pc.x - origin.x, pc.y - origin.y, pt.angle, color, 7 + scale * 7, side, kind);
                    }
                }

                drawFlow(spec.pMag, spec.pScale, COLOR_P, active.phaseP, !!(spec.pDir && spec.pDir.reversed), -7);
                drawFlow(spec.qMag, spec.qScale, COLOR_Q, active.phaseQ, !!(spec.qDir && spec.qDir.reversed), 7, spec.qKind);
            });
        } catch (err) {
            console.warn('Load flow animation frame skipped:', err);
        }

        active.raf = requestAnimationFrame(paintFrame);
    }

    function stopLoadFlowPowerAnimation() {
        if (active.raf) {
            cancelAnimationFrame(active.raf);
            active.raf = null;
        }
        detachListeners();
        removeOverlay();
        removeLegend();
        active.graph = null;
        active.branches = [];
        active.branchCache = null;
        active.dataJson = null;
        active.svg = null;
        try {
            delete window.__electrisimLfAnimLookup;
        } catch (_) {
            window.__electrisimLfAnimLookup = null;
        }
    }

    function startLoadFlowPowerAnimation(graph, resultJson, animate) {
        if (!graph || !resultJson) return;
        stopLoadFlowPowerAnimation();
        var run = animate === undefined ? readPref() : !!animate;

        if (typeof window.buildGraphCellLookupMap === 'function') {
            try {
                window.__electrisimLfAnimLookup = window.buildGraphCellLookupMap(graph);
            } catch (_) { /* ignore */ }
        }

        active.graph = graph;
        active.dataJson = resultJson;
        active.phaseP = 0;
        active.phaseQ = 0;
        active.lastTs = 0;
        active.branchCache = null;
        ensureLegend(run);
        savePref(run);

        active.visibleHandler = function () { /* next frame handles pause */ };
        document.addEventListener('visibilitychange', active.visibleHandler);

        active.scrollHandler = function () { /* paths refreshed each frame */ };
        if (graph.container) {
            graph.container.addEventListener('scroll', active.scrollHandler, { passive: true });
        }

        if (run) setAnimationRunning(true);
        else removeStaticArrows(graph);
    }

    window.startLoadFlowPowerAnimation = startLoadFlowPowerAnimation;
    window.stopLoadFlowPowerAnimation = stopLoadFlowPowerAnimation;
    window.readSavedAnimatePowerFlow = readPref;
})();
