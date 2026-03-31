/**
 * mxGraph draws shape=image cells as SVG <image xlink:href="...">.
 * If the cell style has an empty or missing image URL, href becomes "" and
 * browsers / monitoring tools report "Failed to load image at """.
 * Replace invalid URLs with mxGraph's transparent.gif or a data-URI fallback.
 */
(function () {
    'use strict';
    var PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    if (typeof mxSvgCanvas2D === 'undefined' || !mxSvgCanvas2D.prototype ||
        typeof mxSvgCanvas2D.prototype.image !== 'function') {
        return;
    }
    var orig = mxSvgCanvas2D.prototype.image;
    mxSvgCanvas2D.prototype.image = function (a, b, c, d, e, f, g, k) {
        var converted;
        try {
            converted = this.converter != null && typeof this.converter.convert === 'function'
                ? this.converter.convert(e)
                : e;
        } catch (err) {
            converted = e;
        }
        var bad = converted == null || converted === '';
        if (!bad && typeof converted === 'string' && typeof mxUtils !== 'undefined' &&
            typeof mxUtils.trim === 'function' && mxUtils.trim(converted) === '') {
            bad = true;
        }
        if (bad) {
            var fallback = (typeof mxClient !== 'undefined' && mxClient.imageBasePath)
                ? mxClient.imageBasePath + '/transparent.gif'
                : PLACEHOLDER;
            return orig.call(this, a, b, c, d, fallback, f, g, k);
        }
        return orig.apply(this, arguments);
    };
})();
