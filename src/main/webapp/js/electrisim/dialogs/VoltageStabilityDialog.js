// VoltageStabilityDialog.js - settings for the voltage stability margin study (P-V curves, pandapower)
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';
import { listDiagramBusbars, getSelectedDiagramBusbars } from '../utils/scFaultBuses.js';

export class VoltageStabilityDialog extends Dialog {
    constructor(editorUi) {
        super('Voltage Stability Margin (P-V Curves)', 'Calculate');
        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 720;
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        const buses = listDiagramBusbars(this.graph);
        const selected = getSelectedDiagramBusbars(this.graph);
        const preselectedId = selected.length ? selected[0].id : null;
        this._busCount = buses.length;
        const busOptions = buses.map((b) => ({
            value: b.id,
            label: b.label,
            default: preselectedId != null && b.id === preselectedId
        }));

        this.parameters = [
            {
                id: 'mode',
                label: 'How the load grows',
                type: 'radio',
                options: [
                    { value: 'all_loads', label: 'All loads grow together', default: !preselectedId },
                    { value: 'bus', label: 'A new load is added at one bus', default: !!preselectedId }
                ]
            },
            {
                id: 'bus_id',
                label: 'Bus for the new load (only for "A new load is added at one bus")',
                type: 'select',
                options: busOptions.length ? busOptions : [{ value: '', label: 'No buses on this diagram' }]
            },
            {
                id: 'power_factor',
                label: 'Power factor of the new load (inductive)',
                type: 'number',
                value: '0.95',
                min: '0.5',
                max: '1',
                step: '0.01'
            },
            { id: 'min_vm_pu', label: 'Minimum voltage (p.u.)', type: 'number', value: '0.95', min: '0.5', max: '1.0', step: '0.01' },
            { id: 'max_loading_percent', label: 'Maximum loading of lines and transformers (%)', type: 'number', value: '100', min: '50', max: '200', step: '1' },
            {
                id: 'frequency',
                label: 'Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            }
        ];
    }

    getDescription() {
        return (
            '<strong>How much more load can the network carry?</strong><br>' +
            'The load is raised step by step until the load flow no longer solves. That point is the tip of the P-V curve (voltage collapse). ' +
            'The study also reports where the first bus drops below the minimum voltage and where the first line or transformer is overloaded, ' +
            'because one of those usually comes first. The extra power comes from the External Grid (slack). ' +
            'Tip: select a bus on the diagram before opening this dialog to pre-fill it. ' +
            '<a href="https://electrisim.com/documentation.html#voltage-stability" target="_blank" rel="noopener noreferrer">Documentation</a>'
        );
    }

    getFormValues() {
        const values = {};
        (this.parameters || []).forEach((param) => {
            if (param.type === 'radio') {
                const selected = (param.options || []).find((option) =>
                    this.inputs.get(`${param.id}_${option.value}`)?.checked
                );
                values[param.id] = selected
                    ? selected.value
                    : (param.options || []).find((option) => option.default)?.value;
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input && input.value != null ? input.value : (param.value ?? '');
            }
        });
        return values;
    }

    show(callback) {
        super.show(async (values) => {
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (window.showSubscriptionModal) window.showSubscriptionModal();
                    else alert('A subscription is required for the Voltage Stability Margin study.');
                    return;
                }
            } catch (e) {
                alert('Unable to verify subscription status. Please try again.');
                return;
            }
            if (values.mode === 'bus' && !String(values.bus_id || '').trim()) {
                alert('Choose the bus where the new load connects.');
                return;
            }
            const busParam = this.parameters.find((p) => p.id === 'bus_id');
            const busOption = (busParam?.options || []).find((o) => String(o.value) === String(values.bus_id));
            const busLabel = busOption ? String(busOption.label || '') : '';
            if (callback) callback({ ...values, bus_label: busLabel });
        });
    }

    async checkSubscriptionStatus() {
        await ensureSubscriptionFunctions();
        if (window.checkSubscriptionStatus) return window.checkSubscriptionStatus();
        if (window.SubscriptionManager?.checkSubscriptionStatus) {
            return window.SubscriptionManager.checkSubscriptionStatus();
        }
        return false;
    }
}

globalThis.VoltageStabilityDialog = VoltageStabilityDialog;
