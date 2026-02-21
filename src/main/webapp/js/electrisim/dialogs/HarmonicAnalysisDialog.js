import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

/**
 * HarmonicAnalysisDialog
 * ----------------------
 * Standalone dialog for configuring OpenDSS harmonic analysis parameters.
 * This dialog is separate from the main Load Flow dialog and focuses only
 * on harmonic-specific options.
 *
 * It does not offer a Pandapower tab; it is dedicated to OpenDSS.
 */
export class HarmonicAnalysisDialog extends Dialog {
    constructor(editorUi) {
        super('OpenDSS Harmonic Analysis', 'Run Harmonic Analysis');

        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        // Single-Engine parameter set for OpenDSS harmonic analysis
        // Based on: https://opendss.epri.com/HarmonicFlowAnalysis.html
        //           https://opendss.epri.com/HarmonicsLoadModeling.html
        this.parameters = [
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
                id: 'mode',
                label: 'Initial Solution Mode',
                type: 'radio',
                options: [
                    { value: 'Snapshot', label: 'Snapshot (single power flow)', default: true },
                    { value: 'Daily', label: 'Daily' },
                    { value: 'Dutycycle', label: 'Dutycycle' },
                    { value: 'Yearly', label: 'Yearly' }
                ]
            },
            {
                id: 'algorithm',
                label: 'Initial Solution Algorithm',
                type: 'radio',
                options: [
                    { value: 'Normal', label: 'Normal (fast current injection)', default: true },
                    { value: 'Newton', label: 'Newton (robust for difficult circuits)' }
                ]
            },
            {
                id: 'loadmodel',
                label: 'Load Model (Initial Power Flow)',
                type: 'radio',
                options: [
                    { value: 'Powerflow', label: 'Powerflow (iterative power injections)', default: true },
                    { value: 'Admittance', label: 'Admittance (direct solution)' }
                ]
            },
            {
                id: 'harmonics',
                label: 'Harmonic Orders (comma-separated, e.g. 3,5,7,11,13)',
                type: 'text',
                value: '3,5,7,11,13'
            },
            {
                id: 'neglectLoadY',
                label: 'Neglect load shunt admittance in harmonics (Set NeglectLoadY=Yes)',
                type: 'checkbox',
                value: false
            },
            {
                id: 'maxIterations',
                label: 'Max Iterations (initial power flow)',
                type: 'number',
                value: '100'
            },
            {
                id: 'tolerance',
                label: 'Convergence Tolerance (initial power flow)',
                type: 'number',
                value: '0.0001'
            },
            {
                id: 'controlmode',
                label: 'Control Mode',
                type: 'radio',
                options: [
                    { value: 'Static', label: 'Static (no control actions)', default: true },
                    { value: 'Event', label: 'Event (time-based controls)' },
                    { value: 'Time', label: 'Time (continuous controls)' }
                ]
            },
            {
                id: 'exportCommands',
                label: 'Export OpenDSS Commands (download .txt file)',
                type: 'checkbox',
                value: false
            },
            {
                id: 'exportOpenDSSResults',
                label: 'Export OpenDSS Results (download .txt file)',
                type: 'checkbox',
                value: false
            }
        ];
    }

    getDescription() {
        return '<strong>Configure OpenDSS harmonic analysis parameters.</strong><br>' +
               'A snapshot power flow will be solved first, then <code>Solve mode=harmonics</code> ' +
               'will be executed for the selected harmonic orders.';
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
            const group = document.createElement('div');
            Object.assign(group.style, { marginBottom: '4px' });

            const label = document.createElement('label');
            Object.assign(label.style, {
                display: 'block',
                marginBottom: '2px',
                fontWeight: '600',
                fontSize: '13px',
                color: '#495057'
            });
            label.textContent = param.label;
            group.appendChild(label);

            let input;
            if (param.type === 'radio') {
                input = this.createRadioGroup(param);
            } else if (param.type === 'checkbox') {
                input = this.createCheckbox(param);
            } else {
                input = this.createTextInput(param);
            }

            group.appendChild(input);
            form.appendChild(group);
        });

        return form;
    }

    createRadioGroup(param) {
        const container = document.createElement('div');
        Object.assign(container.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        });

        param.options.forEach((option, index) => {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            });

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = param.id;
            radio.value = option.value;
            radio.checked = option.default || false;
            radio.id = `${param.id}_${index}`;
            Object.assign(radio.style, {
                width: '16px',
                height: '16px',
                accentColor: '#007bff'
            });

            const radioLabel = document.createElement('label');
            radioLabel.htmlFor = `${param.id}_${index}`;
            radioLabel.textContent = option.label;
            Object.assign(radioLabel.style, {
                fontSize: '13px',
                color: '#6c757d',
                cursor: 'pointer'
            });

            wrapper.appendChild(radio);
            wrapper.appendChild(radioLabel);
            container.appendChild(wrapper);
        });

        // Store container for this radio group
        this.inputs.set(param.id, container);
        return container;
    }

    createCheckbox(param) {
        const wrapper = document.createElement('div');
        Object.assign(wrapper.style, {
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = param.id;
        checkbox.checked = param.value;
        Object.assign(checkbox.style, {
            width: '16px',
            height: '16px',
            accentColor: '#007bff'
        });

        this.inputs.set(param.id, checkbox);

        const label = document.createElement('label');
        label.htmlFor = param.id;
        label.textContent = param.label;
        Object.assign(label.style, {
            fontSize: '13px',
            color: '#6c757d',
            cursor: 'pointer'
        });

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        return wrapper;
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
        input.addEventListener('focus', () => {
            input.style.borderColor = '#007bff';
            input.style.outline = 'none';
            input.style.boxShadow = '0 0 0 2px rgba(0, 102, 204, 0.2)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = '#ced4da';
            input.style.boxShadow = 'none';
        });
        this.inputs.set(param.id, input);
        return input;
    }

    getFormValues() {
        const values = {};

        this.parameters.forEach((param) => {
            if (param.type === 'radio') {
                const container = this.inputs.get(param.id);
                const checkedRadio = container
                    ? container.querySelector(`input[name="${param.id}"]:checked`)
                    : null;
                values[param.id] = checkedRadio ? checkedRadio.value : param.options[0].value;
            } else if (param.type === 'checkbox') {
                const checkbox = this.inputs.get(param.id);
                values[param.id] = checkbox ? checkbox.checked : !!param.value;
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.value : param.value;
            }
        });

        // Fixed engine and analysis type for this dialog
        values.engine = 'opendss';
        values.analysisType = 'harmonic';

        return values;
    }

    show(callback) {
        // Fresh inputs map
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

        const scrollableContent = document.createElement('div');
        Object.assign(scrollableContent.style, {
            flex: '1',
            overflowY: 'auto',
            paddingRight: '5px',
            marginBottom: '16px',
            minHeight: '250px',
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
            if (this.ui && typeof this.ui.hideDialog === 'function') {
                this.ui.hideDialog();
            }
        };

        applyButton.onclick = async (e) => {
            e.preventDefault();

            // Check subscription status before proceeding
            try {
                const hasSubscription = await this.checkSubscriptionStatus();

                if (!hasSubscription) {
                    // Close the dialog first
                    if (this.modalOverlay && this.modalOverlay.parentNode) {
                        document.body.removeChild(this.modalOverlay);
                    }

                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        window.showSubscriptionModal();
                    } else {
                        alert('A subscription is required to use the Harmonic Analysis feature.');
                    }
                    return;
                }

                const values = this.getFormValues();
                if (callback) {
                    callback(values);
                }
                this.destroy();
                if (this.ui && typeof this.ui.hideDialog === 'function') {
                    this.ui.hideDialog();
                }
            } catch (error) {
                console.error('HarmonicAnalysisDialog: Error checking subscription status:', error);
                if (error.message && error.message.includes('Token expired')) {
                    alert('Your session has expired. Please log in again.');
                    if (window.location.href.includes('app.electrisim.com')) {
                        window.location.href = '/login.html';
                    }
                } else if (error.message && error.message.includes('NetworkError')) {
                    alert('Network connection error. Please check your internet connection and try again.');
                } else if (error.message && error.message.includes('Failed to fetch')) {
                    alert(
                        'Unable to connect to the server.\n\n' +
                        'This often happens when using a corporate VPN (SSL/certificate is not trusted). Try disconnecting from VPN, using another network, or ask IT to add your organisation\'s root certificate. Contact electrisim@electrisim.com if it persists.'
                    );
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
            width: '560px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            minHeight: '420px',
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
            if (e.target === this.modalOverlay) {
                this.destroy();
            }
        });
    }

    displayDialog() {
        // No-op; dialog is already attached via overlay
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

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = hoverColor;
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = backgroundColor;
        });

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

            console.warn('HarmonicAnalysisDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('HarmonicAnalysisDialog: Error in checkSubscriptionStatus:', error);
            throw error;
        }
    }
}

// Also expose globally so existing app.min.js style code can use it if needed
if (typeof window !== 'undefined') {
    window.HarmonicAnalysisDialog = HarmonicAnalysisDialog;
}

