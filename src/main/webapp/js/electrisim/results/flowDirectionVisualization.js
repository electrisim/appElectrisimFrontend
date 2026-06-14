/**
 * Active-power (P) flow direction overlays and clearer result labels for load-flow results.
 * Pandapower convention: positive terminal P/Q = leaving that bus into the branch.
 */
(function () {
    'use strict';

    if (typeof window === 'undefined') return;

    var FLOW_EPSILON = 1e-6;
    var ARROW_COLOR = '#1565C0';
    var FLOW_ARROW_TAG = 'shapeELXXX=FlowArrow';
    var LEGEND_ID = 'electrisim-flow-convention-legend';
    var LEGEND_STYLE_ID = 'electrisim-flow-convention-legend-style';

    // Arrow long-axis length range (px). Scaled by P magnitude relative to the
    // largest line flow in the network so big flows render as bigger arrows.
    var ARROW_MIN_LEN = 12;
    var ARROW_MAX_LEN = 30;
    var ARROW_THICK_RATIO = 0.82;
    // Line result boxes sit near the midpoint (relative position ~0.5 on the branch).
    var RESULT_BOX_LINE_FRACTION = 0.5;
    var ARROW_FRACTION_CANDIDATES = [0.28, 0.72, 0.2, 0.8];
    var ARROW_BOX_PAD = 10;

    function clamp01(t) {
        return t < 0 ? 0 : (t > 1 ? 1 : t);
    }

    function toHex2(v) {
        var s = Math.max(0, Math.min(255, Math.round(v))).toString(16);
        return s.length < 2 ? '0' + s : s;
    }

    function rgbHex(r, g, b) {
        return '#' + toHex2(r) + toHex2(g) + toHex2(b);
    }

    /**
     * Smooth loading→color gradient (green → amber → orange → red), shared by the
     * line stroke and its flow arrow so both convey thermal loading consistently.
     */
    function loadingToColor(loadingPercent) {
        var p = Number(loadingPercent);
        if (isNaN(p)) return ARROW_COLOR;
        var stops = [
            [0, [46, 125, 50]],
            [60, [249, 168, 37]],
            [85, [239, 108, 0]],
            [100, [198, 40, 40]]
        ];
        if (p <= stops[0][0]) return rgbHex(stops[0][1][0], stops[0][1][1], stops[0][1][2]);
        var last = stops[stops.length - 1];
        if (p >= last[0]) return rgbHex(last[1][0], last[1][1], last[1][2]);
        for (var i = 1; i < stops.length; i++) {
            if (p <= stops[i][0]) {
                var lo = stops[i - 1];
                var hi = stops[i];
                var t = (p - lo[0]) / (hi[0] - lo[0]);
                return rgbHex(
                    lo[1][0] + (hi[1][0] - lo[1][0]) * t,
                    lo[1][1] + (hi[1][1] - lo[1][1]) * t,
                    lo[1][2] + (hi[1][2] - lo[1][2]) * t
                );
            }
        }
        return rgbHex(last[1][0], last[1][1], last[1][2]);
    }

    /** Perceptual 0..1 scale from |P| relative to the network's largest flow. */
    function arrowScaleFromPower(pMw, maxAbsP) {
        var p = Math.abs(Number(pMw));
        var mx = Math.abs(Number(maxAbsP));
        if (!isFinite(p) || !isFinite(mx) || mx <= 0) return 0.5;
        return Math.sqrt(clamp01(p / mx));
    }

    function arrowLongLength(scale) {
        var s = typeof scale === 'number' ? clamp01(scale) : 0.5;
        return ARROW_MIN_LEN + (ARROW_MAX_LEN - ARROW_MIN_LEN) * s;
    }

    function cellSemanticId(c) {
        if (!c) return '';
        return String(c.mxObjectId || '').replace('#', '_');
    }

    function formatNum(num, decimals) {
        decimals = decimals === undefined ? 3 : decimals;
        if (num === null || num === undefined || num === 'NaN' || (typeof num === 'number' && isNaN(num))) {
            return 'N/A';
        }
        return parseFloat(num).toFixed(decimals);
    }

    function getAttr(cell, name) {
        var attrs = cell && cell.value && cell.value.attributes;
        if (!attrs) return null;
        for (var i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === name) return attrs[i].nodeValue;
        }
        return null;
    }

    function busDisplayName(busCell, semanticId) {
        if (busCell) {
            var n = getAttr(busCell, 'name');
            if (n) return n;
        }
        if (semanticId) {
            return String(semanticId).replace(/^mxCell_/, '').replace(/_/g, '#');
        }
        return '?';
    }

    function isFlowArrowCell(cell) {
        return Boolean(cell && cell.style && cell.style.indexOf(FLOW_ARROW_TAG) >= 0);
    }

    var LEGEND_DISMISS_KEY = 'electrisimFlowConventionLegendDismissed';

    function isFlowLegendDismissed() {
        try {
            return String(localStorage.getItem(LEGEND_DISMISS_KEY) || '') === '1';
        } catch (_) {
            return false;
        }
    }

    function dismissFlowLegendPermanently() {
        try {
            localStorage.setItem(LEGEND_DISMISS_KEY, '1');
        } catch (_) {
            /* ignore */
        }
        hideFlowConventionLegend();
    }

    function isLineBranchCell(cell) {
        if (!cell || !cell.style) return false;
        return cell.style.indexOf('shapeELXXX=Line') >= 0;
    }

    function isLineGraphVertex(cell) {
        return isLineBranchCell(cell) && !cell.edge;
    }

    function edgesOfVertex(cell, model) {
        if (!cell || !model) return [];
        if (cell.edges && cell.edges.length) return cell.edges.slice();
        var out = [];
        var all = model.cells || {};
        for (var id in all) {
            if (!Object.prototype.hasOwnProperty.call(all, id)) continue;
            var e = all[id];
            if (e && e.edge && (e.source === cell || e.target === cell)) out.push(e);
        }
        return out;
    }

    function findBusCellBySemanticId(model, semanticId) {
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

    /**
     * Fallback endpoint resolver when loadFlow.getLineBusEndpointsForPayload is unavailable.
     */
    function defaultLineEndpoints(cell, model) {
        if (cell.source && cell.target) {
            return {
                busFrom: cellSemanticId(cell.source),
                busTo: cellSemanticId(cell.target)
            };
        }
        var edges = edgesOfVertex(cell, model);
        if (edges.length >= 2) {
            var o0 = edges[0].source === cell ? edges[0].target : edges[0].source;
            var o1 = edges[1].source === cell ? edges[1].target : edges[1].source;
            return { busFrom: cellSemanticId(o0), busTo: cellSemanticId(o1) };
        }
        return {
            busFrom: cellSemanticId(cell.source),
            busTo: cellSemanticId(cell.target)
        };
    }

    function resolveGraphSideIds(branchCell, model, getEndpointsFn) {
        var resolver = getEndpointsFn || defaultLineEndpoints;
        var ends = resolver(branchCell, model) || {};
        var busFrom = ends.busFrom || '';
        var busTo = ends.busTo || '';

        var sideA = null;
        var sideB = null;

        if (branchCell.source && branchCell.target) {
            sideA = cellSemanticId(branchCell.source);
            sideB = cellSemanticId(branchCell.target);
        } else if (isLineGraphVertex(branchCell)) {
            var edges = edgesOfVertex(branchCell, model);
            if (edges.length >= 2) {
                var p0 = edges[0].source === branchCell ? edges[0].target : edges[0].source;
                var p1 = edges[1].source === branchCell ? edges[1].target : edges[1].source;
                sideA = cellSemanticId(p0);
                sideB = cellSemanticId(p1);
            }
        }

        return { busFrom: busFrom, busTo: busTo, sideA: sideA, sideB: sideB };
    }

    /**
     * Determine active-power flow direction from pandapower terminal results.
     * @returns {{ hasFlow, flowFromId, flowToId, pMw, arrowAtTarget, fromName, toName, nearZero }}
     */
    function resolveBranchFlowDirection(resultRow, branchCell, model, options) {
        options = options || {};
        var pFromKey = options.pFromKey || 'p_from_mw';
        var pToKey = options.pToKey || 'p_to_mw';
        var getEndpointsFn = options.getEndpointsFn;

        var sides = resolveGraphSideIds(branchCell, model, getEndpointsFn);
        var busFrom = sides.busFrom;
        var busTo = sides.busTo;

        var pFrom = Number(resultRow[pFromKey]);
        var pTo = Number(resultRow[pToKey]);
        if (!Number.isFinite(pFrom)) pFrom = 0;
        if (!Number.isFinite(pTo)) pTo = 0;

        var pMw = Math.abs(pFrom) >= Math.abs(pTo) ? Math.abs(pFrom) : Math.abs(pTo);
        var nearZero = pMw < FLOW_EPSILON;

        var flowFromId = busFrom;
        var flowToId = busTo;

        if (!nearZero) {
            if (Math.abs(pFrom) >= Math.abs(pTo)) {
                if (pFrom >= 0) {
                    flowFromId = busFrom;
                    flowToId = busTo;
                } else {
                    flowFromId = busTo;
                    flowToId = busFrom;
                }
            } else if (pTo >= 0) {
                flowFromId = busTo;
                flowToId = busFrom;
            } else {
                flowFromId = busFrom;
                flowToId = busTo;
            }
        }

        var fromBusCell = findBusCellBySemanticId(model, flowFromId);
        var toBusCell = findBusCellBySemanticId(model, flowToId);
        var fromName = busDisplayName(fromBusCell, flowFromId);
        var toName = busDisplayName(toBusCell, flowToId);

        var arrowAtTarget = true;
        if (branchCell.source && branchCell.target) {
            var srcId = cellSemanticId(branchCell.source);
            var tgtId = cellSemanticId(branchCell.target);
            if (flowFromId === srcId && flowToId === tgtId) {
                arrowAtTarget = true;
            } else if (flowFromId === tgtId && flowToId === srcId) {
                arrowAtTarget = false;
            } else if (sides.sideA && sides.sideB) {
                if (flowFromId === sides.sideA && flowToId === sides.sideB) {
                    arrowAtTarget = (srcId === sides.sideA);
                } else if (flowFromId === sides.sideB && flowToId === sides.sideA) {
                    arrowAtTarget = (srcId === sides.sideB);
                }
            }
        } else if (isLineGraphVertex(branchCell)) {
            arrowAtTarget = null;
        }

        return {
            hasFlow: !nearZero,
            nearZero: nearZero,
            flowFromId: flowFromId,
            flowToId: flowToId,
            fromName: fromName,
            toName: toName,
            pMw: pMw,
            arrowAtTarget: arrowAtTarget,
            pFrom: pFrom,
            pTo: pTo,
            // True when flow direction is opposite to the branch's stored from/to orientation,
            // i.e. fromName refers to the result row's *_to_* terminal and toName to *_from_*.
            reversed: !nearZero && flowFromId === busTo && busFrom !== busTo
        };
    }

    function restoreBaseStyles(model) {
        var cells = model.cells || {};
        for (var id in cells) {
            if (!Object.prototype.hasOwnProperty.call(cells, id)) continue;
            var cell = cells[id];
            if (!cell || cell.edge === false && !cell.style) continue;
            var style = model.getStyle(cell) || '';
            var idx = style.indexOf('electrisimFlowBase=');
            if (idx < 0) continue;
            var encoded = style.substring(idx + 'electrisimFlowBase='.length).split(';')[0];
            try {
                var base = decodeURIComponent(encoded);
                model.setStyle(cell, base);
            } catch (_) {
                model.setStyle(cell, style.replace(/;?electrisimFlowBase=[^;]*/g, ''));
            }
        }
    }

    function removeFlowArrowChildren(graph) {
        var model = graph.getModel();
        var toRemove = [];
        var cells = model.cells || {};
        for (var id in cells) {
            if (!Object.prototype.hasOwnProperty.call(cells, id)) continue;
            var cell = cells[id];
            if (isFlowArrowCell(cell)) toRemove.push(cell);
        }
        if (toRemove.length) {
            model.beginUpdate();
            try {
                for (var i = 0; i < toRemove.length; i++) {
                    model.remove(toRemove[i]);
                }
            } finally {
                model.endUpdate();
            }
        }
    }

    function clearFlowArrows(graph) {
        if (!graph || !graph.getModel) return;
        var model = graph.getModel();
        model.beginUpdate();
        try {
            removeFlowArrowChildren(graph);
            restoreBaseStyles(model);
        } finally {
            model.endUpdate();
        }
        hideFlowConventionLegend();
    }

    function cardinalFromDelta(dx, dy) {
        if (Math.abs(dx) >= Math.abs(dy)) {
            return dx >= 0 ? 'east' : 'west';
        }
        return dy >= 0 ? 'south' : 'north';
    }

    function flipCardinal(cardinal) {
        if (cardinal === 'north') return 'south';
        if (cardinal === 'south') return 'north';
        if (cardinal === 'east') return 'west';
        if (cardinal === 'west') return 'east';
        return cardinal;
    }

    function flowMatchesSegmentForward(branchCell, directionInfo) {
        if (!branchCell || !branchCell.source || !branchCell.target) return true;
        var srcId = cellSemanticId(branchCell.source);
        var tgtId = cellSemanticId(branchCell.target);
        return directionInfo.flowFromId === srcId && directionInfo.flowToId === tgtId;
    }

    function appearanceFromCardinal(cardinal, scale, color) {
        var len = arrowLongLength(scale);
        var thick = len * ARROW_THICK_RATIO;
        var horizontal = (cardinal === 'east' || cardinal === 'west');
        return {
            cardinal: cardinal,
            w: horizontal ? len : thick,
            h: horizontal ? thick : len,
            color: color || ARROW_COLOR
        };
    }

    function cardinalFromBusFlow(graph, model, directionInfo) {
        var fromCell = findBusCellBySemanticId(model, directionInfo.flowFromId);
        var toCell = findBusCellBySemanticId(model, directionInfo.flowToId);
        var a = busCenterForRotation(graph, fromCell);
        var b = busCenterForRotation(graph, toCell);
        if (a && b) {
            return cardinalFromDelta(b.x - a.x, b.y - a.y);
        }
        return 'east';
    }

    /**
     * Use mxGraph triangle direction (north/south/east/west) from bus positions in view space.
     * Do not use rotation on edge children — it is applied in the edge label frame and points sideways.
     */
    function flowArrowAppearance(graph, branchCell, model, directionInfo, arrowOpts) {
        arrowOpts = arrowOpts || {};
        var cardinal = cardinalFromBusFlow(graph, model, directionInfo);
        if (branchCell && branchCell.edge) {
            var segAnchor = branchAnchorAt(graph, branchCell, 0.45, directionInfo, model);
            if (segAnchor && (Math.abs(segAnchor.dx) > 1e-3 || Math.abs(segAnchor.dy) > 1e-3)) {
                cardinal = cardinalFromDelta(segAnchor.dx, segAnchor.dy);
                if (!flowMatchesSegmentForward(branchCell, directionInfo)) {
                    cardinal = flipCardinal(cardinal);
                }
            }
        }
        var pForScale = (arrowOpts.pMw !== undefined && arrowOpts.pMw !== null)
            ? arrowOpts.pMw
            : directionInfo.pMw;
        var scale = arrowScaleFromPower(pForScale, arrowOpts.maxAbsP);
        var color = (arrowOpts.loadingPercent !== undefined && arrowOpts.loadingPercent !== null)
            ? loadingToColor(arrowOpts.loadingPercent)
            : ARROW_COLOR;
        return appearanceFromCardinal(cardinal, scale, color);
    }

    function getFlowBranchKey(branchCell) {
        return String(branchCell.id || branchCell.mxObjectId || '');
    }

    function findFlowArrowForBranch(model, branchCell) {
        var key = getFlowBranchKey(branchCell);
        if (!key) return null;
        var cells = model.cells || {};
        for (var id in cells) {
            if (!Object.prototype.hasOwnProperty.call(cells, id)) continue;
            var c = cells[id];
            if (!isFlowArrowCell(c)) continue;
            var st = c.style || '';
            if (st.indexOf('flowBranch=' + key) >= 0) return c;
            if (model.getParent(c) === branchCell) return c;
        }
        return null;
    }

    function viewToModelPoint(graph, viewX, viewY) {
        var scale = graph.view.scale || 1;
        var tr = graph.view.translate || { x: 0, y: 0 };
        return {
            x: viewX / scale - tr.x,
            y: viewY / scale - tr.y
        };
    }

    /** Anchor on a line-as-vertex (view coordinates when state is available). */
    function lineVertexAnchorAt(graph, branchCell, fraction) {
        var state = graph.view && graph.view.getState(branchCell);
        var vertical = lineVertexIsVertical(branchCell);
        if (state) {
            if (vertical) {
                return {
                    x: state.x + state.width / 2,
                    y: state.y + state.height * fraction,
                    dx: 0,
                    dy: state.height || 1,
                    inView: true
                };
            }
            return {
                x: state.x + state.width * fraction,
                y: state.y + state.height / 2,
                dx: state.width || 1,
                dy: 0,
                inView: true
            };
        }
        var geo = branchCell.geometry;
        if (!geo) return null;
        if (vertical) {
            return {
                x: geo.x + (geo.width || 0) / 2,
                y: geo.y + (geo.height || 0) * fraction,
                dx: 0,
                dy: geo.height || 1,
                inView: false
            };
        }
        return {
            x: geo.x + (geo.width || 0) * fraction,
            y: geo.y + (geo.height || 0) / 2,
            dx: geo.width || 1,
            dy: 0,
            inView: false
        };
    }

    function branchAnchorAt(graph, branchCell, fraction, directionInfo, model) {
        if (branchCell.edge) {
            var edgePt = edgeAnchorAt(graph, branchCell, fraction);
            if (edgePt) edgePt.inView = true;
            return edgePt;
        }
        if (isLineGraphVertex(branchCell) && directionInfo && model) {
            var fromCell = findBusCellBySemanticId(model, directionInfo.flowFromId);
            var toCell = findBusCellBySemanticId(model, directionInfo.flowToId);
            var a = busCenterForRotation(graph, fromCell);
            var b = busCenterForRotation(graph, toCell);
            if (a && b) {
                var usedView = !!(graph.view && fromCell && graph.view.getState(fromCell));
                return {
                    x: a.x + (b.x - a.x) * fraction,
                    y: a.y + (b.y - a.y) * fraction,
                    dx: b.x - a.x,
                    dy: b.y - a.y,
                    inView: usedView
                };
            }
        }
        if (isLineGraphVertex(branchCell)) {
            return lineVertexAnchorAt(graph, branchCell, fraction);
        }
        return null;
    }

    function isResultPlaceholderCell(cell) {
        if (!cell || !cell.style) return false;
        var st = cell.style;
        return st.indexOf('shapeELXXX=Result') >= 0 ||
            st.indexOf('shapeELXXX=ResultBus') >= 0 ||
            st.indexOf('shapeELXXX=ResultExternalGrid') >= 0;
    }

    function findLineResultPlaceholder(graph, branchCell) {
        if (!graph || !branchCell) return null;
        if (typeof window !== 'undefined' && typeof window.findResultPlaceholder === 'function') {
            var ph = window.findResultPlaceholder(graph, branchCell);
            if (ph) return ph;
        }
        var model = graph.getModel();
        if (!model) return null;
        var n = model.getChildCount(branchCell);
        for (var i = 0; i < n; i++) {
            var ch = model.getChildAt(branchCell, i);
            if (isResultPlaceholderCell(ch)) return ch;
        }
        return null;
    }

    function viewBoundsOfCell(graph, cell) {
        if (!graph || !graph.view || !cell) return null;
        var st = graph.view.getState(cell);
        if (!st) return null;
        return {
            x: st.x,
            y: st.y,
            width: st.width,
            height: st.height
        };
    }

    function rectsOverlap(a, b, pad) {
        pad = pad || 0;
        return !(
            a.x + a.width + pad < b.x - pad ||
            b.x + b.width + pad < a.x - pad ||
            a.y + a.height + pad < b.y - pad ||
            b.y + b.height + pad < a.y - pad
        );
    }

    function arrowRectAtAnchor(anchor, w, h) {
        return {
            x: anchor.x - w / 2,
            y: anchor.y - h / 2,
            width: w,
            height: h
        };
    }

    /**
     * Pick a point along the branch away from the mid-line result box (fraction ~0.5).
     */
    function resolveArrowAnchor(graph, branchCell, model, directionInfo, arrowW, arrowH) {
        var placeholder = findLineResultPlaceholder(graph, branchCell);
        var boxBounds = viewBoundsOfCell(graph, placeholder);
        var useView = !!(graph.view && branchCell && graph.view.getState(branchCell));

        var i;
        var anchor;
        for (i = 0; i < ARROW_FRACTION_CANDIDATES.length; i++) {
            anchor = branchAnchorAt(graph, branchCell, ARROW_FRACTION_CANDIDATES[i], directionInfo, model);
            if (!anchor) continue;
            if (!boxBounds) return anchor;
            if (!anchor.inView && !useView) return anchor;
            if (!rectsOverlap(arrowRectAtAnchor(anchor, arrowW, arrowH), boxBounds, ARROW_BOX_PAD)) {
                return anchor;
            }
        }

        anchor = branchAnchorAt(graph, branchCell, ARROW_FRACTION_CANDIDATES[0], directionInfo, model);
        if (anchor && boxBounds && anchor.inView) {
            var mid = branchAnchorAt(graph, branchCell, RESULT_BOX_LINE_FRACTION, directionInfo, model);
            if (mid) {
                var bx = boxBounds.x + boxBounds.width / 2;
                var by = boxBounds.y + boxBounds.height / 2;
                var awayX = mid.x - bx;
                var awayY = mid.y - by;
                var awayLen = Math.hypot(awayX, awayY);
                if (awayLen > 1e-3) {
                    var push = Math.max(14, Math.min(arrowW, arrowH) * 0.35);
                    anchor.x += (awayX / awayLen) * push;
                    anchor.y += (awayY / awayLen) * push;
                }
            }
        }
        return anchor;
    }

    function sendFlowArrowToBack(graph, arrowCell) {
        if (!graph || !arrowCell || typeof graph.orderCells !== 'function') return;
        try {
            graph.orderCells(false, [arrowCell]);
        } catch (_) {
            /* ignore */
        }
    }

    function anchorToModelPoint(graph, anchor) {
        if (anchor.inView) {
            return viewToModelPoint(graph, anchor.x, anchor.y);
        }
        return { x: anchor.x, y: anchor.y };
    }

    /** Point and segment tangent on an edge path (view coordinates). */
    function edgeAnchorAt(graph, edge, fraction) {
        var state = graph.view.getState(edge);
        if (!state || !state.absolutePoints || state.absolutePoints.length < 2) return null;
        var pts = state.absolutePoints;
        var total = 0;
        var segs = [];
        for (var i = 1; i < pts.length; i++) {
            var dx = pts[i].x - pts[i - 1].x;
            var dy = pts[i].y - pts[i - 1].y;
            var len = Math.hypot(dx, dy);
            segs.push({ len: len, dx: dx, dy: dy, x0: pts[i - 1].x, y0: pts[i - 1].y });
            total += len;
        }
        if (total <= 0) return null;
        var target = total * fraction;
        var acc = 0;
        for (var j = 0; j < segs.length; j++) {
            var seg = segs[j];
            if (acc + seg.len >= target || j === segs.length - 1) {
                var segT = seg.len > 0 ? (target - acc) / seg.len : 0;
                segT = Math.max(0, Math.min(1, segT));
                return {
                    x: seg.x0 + seg.dx * segT,
                    y: seg.y0 + seg.dy * segT,
                    dx: seg.dx,
                    dy: seg.dy
                };
            }
            acc += seg.len;
        }
        return null;
    }

    function triangleStyle(cardinal, branchKey, color) {
        var c = color || ARROW_COLOR;
        return [
            FLOW_ARROW_TAG,
            'shape=triangle',
            'direction=' + (cardinal || 'east'),
            'fillColor=' + c,
            'strokeColor=' + c,
            'strokeWidth=1',
            'perimeter=none',
            'pointerEvents=0',
            'opacity=92',
            'flowBranch=' + branchKey
        ].join(';');
    }

    function lineVertexIsVertical(branchCell) {
        return Boolean(branchCell.style && branchCell.style.indexOf('direction=north') >= 0);
    }

    function busCenterForRotation(graph, busCell) {
        if (graph && graph.view && busCell) {
            var st = graph.view.getState(busCell);
            if (st) {
                return { x: st.x + st.width / 2, y: st.y + st.height / 2 };
            }
        }
        if (!busCell || !busCell.geometry) return null;
        return {
            x: busCell.geometry.x + (busCell.geometry.width || 0) / 2,
            y: busCell.geometry.y + (busCell.geometry.height || 0) / 2
        };
    }

    function upsertFlowArrowOverlay(graph, branchCell, directionInfo, arrowOpts) {
        var model = graph.getModel();
        var branchKey = getFlowBranchKey(branchCell);
        var existing = findFlowArrowForBranch(model, branchCell);
        var appearance = flowArrowAppearance(graph, branchCell, model, directionInfo, arrowOpts);
        var style = triangleStyle(appearance.cardinal, branchKey, appearance.color);
        var w = appearance.w;
        var h = appearance.h;
        var anchor = resolveArrowAnchor(graph, branchCell, model, directionInfo, w, h);
        if (!anchor) return false;

        var mp = anchorToModelPoint(graph, anchor);
        var x = mp.x - w / 2;
        var y = mp.y - h / 2;
        var layer = graph.getDefaultParent();
        var arrowCell = existing;

        model.beginUpdate();
        try {
            if (existing && model.getParent(existing) !== layer) {
                model.remove(existing);
                existing = null;
                arrowCell = null;
            }

            if (existing) {
                model.setStyle(existing, style);
                var geoE = model.getGeometry(existing);
                if (geoE) {
                    geoE.x = x;
                    geoE.y = y;
                    geoE.width = w;
                    geoE.height = h;
                    geoE.relative = false;
                    geoE.offset = null;
                    model.setGeometry(existing, geoE);
                }
            } else {
                arrowCell = graph.insertVertex(layer, null, '', x, y, w, h, style, false);
            }
        } finally {
            model.endUpdate();
        }

        if (arrowCell) {
            sendFlowArrowToBack(graph, arrowCell);
        }
        return !!arrowCell;
    }

    function applyActivePowerArrow(graph, branchCell, directionInfo, arrowOpts) {
        if (!graph || !branchCell || !directionInfo || !directionInfo.hasFlow) return;
        if (!isLineBranchCell(branchCell)) return;

        var attempts = 0;
        function paint() {
            if (!graph.getModel().contains(branchCell)) return;
            if (graph.view && typeof graph.view.validate === 'function') {
                graph.view.validate();
            }
            if (upsertFlowArrowOverlay(graph, branchCell, directionInfo, arrowOpts)) return;
            if (attempts < 10) {
                attempts += 1;
                if (typeof requestAnimationFrame !== 'undefined') {
                    requestAnimationFrame(paint);
                } else {
                    setTimeout(paint, 32);
                }
            }
        }
        if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(paint);
        } else {
            setTimeout(paint, 0);
        }
    }

    function formatBranchTerminalQ(qMvar) {
        var qn = Number(qMvar);
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0';
        if (qn > 0) {
            return 'Q=' + formatNum(qn) + ' MVar out of bus (inductive draw)';
        }
        return 'Q=' + formatNum(qn) + ' MVar into bus (capacitive supply)';
    }

    /** Net nodal bus Q (elements + branch terminals): + = absorbed/inductive, − = supplied/capacitive. */
    function formatBusNetReactiveQ(qMvar) {
        var qn = Number(qMvar);
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0 (unity PF)';
        if (qn > 0) {
            return 'Q=' + formatNum(qn) + ' MVar (inductive, absorbed)';
        }
        return 'Q=' + formatNum(qn) + ' MVar (capacitive, supplied)';
    }

    /** Element Q for loads/shunts: pandapower positive load Q = inductive. */
    function formatElementReactiveQ(qMvar, elementKind) {
        var qn = Number(qMvar);
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0';
        elementKind = elementKind || 'load';
        if (elementKind === 'shunt' || elementKind === 'capacitor') {
            if (qn < 0) return 'Q=' + formatNum(qn) + ' MVar (capacitive, supplied)';
            return 'Q=' + formatNum(qn) + ' MVar (inductive setting)';
        }
        if (elementKind === 'externalgrid' || elementKind === 'generator') {
            if (qn < 0) return 'Q=' + formatNum(qn) + ' MVar (inductive, supplied to network)';
            if (qn > 0) return 'Q=' + formatNum(qn) + ' MVar (capacitive, absorbed from network)';
            return 'Q≈0 (unity PF)';
        }
        if (qn > 0) return 'Q=' + formatNum(qn) + ' MVar (inductive, consumed)';
        return 'Q=' + formatNum(qn) + ' MVar (capacitive, generated)';
    }

    /** External grid / source Q with optional unit label (e.g. kVar for 1ph OpenDSS). */
    function formatExternalGridReactiveQ(qMvar, unit) {
        var qn = Number(qMvar);
        unit = unit || 'MVar';
        if (!Number.isFinite(qn)) return 'Q=N/A';
        if (Math.abs(qn) < FLOW_EPSILON) return 'Q≈0 (unity PF)';
        if (qn < 0) {
            return 'Q=' + formatNum(qn) + ' ' + unit + ' (inductive, supplied to network)';
        }
        if (qn > 0) {
            return 'Q=' + formatNum(qn) + ' ' + unit + ' (capacitive, absorbed from network)';
        }
        return 'Q≈0 (unity PF)';
    }

    function formatLineTerminalBlock(busName, qMvar, iKa) {
        return '@' + busName + ': ' + formatBranchTerminalQ(qMvar) + '\n  i=' + formatNum(iKa) + ' kA';
    }

    function formatLineResultWithFlow(cell, directionInfo, headerLine) {
        var hdr = headerLine || 'Line';
        var fromName = directionInfo ? directionInfo.fromName : '?';
        var toName = directionInfo ? directionInfo.toName : '?';
        // fromName/toName are ordered by flow direction; when that is opposite to the branch's
        // stored orientation, pair each bus name with the terminal values that belong to it.
        var rev = !!(directionInfo && directionInfo.reversed);
        var qAtFrom = rev ? cell.q_to_mvar : cell.q_from_mvar;
        var iAtFrom = rev ? cell.i_to_ka : cell.i_from_ka;
        var qAtTo = rev ? cell.q_from_mvar : cell.q_to_mvar;
        var iAtTo = rev ? cell.i_from_ka : cell.i_to_ka;
        if (!directionInfo || directionInfo.nearZero) {
            return hdr + '\nP flow: ≈ 0 MW\n' + formatLineTerminalBlock(fromName, qAtFrom, iAtFrom) +
                '\nLoading: ' + formatNum(cell.loading_percent, 1) + ' %\n' +
                formatLineTerminalBlock(toName, qAtTo, iAtTo);
        }
        return hdr + '\nP flow: ' + fromName + ' → ' + toName +
            '  (' + formatNum(directionInfo.pMw) + ' MW)\n' +
            formatLineTerminalBlock(fromName, qAtFrom, iAtFrom) +
            '\nLoading: ' + formatNum(cell.loading_percent, 1) + ' %\n' +
            formatLineTerminalBlock(toName, qAtTo, iAtTo);
    }

    function formatTrafoResultWithFlow(cell, directionInfo, headerLine, tapBlock) {
        var hdr = headerLine || 'Trafo';
        tapBlock = tapBlock || '';
        var flowLine;
        if (!directionInfo || directionInfo.nearZero) {
            flowLine = 'P flow: ≈ 0 MW';
        } else {
            flowLine = 'P flow: ' + directionInfo.fromName + ' → ' + directionInfo.toName +
                '  (' + formatNum(directionInfo.pMw) + ' MW)';
        }
        return hdr + '\n' + flowLine +
            '\nP_HV[MW]: ' + formatNum(cell.p_hv_mw) +
            '\n@HV: ' + formatBranchTerminalQ(cell.q_hv_mvar) +
            '\nP_LV[MW]: ' + formatNum(cell.p_lv_mw) +
            '\n@LV: ' + formatBranchTerminalQ(cell.q_lv_mvar) +
            '\ni_HV[kA]: ' + formatNum(cell.i_hv_ka) +
            '\ni_LV[kA]: ' + formatNum(cell.i_lv_ka) +
            '\nloading[%]: ' + formatNum(cell.loading_percent) + tapBlock;
    }

    function formatSwitchResultWithFlow(cell, directionInfo, headerLine) {
        var hdr = headerLine || 'Switch';
        var closedStr = (cell.closed === false || cell.closed === 'false') ? 'false' : 'true';
        var flowLine;
        if (!directionInfo || directionInfo.nearZero) {
            flowLine = 'P flow: ≈ 0 MW';
        } else {
            flowLine = 'P flow: ' + directionInfo.fromName + ' → ' + directionInfo.toName +
                '  (' + formatNum(directionInfo.pMw) + ' MW)';
        }
        var revSw = !!(directionInfo && directionInfo.reversed);
        var qSwFrom = revSw ? cell.q_to_mvar : cell.q_from_mvar;
        var qSwTo = revSw ? cell.q_from_mvar : cell.q_to_mvar;
        return hdr + '\nclosed: ' + closedStr + '\n' + flowLine +
            '\n' + formatLineTerminalBlock(directionInfo ? directionInfo.fromName : 'from', qSwFrom, cell.i_ka) +
            '\nLoading: ' + formatNum(cell.loading_percent, 1) + ' %\n' +
            '@' + (directionInfo ? directionInfo.toName : 'to') + ': ' +
            formatBranchTerminalQ(qSwTo);
    }

    function formatGenericBranchResultWithFlow(cell, directionInfo, headerLine, extraLines) {
        var hdr = headerLine || 'Branch';
        extraLines = extraLines || '';
        var flowLine;
        if (!directionInfo || directionInfo.nearZero) {
            flowLine = 'P flow: ≈ 0 MW';
        } else {
            flowLine = 'P flow: ' + directionInfo.fromName + ' → ' + directionInfo.toName +
                '  (' + formatNum(directionInfo.pMw) + ' MW)';
        }
        var revGb = !!(directionInfo && directionInfo.reversed);
        var pGbFrom = revGb ? cell.p_to_mw : cell.p_from_mw;
        var qGbFrom = revGb ? cell.q_to_mvar : cell.q_from_mvar;
        var pGbTo = revGb ? cell.p_from_mw : cell.p_to_mw;
        var qGbTo = revGb ? cell.q_from_mvar : cell.q_to_mvar;
        return hdr + '\n' + flowLine +
            '\n@' + (directionInfo ? directionInfo.fromName : 'from') + ': P=' + formatNum(pGbFrom) +
            ', ' + formatBranchTerminalQ(qGbFrom) +
            '\n@' + (directionInfo ? directionInfo.toName : 'to') + ': P=' + formatNum(pGbTo) +
            ', ' + formatBranchTerminalQ(qGbTo) + extraLines;
    }

    var DASHBOARD_ID = 'electrisim-health-dashboard';

    var legendRepositionTimer = null;

    function positionFlowLegendPanel(panel) {
        if (!panel) return;
        var gap = 10;
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';

        var dash = document.getElementById(DASHBOARD_ID);
        if (dash && dash.offsetParent !== null && getComputedStyle(dash).display !== 'none') {
            var dashRect = dash.getBoundingClientRect();
            var legW = panel.offsetWidth || 280;
            var legH = panel.offsetHeight || 130;

            var left = dashRect.left - legW - gap;
            var top = dashRect.bottom - legH;

            if (left < 8) {
                left = Math.max(8, dashRect.left);
                top = dashRect.top - legH - gap;
            }

            left = Math.max(8, Math.min(left, window.innerWidth - legW - 8));
            top = Math.max(8, Math.min(top, window.innerHeight - legH - 8));

            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            return;
        }

        panel.style.left = 'auto';
        panel.style.top = 'auto';
        panel.style.bottom = '16px';
        panel.style.right = '412px';
    }

    function repositionFlowConventionLegend() {
        var panel = document.getElementById(LEGEND_ID);
        if (panel) positionFlowLegendPanel(panel);
    }

    function scheduleLegendReposition() {
        if (legendRepositionTimer) clearTimeout(legendRepositionTimer);
        legendRepositionTimer = setTimeout(function () {
            legendRepositionTimer = null;
            repositionFlowConventionLegend();
        }, 16);
    }

    function bindLegendRepositionListeners() {
        if (bindLegendRepositionListeners._bound) return;
        bindLegendRepositionListeners._bound = true;
        window.addEventListener('resize', scheduleLegendReposition);
    }

    function ensureLegendStyles() {
        if (document.getElementById(LEGEND_STYLE_ID)) return;
        var style = document.createElement('style');
        style.id = LEGEND_STYLE_ID;
        style.textContent = [
            '#' + LEGEND_ID + ' {',
            '  position: fixed; z-index: 998;',
            '  width: 280px; max-width: calc(100vw - 16px); padding: 10px 12px; border-radius: 8px;',
            '  background: rgba(255,255,255,0.96); border: 1px solid #ced4da;',
            '  box-shadow: 0 4px 14px rgba(0,0,0,0.12); font: 12px/1.45 Arial, sans-serif; color: #212529;',
            '}',
            '#' + LEGEND_ID + ' strong { display: block; margin-bottom: 4px; font-size: 12px; }',
            '#' + LEGEND_ID + ' .eflow-arrow { color: ' + ARROW_COLOR + '; font-weight: bold; }',
            '#' + LEGEND_ID + ' button {',
            '  margin-top: 8px; padding: 4px 10px; border: 1px solid #adb5bd; border-radius: 4px;',
            '  background: #f8f9fa; cursor: pointer; font-size: 11px;',
            '}'
        ].join('\n');
        document.head.appendChild(style);
    }

    function hideFlowConventionLegend() {
        var el = document.getElementById(LEGEND_ID);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    }

    function showFlowConventionLegend(graph) {
        if (typeof document === 'undefined') return;
        if (isFlowLegendDismissed()) return;
        ensureLegendStyles();
        hideFlowConventionLegend();

        var panel = document.createElement('div');
        panel.id = LEGEND_ID;
        panel.innerHTML = [
            '<strong>Power flow convention</strong>',
            '<span class="eflow-arrow">→</span> Arrow on <b>lines</b> = active power (P) direction.',
            '<b>Arrow size</b> ∝ P magnitude (bigger arrow = more MW).',
            '<b>Arrow & line color</b> = loading: <span style="color:#2E7D32">green</span> → <span style="color:#F9A825">amber</span> → <span style="color:#C62828">red</span> (≥100%).',
            '<b>Branch terminals:</b> +P/+Q = leaving bus into branch; − = into bus from branch.',
            '<b>Reactive labels:</b> “out of bus (inductive draw)” / “into bus (capacitive supply)”.',
            'On buses & loads: +Q = inductive absorbed/consumed; −Q = capacitive supplied.',
            '<button type="button">Dismiss</button>'
        ].join('<br>');

        var btn = panel.querySelector('button');
        if (btn) {
            btn.addEventListener('click', function () {
                dismissFlowLegendPermanently();
            });
        }
        document.body.appendChild(panel);
        bindLegendRepositionListeners();
        positionFlowLegendPanel(panel);
        requestAnimationFrame(function () { positionFlowLegendPanel(panel); });
        setTimeout(function () { positionFlowLegendPanel(panel); }, 450);
    }

    /** Recolor a line cell stroke using the smooth loading gradient (overrides 3-bucket color). */
    function applyLoadingLineColor(graph, lineCell, loadingPercent) {
        if (!graph || !lineCell) return;
        var p = Number(loadingPercent);
        if (isNaN(p)) return;
        var color = loadingToColor(p);
        var model = graph.getModel();
        var style = model.getStyle(lineCell) || '';
        if (typeof mxUtils !== 'undefined' && typeof mxConstants !== 'undefined') {
            style = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
        } else if (style.indexOf('strokeColor=') >= 0) {
            style = style.replace(/strokeColor=[^;]*/, 'strokeColor=' + color);
        } else {
            style += ';strokeColor=' + color;
        }
        model.setStyle(lineCell, style);
    }

    /**
     * P/Q shown on bus result boxes: net nodal balance (element injection + signed branch terminals).
     * Falls back to legacy injection / through-flow when nodal fields are absent (older backend).
     */
    function busDisplayPq(cell) {
        var pN = Number(cell.p_nodal_mw);
        var qN = Number(cell.q_nodal_mvar);
        if (Number.isFinite(pN) && Number.isFinite(qN)) {
            var denom = Math.sqrt(pN * pN + qN * qN);
            var pfN = Number(cell.pf_nodal);
            var qpN = Number(cell.q_p_nodal);
            return {
                p: pN,
                q: qN,
                pf: denom > 1e-12 ? pN / denom : (Number.isFinite(pfN) ? pfN : 0),
                qp: Math.abs(pN) > 1e-12 ? qN / pN : (Number.isFinite(qpN) ? qpN : 0)
            };
        }
        var pInjN = Number(cell.p_mw);
        var qInjN = Number(cell.q_mvar);
        var magInj = Math.hypot(
            Number.isFinite(pInjN) ? pInjN : 0,
            Number.isFinite(qInjN) ? qInjN : 0
        );
        if (magInj >= 1e-6) {
            return { p: cell.p_mw, q: cell.q_mvar, pf: cell.pf, qp: cell.q_p };
        }
        var pBr = cell.p_branch_mw;
        var qBr = cell.q_branch_mvar;
        var hasBr = pBr !== undefined && pBr !== null && qBr !== undefined && qBr !== null;
        var pBrN = Number(pBr);
        var qBrN = Number(qBr);
        var magBr = hasBr ? Math.hypot(Number.isFinite(pBrN) ? pBrN : 0, Number.isFinite(qBrN) ? qBrN : 0) : 0;
        if (hasBr && magBr >= 1e-6) {
            var p = Number.isFinite(pBrN) ? pBrN : 0;
            var q = Number.isFinite(qBrN) ? qBrN : 0;
            var denomBr = Math.sqrt(p * p + q * q);
            return {
                p: p,
                q: q,
                pf: denomBr > 1e-12 ? p / denomBr : 0,
                qp: Math.abs(p) > 1e-12 ? q / p : 0
            };
        }
        return { p: cell.p_mw, q: cell.q_mvar, pf: cell.pf, qp: cell.q_p };
    }

    window.clearFlowArrows = clearFlowArrows;
    window.resolveBranchFlowDirection = resolveBranchFlowDirection;
    window.applyActivePowerArrow = applyActivePowerArrow;
    window.loadingFlowColor = loadingToColor;
    window.applyLoadingLineColor = applyLoadingLineColor;
    window.formatLineResultWithFlow = formatLineResultWithFlow;
    window.formatTrafoResultWithFlow = formatTrafoResultWithFlow;
    window.formatSwitchResultWithFlow = formatSwitchResultWithFlow;
    window.formatGenericBranchResultWithFlow = formatGenericBranchResultWithFlow;
    window.formatBranchTerminalQ = formatBranchTerminalQ;
    window.formatBusNetReactiveQ = formatBusNetReactiveQ;
    window.busDisplayPq = busDisplayPq;
    window.formatElementReactiveQ = formatElementReactiveQ;
    window.formatExternalGridReactiveQ = formatExternalGridReactiveQ;
    window.showFlowConventionLegend = showFlowConventionLegend;
    window.hideFlowConventionLegend = hideFlowConventionLegend;
    window.repositionFlowConventionLegend = repositionFlowConventionLegend;
})();
