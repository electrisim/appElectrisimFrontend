/**
 * The main mxGraph client file that includes all required modules.
 */

// Define global constants
var STENCIL_PATH = 'stencils';
var STYLE_PATH = 'styles';
var SHAPES_PATH = 'shapes';

// Core mxGraph classes
window.mxClient = {
    VERSION: '4.2.2',
    IS_IE: navigator.userAgent.indexOf('MSIE') >= 0,
    IS_IE6: navigator.userAgent.indexOf('MSIE 6') >= 0,
    IS_QUIRKS: document.compatMode != 'CSS1Compat',
    LANGUAGE: 'en',
    basePath: '',
    imageBasePath: '',
    languages: {},
    defaultLanguage: 'en'
};

// Essential mxGraph classes
window.mxEventSource = function(eventTarget) {
    this.eventTarget = eventTarget || this;
    this.eventListeners = [];
};

window.mxUtils = {
    extend: function(ctor, superCtor) {
        var f = function() {};
        f.prototype = superCtor.prototype;
        ctor.prototype = new f();
        ctor.prototype.constructor = ctor;
    },
    bind: function(scope, funct) {
        return function() {
            return funct.apply(scope, arguments);
        };
    },
    isNode: function(value, nodeName) {
        return value != null && value.nodeType == 1 && 
               (nodeName == null || value.nodeName.toLowerCase() == nodeName.toLowerCase());
    }
};

window.mxEvent = {
    addListener: function(element, eventName, funct) {
        if (element.addEventListener) {
            element.addEventListener(eventName, funct, false);
        } else {
            element.attachEvent('on' + eventName, funct);
        }
    },
    removeListener: function(element, eventName, funct) {
        if (element.removeEventListener) {
            element.removeEventListener(eventName, funct, false);
        } else {
            element.detachEvent('on' + eventName, funct);
        }
    }
};

// Basic UI components
window.mxPopupMenu = function() {
    this.items = [];
};

window.mxText = function(value, bounds, align, valign, color, family, size, fontStyle, spacing, spacingTop, spacingRight, spacingBottom, spacingLeft, horizontal, background, border, wrap, clipped, overflow, labelPadding) {
    this.value = value;
    this.bounds = bounds;
};

window.mxCellRenderer = {
    defaultShapes: {},
    registerShape: function(key, shape) {
        this.defaultShapes[key] = shape;
    }
};

// Export mxGraph namespace
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.mxClient;
} 