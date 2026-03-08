/**
 * Resizable Dialogs for Electrisim
 * All .geDialog and .mxWindow dialogs can be resized
 */
(function() {
    'use strict';

    function makeResizable(dialogEl) {
        if (!dialogEl || dialogEl.dataset.geResizable === 'true') return;
        dialogEl.classList.add('geResizable');
        dialogEl.dataset.geResizable = 'true';
    }

    function observeNewDialogs() {
        var observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                m.addedNodes.forEach(function(node) {
                    if (node.nodeType !== 1) return;
                    if (node.classList && (node.classList.contains('geDialog') || node.classList.contains('mxWindow'))) {
                        makeResizable(node);
                    }
                    var children = node.querySelectorAll && node.querySelectorAll('.geDialog, .mxWindow');
                    if (children) {
                        for (var i = 0; i < children.length; i++) {
                            makeResizable(children[i]);
                        }
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function waitForEditor(callback) {
        var ui = window.App && (window.App._editorUi || window.App._instance);
        var EditorUi = window.EditorUi;
        if (EditorUi && ui && ui.actions) {
            callback(ui);
            return;
        }
        setTimeout(function() { waitForEditor(callback); }, 100);
    }

    waitForEditor(function(ui) {
        var origShowDialog = window.EditorUi.prototype.showDialog;
        if (origShowDialog) {
            window.EditorUi.prototype.showDialog = function(elt, w, h, modal, closable, onClose, noScroll, transparent, onResize, ignoreBgClick) {
                origShowDialog.apply(this, arguments);
                window.setTimeout(function() {
                    var dlg = this.dialog;
                    if (dlg && dlg.container) {
                        var wrapper = dlg.container;
                        while (wrapper && !wrapper.classList.contains('geDialog') && !wrapper.classList.contains('mxWindow')) {
                            wrapper = wrapper.parentElement;
                        }
                        if (wrapper) makeResizable(wrapper);
                    }
                }.bind(this), 0);
            };
        }

        observeNewDialogs();

        var existing = document.querySelectorAll('.geDialog, .mxWindow');
        for (var i = 0; i < existing.length; i++) makeResizable(existing[i]);

        console.log('✅ Resizable Dialogs initialized');
    });
})();
