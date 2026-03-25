/**
 * Non-module script: draw.io defines mx* in the classic global scope; ES modules only see window.*.
 * Some builds expose mxShape on the global object but not as window.mxShape — copy refs here for modules.
 */
(function () {
    var g = typeof globalThis !== 'undefined' ? globalThis : window;
    try {
        /* global mxShape, mxCellRenderer, mxUtils, Graph */
        if (typeof mxShape !== 'undefined') {
            g.__drawio_mxShape = mxShape;
        }
        if (typeof mxCellRenderer !== 'undefined') {
            g.__drawio_mxCellRenderer = mxCellRenderer;
        }
        if (typeof mxGraphView !== 'undefined') {
            g.__drawio_mxGraphView = mxGraphView;
        }
    } catch (e) {
        /* ignore */
    }
})();
