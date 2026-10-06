/**
 * Pandapower load flow is a balanced three-phase solver.
 * Single-phase OpenDSS elements (Source 1ph, Line 1ph, …) are omitted from
 * that payload, which leaves every bus isolated. Stop the run and tell the
 * user to use OpenDSS.
 */
import { showConfirmDialog } from './confirmDialog.js';

const SINGLE_PHASE_SHAPES = [
    'Source 1ph',
    'Line 1ph',
    'Transformer 1ph',
    'Load 1ph',
    'Generator 1ph'
];

function shapeOf(cell) {
    const style = cell && cell.style ? String(cell.style) : '';
    const match = style.match(/shapeELXXX=([^;]+)/);
    return match ? match[1] : '';
}

/**
 * @param {object} graph mxGraph
 * @returns {Array<{ shape: string, count: number }>}
 */
export function collectSinglePhaseShapes(graph) {
    const counts = new Map();
    const cells = graph?.getModel?.()?.cells;
    if (!cells) return [];
    for (const id in cells) {
        const shape = shapeOf(cells[id]);
        if (!SINGLE_PHASE_SHAPES.includes(shape)) continue;
        counts.set(shape, (counts.get(shape) || 0) + 1);
    }
    return SINGLE_PHASE_SHAPES
        .filter((shape) => counts.has(shape))
        .map((shape) => ({ shape, count: counts.get(shape) }));
}

/**
 * @param {object} graph
 * @returns {Promise<boolean>} true when the pandapower run must not start
 */
export async function blockPandapowerIfSinglePhase(graph) {
    const found = collectSinglePhaseShapes(graph);
    if (!found.length) return false;
    const items = found.map(({ shape, count }) =>
        `${shape} — ${count} element${count === 1 ? '' : 's'}`
    );
    await showConfirmDialog({
        title: 'Single-phase network',
        variant: 'info',
        message: 'Pandapower does not solve a single-phase system. Use OpenDSS load flow for this diagram.',
        items,
        footerHint: 'The pandapower load flow was not started.',
        confirmLabel: 'OK',
        hideCancel: true
    });
    return true;
}
