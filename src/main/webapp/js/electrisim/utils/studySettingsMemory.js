// studySettingsMemory.js - Remember each simulation tab's last settings in the diagram.
// Settings are saved as JSON on the diagram root cell, so they travel with the model file
// (same idea as the BESS Dispatch Reversal study, which stores them on its Storage cell).
// The attribute is not an element property, so it is never sent to the backend.

const SETTINGS_ATTR = 'electrisim_study_settings';

// Dialog class name -> study key. Every simulation tab that should remember its settings.
const STUDY_KEYS = {
    LoadFlowDialog: 'loadFlow',
    OpenDSSLoadFlowDialog: 'loadFlowOpenDss',
    ShortCircuitDialog: 'shortCircuit',
    OptimalPowerFlowDialog: 'optimalPowerFlow',
    TimeSeriesSimulationDialog: 'timeSeries',
    ContingencyDialog: 'contingency',
    GridCodePqDialog: 'gridCodePq',
    GridCodeVqDialog: 'gridCodeVq',
    HarmonicAnalysisDialog: 'harmonic',
    ProtectionCoordinationDialog: 'protectionCoordination',
    BessSizingDialog: 'bessSizing',
    BessPreliminaryDesignDialog: 'bessPreliminaryDesign',
    DataCenterSiteScreeningDialog: 'dataCenterSiteScreening',
    ArcFlashDialog: 'arcFlash',
    MotorStartingDialog: 'motorStarting',
    TransientStabilityDialog: 'transientStability',
    EigenvalueAnalysisDialog: 'eigenvalueAnalysis',
    EconomicAnalysisDialog: 'economicAnalysis'
};

// Field types whose value is a plain string/boolean that can be stored and restored.
const REMEMBERED_TYPES = new Set(['text', 'number', 'select', 'checkbox', 'radio']);

function _graphOf(dialog) {
    return dialog?.graph
        || dialog?.ui?.editor?.graph
        || window.App?.main?.editor?.graph
        || window.App?.main?.editor?.editorUi?.editor?.graph
        || null;
}

function _readAll(graph) {
    try {
        const root = graph?.getModel?.().getRoot?.();
        const attrs = root?.value?.attributes;
        if (!attrs) return {};
        for (let i = 0; i < attrs.length; i++) {
            if (attrs[i].nodeName === SETTINGS_ATTR) {
                const parsed = JSON.parse(attrs[i].nodeValue);
                return parsed && typeof parsed === 'object' ? parsed : {};
            }
        }
    } catch (e) { /* ignore: missing or malformed settings start empty */ }
    return {};
}

/** Write the whole settings map onto the diagram root (undoable; marks the diagram modified). */
function _writeAll(graph, all) {
    const model = graph?.getModel?.();
    const root = model?.getRoot?.();
    if (!root) return false;
    let node;
    if (root.value && typeof root.value.cloneNode === 'function') {
        node = root.value.cloneNode(true);
    } else if (typeof mxUtils !== 'undefined') {
        node = mxUtils.createXmlDocument().createElement('object');
    } else {
        return false;
    }
    node.setAttribute(SETTINGS_ATTR, JSON.stringify(all));
    model.beginUpdate();
    try {
        model.setValue(root, node);
    } finally {
        model.endUpdate();
    }
    return true;
}

function _applySaved(parameters, saved) {
    (parameters || []).forEach((param) => {
        if (!param || !param.id || !REMEMBERED_TYPES.has(param.type) || !(param.id in saved)) return;
        const value = saved[param.id];
        if (param.type === 'radio') {
            (param.options || []).forEach((option) => {
                option.default = String(option.value) === String(value);
            });
            return;
        }
        if (param.type === 'select' && Array.isArray(param.options) && param.options.length
            && !param.options.some((option) => String(option.value) === String(value))) {
            // Element ids change between diagrams; keep the dialog's own default when the saved one is gone.
            return;
        }
        param.value = param.type === 'checkbox' ? !!value : String(value);
    });
}

function _snapshot(dialog) {
    const values = {};
    (dialog.parameters || []).forEach((param) => {
        if (!param || !param.id || !REMEMBERED_TYPES.has(param.type)) return;
        if (param.type === 'radio') {
            const selected = (param.options || []).find((option) =>
                dialog.inputs?.get?.(`${param.id}_${option.value}`)?.checked
            );
            if (selected) values[param.id] = String(selected.value);
            return;
        }
        const input = dialog.inputs?.get?.(param.id);
        if (!input) return;
        values[param.id] = param.type === 'checkbox' ? !!input.checked : String(input.value);
    });
    return values;
}

/**
 * Restore the remembered settings of this study into the dialog's fields, and return a callback
 * that also saves what the user ran with. Dialogs that are not simulation tabs are returned unchanged.
 */
export function rememberStudySettings(dialog, callback) {
    const studyKey = STUDY_KEYS[dialog?.constructor?.name];
    if (!studyKey || !Array.isArray(dialog.parameters)) return callback;
    const graph = _graphOf(dialog);
    if (graph) {
        const saved = _readAll(graph)[studyKey];
        if (saved && typeof saved === 'object') _applySaved(dialog.parameters, saved);
    }
    return (values) => {
        if (values && graph) {
            try {
                const all = _readAll(graph);
                all[studyKey] = _snapshot(dialog);
                _writeAll(graph, all);
            } catch (e) {
                console.warn(`studySettingsMemory: could not save ${studyKey} settings`, e);
            }
        }
        return callback?.(values);
    };
}

// Bundled dialogs (no module import) reach the helper through the global.
globalThis.rememberStudySettings = rememberStudySettings;
