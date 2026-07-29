// MotorStartingDialog.js - Motor starting / voltage dip study parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

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

function collectMotors(graph) {
    const motors = [{ value: 'all', label: 'All in-service motors', default: true }];
    if (!graph?.getModel) return motors;
    const cells = graph.getModel().getChildCells(graph.getDefaultParent(), true, true) || [];
    for (const cell of cells) {
        const styleStr = cell.getStyle?.() || '';
        if (styleStr.includes('Result')) continue;
        const style = parseCellStyle(styleStr);
        if (style.shapeELXXX !== 'Motor' && !styleStr.includes('shapeELXXX=Motor')) continue;
        const technicalName = cell.mxObjectId?.replace('#', '_') || String(cell.id);
        const label = getCellAttr(cell, 'name') || technicalName;
        motors.push({ value: technicalName, label });
    }
    return motors;
}

export class MotorStartingDialog extends Dialog {
    constructor(editorUi) {
        super('Motor Starting Parameters', 'Calculate');

        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 740;

        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        const motors = collectMotors(this.graph);

        this.parameters = [
            {
                id: 'mode',
                label: 'Calculation Mode',
                type: 'radio',
                options: [
                    { value: 'steady', label: 'Steady-state (before / during / after voltage dip)', default: true },
                    { value: 'dynamic', label: 'Dynamic (ANDES Motor3 time-domain)' }
                ]
            },
            {
                id: 'motor_ids',
                label: 'Motor(s) to Start',
                type: 'select',
                options: motors
            },
            {
                id: 'starting_method',
                label: 'Starting Method',
                type: 'select',
                options: [
                    { value: 'dol', label: 'DOL (Direct On Line)', default: true },
                    { value: 'soft_start', label: 'Soft-start (current limit)' },
                    { value: 'star_delta', label: 'Star-delta' },
                    { value: 'autotransformer', label: 'Autotransformer' },
                    { value: 'reactor', label: 'Reactor' }
                ]
            },
            {
                id: 'i_limit_pu',
                label: 'Soft-start Current Limit (p.u. of In)',
                type: 'number',
                value: '3',
                min: '0.5',
                step: '0.1'
            },
            {
                id: 'at_tap_pu',
                label: 'Autotransformer Tap (p.u.)',
                type: 'number',
                value: '0.8',
                min: '0.1',
                max: '1',
                step: '0.05'
            },
            {
                id: 'reactor_x_pu',
                label: 'Reactor Reactance (p.u.)',
                type: 'number',
                value: '0.25',
                min: '0',
                step: '0.05'
            },
            {
                id: 'voltage_limit_percent',
                label: 'Max Voltage Dip Limit (%)',
                type: 'number',
                value: '15',
                min: '1',
                max: '50',
                step: '1'
            },
            {
                id: 'thermal_limit_percent',
                label: 'Max Branch Loading Limit (%)',
                type: 'number',
                value: '100',
                min: '50',
                max: '300',
                step: '1'
            },
            {
                id: 't_start',
                label: 'Dynamic: Motor Connect Time (s)',
                type: 'number',
                value: '0.1',
                min: '0',
                step: '0.01'
            },
            {
                id: 't_end',
                label: 'Dynamic: Simulation End Time (s)',
                type: 'number',
                value: '5',
                min: '0.5',
                step: '0.1'
            },
            {
                id: 'frequency',
                label: 'Dynamic: System Frequency (Hz)',
                type: 'number',
                value: '50',
                min: '50',
                step: '10'
            },
            {
                id: 'sn_mva',
                label: 'Dynamic: System Base (MVA)',
                type: 'number',
                value: '100',
                min: '1',
                step: '1'
            }
        ];
    }

    getDescription() {
        return '<strong>Motor starting / voltage dip study</strong><br>' +
            'Steady-state mode runs three load flows (before, locked-rotor during start, after) ' +
            'for DOL, soft-start, star-delta, autotransformer, or reactor starting. ' +
            'Dynamic mode uses ANDES Motor3 with a connect Toggle (DOL / approx. soft-start). ' +
            'Motors need <code>lrc_pu</code>, <code>rx</code>, and <code>vn_kv</code>. ' +
            'See the <a href="https://electrisim.com/documentation.html#motor-starting" target="_blank" rel="noopener noreferrer">documentation</a>.';
    }

    show(callback) {
        super.show(async (values) => {
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (window.showSubscriptionModal) {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to use the Motor Starting analysis feature.');
                    }
                    return;
                }

                let params;
                if (values && typeof values === 'object' && !Array.isArray(values) && ('mode' in values || 'starting_method' in values)) {
                    params = values;
                } else if (Array.isArray(values)) {
                    params = {
                        mode: values[0],
                        motor_ids: values[1],
                        starting_method: values[2],
                        i_limit_pu: values[3],
                        at_tap_pu: values[4],
                        reactor_x_pu: values[5],
                        voltage_limit_percent: values[6],
                        thermal_limit_percent: values[7],
                        t_start: values[8],
                        t_end: values[9],
                        frequency: values[10],
                        sn_mva: values[11]
                    };
                } else {
                    params = values || {};
                }

                if (callback) {
                    callback(params);
                }
            } catch (error) {
                console.error('MotorStartingDialog: Error checking subscription status:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        });
    }

    async checkSubscriptionStatus() {
        try {
            await ensureSubscriptionFunctions();
            if (window.checkSubscriptionStatus) {
                return await window.checkSubscriptionStatus();
            }
            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                return await window.SubscriptionManager.checkSubscriptionStatus();
            }
            return false;
        } catch (error) {
            console.error('MotorStartingDialog: Error in checkSubscriptionStatus:', error);
            return false;
        }
    }
}

globalThis.MotorStartingDialog = MotorStartingDialog;
