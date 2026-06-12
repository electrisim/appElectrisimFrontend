// ProtectionCoordinationDialog.js - Dialog for Protection Coordination parameters.
// Modeled on ShortCircuitDialog.js: 3 tabs (Fault / Grading / Output) and a subscription
// gate before the callback fires.
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';
import { getDrawioStudyDialogHeight, SIMULATION_FORM_SCROLL_STYLE, SIMULATION_INFO_BANNER_STYLE, preventAccidentalFormSubmit } from '../utils/dialogStyles.js';

export class ProtectionCoordinationDialog extends Dialog {
    constructor(editorUi) {
        super('Protection Coordination (Beta) Parameters', 'Calculate');

        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        // Tab 1 - Fault scenario(s) to analyse.
        this.faultParameters = [
            {
                id: 'fault_location_mode', label: 'Fault location', type: 'radio',
                options: [
                    { value: 'line', label: 'Along a line (fraction 0–1)', default: true },
                    { value: 'bus', label: 'At selected busbar (3-phase / 2-phase / 1-phase SC at bus)' }
                ]
            },
            {
                id: 'fault_bus_id',
                label: 'Fault busbar',
                type: 'select',
                options: [{ value: '', label: 'Select a busbar…' }],
                showWhen: 'bus'
            },
            {
                id: 'fault_type', label: 'Fault type', type: 'radio',
                options: [
                    { value: '3ph', label: 'Three Phase', default: true },
                    { value: '2ph', label: 'Two Phase' },
                    { value: '1ph', label: 'Single Phase' }
                ]
            },
            {
                id: 'case', label: 'Case', type: 'radio',
                options: [
                    { value: 'max', label: 'Maximum', default: true },
                    { value: 'min', label: 'Minimum' }
                ]
            },
            {
                id: 'sc_line_id',
                label: 'Faulted line (pandapower line index, leave "all" to sweep every in-service line)',
                type: 'text',
                value: 'all',
                showWhen: 'line'
            },
            { id: 'sc_fraction', label: 'Fault location along the line (0-1, mid-line = 0.5)', type: 'number', value: '0.5', showWhen: 'line' }
        ];

        // Tab 2 - Time grading parameters (defaults applied when the per-switch protection settings are empty).
        this.gradingParameters = [
            {
                id: 'grading_mode', label: 'Time grading', type: 'radio',
                options: [
                    { value: 'auto', label: 'Automatic (pandapower topological grading)', default: true },
                    { value: 'manual', label: 'Manual (per-switch values from the Switch dialog)' }
                ]
            },
            {
                id: 'curve_type', label: 'Default IEC inverse curve (for switches without an explicit curve)', type: 'radio',
                options: [
                    { value: 'standard_inverse', label: 'Standard inverse', default: true },
                    { value: 'very_inverse', label: 'Very inverse' },
                    { value: 'extremely_inverse', label: 'Extremely inverse' },
                    { value: 'long_inverse', label: 'Long inverse' }
                ]
            },
            { id: 't_diff', label: 'Grading margin (s) - used for the miscoordination check', type: 'number', value: '0.3' },
            { id: 't_g',  label: 'Default primary trip time t> (s)', type: 'number', value: '0.5' },
            { id: 't_gg', label: 'Default instantaneous trip time t>> (s)', type: 'number', value: '0.07' },
            { id: 'tms', label: 'Default time multiplier setting (TMS, s)', type: 'number', value: '1.0' },
            { id: 't_grade', label: 'Default time grading delay (s)', type: 'number', value: '0.5' },
            { id: 'overload_factor', label: 'Default overload factor', type: 'number', value: '1.25' },
            { id: 'ct_current_factor', label: 'Default CT current factor', type: 'number', value: '1.2' },
            { id: 'safety_factor', label: 'Default safety factor', type: 'number', value: '1.0' }
        ];

        // Tab 3 - Output / display options.
        this.outputParameters = [
            { id: 'show_curves', label: 'Show time-current grading curves (Chart.js)', type: 'checkbox', value: true },
            { id: 'show_table', label: 'Show tripping table', type: 'checkbox', value: true },
            { id: 'show_miscoordination', label: 'Show miscoordination warnings', type: 'checkbox', value: true },
            { id: 'export_results', label: 'Export results (download .txt file)', type: 'checkbox', value: false }
        ];

        this.currentTab = 'fault';
        this.parameters = this.faultParameters;
    }

    getDescription() {
        return '<strong>Configure the Protection Coordination study</strong><br>' +
            'Set the per-switch protection device on each switch (Switch dialog &rarr; Protection tab) - OC relay (DTOC/IDMT/IDTOC) or fuse. ' +
            'Choose a <strong>line fault</strong> (pandapower creates an intermediate SC bus on the line) or a <strong>busbar fault</strong> (short-circuit calculated directly at the selected bus). ' +
            'Fuse melting times appear in the tripping table when fuses are assigned. ' +
            'See the <a href="https://pandapower.readthedocs.io/en/latest/protection.html" target="_blank" rel="noopener noreferrer">pandapower protection docs</a>.';
    }

    populateBusbars() {
        if (!this.graph) return;
        const model = this.graph.getModel();
        const busbars = [];
        (model.getDescendants() || []).forEach(cell => {
            if (!cell || !cell.value) return;
            const style = cell.getStyle();
            if (!style) return;
            let componentType = null;
            for (const part of style.split(';')) {
                if (part.startsWith('shapeELXXX=')) {
                    componentType = part.split('=')[1];
                    break;
                }
            }
            if (componentType === 'Bus' || style.includes('shapeELXXX=Bus') || style.includes('busbar')) {
                busbars.push({ value: cell.getId(), label: this._getCellDisplayName(cell) });
            }
        });
        const busParam = this.faultParameters.find(p => p.id === 'fault_bus_id');
        if (busParam) {
            busParam.options = busbars.length
                ? busbars
                : [{ value: '', label: 'No busbar found on diagram' }];
        }
    }

    _getCellDisplayName(cell) {
        try {
            const value = cell.value;
            if (value && value.attributes) {
                for (let i = 0; i < value.attributes.length; i++) {
                    const a = value.attributes[i];
                    if (a.nodeName === 'name' && a.nodeValue) {
                        return String(a.nodeValue).trim();
                    }
                }
            }
        } catch (e) { /* ignore */ }
        return cell.getId();
    }

    _getFaultLocationMode() {
        const param = this.faultParameters.find(p => p.id === 'fault_location_mode');
        const checked = (param?.options || []).find(o => o.default);
        return checked ? checked.value : 'line';
    }

    _updateFaultFieldVisibility() {
        const mode = this._getFaultLocationMode();
        const form = this.container?.querySelector('[data-form-container="true"] form');
        if (!form) return;
        form.querySelectorAll('[data-fault-show]').forEach(group => {
            const show = group.getAttribute('data-fault-show');
            group.style.display = (show === mode || show === 'always') ? '' : 'none';
        });
    }

    _bindFaultLocationModeRadios() {
        const container = this.inputs.get('fault_location_mode');
        if (!container) return;
        container.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const param = this.faultParameters.find(p => p.id === 'fault_location_mode');
                if (param?.options) {
                    param.options.forEach(o => { o.default = (o.value === radio.value); });
                }
                this._updateFaultFieldVisibility();
            });
        });
    }

    createTabInterface() {
        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            marginBottom: '16px'
        });

        const tabHeaders = document.createElement('div');
        Object.assign(tabHeaders.style, {
            display: 'flex',
            borderBottom: '2px solid #e9ecef',
            marginBottom: '16px'
        });

        const faultTab = this.createTabHeader('Fault scenario', 'fault', true);
        const gradingTab = this.createTabHeader('Grading', 'grading', false);
        const outputTab = this.createTabHeader('Output', 'output', false);

        tabHeaders.appendChild(faultTab);
        tabHeaders.appendChild(gradingTab);
        tabHeaders.appendChild(outputTab);
        tabContainer.appendChild(tabHeaders);
        return tabContainer;
    }

    createTabHeader(text, tabId, isActive) {
        const tab = document.createElement('div');
        tab.setAttribute('data-tab-id', tabId);
        Object.assign(tab.style, {
            padding: '12px 20px',
            cursor: 'pointer',
            borderBottom: isActive ? '2px solid #007bff' : '2px solid transparent',
            color: isActive ? '#007bff' : '#6c757d',
            fontWeight: isActive ? '600' : '400',
            backgroundColor: isActive ? '#f8f9fa' : 'transparent',
            borderTopLeftRadius: '4px',
            borderTopRightRadius: '4px',
            transition: 'all 0.2s ease'
        });
        tab.textContent = text;
        tab.onclick = () => this.switchTab(tabId);
        return tab;
    }

    switchTab(tabId) {
        // Snapshot current values so users don't lose what they typed on the other tab.
        this._snapshotCurrentValues();
        this.currentTab = tabId;
        this.inputs.clear();

        if (tabId === 'fault') {
            this.parameters = this.faultParameters;
        } else if (tabId === 'grading') {
            this.parameters = this.gradingParameters;
        } else {
            this.parameters = this.outputParameters;
        }

        const tabs = this.container.querySelectorAll('[data-tab-id]');
        tabs.forEach(tab => {
            const tabIdAttr = tab.getAttribute('data-tab-id');
            const isActive = tabIdAttr === tabId;
            tab.style.borderBottomColor = isActive ? '#007bff' : 'transparent';
            tab.style.color = isActive ? '#007bff' : '#6c757d';
            tab.style.fontWeight = isActive ? '600' : '400';
            tab.style.backgroundColor = isActive ? '#f8f9fa' : 'transparent';
        });

        this.recreateForm();
        if (tabId === 'fault') {
            this.populateBusbars();
            this.recreateForm();
            this._bindFaultLocationModeRadios();
            this._updateFaultFieldVisibility();
        }
    }

    _snapshotCurrentValues() {
        // Persist current tab's inputs back into the parameter list so re-rendering keeps them.
        (this.parameters || []).forEach(param => {
            if (param.type === 'radio') {
                const container = this.inputs.get(param.id);
                if (!container) return;
                const checked = container.querySelector(`input[name="${param.id}"]:checked`);
                if (checked) {
                    param.options.forEach(o => { o.default = (o.value === checked.value); });
                }
            } else if (param.type === 'checkbox') {
                const input = this.inputs.get(param.id);
                if (input) param.value = !!input.checked;
            } else {
                const input = this.inputs.get(param.id);
                if (input) param.value = input.value;
            }
        });
    }

    recreateForm() {
        const scrollableContent = this.container.querySelector('[data-form-container="true"]');
        if (scrollableContent) {
            const existingForm = scrollableContent.querySelector('form');
            if (existingForm) {
                const newForm = this.createForm();
                scrollableContent.replaceChild(newForm, existingForm);
            }
        }
    }

    createForm() {
        const form = document.createElement('form');
        preventAccidentalFormSubmit(form);
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
            boxSizing: 'border-box'
        });

        this.parameters.forEach((param) => {
            const formGroup = document.createElement('div');
            Object.assign(formGroup.style, { marginBottom: '4px' });
            const showWhen = param.showWhen || 'always';
            formGroup.setAttribute('data-fault-show', showWhen);

            const label = document.createElement('label');
            Object.assign(label.style, {
                display: 'block',
                marginBottom: '4px',
                fontWeight: '600',
                fontSize: '13px',
                color: '#495057'
            });
            label.textContent = param.label;
            formGroup.appendChild(label);

            let input;
            if (param.type === 'radio') {
                input = this.createRadioGroup(param);
            } else if (param.type === 'checkbox') {
                input = this.createCheckbox(param);
            } else if (param.type === 'select') {
                input = this.createSelect(param);
            } else {
                input = this.createTextInput(param);
            }

            formGroup.appendChild(input);
            form.appendChild(formGroup);
        });

        return form;
    }

    createRadioGroup(param) {
        const radioContainer = document.createElement('div');
        Object.assign(radioContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        });

        param.options.forEach((option, index) => {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', gap: '8px' });

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = param.id;
            radio.value = option.value;
            radio.checked = !!option.default;
            radio.id = `${param.id}_${index}`;
            Object.assign(radio.style, { width: '16px', height: '16px', accentColor: '#007bff' });

            const radioLabel = document.createElement('label');
            radioLabel.htmlFor = `${param.id}_${index}`;
            radioLabel.textContent = option.label;
            Object.assign(radioLabel.style, { fontSize: '13px', color: '#6c757d', cursor: 'pointer' });

            wrapper.appendChild(radio);
            wrapper.appendChild(radioLabel);
            radioContainer.appendChild(wrapper);

            if (index === 0) this.inputs.set(param.id, radioContainer);
        });

        return radioContainer;
    }

    createCheckbox(param) {
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = param.id;
        checkbox.checked = !!param.value;
        Object.assign(checkbox.style, { width: '16px', height: '16px', accentColor: '#007bff' });
        this.inputs.set(param.id, checkbox);
        const label = document.createElement('label');
        label.htmlFor = param.id;
        label.textContent = param.label;
        Object.assign(label.style, { fontSize: '13px', color: '#6c757d', cursor: 'pointer' });
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        return wrapper;
    }

    createTextInput(param) {
        const input = document.createElement('input');
        input.type = param.type || 'text';
        input.id = param.id;
        input.value = param.value !== undefined ? String(param.value) : '';
        Object.assign(input.style, {
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'inherit',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box'
        });
        this.inputs.set(param.id, input);
        return input;
    }

    createSelect(param) {
        const select = document.createElement('select');
        Object.assign(select.style, {
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'inherit',
            backgroundColor: '#ffffff',
            boxSizing: 'border-box'
        });
        (param.options || []).forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.value || '';
            o.textContent = opt.label || '';
            if (opt.default) o.selected = true;
            select.appendChild(o);
        });
        this.inputs.set(param.id, select);
        return select;
    }

    getFormValues() {
        // Snapshot the currently visible tab too so we collect its values.
        this._snapshotCurrentValues();
        const all = [...this.faultParameters, ...this.gradingParameters, ...this.outputParameters];
        const values = {};
        all.forEach(param => {
            if (param.type === 'radio') {
                const checkedOption = (param.options || []).find(o => o.default);
                values[param.id] = checkedOption ? checkedOption.value : (param.options[0]?.value ?? '');
            } else if (param.type === 'checkbox') {
                values[param.id] = !!param.value;
            } else {
                values[param.id] = param.value;
            }
        });
        return values;
    }

    createButton(text, backgroundColor, hoverColor) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        Object.assign(button.style, {
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            backgroundColor: backgroundColor,
            color: 'white',
            transition: 'background-color 0.2s ease'
        });
        button.addEventListener('mouseenter', () => { button.style.backgroundColor = hoverColor; });
        button.addEventListener('mouseleave', () => { button.style.backgroundColor = backgroundColor; });
        return button;
    }

    show(callback) {
        this.inputs.clear();

        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
            display: 'flex',
            flexDirection: 'column',
            flex: '1 1 auto',
            minHeight: '0',
            maxHeight: '100%',
            height: '100%',
            width: '100%',
            boxSizing: 'border-box',
            overflow: 'hidden'
        });

        const description = document.createElement('div');
        Object.assign(description.style, SIMULATION_INFO_BANNER_STYLE);
        description.innerHTML = this.getDescription();
        container.appendChild(description);

        this.container = container;

        const tabInterface = this.createTabInterface();
        container.appendChild(tabInterface);

        const scrollableContent = document.createElement('div');
        scrollableContent.setAttribute('data-form-container', 'true');
        Object.assign(scrollableContent.style, SIMULATION_FORM_SCROLL_STYLE);
        const form = this.createForm();
        scrollableContent.appendChild(form);
        container.appendChild(scrollableContent);

        if (this.currentTab === 'fault') {
            this.populateBusbars();
            this.recreateForm();
            this._bindFaultLocationModeRadios();
            this._updateFaultFieldVisibility();
        }

        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef',
            flexShrink: '0'
        });

        const cancelButton = this.createButton('Cancel', '#6c757d', '#5a6268');
        const applyButton = this.createButton(this.submitButtonText, '#007bff', '#0056b3');

        cancelButton.onclick = (e) => {
            e.preventDefault();
            this.closeDialog();
        };

        applyButton.onclick = async (e) => {
            e.preventDefault();
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (window.showSubscriptionModal) {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to use the Protection Coordination feature.');
                    }
                    return;
                }
                const values = this.getFormValues();
                if (values.fault_location_mode === 'bus' && !String(values.fault_bus_id || '').trim()) {
                    alert('Select a fault busbar, or switch fault location to "Along a line".');
                    return;
                }
                if (callback) callback(values);
                this.closeDialog();
            } catch (error) {
                console.error('ProtectionCoordinationDialog: subscription check failed:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        const useDrawIODialog = !this.useModalFallback && this.ui && typeof this.ui.showDialog === 'function';
        if (useDrawIODialog) {
            this.ui.showDialog(container, 740, getDrawioStudyDialogHeight(), true, false, () => {
                this.destroy();
                return 1;
            });
        } else {
            this.showModalFallback(container);
        }
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
            console.error('ProtectionCoordinationDialog: checkSubscriptionStatus error:', error);
            return false;
        }
    }
}

// Make available globally for legacy code compatibility (same pattern as ShortCircuitDialog).
if (typeof window !== 'undefined') {
    window.ProtectionCoordinationDialog = ProtectionCoordinationDialog;
}
