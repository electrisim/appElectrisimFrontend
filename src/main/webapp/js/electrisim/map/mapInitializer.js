/**
 * Map Editor initializer - adds Map Editor button and menu integration
 */

import { MapEditorDialog } from '../dialogs/MapEditorDialog.js';

// Define early so it's always available (e.g. from console)
window.showMapEditorDialog = function (retryCount) {
    retryCount = retryCount || 0;
    let editorUi = null;
    if (window.App) {
        editorUi = window.App._editorUi ||
            window.App._instance ||
            (window.App._instance && window.App._instance.editor && window.App._instance.editor.editorUi) ||
            (window.App.main && typeof window.App.main === 'object' && window.App.main.editor && (window.App.main.editor.editorUi || window.App.main)) ||
            (window.App.main && window.App.main.editor && window.App.main.editor.editorUi);
    }
    if (!editorUi && window.EditorUi) {
        const el = document.querySelector('.geEditor, [class*="geEditor"]');
        if (el && el._editorUi) editorUi = el._editorUi;
    }
    if (!editorUi) {
        if (retryCount < 3) {
            setTimeout(() => window.showMapEditorDialog(retryCount + 1), 500);
            return;
        }
        console.warn('Map Editor: App not ready. Try: 1) Wait for diagram to fully load 2) Click on the canvas first 3) Refresh the page');
        alert('Map Editor: Application not ready yet.\n\nPlease:\n1. Wait for the diagram to fully load\n2. Click once on the drawing canvas\n3. Try again, or refresh the page');
        return;
    }
    const dialog = new MapEditorDialog(editorUi);
    dialog.show();
};

function waitForApp(callback) {
    const ready = typeof EditorUi !== 'undefined' && (
        (window.App && window.App._editorUi) ||
        (window.App && window.App._instance && window.App._instance.editor) ||
        (window.App && window.App.main && window.App.main.editor)
    );
    if (!ready) {
        setTimeout(() => waitForApp(callback), 100);
        return;
    }
    setTimeout(callback, 200);
}

function initializeMapEditor() {
    try {
        const editorUi = window.App._editorUi ||
            (window.App._instance && window.App._instance.editor && window.App._instance.editor.editorUi) ||
            (window.App.main && window.App.main.editor && window.App.main.editor.editorUi);
        if (!editorUi) {
            return;
        }

        if (document.getElementById('electrisim-map-editor-btn')) {
            console.log('Map Editor button already added');
            return;
        }

        const btn = document.createElement('button');
        btn.id = 'electrisim-map-editor-btn';
        btn.title = 'Map Editor - Place nodes and draw cables on a real map to generate electrical model with geographic cable lengths';
        btn.textContent = '🗺️ Map';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 9999;
            padding: 8px 14px;
            font-size: 13px;
            cursor: pointer;
            border: 1px solid #4caf50;
            border-radius: 6px;
            background: #4caf50;
            color: #fff;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        btn.onmouseover = () => {
            btn.style.background = '#43a047';
            btn.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)';
        };
        btn.onmouseout = () => {
            btn.style.background = '#4caf50';
            btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        };
        btn.onclick = () => window.showMapEditorDialog();
        document.body.appendChild(btn);

        console.log('Map Editor initialized');
    } catch (err) {
        console.error('Map Editor init error:', err);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForApp(initializeMapEditor));
} else {
    waitForApp(initializeMapEditor);
}

window.addEventListener('load', () => {
    setTimeout(() => {
        if (!document.getElementById('electrisim-map-editor-btn')) {
            waitForApp(initializeMapEditor);
        }
    }, 1500);
});

export { initializeMapEditor };
