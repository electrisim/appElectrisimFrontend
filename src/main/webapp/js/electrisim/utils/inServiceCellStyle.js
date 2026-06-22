/**
 * Grey out diagram cells when in_service is false.
 * Mirrors updateSwitchCellStyle — visual feedback for out-of-service elements.
 */

const OUT_OF_SERVICE_OPACITY = 40;
const OUT_OF_SERVICE_FONT_COLOR = '#9E9E9E';
const OUT_OF_SERVICE_STROKE_COLOR = '#9E9E9E';
const STYLE_FLAG = 'electrisimOutOfService';

function parseStyle(styleStr) {
    const result = {};
    if (!styleStr) return result;
    styleStr.split(';').forEach((part) => {
        const eq = part.indexOf('=');
        if (eq > 0) {
            result[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
        }
    });
    return result;
}

/** @returns {boolean} true when element is in service (default when attribute missing) */
export function parseInServiceFromCell(cell) {
    const val = cell?.value;
    if (!val?.getAttribute) return true;
    const raw = val.getAttribute('in_service');
    if (raw == null || raw === '') return true;
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).trim().toLowerCase();
    return !(s === 'false' || s === '0' || s === 'no');
}

function isElectricalCell(cell, style) {
    if (!cell || !style) return false;
    if (style.indexOf('shapeELXXX=Result') >= 0) return false;
    if (style.indexOf('shapeELXXX=NotEditableLine') >= 0) return false;
    return style.indexOf('shapeELXXX=') >= 0;
}

function applyOutOfServiceStyle(graph, cell, outOfService) {
    const model = graph.getModel();
    let style = model.getStyle(cell) || '';
    const parsed = parseStyle(style);
    const wasMarked = parsed[STYLE_FLAG] === '1';

    if (outOfService) {
        style = mxUtils.setStyle(style, 'opacity', String(OUT_OF_SERVICE_OPACITY));
        style = mxUtils.setStyle(style, STYLE_FLAG, '1');
        if (cell.edge) {
            style = mxUtils.setStyle(style, 'strokeColor', OUT_OF_SERVICE_STROKE_COLOR);
        } else {
            style = mxUtils.setStyle(style, 'fontColor', OUT_OF_SERVICE_FONT_COLOR);
        }
    } else if (wasMarked) {
        style = mxUtils.setStyle(style, 'opacity', null);
        style = mxUtils.setStyle(style, STYLE_FLAG, null);
        style = mxUtils.setStyle(style, 'fontColor', null);
        style = mxUtils.setStyle(style, 'strokeColor', null);
    } else {
        return;
    }

    if (style !== model.getStyle(cell)) {
        graph.setCellStyle(style, [cell]);
    }

    const childCount = model.getChildCount(cell);
    for (let i = 0; i < childCount; i++) {
        const child = model.getChildAt(cell, i);
        if (!child || !model.isVertex(child)) continue;

        let childStyle = model.getStyle(child) || '';
        const childParsed = parseStyle(childStyle);
        const childMarked = childParsed[STYLE_FLAG] === '1';

        if (outOfService) {
            childStyle = mxUtils.setStyle(childStyle, 'fontColor', OUT_OF_SERVICE_FONT_COLOR);
            childStyle = mxUtils.setStyle(childStyle, 'opacity', String(OUT_OF_SERVICE_OPACITY));
            childStyle = mxUtils.setStyle(childStyle, STYLE_FLAG, '1');
        } else if (childMarked) {
            childStyle = mxUtils.setStyle(childStyle, 'fontColor', null);
            childStyle = mxUtils.setStyle(childStyle, 'opacity', null);
            childStyle = mxUtils.setStyle(childStyle, STYLE_FLAG, null);
        } else {
            continue;
        }

        if (childStyle !== model.getStyle(child)) {
            graph.setCellStyle(childStyle, [child]);
        }
    }
}

/** Apply or clear grey styling for one cell based on its in_service attribute. */
export function syncInServiceCellStyle(graph, cell) {
    if (!graph || !cell) return;
    const style = graph.getModel().getStyle(cell) || '';
    if (!isElectricalCell(cell, style)) return;
    applyOutOfServiceStyle(graph, cell, !parseInServiceFromCell(cell));
}

/** Walk the graph and sync in_service styling for all electrical cells. */
export function syncAllInServiceCellStyles(graph) {
    if (!graph?.getModel) return;
    const model = graph.getModel();
    const root = model.getRoot();

    const visit = (parent) => {
        const count = model.getChildCount(parent);
        for (let i = 0; i < count; i++) {
            const child = model.getChildAt(parent, i);
            syncInServiceCellStyle(graph, child);
            if (model.getChildCount(child) > 0) {
                visit(child);
            }
        }
    };

    model.beginUpdate();
    try {
        visit(root);
    } finally {
        model.endUpdate();
    }
}

function getEditorGraph() {
    if (typeof Editor !== 'undefined' && Editor.ui?.editor?.graph) {
        return Editor.ui.editor.graph;
    }
    if (typeof window !== 'undefined' && window.App?.main?.editor?.editorUi?.editor?.graph) {
        return window.App.main.editor.editorUi.editor.graph;
    }
    return null;
}

function scheduleSyncOnDiagramLoad() {
    setTimeout(function trySyncInServiceStyles() {
        const graph = getEditorGraph();
        if (graph?.getModel) {
            syncAllInServiceCellStyles(graph);
        }
    }, 2500);
}

function waitForMxGraphAndInit() {
    if (typeof mxGraph !== 'undefined' && typeof mxUtils !== 'undefined') {
        scheduleSyncOnDiagramLoad();
        return;
    }
    setTimeout(waitForMxGraphAndInit, 50);
}

if (typeof window !== 'undefined') {
    window.syncInServiceCellStyle = syncInServiceCellStyle;
    window.syncAllInServiceCellStyles = syncAllInServiceCellStyles;
    window.parseInServiceFromCell = parseInServiceFromCell;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForMxGraphAndInit);
    } else {
        waitForMxGraphAndInit();
    }
}

export default {
    parseInServiceFromCell,
    syncInServiceCellStyle,
    syncAllInServiceCellStyles,
};
