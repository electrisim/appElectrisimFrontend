// ArcFlashDialog.js - Dialog for IEEE 1584-2018 Arc Flash parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class ArcFlashDialog extends Dialog {
    constructor(editorUi) {
        super('Arc Flash Parameters (IEEE 1584-2018)', 'Calculate');

        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 720;

        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        this.parameters = [
            {
                id: 'electrode_config',
                label: 'Electrode Configuration',
                type: 'radio',
                options: [
                    { value: 'VCB', label: 'VCB – Vertical in box (switchgear/MCC)', default: true },
                    { value: 'VCBB', label: 'VCBB – Vertical in box with barrier' },
                    { value: 'HCB', label: 'HCB – Horizontal in box' },
                    { value: 'VOA', label: 'VOA – Vertical open air' },
                    { value: 'HOA', label: 'HOA – Horizontal open air' }
                ]
            },
            {
                id: 'working_distance_mm',
                label: 'Working Distance (mm)',
                type: 'number',
                value: '455',
                min: '305',
                step: '1'
            },
            {
                id: 'conductor_gap_mm',
                label: 'Conductor Gap (mm)',
                type: 'number',
                value: '25',
                min: '1',
                step: '1'
            },
            {
                id: 'enclosure_height_mm',
                label: 'Enclosure Height (mm)',
                type: 'number',
                value: '508',
                min: '100',
                step: '1'
            },
            {
                id: 'enclosure_width_mm',
                label: 'Enclosure Width (mm)',
                type: 'number',
                value: '508',
                min: '100',
                step: '1'
            },
            {
                id: 'enclosure_depth_mm',
                label: 'Enclosure Depth (mm)',
                type: 'number',
                value: '508',
                min: '100',
                step: '1'
            },
            {
                id: 'clearing_time_s',
                label: 'Clearing Time at Iarc (s)',
                type: 'number',
                value: '0.2',
                min: '0.001',
                step: '0.001'
            },
            {
                id: 'clearing_time_min_s',
                label: 'Clearing Time at Iarc-min (s)',
                type: 'number',
                value: '0.2',
                min: '0.001',
                step: '0.001'
            }
        ];
    }

    getDescription() {
        return '<strong>Configure IEEE 1584-2018 arc flash parameters</strong><br>' +
            'A 3-phase max short-circuit study is run first, then incident energy, arc-flash boundary, ' +
            'and PPE category are calculated for each bus. Buses above 15&nbsp;kV use the Ralph Lee method. ' +
            'Typical working distance: LV 455&nbsp;mm, MV 610&nbsp;mm.';
    }

    show(callback) {
        super.show(async (values) => {
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (window.showSubscriptionModal) {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to use the Arc Flash analysis feature.');
                    }
                    return;
                }

                // Prefer named object if Dialog returns one; otherwise map array by parameter order
                let params;
                if (values && typeof values === 'object' && !Array.isArray(values) && ('electrode_config' in values || 'working_distance_mm' in values)) {
                    params = values;
                } else if (Array.isArray(values)) {
                    params = {
                        electrode_config: values[0],
                        working_distance_mm: values[1],
                        conductor_gap_mm: values[2],
                        enclosure_height_mm: values[3],
                        enclosure_width_mm: values[4],
                        enclosure_depth_mm: values[5],
                        clearing_time_s: values[6],
                        clearing_time_min_s: values[7]
                    };
                } else {
                    params = values || {};
                }

                if (callback) {
                    callback(params);
                }
            } catch (error) {
                console.error('ArcFlashDialog: Error checking subscription status:', error);
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
            console.error('ArcFlashDialog: Error in checkSubscriptionStatus:', error);
            return false;
        }
    }
}
