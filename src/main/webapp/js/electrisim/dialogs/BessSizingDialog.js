// BessSizingDialog.js - Dialog for BESS Sizing parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

console.log('BessSizingDialog.js LOADED');

export class BessSizingDialog extends Dialog {
    constructor(editorUi) {
        super('BESS Sizing Parameters', 'Calculate');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.scenarioInputs = []; // Initialize scenario inputs array
        this.scenariosSection = null; // Initialize scenarios section reference
        
        // Define parameters
        this.parameters = [
            {
                id: 'storageId',
                label: 'Select Battery/Storage',
                type: 'select',
                options: []
            },
            {
                id: 'pocBusbarId',
                label: 'Select POC Busbar (Point of Coupling)',
                type: 'select',
                options: []
            },
            {
                id: 'calculationMode',
                label: 'Calculation Mode',
                type: 'radio',
                options: [
                    { value: 'single', label: 'Single Target at POC', default: true },
                    { value: 'multiple', label: 'Multiple Scenarios' }
                ]
            },
            {
                id: 'targetP',
                label: 'Target Active Power at POC (MW)',
                type: 'number',
                value: '10.0',
                placeholder: '10.0',
                dependsOn: { id: 'calculationMode', value: 'single' }
            },
            {
                id: 'targetQ',
                label: 'Target Reactive Power at POC (Mvar)',
                type: 'number',
                value: '5.0',
                placeholder: '5.0',
                dependsOn: { id: 'calculationMode', value: 'single' }
            },
            {
                id: 'tolerance',
                label: 'Convergence Tolerance',
                type: 'number',
                value: '0.001',
                placeholder: '0.001'
            },
            {
                id: 'maxIterations',
                label: 'Max Iterations',
                type: 'number',
                value: '50',
                placeholder: '50'
            },
            {
                id: 'kpP',
                label: 'Proportional Gain (P)',
                type: 'number',
                value: '0.5',
                placeholder: '0.5'
            },
            {
                id: 'kpQ',
                label: 'Proportional Gain (Q)',
                type: 'number',
                value: '0.5',
                placeholder: '0.5'
            },
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
                    { value: 'bfsw', label: 'Backward Forward Sweep' }
                ]
            }
        ];
    }

    getDescription() {
        return '<strong>Battery Energy Storage System (BESS) Sizing</strong><br>Calculate required BESS power to achieve target P and Q at Point of Coupling (POC).';
    }

    // Note: createForm() is NOT used by the base Dialog class
    // The base class creates the form directly in show() using this.parameters
    // We only need to define createSelect(), createRadioGroup(), and createTextInput()
    // for handling special input types that the base class doesn't handle

    populateOptions() {
        if (!this.graph) return;

        const model = this.graph.getModel();
        const storages = [];
        const busbars = [];

        // Get all cells using getDescendants (same as networkDataPreparation.js)
        const cellsArray = model.getDescendants();
        
        cellsArray.forEach(cell => {
            if (!cell || !cell.value) return;

            const style = cell.getStyle();
            if (!style) return;

            // Parse style to get component type
            const styleParts = style.split(';');
            let componentType = null;
            for (const part of styleParts) {
                if (part.startsWith('shapeELXXX=')) {
                    componentType = part.split('=')[1];
                    break;
                }
            }

            // Check if it's a storage (component type should be 'Storage')
            if (componentType === 'Storage' || style.includes('shapeELXXX=Storage') || style.includes('multicell_battery')) {
                const name = this.getCellName(cell);
                const id = cell.getId();
                storages.push({ value: id, label: name || `Storage ${id}` });
            }

            // Check if it's a busbar (component type should be 'Bus')
            if (componentType === 'Bus' || style.includes('shapeELXXX=Bus') || style.includes('shapeELXXX=Busbar') || style.includes('busbar')) {
                const name = this.getCellName(cell);
                const id = cell.getId();
                busbars.push({ value: id, label: name || `Busbar ${id}` });
            }
        });

        // Update parameters
        const storageParam = this.parameters.find(p => p.id === 'storageId');
        if (storageParam) {
            storageParam.options = storages.length > 0 ? storages : [{ value: '', label: 'No storage found' }];
        }

        const busbarParam = this.parameters.find(p => p.id === 'pocBusbarId');
        if (busbarParam) {
            busbarParam.options = busbars.length > 0 ? busbars : [{ value: '', label: 'No busbar found' }];
        }
    }

    getCellName(cell) {
        try {
            const value = cell.value;
            if (value && value.attributes) {
                const nameAttr = value.attributes.getNamedItem('name');
                if (nameAttr) return nameAttr.nodeValue;
            }
            return cell.getId();
        } catch (e) {
            return cell.getId();
        }
    }

    createSelect(param) {
        const select = document.createElement('select');
        Object.assign(select.style, {
            width: '100%',
            padding: '8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box'
        });

        // Ensure options is an array
        const options = param.options || [];
        options.forEach(option => {
            if (!option || typeof option !== 'object') return;
            const optionEl = document.createElement('option');
            optionEl.value = option.value || '';
            optionEl.textContent = option.label || '';
            if (option.default) optionEl.selected = true;
            select.appendChild(optionEl);
        });

        this.inputs.set(param.id, select);
        return select;
    }

    createRadioGroup(param) {
        const radioContainer = document.createElement('div');
        Object.assign(radioContainer.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
        });

        // Ensure options is an array
        const options = param.options || [];
        options.forEach((option, index) => {
            if (!option || typeof option !== 'object') return;
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

            const label = document.createElement('label');
            label.htmlFor = radio.id;
            label.textContent = option.label;
            Object.assign(label.style, {
                margin: 0,
                cursor: 'pointer',
                fontSize: '14px'
            });

            radioWrapper.appendChild(radio);
            radioWrapper.appendChild(label);
            radioContainer.appendChild(radioWrapper);

            if (option.default) {
                this.inputs.set(param.id, radio);
            }

            radio.onchange = () => {
                this.inputs.set(param.id, radio);
            };
        });

        return radioContainer;
    }

    createTextInput(param) {
        const input = document.createElement('input');
        input.type = param.type || 'text';
        input.value = param.value || '';
        if (param.placeholder) input.placeholder = param.placeholder;
        
        Object.assign(input.style, {
            width: '100%',
            padding: '8px',
            border: '1px solid #ced4da',
            borderRadius: '4px',
            fontSize: '14px',
            boxSizing: 'border-box'
        });

        this.inputs.set(param.id, input);
        return input;
    }

    updateFormVisibility() {
        const calculationModeInput = this.inputs.get('calculationMode');
        console.log('[BessSizingDialog] updateFormVisibility called');
        console.log('[BessSizingDialog] calculationModeInput:', calculationModeInput);
        
        if (!calculationModeInput) {
            console.warn('[BessSizingDialog] calculationModeInput not found');
            return;
        }

        const mode = calculationModeInput.value;
        const isMultiple = mode === 'multiple';
        console.log('[BessSizingDialog] mode:', mode, 'isMultiple:', isMultiple);

        // Show/hide conditional fields using stored form groups
        if (this.formGroups) {
            this.formGroups.forEach(({ param, formGroup }) => {
                if (param.dependsOn) {
                    const shouldShow = !isMultiple; // Show if single mode, hide if multiple
                    formGroup.style.display = shouldShow ? 'block' : 'none';
                }
            });
        }

        // Show/hide scenarios section using stored reference
        if (this.scenariosSection) {
            console.log('[BessSizingDialog] Setting scenarios section display to:', isMultiple ? 'block' : 'none');
            this.scenariosSection.style.display = isMultiple ? 'block' : 'none';
        } else {
            console.warn('[BessSizingDialog] scenariosSection not found');
        }
    }

    createScenariosSection() {
        const scenariosSection = document.createElement('div');
        scenariosSection.id = 'scenarios-section';
        Object.assign(scenariosSection.style, {
            display: 'none', // Initially hidden
            marginTop: '16px',
            padding: '12px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px'
        });

        const title = document.createElement('h4');
        title.textContent = 'Configure Scenarios';
        Object.assign(title.style, {
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: '#495057'
        });
        scenariosSection.appendChild(title);

        const description = document.createElement('p');
        description.textContent = 'Set target P and Q values for each scenario:';
        Object.assign(description.style, {
            margin: '0 0 12px 0',
            fontSize: '12px',
            color: '#6c757d'
        });
        scenariosSection.appendChild(description);

        // Default scenarios (can be edited)
        const defaultScenarios = [
            { name: 'Load Supply', p: 15.0, q: 8.0 },
            { name: 'Power Export', p: -20.0, q: -5.0 },
            { name: 'Reactive Support', p: 0.0, q: 10.0 },
            { name: 'Capacitive Support', p: 5.0, q: -8.0 },
            { name: 'Balanced', p: 10.0, q: 5.0 }
        ];

        // Clear and store scenario inputs for later retrieval
        this.scenarioInputs = [];

        const table = document.createElement('table');
        Object.assign(table.style, {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px'
        });

        // Header row
        const headerRow = document.createElement('tr');
        ['Scenario', 'P (MW)', 'Q (Mvar)'].forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            Object.assign(th.style, {
                padding: '8px',
                textAlign: 'left',
                borderBottom: '2px solid #dee2e6',
                fontWeight: '600',
                backgroundColor: '#e9ecef'
            });
            headerRow.appendChild(th);
        });
        table.appendChild(headerRow);

        // Data rows with editable inputs
        defaultScenarios.forEach((scenario, index) => {
            const row = document.createElement('tr');
            Object.assign(row.style, {
                backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa'
            });

            // Scenario name (read-only)
            const nameCell = document.createElement('td');
            nameCell.textContent = scenario.name;
            Object.assign(nameCell.style, {
                padding: '8px',
                borderBottom: '1px solid #dee2e6',
                fontWeight: '500'
            });
            row.appendChild(nameCell);

            // P input
            const pCell = document.createElement('td');
            const pInput = document.createElement('input');
            pInput.type = 'number';
            pInput.step = '0.1';
            pInput.value = scenario.p.toString();
            pInput.placeholder = '0.0';
            Object.assign(pInput.style, {
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #ced4da',
                borderRadius: '3px',
                fontSize: '13px',
                boxSizing: 'border-box',
                textAlign: 'right'
            });
            pCell.appendChild(pInput);
            Object.assign(pCell.style, {
                padding: '8px',
                borderBottom: '1px solid #dee2e6'
            });
            row.appendChild(pCell);

            // Q input
            const qCell = document.createElement('td');
            const qInput = document.createElement('input');
            qInput.type = 'number';
            qInput.step = '0.1';
            qInput.value = scenario.q.toString();
            qInput.placeholder = '0.0';
            Object.assign(qInput.style, {
                width: '100%',
                padding: '4px 6px',
                border: '1px solid #ced4da',
                borderRadius: '3px',
                fontSize: '13px',
                boxSizing: 'border-box',
                textAlign: 'right'
            });
            qCell.appendChild(qInput);
            Object.assign(qCell.style, {
                padding: '8px',
                borderBottom: '1px solid #dee2e6'
            });
            row.appendChild(qCell);

            // Store inputs for retrieval
            this.scenarioInputs.push({
                name: scenario.name,
                pInput: pInput,
                qInput: qInput
            });

            table.appendChild(row);
        });

        scenariosSection.appendChild(table);
        return scenariosSection;
    }

    getFormValues() {
        const values = {};
        
        this.parameters.forEach(param => {
            const input = this.inputs.get(param.id);
            if (!input) return;

            if (param.type === 'radio') {
                values[param.id] = input.value;
            } else if (param.type === 'select') {
                values[param.id] = input.value;
            } else if (param.type === 'checkbox') {
                values[param.id] = input.checked;
            } else {
                values[param.id] = input.value;
            }
        });

        // Add scenarios if multiple mode is selected (read from input fields)
        if (values.calculationMode === 'multiple' && this.scenarioInputs) {
            values.scenarios = this.scenarioInputs.map(scenario => ({
                name: scenario.name,
                p: parseFloat(scenario.pInput.value) || 0.0,
                q: parseFloat(scenario.qInput.value) || 0.0
            }));
        }

        return values;
    }

    // Function to check subscription status (same pattern as ControllerSimulationDialog)
    async checkSubscriptionStatus() {
        console.log('BessSizingDialog.checkSubscriptionStatus() called');
        try {
            // First ensure subscription functions are available
            console.log('BessSizingDialog: Ensuring subscription functions are available...');
            if (window.ensureSubscriptionFunctions) {
                const functionsStatus = await window.ensureSubscriptionFunctions();
                console.log('BessSizingDialog: Functions status:', functionsStatus);
            }
            
            // Use the global subscription check function
            if (window.checkSubscriptionStatus) {
                console.log('BessSizingDialog: Using window.checkSubscriptionStatus');
                const result = await window.checkSubscriptionStatus();
                console.log('BessSizingDialog: window.checkSubscriptionStatus result:', result);
                return result;
            }
            
            // Fallback: check if subscription manager exists
            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                console.log('BessSizingDialog: Using SubscriptionManager.checkSubscriptionStatus');
                const result = await window.SubscriptionManager.checkSubscriptionStatus();
                console.log('BessSizingDialog: SubscriptionManager result:', result);
                return result;
            }
            
            console.warn('BessSizingDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('BessSizingDialog: Error in checkSubscriptionStatus:', error);
            // Re-throw so the applyButton.onclick catch block can handle it with specific error messages
            throw error;
        }
    }

    show(callback) {
        // Populate options BEFORE showing the dialog
        try {
            this.populateOptions();
        } catch (error) {
            console.error('Error populating options:', error);
            const storageParam = this.parameters.find(p => p.id === 'storageId');
            if (storageParam && (!storageParam.options || storageParam.options.length === 0)) {
                storageParam.options = [{ value: '', label: 'Error loading storages' }];
            }
            const busbarParam = this.parameters.find(p => p.id === 'pocBusbarId');
            if (busbarParam && (!busbarParam.options || busbarParam.options.length === 0)) {
                busbarParam.options = [{ value: '', label: 'Error loading busbars' }];
            }
        }
        
        // Check subscription status first
        if (ensureSubscriptionFunctions && ensureSubscriptionFunctions.checkSubscriptionStatus) {
            ensureSubscriptionFunctions.checkSubscriptionStatus().then((hasAccess) => {
                if (!hasAccess) {
                    alert('BESS Sizing requires an active subscription. Please upgrade your plan.');
                    return;
                }
                this.displayDialog(callback);
            }).catch((error) => {
                console.error('Error checking subscription:', error);
                this.displayDialog(callback);
            });
        } else {
            this.displayDialog(callback);
        }
    }

    displayDialog(callback) {
        // Store callback
        this.callback = callback;
        
        // Use global App if ui is not valid
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        
        // Create main container
        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
            padding: '0',
            margin: '0',
            width: '100%',
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column'
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

        // Create scrollable content area
        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, {
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 auto',
            minHeight: '0',
            paddingRight: '8px'
        });

        // Create form
        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            boxSizing: 'border-box'
        });

        // Build form fields
        this.parameters.forEach((param) => {
            const formGroup = document.createElement('div');
            Object.assign(formGroup.style, {
                marginBottom: '6px'
            });

            // Store form group reference for conditional display
            if (param.dependsOn) {
                formGroup.dataset.dependsOn = param.dependsOn.id;
                formGroup.dataset.dependsOnValue = param.dependsOn.value;
            }

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
            } else if (param.type === 'select') {
                input = this.createSelect(param);
            } else {
                input = this.createTextInput(param);
            }

            if (input && input instanceof Node) {
                formGroup.appendChild(input);
                form.appendChild(formGroup);
                
                // Add change listener for calculation mode AFTER appending to DOM
                if (param.type === 'radio' && param.id === 'calculationMode') {
                    const radios = formGroup.querySelectorAll('input[type="radio"]');
                    radios.forEach(radio => {
                        radio.addEventListener('change', () => {
                            this.updateFormVisibility();
                        });
                    });
                }
            }
            
            // Store reference to form group for visibility updates
            if (!this.formGroups) {
                this.formGroups = [];
            }
            this.formGroups.push({ param, formGroup });
            
            // Insert scenarios section right after targetQ (before tolerance)
            if (param.id === 'targetQ') {
                const scenariosSection = this.createScenariosSection();
                form.appendChild(scenariosSection);
                // Store reference for visibility updates
                this.scenariosSection = scenariosSection;
            }
        });

        // Initial visibility update (before container is set, so use direct reference)
        this.updateFormVisibility();

        contentArea.appendChild(form);
        container.appendChild(contentArea);

        // Create buttons
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef'
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
            
            // Check subscription status before proceeding (same pattern as ControllerSimulationDialog)
            try {
                console.log('BessSizingDialog: Starting subscription check...');
                const hasSubscription = await this.checkSubscriptionStatus();
                console.log('BessSizingDialog: Subscription check result:', hasSubscription);
                
                if (!hasSubscription) {
                    console.log('BessSizingDialog: No subscription, showing modal...');
                    // Close the dialog first
                    this.destroy();
                    if (this.ui && typeof this.ui.hideDialog === 'function') {
                        this.ui.hideDialog();
                    }
                    
                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        console.log('BessSizingDialog: Calling showSubscriptionModal');
                        window.showSubscriptionModal();
                    } else {
                        console.error('BessSizingDialog: Subscription modal not available');
                        alert('A subscription is required to use the BESS Sizing feature.');
                    }
                    return;
                }
                
                console.log('BessSizingDialog: Subscription check passed, proceeding with calculation...');
                
                const values = this.getFormValues();
                console.log(`${this.title} values:`, values);
                
                // Validate scenarios if multiple mode
                if (values.calculationMode === 'multiple' && values.scenarios) {
                    const invalidScenarios = values.scenarios.filter(s => 
                        isNaN(s.p) || isNaN(s.q) || s.p === null || s.q === null
                    );
                    if (invalidScenarios.length > 0) {
                        alert('Please enter valid P and Q values for all scenarios.');
                        return;
                    }
                }
                
                if (this.callback) {
                    this.callback(values);
                }
                
                this.destroy();
                if (this.ui && typeof this.ui.hideDialog === 'function') {
                    this.ui.hideDialog();
                }
            } catch (error) {
                console.error('BessSizingDialog: Error checking subscription status:', error);
                // Provide more helpful error messages based on error type
                if (error.message && error.message.includes('Token expired')) {
                    alert('Your session has expired. Please log in again.');
                    // Redirect to login if possible
                    if (window.location.href.includes('app.electrisim.com')) {
                        window.location.href = '/login.html';
                    }
                } else if (error.message && error.message.includes('NetworkError')) {
                    alert('Network connection error. Please check your internet connection and try again.');
                } else if (error.message && error.message.includes('Failed to fetch')) {
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

        // Use DrawIO's dialog system
        if (this.ui && typeof this.ui.showDialog === 'function') {
            this.ui.showDialog(container, 680, 600, true, false);
        } else {
            this.showModalFallback(container);
        }
    }
}
