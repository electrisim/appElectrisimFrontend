import { buildGraphCellLookupMap, resolveGraphCellForResult } from './attributeUtils.js';

const ERROR_HIGHLIGHT_STYLE_ID = 'electrisim-calc-error-flash';

const ELEMENT_NAME_PATTERNS = [
    /(?:Line|Bus|Transformer|Generator|Load|External Grid|Static Generator|Shunt|Capacitor|Storage|Motor|PVSystem|Source 1ph|Three Winding Transformer|Switch|Impedance)\s+'([^']+)'/gi,
    /bus\s+'([^']+)'/gi,
];

function ensureFlashStyles() {
    if (typeof document === 'undefined' || document.getElementById(ERROR_HIGHLIGHT_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = ERROR_HIGHLIGHT_STYLE_ID;
    style.textContent = `
        .electrisim-calc-error-flash {
            animation: electrisim-calc-error-flash 1.6s ease-in-out 2;
        }
        @keyframes electrisim-calc-error-flash {
            0%, 100% { filter: drop-shadow(0 0 0 rgba(220,38,38,0)); }
            50%      { filter: drop-shadow(0 0 14px rgba(220,38,38,0.95)); }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Extract graph element identifiers referenced in backend validation / solver errors.
 * Handles mxCell ids (mxCell_647, mxCell#647) and quoted element names.
 */
export function extractElementIdentifiersFromErrorText(errorText) {
    if (errorText == null || errorText === '') return [];
    const text = String(errorText);
    const ids = new Set();

    const mxMatches = text.match(/mxCell[_#]?\d+/gi);
    if (mxMatches) {
        mxMatches.forEach((token) => ids.add(token.replace(/#/g, '_')));
    }

    for (const pattern of ELEMENT_NAME_PATTERNS) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(text)) !== null) {
            const name = match[1] && String(match[1]).trim();
            if (name) ids.add(name);
        }
    }

    return [...ids];
}

function applyErrorHighlightStyle(graph, cell) {
    const model = graph.getModel();
    let style = model.getStyle(cell);
    style = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, 'red');
    style = mxUtils.setStyle(style, mxConstants.STYLE_STROKEWIDTH, '3');
    style = mxUtils.setStyle(style, mxConstants.STYLE_STROKE_OPACITY, '100');
    graph.setCellStyle(style, [cell]);
}

function focusErrorCell(graph, cell) {
    try {
        if (graph.scrollCellToVisible) {
            graph.scrollCellToVisible(cell, true);
        }
        if (graph.setSelectionCell) {
            graph.setSelectionCell(cell);
        }
        ensureFlashStyles();
        const state = graph.view && graph.view.getState ? graph.view.getState(cell) : null;
        const node = state && state.shape && state.shape.node ? state.shape.node : null;
        if (node) {
            node.classList.add('electrisim-calc-error-flash');
            setTimeout(() => node.classList.remove('electrisim-calc-error-flash'), 3400);
        }
    } catch (e) {
        console.warn('[calculationErrorHighlight] focusErrorCell failed:', e);
    }
}

/**
 * Highlight graph cells by technical ids and/or display names.
 * @param {object} graph
 * @param {Array<string|number|{id?:string,name?:string}>} identifiers
 * @returns {object[]} highlighted mxCells
 */
export function highlightGraphElementsByIdentifiers(graph, identifiers) {
    if (!graph || !graph.getModel) return [];
    const list = Array.isArray(identifiers) ? identifiers : [identifiers];
    const allIds = new Set();
    const addId = (raw) => {
        if (raw == null) return;
        const s = String(raw).trim();
        if (!s) return;
        // Bare integers collide with mxGraph internal cell ids and highlight the wrong shapes
        if (/^\d+$/.test(s)) return;
        allIds.add(s);
    };
    for (const item of list) {
        if (item == null || item === '') continue;
        if (typeof item === 'object') {
            addId(item.id);
            addId(item.name);
        } else {
            addId(item);
        }
    }
    if (allIds.size === 0) return [];

    let map;
    try {
        map = buildGraphCellLookupMap(graph);
    } catch (e) {
        console.warn('[calculationErrorHighlight] lookup map failed:', e);
        return [];
    }

    const highlighted = [];
    const seen = new Set();
    for (const id of allIds) {
        const cell = resolveGraphCellForResult(map, { id, name: id }, graph);
        if (!cell || seen.has(cell)) continue;
        seen.add(cell);
        applyErrorHighlightStyle(graph, cell);
        highlighted.push(cell);
    }

    if (highlighted.length === 0) return [];

    focusErrorCell(graph, highlighted[0]);
    if (highlighted.length > 1 && graph.setSelectionCells) {
        graph.setSelectionCells(highlighted);
    }

    return highlighted;
}

/**
 * Find and highlight elements referenced in one or more error messages.
 * @returns {object[]} highlighted mxCells
 */
export function highlightCalculationErrorElements(graph, errorTextOrTexts) {
    if (!graph || !graph.getModel) return [];

    const texts = Array.isArray(errorTextOrTexts) ? errorTextOrTexts : [errorTextOrTexts];
    const allIds = new Set();
    for (const text of texts) {
        extractElementIdentifiersFromErrorText(text).forEach((id) => allIds.add(id));
    }
    if (allIds.size === 0) return [];

    return highlightGraphElementsByIdentifiers(graph, [...allIds]);
}

export function calculationErrorHighlightSuffix(highlightedCount) {
    if (!highlightedCount) return '';
    return highlightedCount > 1
        ? '\n\nThe problematic elements are highlighted in red on the diagram.'
        : '\n\nThe problematic element is highlighted in red on the diagram.';
}

if (typeof window !== 'undefined') {
    window.extractElementIdentifiersFromErrorText = extractElementIdentifiersFromErrorText;
    window.highlightCalculationErrorElements = highlightCalculationErrorElements;
    window.highlightGraphElementsByIdentifiers = highlightGraphElementsByIdentifiers;
}
