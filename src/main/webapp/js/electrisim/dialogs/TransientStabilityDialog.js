// TransientStabilityDialog.js - ANDES time-domain simulation parameters
import { Dialog } from '../Dialog.js';

function parseCellStyle(style) {
    if (!style) return {};
    return Object.fromEntries(
        style.split(';').filter(Boolean).map((pair) => {
            const i = pair.indexOf('=');
            return i >= 0 ? [pair.slice(0, i), pair.slice(i + 1)] : [pair, ''];
        })
    );
}

function getCellAttr(cell, attrName) {
    if (!cell?.value?.attributes) return null;
    for (let i = 0; i < cell.value.attributes.length; i++) {
        if (cell.value.attributes[i].nodeName === attrName) {
            return cell.value.attributes[i].nodeValue;
        }
    }
    return null;
}

function collectBusesAndLines(graph) {
    const buses = [{ value: '', label: '(none)' }];
    const lines = [{ value: '', label: '(none)' }];
    if (!graph?.getModel) return { buses, lines };
    const cells = graph.getModel().getChildCells(graph.getDefaultParent(), true, true) || [];
    for (const cell of cells) {
        const styleStr = cell.getStyle?.() || '';
        if (styleStr.includes('Result')) continue;
        const style = parseCellStyle(styleStr);
        const componentType = style.shapeELXXX || '';
        const technicalName = cell.mxObjectId?.replace('#', '_') || String(cell.id);
        const label = getCellAttr(cell, 'name') || technicalName;
        if (componentType === 'Bus' || componentType === 'Busbar' || styleStr.includes('shapeELXXX=Bus')) {
            buses.push({ value: technicalName, label });
        } else if (componentType === 'Line' || styleStr.includes('shapeELXXX=Line')) {
            lines.push({ value: technicalName, label });
        }
    }
    return { buses, lines };
}

export class TransientStabilityDialog extends Dialog {
    constructor(editorUi) {
        super('Transient Stability (ANDES TDS)', 'Run Simulation');
        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 720;
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        const { buses, lines } = collectBusesAndLines(this.graph);

        this.parameters = [
            {
                id: 'frequency',
                label: 'System Frequency (Hz)',
                type: 'number',
                value: '50',
                min: '1',
                step: '1'
            },
            {
                id: 'sn_mva',
                label: 'System Base (MVA)',
                type: 'number',
                value: '100',
                min: '1',
                step: '1'
            },
            {
                id: 'tf',
                label: 'Simulation End Time tf (s)',
                type: 'number',
                value: '10',
                min: '0.1',
                step: '0.1'
            },
            {
                id: 'tstep',
                label: 'Time Step Hint (s, 0 = auto)',
                type: 'number',
                value: '0',
                min: '0',
                step: '0.001'
            },
            {
                id: 'fault_bus',
                label: 'Fault Bus',
                type: 'select',
                options: buses.map((b, i) => ({
                    value: b.value,
                    label: b.label,
                    default: i === 1
                }))
            },
            {
                id: 'fault_tf',
                label: 'Fault Apply Time (s)',
                type: 'number',
                value: '1.0',
                min: '0',
                step: '0.01'
            },
            {
                id: 'fault_tc',
                label: 'Fault Clear Time (s)',
                type: 'number',
                value: '1.1',
                min: '0',
                step: '0.01'
            },
            {
                id: 'toggle_line',
                label: 'Line Outage (optional)',
                type: 'select',
                options: lines.map((l, i) => ({
                    value: l.value,
                    label: l.label,
                    default: i === 0
                }))
            },
            {
                id: 'toggle_t',
                label: 'Line Outage Time (s)',
                type: 'number',
                value: '2.0',
                min: '0',
                step: '0.01'
            }
        ];
    }

    getDescription() {
        return 'Time-domain transient stability using ANDES. Requires at least one synchronous Generator or Static Generator with an IBR, Wind, PVD1, or ESD1 dynamic plant; External Grid alone is insufficient.';
    }
}

if (typeof window !== 'undefined') {
    window.TransientStabilityDialog = TransientStabilityDialog;
}

export default TransientStabilityDialog;
