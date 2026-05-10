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
                        label: 'Delta (convergence tolerance)',
                        description:
                            'PYPOWER OPF power-limit tolerance (see pandapower opf_basic tutorial). The notebook uses 1e-16; looser values (e.g. 1e-8) can change dispatch slightly.',
                        type: 'number',
                        value: '1e-16',
                        step: 'any'
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
                    }
                ];
                
                console.log('OptimalPowerFlowDialog: constructor completed, parameters length:', this.parameters.length);
            }

            getDescription() {
                return '<strong>Study-wide OPF options</strong><br>' +
                       'Per-device limits, marginal costs, currency labels, and polynomial curvature are edited on each symbol&rsquo;s <strong>OPF</strong> tab (generator, external grid, storage).<br>' +
                       'AC OPF uses pandapower.runopp; DC OPF uses pandapower.rundcopp.<br>' +
                       'See the <a href="https://electrisim.com/documentation.html#optimal-power-flow" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
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

                const onEscapeKey = (e) => {
                    if (e.key === 'Escape') {
                        closeOverlay();
                    }
                };
                const closeOverlay = () => {
                    overlay.remove();
                    document.removeEventListener('keydown', onEscapeKey);
                };

                // Create dialog container
                const dialog = document.createElement('div');
                dialog.style.cssText = `
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    max-width: 720px;
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

                const opfTypeParam = this.parameters.find((p) => p.id === 'opf_type');
                let initialOpfType = 'ac';
                if (opfTypeParam?.options) {
                    const defOpt = opfTypeParam.options.find((o) => o.default);
                    if (defOpt) initialOpfType = String(defOpt.value);
                }

                const syncOpfDependentVisibility = () => {
                    const sel = form.querySelector('input[name="opf_type"]:checked');
                    const cur = sel ? String(sel.value) : initialOpfType;
                    form.querySelectorAll('[data-opf-show-when]').forEach((el) => {
                        const when = el.getAttribute('data-opf-show-when');
                        el.style.display = when === cur ? '' : 'none';
                    });
                };

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

                    if (param.description && param.type !== 'radio') {
                        const desc = document.createElement('div');
                        desc.textContent = param.description;
                        desc.style.cssText =
                            'font-size: 12px; color: #555; margin: -4px 0 8px 0; line-height: 1.4;';
                        fieldContainer.appendChild(desc);
                    }

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
                                    if (param.id === 'opf_type') {
                                        syncOpfDependentVisibility();
                                    }
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
                        if (param.id === 'cost_function') {
                            const costHint = document.createElement('div');
                            costHint.style.cssText =
                                'margin-top: 12px; padding: 10px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #334155; line-height: 1.5;';
                            costHint.innerHTML =
                                '<strong>Polynomial</strong> — uses <code>opf_marginal_cost_eur_per_mwh</code> (cp1) and optional <code>opf_cp2_eur_per_mw2</code> (cp2) from each element&rsquo;s <strong>OPF</strong> tab. The pandapower <code>opf_basic</code> loss-minimization cells use <strong>the same cp1 only</strong> (no cp2); if your gens or slack still have cp2 set (e.g. 0.01), dispatch and reported marginal ∂C/∂P will differ from the notebook.<br><br>' +
                                '<strong>Piecewise linear</strong> — one segment over each device&rsquo;s OPF <strong>Min&ndash;Max P (MW)</strong> with slope from the same marginal field.<br><br>' +
                                '<strong>No cost function</strong> — no <code>poly_cost</code> / <code>pwl_cost</code>; OPF still runs without a generation-cost objective.';
                            fieldContainer.appendChild(costHint);
                        }
                    } else if (param.type === 'select') {
                        const sel = document.createElement('select');
                        sel.id = param.id;
                        sel.style.cssText =
                            'max-width: 280px; padding: 8px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px;';
                        (param.options || []).forEach((opt) => {
                            const o = document.createElement('option');
                            o.value = opt.value;
                            o.textContent = opt.label;
                            if (String(opt.value) === String(param.value)) {
                                o.selected = true;
                                values[index] = opt.value;
                            }
                            sel.appendChild(o);
                        });
                        if (values[index] === undefined) {
                            values[index] = param.value || (param.options[0] && param.options[0].value);
                        }
                        sel.addEventListener('change', () => {
                            values[index] = sel.value;
                        });
                        fieldContainer.appendChild(sel);
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

                    let nodeToAppend = fieldContainer;
                    if (param.dependsOn === 'opf_type' && param.showWhen) {
                        const wrap = document.createElement('div');
                        wrap.setAttribute('data-opf-show-when', String(param.showWhen));
                        wrap.style.display = String(param.showWhen) === initialOpfType ? '' : 'none';
                        wrap.appendChild(fieldContainer);
                        nodeToAppend = wrap;
                    }
                    form.appendChild(nodeToAppend);
                });

                syncOpfDependentVisibility();

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
                    closeOverlay();
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
                            closeOverlay();
                            
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

                        closeOverlay();

                        if (callback) {
                            callback(values);
                        }
                    } catch (error) {
                        console.error('OptimalPowerFlowDialog: Error checking subscription status:', error);
                        alert('Unable to verify subscription status. Please try again.');
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
                        closeOverlay();
                    }
                });

                document.addEventListener('keydown', onEscapeKey);
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
                    return false;
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