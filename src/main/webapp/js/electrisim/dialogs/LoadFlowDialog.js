// LoadFlowDialog.js - Dialog for Load Flow parameters with tabs for Pandapower and OpenDSS
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class LoadFlowDialog extends Dialog {
    constructor(editorUi) {
        super('Load Flow Parameters', 'Calculate');
        
        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        
        // Define parameters for both engines
        this.pandapowerParameters = [
            {
                id: 'frequency',
                label: 'Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            },
            {
                id: 'algorithm',
                label: 'Algorithm',
                type: 'radio',
                options: [
                    { value: 'nr', label: 'Newton-Raphson', default: true },
                    { value: 'iwamoto_nr', label: 'Iwamoto' },
                    { value: 'bfsw', label: 'Backward Forward Sweep' },
                    { value: 'gs', label: 'Gauss-Seidel' },
                    { value: 'fdbx', label: 'FDBX' },
                    { value: 'fdxb', label: 'FDXB' }
                ]
            },
            {
                id: 'calculate_voltage_angles',
                label: 'Calculate Voltage Angles',
                type: 'radio',
                options: [
                    { value: 'auto', label: 'Auto', default: true },
                    { value: 'True', label: 'True' },
                    { value: 'False', label: 'False' }
                ]
            },
            {
                id: 'initialization',
                label: 'Initialization',
                type: 'radio',
                options: [
                    { value: 'auto', label: 'Auto', default: true },
                    { value: 'flat', label: 'Flat' },
                    { value: 'dc', label: 'DC' }
                ]
            },
            { id: 'maxIterations', label: 'Max Iterations', type: 'number', value: '100' },
            { id: 'tolerance', label: 'Tolerance', type: 'number', value: '1e-6' },
            { id: 'enforceLimits', label: 'Enforce Q Limits', type: 'checkbox', value: false }
        ];

        this.opendssParameters = [
            {
                id: 'frequency',
                label: 'Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            },
            {
                id: 'algorithm',
                label: 'Algorithm',
                type: 'radio',
                options: [
                    { value: 'Admittance', label: 'Admittance (Iterative Load Flow)', default: true },
                    { value: 'PowerFlow', label: 'PowerFlow (Direct Solution)' }
                ]
            },
            {
                id: 'maxIterations',
                label: 'Max Iterations',
                type: 'number',
                value: '100'
            },
            {
                id: 'tolerance',
                label: 'Tolerance',
                type: 'number',
                value: '1e-6'
            },
            {
                id: 'convergence',
                label: 'Convergence Method',
                type: 'radio',
                options: [
                    { value: 'normal', label: 'Normal', default: true },
                    { value: 'accelerated', label: 'Accelerated' }
                ]
            }
        ];

        this.currentTab = 'pandapower'; // Default tab
        
        // Set the current parameters based on the default tab
        this.parameters = this.pandapowerParameters;
    }

    getDescription() {
        return '<strong>Configure load flow calculation parameters</strong><br>Choose between Pandapower (recommended for most cases) and OpenDSS engines.';
    }

    createTabInterface() {
        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            marginBottom: '16px'
        });

        // Create tab headers
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
            if (!isActive) {
                tab.style.backgroundColor = '#e9ecef';
                tab.style.color = '#495057';
            }
        };
        tab.onmouseleave = () => {
            if (!isActive) {
                tab.style.backgroundColor = 'transparent';
                tab.style.color = '#6c757d';
            }
        };

        return tab;
    }

    switchTab(tabId) {
        console.log('Switching to tab:', tabId);
        this.currentTab = tabId;
        
        // Update the parameters array based on the selected tab
        if (tabId === 'pandapower') {
            this.parameters = this.pandapowerParameters;
        } else {
            this.parameters = this.opendssParameters;
        }
        
        // Update tab headers - find all tabs with data-tab-id attribute
        const tabs = this.container.querySelectorAll('[data-tab-id]');
        console.log('Found tabs:', tabs.length, 'for tabId:', tabId);
        
        tabs.forEach(tab => {
            const tabIdAttr = tab.getAttribute('data-tab-id');
            const isActive = tabIdAttr === tabId;
            console.log('Tab:', tabIdAttr, 'isActive:', isActive);
            
            // Update tab styling
            tab.style.borderBottomColor = isActive ? '#007bff' : 'transparent';
            tab.style.color = isActive ? '#007bff' : '#6c757d';
            tab.style.fontWeight = isActive ? '600' : '400';
            tab.style.backgroundColor = isActive ? '#f8f9fa' : 'transparent';
        });

        // Recreate the form with new parameters
        this.recreateForm();
    }

    recreateForm() {
        // Find the scrollable content container and replace the form inside it
        const scrollableContent = this.container.querySelector('div[style*="overflowY"]');
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

        // Create form fields from current parameters
        this.parameters.forEach(param => {
            const formGroup = document.createElement('div');
            Object.assign(formGroup.style, {
                marginBottom: '4px'
            });

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
        Object.assign(radioContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        });

        param.options.forEach((option, index) => {
            const radioWrapper = document.createElement('div');
            Object.assign(radioWrapper.style, {
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

            radioWrapper.appendChild(radio);
            radioWrapper.appendChild(radioLabel);
            radioContainer.appendChild(radioWrapper);

            // Store reference to the radio group
            if (index === 0) {
                this.inputs.set(param.id, radioContainer);
            }
        });

        return radioContainer;
    }

    createCheckbox(param) {
        const checkboxWrapper = document.createElement('div');
        Object.assign(checkboxWrapper.style, {
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

        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = param.id;
        checkboxLabel.textContent = param.label;
        Object.assign(checkboxLabel.style, {
            fontSize: '13px',
            color: '#6c757d',
            cursor: 'pointer'
        });

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
        
        // Get values from current parameters
        this.parameters.forEach(param => {
            if (param.type === 'radio') {
                const radioContainer = this.inputs.get(param.id);
                if (radioContainer) {
                    const checkedRadio = radioContainer.querySelector(`input[name="${param.id}"]:checked`);
                    values[param.id] = checkedRadio ? checkedRadio.value : param.options[0].value;
                }
            } else if (param.type === 'checkbox') {
                const checkbox = this.inputs.get(param.id);
                values[param.id] = checkbox ? checkbox.checked : param.value;
            } else {
                const input = this.inputs.get(param.id);
                values[param.id] = input ? input.value : param.value;
            }
        });

        // Add engine type
        values.engine = this.currentTab;
        
        return values;
    }

    show(callback) {
        console.log('LoadFlowDialog.show() called');
        
        // Create the dialog content with tabs
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
            minHeight: '0', // Allow flex shrinking
            maxHeight: '100%' // Prevent overflow of parent
        });

        // Add description
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

        // Add tab interface
        const tabInterface = this.createTabInterface();
        container.appendChild(tabInterface);

        // Create scrollable content area for the form
        const scrollableContent = document.createElement('div');
        Object.assign(scrollableContent.style, {
            flex: '1',
            overflowY: 'auto',
            paddingRight: '5px', // Space for scrollbar
            marginBottom: '16px',
            minHeight: '300px', // Minimum height to ensure form is visible
            maxHeight: '450px' // Maximum height before scrolling
        });

        // Add form to scrollable area
        const form = this.createForm();
        scrollableContent.appendChild(form);
        container.appendChild(scrollableContent);

        // Add button container (fixed at bottom)
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef',
            flexShrink: '0' // Prevent buttons from shrinking
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
                console.log('LoadFlowDialog: Starting subscription check...');
                const hasSubscription = await this.checkSubscriptionStatus();
                console.log('LoadFlowDialog: Subscription check result:', hasSubscription);
                
                if (!hasSubscription) {
                    console.log('LoadFlowDialog: No subscription, showing modal...');
                    // Close the dialog first
                    if (this.modalOverlay && this.modalOverlay.parentNode) {
                        document.body.removeChild(this.modalOverlay);
                    }
                    
                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        console.log('LoadFlowDialog: Calling showSubscriptionModal');
                        window.showSubscriptionModal();
                    } else {
                        console.error('LoadFlowDialog: Subscription modal not available');
                        alert('A subscription is required to use the Load Flow calculation feature.');
                    }
                    return;
                }
                
                console.log('LoadFlowDialog: Subscription check passed, proceeding with calculation...');
                
                const values = this.getFormValues();
                console.log(`${this.title} values:`, values);
                
                if (callback) {
                    callback(values);
                }
                
                this.destroy();
                if (this.ui && typeof this.ui.hideDialog === 'function') {
                    this.ui.hideDialog();
                }
            } catch (error) {
                console.error('LoadFlowDialog: Error checking subscription status:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        // Store container reference
        this.container = container;

        // Create modal overlay and display the dialog
        this.createModalOverlay();
        this.displayDialog();
    }

    createModalOverlay() {
        // Create modal overlay
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

        // Create dialog box
        const dialogBox = document.createElement('div');
        Object.assign(dialogBox.style, {
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            width: '600px',
            maxWidth: '90vw',
            maxHeight: '85vh',
            minHeight: '600px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });

        // Add title bar
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

        // Add content
        const contentWrapper = document.createElement('div');
        Object.assign(contentWrapper.style, {
            padding: '20px',
            flex: '1',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0' // Important for proper flex shrinking
        });
        contentWrapper.appendChild(this.container);
        dialogBox.appendChild(contentWrapper);

        this.modalOverlay.appendChild(dialogBox);
        document.body.appendChild(this.modalOverlay);

        // Add click outside to close
        this.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.modalOverlay) {
                this.destroy();
            }
        });
    }

    displayDialog() {
        // The dialog is now displayed through the modal overlay
        console.log('LoadFlowDialog displayed with tabbed interface');
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
            backgroundColor: backgroundColor,
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

    // Function to check subscription status
    async checkSubscriptionStatus() {
        console.log('LoadFlowDialog.checkSubscriptionStatus() called');
        try {
            // First ensure subscription functions are available
            console.log('LoadFlowDialog: Ensuring subscription functions are available...');
            const functionsStatus = await ensureSubscriptionFunctions();
            console.log('LoadFlowDialog: Functions status:', functionsStatus);
            
            // Use the global subscription check function
            if (window.checkSubscriptionStatus) {
                console.log('LoadFlowDialog: Using window.checkSubscriptionStatus');
                const result = await window.checkSubscriptionStatus();
                console.log('LoadFlowDialog: window.checkSubscriptionStatus result:', result);
                return result;
            }
            
            // Fallback: check if subscription manager exists
            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                console.log('LoadFlowDialog: Using SubscriptionManager.checkSubscriptionStatus');
                const result = await window.SubscriptionManager.checkSubscriptionStatus();
                console.log('LoadFlowDialog: SubscriptionManager result:', result);
                return result;
            }
            
            console.warn('LoadFlowDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('LoadFlowDialog: Error in checkSubscriptionStatus:', error);
            return false;
        }
    }
} 