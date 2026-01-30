// ShortCircuitDialog.js - Dialog for Short Circuit parameters with tabs for Pandapower and OpenDSS
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class ShortCircuitDialog extends Dialog {
    constructor(editorUi) {
        super('Short Circuit Parameters', 'Calculate');

        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        // Pandapower parameters (existing)
        this.pandapowerParameters = [
            {
                id: 'fault',
                label: 'Fault',
                type: 'radio',
                options: [
                    { value: '3ph', label: 'Three Phase', default: true },
                    { value: '2ph', label: 'Two Phase' },
                    { value: '1ph', label: 'Single Phase' }
                ]
            },
            {
                id: 'case',
                label: 'Case',
                type: 'radio',
                options: [
                    { value: 'max', label: 'Maximum', default: true },
                    { value: 'min', label: 'Minimum' }
                ]
            },
            {
                id: 'lv_tol_percent',
                label: 'Voltage tolerance in low voltage grids',
                type: 'radio',
                options: [
                    { value: '6', label: '6%', default: true },
                    { value: '10', label: '10%' }
                ]
            },
            {
                id: 'topology',
                label: 'Define option for meshing',
                type: 'radio',
                options: [
                    { value: 'auto', label: 'Auto', default: true },
                    { value: 'radial', label: 'Radial' },
                    { value: 'meshed', label: 'Meshed' }
                ]
            },
            { id: 'tk_s', label: 'Failure clearing time in seconds (only relevant for ith)', type: 'number', value: '1' },
            { id: 'r_fault_ohm', label: 'Fault resistance in Ohm', type: 'number', value: '0' },
            { id: 'x_fault_ohm', label: 'Fault reactance in Ohm', type: 'number', value: '0' },
            {
                id: 'inverse_y',
                label: 'Inverse should be used instead of LU factorization',
                type: 'radio',
                options: [
                    { value: 'True', label: 'True', default: true },
                    { value: 'False', label: 'False' }
                ]
            }
        ];

        // OpenDSS fault study parameters (OpenDSS Fault Study mode - https://opendss.epri.com/OpenDSSFaultStudyMode.html)
        this.opendssParameters = [
            {
                id: 'frequency',
                label: 'Base Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            },
            {
                id: 'fault',
                label: 'Fault Type',
                type: 'radio',
                options: [
                    { value: '3ph', label: 'Three Phase', default: true },
                    { value: '2ph', label: 'Two Phase' },
                    { value: '1ph', label: 'Single Phase' }
                ]
            },
            {
                id: 'exportOpenDSSResults',
                label: 'Export OpenDSS Fault Study Results (download .txt file)',
                type: 'checkbox',
                value: false
            }
        ];

        this.currentTab = 'pandapower';
        this.parameters = this.pandapowerParameters;
    }

    getDescription() {
        return '<strong>Configure short circuit calculation parameters</strong><br>Choose between Pandapower and OpenDSS engines.';
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

        const pandapowerTab = this.createTabHeader('Pandapower', 'pandapower', true);
        const opendssTab = this.createTabHeader('OpenDSS', 'opendss', false);

        tabHeaders.appendChild(pandapowerTab);
        tabHeaders.appendChild(opendssTab);
        tabContainer.appendChild(tabHeaders);
        return tabContainer;
    }

    createTabHeader(text, tabId, isActive) {
        const tab = document.createElement('div');
        tab.setAttribute('data-tab-id', tabId);
        Object.assign(tab.style, {
            padding: '12px 24px',
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
        tab.onmouseenter = () => {
            if (this.currentTab !== tabId) {
                tab.style.backgroundColor = '#e9ecef';
                tab.style.color = '#495057';
            }
        };
        tab.onmouseleave = () => {
            if (this.currentTab !== tabId) {
                tab.style.backgroundColor = 'transparent';
                tab.style.color = '#6c757d';
            }
        };
        return tab;
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        this.inputs.clear();
        if (tabId === 'pandapower') {
            this.parameters = this.pandapowerParameters;
        } else {
            this.parameters = this.opendssParameters;
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
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            width: '100%',
            boxSizing: 'border-box'
        });
        this.parameters.forEach((param) => {
            const formGroup = document.createElement('div');
            Object.assign(formGroup.style, { marginBottom: '4px' });
            const label = document.createElement('label');
            Object.assign(label.style, {
                display: 'block',
                marginBottom: '2px',
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
        Object.assign(radioContainer.style, { display: 'flex', flexDirection: 'column', gap: '6px' });
        param.options.forEach((option, index) => {
            const radioWrapper = document.createElement('div');
            Object.assign(radioWrapper.style, { display: 'flex', alignItems: 'center', gap: '8px' });
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = param.id;
            radio.value = option.value;
            radio.checked = option.default || false;
            radio.id = `${param.id}_${index}`;
            Object.assign(radio.style, { width: '16px', height: '16px', accentColor: '#007bff' });
            const radioLabel = document.createElement('label');
            radioLabel.htmlFor = `${param.id}_${index}`;
            radioLabel.textContent = option.label;
            Object.assign(radioLabel.style, { fontSize: '13px', color: '#6c757d', cursor: 'pointer' });
            radioWrapper.appendChild(radio);
            radioWrapper.appendChild(radioLabel);
            radioContainer.appendChild(radioWrapper);
            if (index === 0) this.inputs.set(param.id, radioContainer);
        });
        return radioContainer;
    }

    createCheckbox(param) {
        const checkboxWrapper = document.createElement('div');
        Object.assign(checkboxWrapper.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = param.id;
        checkbox.checked = param.value;
        Object.assign(checkbox.style, { width: '16px', height: '16px', accentColor: '#007bff' });
        this.inputs.set(param.id, checkbox);
        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = param.id;
        checkboxLabel.textContent = param.label;
        Object.assign(checkboxLabel.style, { fontSize: '13px', color: '#6c757d', cursor: 'pointer' });
        checkboxWrapper.appendChild(checkbox);
        checkboxWrapper.appendChild(checkboxLabel);
        return checkboxWrapper;
    }

    createTextInput(param) {
        const input = document.createElement('input');
        input.type = param.type;
        input.id = param.id;
        input.value = param.value;
        Object.assign(input.style, {
            width: '100%',
            padding: '6px 10px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '13px',
            fontFamily: 'inherit',
            backgroundColor: '#ffffff'
        });
        this.inputs.set(param.id, input);
        return input;
    }

    getFormValues() {
        const values = {};
        this.parameters.forEach(param => {
            if (param.type === 'radio') {
                const radioContainer = this.inputs.get(param.id);
                if (radioContainer) {
                    const checkedRadio = radioContainer.querySelector(`input[name="${param.id}"]:checked`);
                    values[param.id] = checkedRadio ? checkedRadio.value : (param.options[0]?.value ?? '');
                }
            } else if (param.type === 'checkbox') {
                let checkbox = this.inputs.get(param.id);
                if (!checkbox && this.container) {
                    checkbox = this.container.querySelector(`input[type="checkbox"]#${CSS.escape(param.id)}`);
                }
                values[param.id] = checkbox ? checkbox.checked : (param.value || false);
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.value : param.value;
            }
        });
        values.engine = this.currentTab;
        return values;
    }

    show(callback) {
        console.log('ShortCircuitDialog.show() called');
        this.inputs.clear();

        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
            padding: '0',
            margin: '0',
            width: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0',
            maxHeight: '100%'
        });

        if (this.getDescription) {
            const description = document.createElement('div');
            Object.assign(description.style, {
                padding: '6px 10px',
                backgroundColor: '#e3f2fd',
                border: '1px solid #bbdefb',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#1565c0',
                marginBottom: '12px'
            });
            description.innerHTML = this.getDescription();
            container.appendChild(description);
        }

        const tabInterface = this.createTabInterface();
        container.appendChild(tabInterface);

        const scrollableContent = document.createElement('div');
        scrollableContent.setAttribute('data-form-container', 'true');
        Object.assign(scrollableContent.style, {
            flex: '1',
            overflowY: 'auto',
            paddingRight: '5px',
            marginBottom: '16px',
            minHeight: '300px',
            maxHeight: '450px'
        });
        const form = this.createForm();
        scrollableContent.appendChild(form);
        container.appendChild(scrollableContent);

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
            this.destroy();
            if (this.ui && typeof this.ui.hideDialog === 'function') this.ui.hideDialog();
        };

        applyButton.onclick = async (e) => {
            e.preventDefault();
            try {
                const hasSubscription = await this.checkSubscriptionStatus();
                if (!hasSubscription) {
                    if (this.modalOverlay && this.modalOverlay.parentNode) {
                        document.body.removeChild(this.modalOverlay);
                    }
                    if (window.showSubscriptionModal) {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to use the Short Circuit calculation feature.');
                    }
                    return;
                }
                const values = this.getFormValues();
                if (callback) callback(values);
                this.destroy();
                if (this.ui && typeof this.ui.hideDialog === 'function') this.ui.hideDialog();
            } catch (error) {
                console.error('ShortCircuitDialog: Error checking subscription status:', error);
                if (error.message && error.message.includes('Token expired')) {
                    alert('Your session has expired. Please log in again.');
                    if (window.location.href.includes('app.electrisim.com')) window.location.href = '/login.html';
                } else if (error.message && (error.message.includes('NetworkError') || error.message.includes('Failed to fetch'))) {
                    alert('Unable to connect to the server. Please check your internet connection and try again.');
                } else {
                    alert('Unable to verify subscription status. Please try again. If the issue persists, contact support.');
                }
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);
        this.container = container;
        this.createModalOverlay();
        this.displayDialog();
    }

    createModalOverlay() {
        this.modalOverlay = document.createElement('div');
        Object.assign(this.modalOverlay.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: '10000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        });
        const dialogBox = document.createElement('div');
        Object.assign(dialogBox.style, {
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            minHeight: '500px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });
        const titleBar = document.createElement('div');
        Object.assign(titleBar.style, {
            padding: '16px 20px',
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #e9ecef',
            fontWeight: '600',
            fontSize: '16px',
            color: '#495057'
        });
        titleBar.textContent = this.title;
        dialogBox.appendChild(titleBar);
        const contentWrapper = document.createElement('div');
        Object.assign(contentWrapper.style, {
            padding: '20px',
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0'
        });
        contentWrapper.appendChild(this.container);
        dialogBox.appendChild(contentWrapper);
        this.modalOverlay.appendChild(dialogBox);
        document.body.appendChild(this.modalOverlay);
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) this.destroy();
        });
    }

    displayDialog() {
        console.log('ShortCircuitDialog displayed with tabbed interface');
    }

    destroy() {
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            document.body.removeChild(this.modalOverlay);
        }
        this.modalOverlay = null;
        this.container = null;
    }

    createButton(text, backgroundColor, hoverColor) {
        const button = document.createElement('button');
        button.textContent = text;
        Object.assign(button.style, {
            padding: '8px 16px',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            backgroundColor,
            color: 'white',
            transition: 'background-color 0.2s ease'
        });
        button.addEventListener('mouseenter', () => { button.style.backgroundColor = hoverColor; });
        button.addEventListener('mouseleave', () => { button.style.backgroundColor = backgroundColor; });
        return button;
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
            console.error('ShortCircuitDialog.checkSubscriptionStatus error:', error);
            throw error;
        }
    }
}
