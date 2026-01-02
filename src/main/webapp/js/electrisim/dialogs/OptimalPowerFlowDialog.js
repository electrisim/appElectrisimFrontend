// OptimalPowerFlowDialog.js - Dialog for Optimal Power Flow parameters

// Create a standalone dialog that doesn't inherit from Dialog
(function() {
    function initOptimalPowerFlowDialog() {
        console.log('Initializing OptimalPowerFlowDialog as standalone...');
        
        const ensureSubscriptionFunctions = window.ensureSubscriptionFunctions;
        console.log('ensureSubscriptionFunctions available:', !!ensureSubscriptionFunctions);

        class OptimalPowerFlowDialog {
            constructor(editorUi) {
                console.log('OptimalPowerFlowDialog constructor called with:', editorUi);
                
                this.ui = editorUi || window.App?.main?.editor?.editorUi;
                this.graph = this.ui?.editor?.graph;
                this.title = 'Optimal Power Flow Parameters';
                this.submitButtonText = 'Calculate';
                
                console.log('OptimalPowerFlowDialog: this.ui:', !!this.ui);
                console.log('OptimalPowerFlowDialog: this.graph:', !!this.graph);
                
                this.parameters = [
                    {
                        id: 'opf_type',
                        label: 'OPF Type',
                        type: 'radio',
                        options: [
                            { value: 'ac', label: 'AC Optimal Power Flow (runopp)', default: true },
                            { value: 'dc', label: 'DC Optimal Power Flow (rundcopp)' }
                        ]
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
                        id: 'ac_algorithm',
                        label: 'AC Algorithm',
                        type: 'radio',
                        options: [
                            { value: 'pypower', label: 'PYPOWER', default: true },
                            { value: 'powermodels', label: 'PowerModels.jl (Not available)' }
                        ],
                        dependsOn: 'opf_type',
                        showWhen: 'ac'
                    },
                    {
                        id: 'dc_algorithm',
                        label: 'DC Algorithm',
                        type: 'radio',
                        options: [
                            { value: 'pypower', label: 'PYPOWER', default: true },
                            { value: 'powermodels', label: 'PowerModels.jl (Not available)' }
                        ],
                        dependsOn: 'opf_type',
                        showWhen: 'dc'
                    },
                    {
                        id: 'calculate_voltage_angles',
                        label: 'Calculate Voltage Angles',
                        type: 'radio',
                        options: [
                            { value: 'auto', label: 'Auto', default: true },
                            { value: true, label: 'True' },
                            { value: false, label: 'False' }
                        ]
                    },
                    {
                        id: 'init',
                        label: 'Initialization',
                        type: 'radio',
                        options: [
                            { value: 'pf', label: 'Power Flow', default: true },
                            { value: 'flat', label: 'Flat' },
                            { value: 'results', label: 'Previous Results' }
                        ]
                    },
                    {
                        id: 'delta',
                        label: 'Delta (Convergence Tolerance)',
                        type: 'number',
                        value: '1e-8',
                        step: '1e-10'
                    },
                    {
                        id: 'trafo_model',
                        label: 'Transformer Model',
                        type: 'radio',
                        options: [
                            { value: 't', label: 'Exact Model (t)', default: true },
                            { value: 'pi', label: 'Pi Model (pi)' }
                        ]
                    },
                    {
                        id: 'trafo_loading',
                        label: 'Transformer Loading',
                        type: 'radio',
                        options: [
                            { value: 'current', label: 'Current', default: true },
                            { value: 'power', label: 'Power' }
                        ]
                    },
                    {
                        id: 'ac_line_model',
                        label: 'AC Line Model',
                        type: 'radio',
                        options: [
                            { value: 'pi', label: 'Pi Model', default: true },
                            { value: 't', label: 'T Model' }
                        ],
                        dependsOn: 'opf_type',
                        showWhen: 'ac'
                    },
                    {
                        id: 'numba',
                        label: 'Use Numba (Performance)',
                        type: 'checkbox',
                        value: true
                    },
                    {
                        id: 'suppress_warnings',
                        label: 'Suppress Warnings',
                        type: 'checkbox',
                        value: true
                    },
                    {
                        id: 'cost_function',
                        label: 'Cost Function Type',
                        type: 'radio',
                        options: [
                            { value: 'polynomial', label: 'Polynomial Cost' },
                            { value: 'piecewise_linear', label: 'Piecewise Linear Cost' },
                            { value: 'none', label: 'No Cost Function', default: true }
                        ]
                    },
                    {
                        id: 'min_p_mw',
                        label: 'Generator Min P (MW)',
                        type: 'number',
                        value: '0',
                        step: '0.01'
                    },
                    {
                        id: 'max_p_mw',
                        label: 'Generator Max P (MW)',
                        type: 'number',
                        value: '10',
                        step: '0.01'
                    }
                ];
                
                console.log('OptimalPowerFlowDialog: constructor completed, parameters length:', this.parameters.length);
            }

            getDescription() {
                return '<strong>Configure Optimal Power Flow calculation parameters</strong><br>' +
                       'AC OPF uses pandapower.runopp for full AC optimal power flow.<br>' +
                       'DC OPF uses pandapower.rundcopp for linearized DC optimal power flow.<br>' +
                       '<em>Note: Cost functions should be defined on generators for meaningful optimization.</em>';
            }

            show(callback) {
                console.log('OptimalPowerFlowDialog.show() called');
                
                // Create modal overlay
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;

                // Create dialog container
                const dialog = document.createElement('div');
                dialog.style.cssText = `
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 600px;
                    max-height: 80vh;
                    overflow-y: auto;
                    padding: 20px;
                    margin: 20px;
                    font-family: Arial, sans-serif;
                `;

                // Create title
                const title = document.createElement('h2');
                title.textContent = this.title;
                title.style.cssText = `
                    margin: 0 0 16px 0;
                    color: #333;
                    font-size: 18px;
                `;
                dialog.appendChild(title);

                // Add description
                const description = document.createElement('div');
                description.innerHTML = this.getDescription();
                description.style.cssText = `
                    padding: 10px;
                    background: #e3f2fd;
                    border: 1px solid #bbdefb;
                    border-radius: 4px;
                    margin-bottom: 16px;
                    font-size: 12px;
                    color: #1565c0;
                `;
                dialog.appendChild(description);

                // Create form
                const form = document.createElement('form');
                const values = [];

                // Standard parameters
                this.parameters.forEach((param, index) => {
                    const fieldContainer = document.createElement('div');
                    fieldContainer.style.cssText = `
                        margin-bottom: 16px;
                        border-bottom: 1px solid #eee;
                        padding-bottom: 12px;
                    `;

                    const label = document.createElement('label');
                    label.textContent = param.label;
                    label.style.cssText = `
                        display: block;
                        margin-bottom: 8px;
                        font-weight: bold;
                        color: #333;
                    `;
                    fieldContainer.appendChild(label);

                    if (param.type === 'radio') {
                        param.options.forEach(option => {
                            const radioContainer = document.createElement('div');
                            radioContainer.style.marginBottom = '4px';

                            const radio = document.createElement('input');
                            radio.type = 'radio';
                            radio.name = param.id;
                            radio.value = option.value;
                            radio.id = `${param.id}_${option.value}`;
                            if (option.default) {
                                radio.checked = true;
                                values[index] = option.value;
                            }

                            radio.addEventListener('change', () => {
                                if (radio.checked) {
                                    values[index] = option.value;
                                }
                            });

                            const radioLabel = document.createElement('label');
                            radioLabel.htmlFor = radio.id;
                            radioLabel.textContent = option.label;
                            radioLabel.style.cssText = `
                                margin-left: 8px;
                                font-weight: normal;
                                cursor: pointer;
                            `;

                            radioContainer.appendChild(radio);
                            radioContainer.appendChild(radioLabel);
                            fieldContainer.appendChild(radioContainer);
                        });
                    } else if (param.type === 'checkbox') {
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.id = param.id;
                        checkbox.checked = param.value;
                        values[index] = param.value;

                        checkbox.addEventListener('change', () => {
                            values[index] = checkbox.checked;
                        });

                        const checkboxLabel = document.createElement('label');
                        checkboxLabel.htmlFor = checkbox.id;
                        checkboxLabel.textContent = ' Enable';
                        checkboxLabel.style.cssText = `
                            margin-left: 8px;
                            font-weight: normal;
                            cursor: pointer;
                        `;

                        fieldContainer.appendChild(checkbox);
                        fieldContainer.appendChild(checkboxLabel);
                    } else if (param.type === 'number') {
                        const input = document.createElement('input');
                        input.type = 'number';
                        input.id = param.id;
                        input.value = param.value;
                        input.step = param.step;
                        values[index] = param.value;

                        input.style.cssText = `
                            width: 100%;
                            padding: 8px;
                            border: 1px solid #ccc;
                            border-radius: 4px;
                            font-size: 14px;
                        `;

                        input.addEventListener('input', () => {
                            values[index] = input.value;
                        });

                        fieldContainer.appendChild(input);
                    }

                    form.appendChild(fieldContainer);
                });

                // --- Per-generator min/max fields ---
                const generatorCells = this.graph.getChildCells(this.graph.getDefaultParent(), true, true)
                    .filter(cell => {
                        const style = cell.getStyle && cell.getStyle();
                        return style && style.includes('Generator');
                    });
                const perGenMinMax = {}; // { generatorId: {min: inputElem, max: inputElem} }
                if (generatorCells.length > 0) {
                    const genHeader = document.createElement('div');
                    genHeader.textContent = 'Per-Generator Min/Max P (MW)';
                    genHeader.style.cssText = 'margin: 16px 0 8px 0; font-weight: bold; color: #007cba;';
                    form.appendChild(genHeader);
                }
                generatorCells.forEach(cell => {
                    const genId = cell.id;
                    const genName = cell.value?.getAttribute?.('name') || cell.mxObjectId || genId;
                    const p_mw = cell.value?.getAttribute?.('p_mw') || '';
                    const row = document.createElement('div');
                    row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';
                    const label = document.createElement('span');
                    label.textContent = `Generator ${genName} (P=${p_mw})`;
                    label.style.cssText = 'min-width: 120px; font-size: 13px;';
                    row.appendChild(label);
                    // Min field
                    const minInput = document.createElement('input');
                    minInput.type = 'number';
                    minInput.value = '0';
                    minInput.step = '0.01';
                    minInput.style.cssText = 'width: 70px;';
                    row.appendChild(document.createTextNode('Min:'));
                    row.appendChild(minInput);
                    // Max field
                    const maxInput = document.createElement('input');
                    maxInput.type = 'number';
                    maxInput.value = p_mw || '10';
                    maxInput.step = '0.01';
                    maxInput.style.cssText = 'width: 70px;';
                    row.appendChild(document.createTextNode('Max:'));
                    row.appendChild(maxInput);
                    perGenMinMax[genId] = { min: minInput, max: maxInput };
                    form.appendChild(row);
                });
                // --- End per-generator fields ---

                dialog.appendChild(form);

                // Create buttons
                const buttonContainer = document.createElement('div');
                buttonContainer.style.cssText = `
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                    margin-top: 20px;
                `;

                const cancelButton = document.createElement('button');
                cancelButton.textContent = 'Cancel';
                cancelButton.type = 'button';
                cancelButton.style.cssText = `
                    padding: 8px 16px;
                    border: 1px solid #ccc;
                    background: white;
                    border-radius: 4px;
                    cursor: pointer;
                `;
                cancelButton.addEventListener('click', () => {
                    document.body.removeChild(overlay);
                });

                const submitButton = document.createElement('button');
                submitButton.textContent = this.submitButtonText;
                submitButton.type = 'button';
                submitButton.style.cssText = `
                    padding: 8px 16px;
                    border: 1px solid #007cba;
                    background: #007cba;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                `;
                
                submitButton.addEventListener('click', async () => {
                    console.log('OptimalPowerFlowDialog Calculate button clicked, values:', values);
                    
                    // Check subscription status before proceeding
                    try {
                        console.log('OptimalPowerFlowDialog: Starting subscription check...');
                        const hasSubscription = await this.checkSubscriptionStatus();
                        console.log('OptimalPowerFlowDialog: Subscription check result:', hasSubscription);
                        
                        if (!hasSubscription) {
                            console.log('OptimalPowerFlowDialog: No subscription, showing modal...');
                            // Close the dialog first
                            document.body.removeChild(overlay);
                            
                            // Show subscription modal if no active subscription
                            if (window.showSubscriptionModal) {
                                console.log('OptimalPowerFlowDialog: Calling showSubscriptionModal');
                                window.showSubscriptionModal();
                            } else {
                                console.error('OptimalPowerFlowDialog: Subscription modal not available');
                                alert('A subscription is required to use the Optimal Power Flow calculation feature.');
                            }
                            return;
                        }
                        
                        console.log('OptimalPowerFlowDialog: Subscription check passed, proceeding with calculation...');
                        
                        // Close dialog
                        document.body.removeChild(overlay);
                        
                        // Collect per-generator min/max values
                        const perGenLimits = {};
                        Object.keys(perGenMinMax).forEach(genId => {
                            perGenLimits[genId] = {
                                min: parseFloat(perGenMinMax[genId].min.value),
                                max: parseFloat(perGenMinMax[genId].max.value)
                            };
                        });

                        // Call callback with values
                        console.log('OptimalPowerFlowDialog: Calling callback with values array:', values);
                        if (callback) {
                            callback(values, perGenLimits);
                        }
                    } catch (error) {
                        console.error('OptimalPowerFlowDialog: Error checking subscription status:', error);
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
                });

                buttonContainer.appendChild(cancelButton);
                buttonContainer.appendChild(submitButton);
                dialog.appendChild(buttonContainer);

                overlay.appendChild(dialog);
                document.body.appendChild(overlay);

                // Close on overlay click
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        document.body.removeChild(overlay);
                    }
                });

                // Close on Escape key
                const handleEscape = (e) => {
                    if (e.key === 'Escape') {
                        document.body.removeChild(overlay);
                        document.removeEventListener('keydown', handleEscape);
                    }
                };
                document.addEventListener('keydown', handleEscape);
            }

            async checkSubscriptionStatus() {
                try {
                    if (ensureSubscriptionFunctions && typeof ensureSubscriptionFunctions.checkSubscriptionStatus === 'function') {
                        console.log('OptimalPowerFlowDialog: Using ensureSubscriptionFunctions.checkSubscriptionStatus');
                        return await ensureSubscriptionFunctions.checkSubscriptionStatus();
                    } else if (window.checkSubscriptionStatus && typeof window.checkSubscriptionStatus === 'function') {
                        console.log('OptimalPowerFlowDialog: Using window.checkSubscriptionStatus');
                        return await window.checkSubscriptionStatus();
                    } else if (window.ensureSubscriptionFunctions && typeof window.ensureSubscriptionFunctions.checkSubscriptionStatus === 'function') {
                        console.log('OptimalPowerFlowDialog: Using window.ensureSubscriptionFunctions.checkSubscriptionStatus');
                        return await window.ensureSubscriptionFunctions.checkSubscriptionStatus();
                    }
                    
                    console.warn('OptimalPowerFlowDialog: No subscription check function available');
                    return false;
                } catch (error) {
                    console.error('OptimalPowerFlowDialog: Error in checkSubscriptionStatus:', error);
                    // Re-throw so the show() catch block can handle it with specific error messages
                    throw error;
                }
            }
        }

        // Make OptimalPowerFlowDialog available globally
        if (typeof globalThis !== 'undefined') {
            globalThis.OptimalPowerFlowDialog = OptimalPowerFlowDialog;
        } else if (typeof window !== 'undefined') {
            window.OptimalPowerFlowDialog = OptimalPowerFlowDialog;
        }
        
        // Export for module usage if supported
        if (typeof module !== 'undefined' && module.exports) {
            module.exports = { OptimalPowerFlowDialog };
        } else if (typeof exports === 'object') {
            try {
                exports.OptimalPowerFlowDialog = OptimalPowerFlowDialog;
            } catch (e) {
                // Ignore export errors in non-module environments
            }
        }

        console.log('OptimalPowerFlowDialog initialized and made available globally');
    }

    // Initialize immediately
    console.log('Starting OptimalPowerFlowDialog initialization...');
    initOptimalPowerFlowDialog();
})(); 