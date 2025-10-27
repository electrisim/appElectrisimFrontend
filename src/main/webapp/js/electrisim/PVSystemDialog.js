import { Dialog } from './Dialog.js';

// Default values for PVSystem parameters (based on OpenDSS documentation)
export const defaultPVSystemData = {
    // PV Array Properties
    name: "PVSystem",
    irradiance: 1.0,
    pmpp: 100.0,
    temperature: 25.0,

    // PV Inverter Properties
    phases: 3,
    kv: 20.0,
    pf: 1.0,
    kvar: 0.0,
    kva: 120.0,
    cutin: 0.1,
    cutout: 0.1,
    conn: "wye",
    effcurve: "",
    r_percent: 0.0,
    x_percent: 50.0,

    // Operating Conditions
    model: 1,
    vmaxpu: 1.1,
    vminpu: 0.9,

    // Time-dependent Load Flow
    yearly: "",
    daily: "",
    duty: "",
    tyearly: "",
    tdaily: "",
    tduty: "",
    dutystart: 0.0,

    // Short Circuit
    spectrum: "default",
    basefreq: 50.0,
    balanced: false,

    // Harmonic
    class_: 1,
    debugtrace: false,

    // Dynamic
    controlmode: "GFL",
    dynamiceq: "",
    dynout: "",
    kp: 0.1,
    kvarmax: 120.0,
    kvarmaxabs: 120.0,
    kvdc: 20.0,
    limitcurrent: false,
    pfpriority: false,
    pitol: 0.01,
    safemode: false,
    safevoltage: 0.8,
    varfollowinverter: false,
    wattpriority: false,
    amplimit: 1.0,
    amplimitgain: 0.8,
    pminkvarmax: 0.0,
    pminnovars: 0.0,
    pmpp_percent: 100.0
};

export class PVSystemDialog extends Dialog {
    constructor(editorUi) {
        super('PVSystem Parameters', 'Apply');

        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'snapshot';
        this.data = { ...defaultPVSystemData };
        this.inputs = new Map(); // Initialize inputs map for form elements

        // Snapshot Load Flow parameters
        this.snapshotLoadFlowParameters = [
            // PV Array Properties
            {
                id: 'name',
                label: 'PVSystem Name',
                description: 'Name identifier for the PV system element',
                type: 'text',
                value: this.data.name,
                category: 'PV Array'
            },
            {
                id: 'irradiance',
                label: 'Irradiance [kW/m²]',
                description: 'Present irradiance value in kW/sq-m. Used for snapshot power flow calculations at this specific operating point.',
                type: 'number',
                value: this.data.irradiance.toString(),
                step: '0.01',
                min: '0',
                category: 'PV Array'
            },
            {
                id: 'pmpp',
                label: 'Peak Power (Pmpp) [kW]',
                description: 'Rated max power of the PV array for 1.0 kW/sq-m irradiance',
                type: 'number',
                value: this.data.pmpp.toString(),
                step: '0.1',
                min: '0',
                category: 'PV Array'
            },
            {
                id: 'temperature',
                label: 'Temperature [°C]',
                description: 'Present temperature in degrees Celsius',
                type: 'number',
                value: this.data.temperature.toString(),
                step: '0.1',
                category: 'PV Array'
            },

            // PV Inverter Properties
            {
                id: 'phases',
                label: 'Phases',
                description: 'Number of phases for the PV system',
                type: 'number',
                value: this.data.phases.toString(),
                step: '1',
                min: '1',
                max: '3',
                category: 'PV Inverter'
            },
            {
                id: 'kv',
                label: 'Voltage [kV]',
                description: 'Nominal rated voltage in kV',
                type: 'number',
                value: this.data.kv.toString(),
                step: '0.1',
                min: '0',
                category: 'PV Inverter'
            },
            {
                id: 'pf',
                label: 'Power Factor (pf)',
                description: 'Power factor for the output power',
                type: 'number',
                value: this.data.pf.toString(),
                step: '0.01',
                min: '-1',
                max: '1',
                category: 'PV Inverter'
            },
            {
                id: 'kvar',
                label: 'Reactive Power [kVar]',
                description: 'Present kvar value',
                type: 'number',
                value: this.data.kvar.toString(),
                step: '0.1',
                category: 'PV Inverter'
            },
            {
                id: 'kva',
                label: 'Inverter Rating  [kVA]',
                description: 'kVA rating of inverter',
                type: 'number',
                value: this.data.kva.toString(),
                step: '0.1',
                min: '0',
                category: 'PV Inverter'
            },

            // Operating Conditions
            {
                id: 'model',
                label: 'Model Type (model)',
                description: 'Model to use for power output variation with voltage',
                type: 'select',
                value: this.data.model.toString(),
                options: [
                    { value: '1', label: 'Constant Power' },
                    { value: '2', label: 'Constant Admittance' },
                    { value: '3', label: 'User Model' }
                ],
                category: 'Operating Conditions'
            },
            {
                id: 'vminpu',
                label: 'Min Voltage (Vminpu) [pu]',
                description: 'Minimum per unit voltage for model application',
                type: 'number',
                value: this.data.vminpu.toString(),
                step: '0.01',
                min: '0',
                category: 'Operating Conditions'
            },
            {
                id: 'vmaxpu',
                label: 'Max Voltage (Vmaxpu) [pu]',
                description: 'Maximum per unit voltage for model application',
                type: 'number',
                value: this.data.vmaxpu.toString(),
                step: '0.01',
                min: '0',
                category: 'Operating Conditions'
            }
        ];

        // Time-dependent Load Flow parameters
        this.timeDependentParameters = [
            // PV Array Properties
            {
                id: 'irradiance',
                label: 'Irradiance [kW/m²]',
                description: 'Present irradiance value in kW/sq-m. For time-dependent analysis, consider using irradiance shapes in the load shape definitions.',
                type: 'number',
                value: this.data.irradiance.toString(),
                step: '0.01',
                min: '0',
                category: 'PV Array'
            },
            {
                id: 'temperature',
                label: 'Temperature [°C]',
                description: 'Present temperature in degrees Celsius',
                type: 'number',
                value: this.data.temperature.toString(),
                step: '0.1',
                category: 'PV Array'
            },

            // Load Shapes and Temperature Shapes
            {
                id: 'yearly',
                label: 'Yearly Load Shape (yearly)',
                description: 'Dispatch shape to use for YEARLY simulations',
                type: 'text',
                value: this.data.yearly,
                category: 'Load Shapes'
            },
            {
                id: 'daily',
                label: 'Daily Load Shape (daily)',
                description: 'Dispatch shape to use for DAILY simulations',
                type: 'text',
                value: this.data.daily,
                category: 'Load Shapes'
            },
            {
                id: 'duty',
                label: 'Duty Load Shape (duty)',
                description: 'Load shape to use for DUTY cycle dispatch simulations',
                type: 'text',
                value: this.data.duty,
                category: 'Load Shapes'
            },
            {
                id: 'dutystart',
                label: 'Duty Start (DutyStart) [hours]',
                description: 'Starting time offset into the duty cycle shape',
                type: 'number',
                value: this.data.dutystart.toString(),
                step: '0.1',
                category: 'Load Shapes'
            },

            // Temperature Shapes
            {
                id: 'tyearly',
                label: 'Yearly Temperature Shape (Tyearly)',
                description: 'Temperature shape to use for YEARLY simulations',
                type: 'text',
                value: this.data.tyearly,
                category: 'Temperature Shapes'
            },
            {
                id: 'tdaily',
                label: 'Daily Temperature Shape (Tdaily)',
                description: 'Temperature shape to use for DAILY simulations',
                type: 'text',
                value: this.data.tdaily,
                category: 'Temperature Shapes'
            },
            {
                id: 'tduty',
                label: 'Duty Temperature Shape (Tduty)',
                description: 'Temperature shape to use for DUTY cycle dispatch simulations',
                type: 'text',
                value: this.data.tduty,
                category: 'Temperature Shapes'
            }
        ];

        // Short Circuit parameters
        this.shortCircuitParameters = [
            // PV Inverter Properties
            {
                id: 'r_percent',
                label: 'Internal Resistance (%R) [%]',
                description: 'Equivalent percent internal resistance, ohms',
                type: 'number',
                value: this.data.r_percent.toString(),
                step: '0.01',
                min: '0',
                category: 'PV Inverter'
            },
            {
                id: 'x_percent',
                label: 'Internal Reactance (%X) [%]',
                description: 'Equivalent percent internal reactance, ohms',
                type: 'number',
                value: this.data.x_percent.toString(),
                step: '0.01',
                min: '0',
                category: 'PV Inverter'
            },

            // Short Circuit Properties
            {
                id: 'basefreq',
                label: 'Base Frequency (basefreq) [Hz]',
                description: 'Base frequency for ratings',
                type: 'number',
                value: this.data.basefreq.toString(),
                step: '0.1',
                min: '0',
                category: 'Short Circuit Properties'
            },
            {
                id: 'balanced',
                label: 'Force Balanced (Balanced)',
                description: 'Force balanced current only for 3-phase PVSystems',
                type: 'checkbox',
                value: this.data.balanced,
                category: 'Short Circuit Properties'
            }
        ];

        // Harmonic parameters
        this.harmonicParameters = [
            // General Harmonic Properties
            {
                id: 'class_',
                label: 'Class (class)',
                description: 'Class of PVSystem element for segregation',
                type: 'number',
                value: this.data.class_.toString(),
                step: '1',
                min: '1',
                category: 'General'
            },
            {
                id: 'debugtrace',
                label: 'Debug Trace (debugtrace)',
                description: 'Turn on to capture PVSystem model progress',
                type: 'checkbox',
                value: this.data.debugtrace,
                category: 'General'
            },

            // Harmonic Analysis Properties
            {
                id: 'spectrum',
                label: 'Harmonic Spectrum (spectrum)',
                description: 'Name of harmonic voltage or current spectrum',
                type: 'text',
                value: this.data.spectrum,
                category: 'Harmonic Analysis'
            }
        ];

        // Dynamic parameters
        this.dynamicParameters = [
            // Control Mode
            {
                id: 'controlmode',
                label: 'Control Mode (ControlMode)',
                description: 'Control mode for the inverter (GFL/GFM)',
                type: 'select',
                value: this.data.controlmode,
                options: [
                    { value: 'GFL', label: 'Grid Following (GFL)' },
                    { value: 'GFM', label: 'Grid Forming (GFM)' }
                ],
                category: 'Control'
            },

            // Dynamic Equation
            {
                id: 'dynamiceq',
                label: 'Dynamic Equation (DynamicEq)',
                description: 'Name of dynamic equation for defining behavior',
                type: 'text',
                value: this.data.dynamiceq,
                category: 'Dynamic Equation'
            },
            {
                id: 'dynout',
                label: 'Dynamic Outputs (DynOut)',
                description: 'Variables within the dynamic equation',
                type: 'text',
                value: this.data.dynout,
                category: 'Dynamic Equation'
            },

            // PI Controller
            {
                id: 'kp',
                label: 'Proportional Gain (kp)',
                description: 'Proportional gain for PI controller',
                type: 'number',
                value: this.data.kp.toString(),
                step: '0.001',
                min: '0',
                category: 'PI Controller'
            },
            {
                id: 'pitol',
                label: 'PI Tolerance (PITol) [%]',
                description: 'Tolerance for closed loop controller',
                type: 'number',
                value: this.data.pitol.toString(),
                step: '0.001',
                min: '0',
                max: '1',
                category: 'PI Controller'
            },

            // Reactive Power Limits
            {
                id: 'kvarmax',
                label: 'Max Reactive Power (kvarMax) [kVar]',
                description: 'Maximum reactive power generation',
                type: 'number',
                value: this.data.kvarmax.toString(),
                step: '0.1',
                min: '0',
                category: 'Reactive Power Limits'
            },
            {
                id: 'kvarmaxabs',
                label: 'Max Abs Reactive Power (kvarMaxAbs) [kVar]',
                description: 'Maximum reactive power absorption',
                type: 'number',
                value: this.data.kvarmaxabs.toString(),
                step: '0.1',
                min: '0',
                category: 'Reactive Power Limits'
            },

            // DC Properties
            {
                id: 'kvdc',
                label: 'DC Voltage (kVDC) [kV]',
                description: 'Rated voltage at input of inverter',
                type: 'number',
                value: this.data.kvdc.toString(),
                step: '0.1',
                min: '0',
                category: 'DC Properties'
            },

            // Safety and Limits
            {
                id: 'limitcurrent',
                label: 'Limit Current (LimitCurrent)',
                description: 'Limits current magnitude to Vminpu value',
                type: 'checkbox',
                value: this.data.limitcurrent,
                category: 'Safety and Limits'
            },
            {
                id: 'amplimit',
                label: 'Current Limit (AmpLimit) [A]',
                description: 'Current limiter per phase for IBR in GFM mode',
                type: 'number',
                value: this.data.amplimit.toString(),
                step: '0.1',
                min: '0',
                category: 'Safety and Limits'
            },
            {
                id: 'amplimitgain',
                label: 'Current Limit Gain (AmpLimitGain)',
                description: 'Gain for current limiter fine tuning',
                type: 'number',
                value: this.data.amplimitgain.toString(),
                step: '0.01',
                min: '0.1',
                max: '1',
                category: 'Safety and Limits'
            },
            {
                id: 'safemode',
                label: 'Safe Mode (SafeMode)',
                description: 'Indicates if inverter entered safe mode',
                type: 'checkbox',
                value: this.data.safemode,
                category: 'Safety and Limits'
            },
            {
                id: 'safevoltage',
                label: 'Safe Voltage (SafeVoltage) [%]',
                description: 'Voltage level for inverter operation',
                type: 'number',
                value: this.data.safevoltage.toString(),
                step: '0.01',
                min: '0',
                max: '1',
                category: 'Safety and Limits'
            },

            // Priority Settings
            {
                id: 'pfpriority',
                label: 'PF Priority (PFPriority)',
                description: 'Set inverter to operate with PF priority',
                type: 'checkbox',
                value: this.data.pfpriority,
                category: 'Priority Settings'
            },
            {
                id: 'wattpriority',
                label: 'Watt Priority (WattPriority)',
                description: 'Set inverter to watt priority instead of var priority',
                type: 'checkbox',
                value: this.data.wattpriority,
                category: 'Priority Settings'
            },

            // Advanced Limits
            {
                id: 'pminkvarmax',
                label: 'Min Active Power for Max kVar (%PminkvarMax) [%]',
                description: 'Minimum active power for max reactive power',
                type: 'number',
                value: this.data.pminkvarmax.toString(),
                step: '0.01',
                min: '0',
                max: '1',
                category: 'Advanced Limits'
            },
            {
                id: 'pminnovars',
                label: 'Min Active Power for No Vars (%PminNoVars) [%]',
                description: 'Minimum active power for no vars production',
                type: 'number',
                value: this.data.pminnovars.toString(),
                step: '0.01',
                min: '0',
                max: '1',
                category: 'Advanced Limits'
            },
            {
                id: 'pmpp_percent',
                label: 'Upper Limit Active Power (%Pmpp) [%]',
                description: 'Upper limit on active power as percentage of Pmpp',
                type: 'number',
                value: this.data.pmpp_percent.toString(),
                step: '0.01',
                min: '0',
                max: '1',
                category: 'Advanced Limits'
            },

            // Inverter Following
            {
                id: 'varfollowinverter',
                label: 'Var Follow Inverter (VarFollowInverter)',
                description: 'Reactive power follows inverter status',
                type: 'checkbox',
                value: this.data.varfollowinverter,
                category: 'Inverter Following'
            }
        ];
    }

    getDescription() {
        return '<strong>Configure PVSystem Parameters</strong><br>Set comprehensive parameters for photovoltaic system with inverter control and power management capabilities organized into tabs for different analysis types. Based on <a href="https://opendss.epri.com/Properties6.html" target="_blank">OpenDSS documentation</a>.';
    }

    show(callback) {
        // Store callback for later use
        this.callback = callback;

        // Create custom dialog content with tabs
        this.showTabDialog();
    }

    showTabDialog() {
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

        // Create tab container
        const tabContainer = document.createElement('div');
        Object.assign(tabContainer.style, {
            display: 'flex',
            borderBottom: '2px solid #e9ecef',
            marginBottom: '16px'
        });

        // Create tabs
        const snapshotTab = this.createTab('Snapshot Load Flow', 'snapshot', true); // Always start with snapshot tab active
        const timeDependentTab = this.createTab('Time-dependent Load Flow', 'timedependent', false);
        const shortCircuitTab = this.createTab('Short Circuit', 'shortcircuit', false);
        const harmonicTab = this.createTab('Harmonic', 'harmonic', false);
        const dynamicTab = this.createTab('Dynamic', 'dynamic', false);

        tabContainer.appendChild(snapshotTab);
        tabContainer.appendChild(timeDependentTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(harmonicTab);
        tabContainer.appendChild(dynamicTab);
        container.appendChild(tabContainer);

        // Create content area
        const contentArea = document.createElement('div');
        Object.assign(contentArea.style, {
            overflowY: 'auto',
            overflowX: 'hidden',
            flex: '1 1 auto',
            minHeight: '0',
            scrollbarWidth: 'thin',
            scrollbarColor: '#c1c1c1 #f1f1f1',
            paddingRight: '8px'
        });

        // Create tab content containers with sub-tabs
        const snapshotContent = this.createTabContentWithSubTabs('snapshot', this.snapshotLoadFlowParameters);
        const timeDependentContent = this.createTabContentWithSubTabs('timedependent', this.timeDependentParameters);
        const shortCircuitContent = this.createTabContentWithSubTabs('shortcircuit', this.shortCircuitParameters);
        const harmonicContent = this.createTabContentWithSubTabs('harmonic', this.harmonicParameters);
        const dynamicContent = this.createTabContentWithSubTabs('dynamic', this.dynamicParameters);

        contentArea.appendChild(snapshotContent);
        contentArea.appendChild(timeDependentContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(harmonicContent);
        contentArea.appendChild(dynamicContent);
        container.appendChild(contentArea);

        // Ensure the initial tab content is visible and properly styled
        // Set snapshot content to be visible by default
        snapshotContent.style.display = 'block';
        // Call switchTab to properly style the active tab and hide others
        this.switchTab('snapshot', snapshotTab, [timeDependentTab, shortCircuitTab, harmonicTab, dynamicTab], snapshotContent, [timeDependentContent, shortCircuitContent, harmonicContent, dynamicContent]);

        // Add button container
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
        const applyButton = this.createButton('Apply', '#007bff', '#0056b3');

        cancelButton.onclick = (e) => {
            e.preventDefault();
            this.destroy();
            if (this.ui && typeof this.ui.hideDialog === 'function') {
                this.ui.hideDialog();
            }
        };

        applyButton.onclick = (e) => {
            e.preventDefault();
            const values = this.getFormValues();

            if (this.callback) {
                this.callback(values);
            }

            this.destroy();
            if (this.ui && typeof this.ui.hideDialog === 'function') {
                this.ui.hideDialog();
            }
        };

        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(applyButton);
        container.appendChild(buttonContainer);

        this.container = container;

        // Tab click handlers
        snapshotTab.onclick = () => this.switchTab('snapshot', snapshotTab, [timeDependentTab, shortCircuitTab, harmonicTab, dynamicTab], snapshotContent, [timeDependentContent, shortCircuitContent, harmonicContent, dynamicContent]);
        timeDependentTab.onclick = () => this.switchTab('timedependent', timeDependentTab, [snapshotTab, shortCircuitTab, harmonicTab, dynamicTab], timeDependentContent, [snapshotContent, shortCircuitContent, harmonicContent, dynamicContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [snapshotTab, timeDependentTab, harmonicTab, dynamicTab], shortCircuitContent, [snapshotContent, timeDependentContent, harmonicContent, dynamicContent]);
        harmonicTab.onclick = () => this.switchTab('harmonic', harmonicTab, [snapshotTab, timeDependentTab, shortCircuitTab, dynamicTab], harmonicContent, [snapshotContent, timeDependentContent, shortCircuitContent, dynamicContent]);
        dynamicTab.onclick = () => this.switchTab('dynamic', dynamicTab, [snapshotTab, timeDependentTab, shortCircuitTab, harmonicTab], dynamicContent, [snapshotContent, timeDependentContent, shortCircuitContent, harmonicContent]);

        // Show dialog using DrawIO's dialog system
        if (this.ui && typeof this.ui.showDialog === 'function') {
            const screenHeight = window.innerHeight - 80;
            this.ui.showDialog(container, 1000, screenHeight, true, false);
        } else {
            this.showModalFallback(container);
        }
    }

    createTab(title, tabId, isActive) {
        const tab = document.createElement('div');
        Object.assign(tab.style, {
            padding: '12px 20px',
            cursor: 'pointer',
            borderBottom: isActive ? '2px solid #007bff' : '2px solid transparent',
            backgroundColor: isActive ? '#f8f9fa' : 'transparent',
            color: isActive ? '#007bff' : '#6c757d',
            fontWeight: isActive ? '600' : '400',
            transition: 'all 0.2s ease',
            userSelect: 'none'
        });
        tab.textContent = title;
        tab.dataset.tab = tabId;

        tab.addEventListener('mouseenter', () => {
            if (!tab.classList.contains('active')) {
                tab.style.backgroundColor = '#f8f9fa';
            }
        });

        tab.addEventListener('mouseleave', () => {
            if (!tab.classList.contains('active')) {
                tab.style.backgroundColor = 'transparent';
            }
        });

        if (isActive) {
            tab.classList.add('active');
        }

        return tab;
    }

    createTabContent(tabId, parameters) {
        const content = document.createElement('div');
        content.dataset.tab = tabId;
        Object.assign(content.style, {
            display: tabId === this.currentTab ? 'block' : 'none'
        });

        const form = document.createElement('form');
        Object.assign(form.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        parameters.forEach(param => {
            const parameterRow = document.createElement('div');
            Object.assign(parameterRow.style, {
                display: 'grid',
                gridTemplateColumns: '1fr 200px',
                gap: '20px',
                alignItems: 'start',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                minHeight: '80px'
            });

            // Left column: Label and description
            const leftColumn = document.createElement('div');
            Object.assign(leftColumn.style, {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '60px'
            });

            const label = document.createElement('label');
            Object.assign(label.style, {
                fontWeight: '600',
                fontSize: '14px',
                color: '#495057',
                marginBottom: '6px',
                lineHeight: '1.2'
            });
            label.textContent = param.label;
            label.htmlFor = param.id;

            const description = document.createElement('div');
            Object.assign(description.style, {
                fontSize: '12px',
                color: '#6c757d',
                lineHeight: '1.4',
                fontStyle: 'italic',
                marginBottom: '4px'
            });
            description.textContent = param.description;

            leftColumn.appendChild(label);
            leftColumn.appendChild(description);

            // Right column: Input field with fixed width
            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minHeight: '60px',
                width: '200px'
            });

            let input;

            // Handle different input types
            if (param.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = param.value;
                Object.assign(input.style, {
                    width: '24px',
                    height: '24px',
                    accentColor: '#007bff',
                    cursor: 'pointer',
                    margin: '0'
                });
            } else if (param.type === 'select') {
                input = document.createElement('select');
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                });

                // Add options
                if (param.options) {
                    param.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option.value;
                        optionElement.textContent = option.label;
                        if (option.value === param.value) {
                            optionElement.selected = true;
                        }
                        input.appendChild(optionElement);
                    });
                }
            } else {
                input = document.createElement('input');
                input.type = param.type;
                input.value = param.value;
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                });

                input.addEventListener('focus', () => {
                    input.style.borderColor = '#007bff';
                    input.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
                    input.style.transform = 'translateY(-1px)';
                });

                input.addEventListener('blur', () => {
                    input.style.borderColor = '#ced4da';
                    input.style.boxShadow = 'none';
                    input.style.transform = 'translateY(0)';
                });

                // Add hover effect
                input.addEventListener('mouseenter', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#adb5bd';
                        input.style.backgroundColor = '#f8f9fa';
                    }
                });

                input.addEventListener('mouseleave', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#ced4da';
                        input.style.backgroundColor = '#ffffff';
                    }
                });
            }

            // Set additional attributes for number inputs
            if (param.type === 'number') {
                if (param.step) input.step = param.step;
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
            }

            input.id = param.id;
            this.inputs.set(param.id, input);
            rightColumn.appendChild(input);

            parameterRow.appendChild(leftColumn);
            parameterRow.appendChild(rightColumn);
            form.appendChild(parameterRow);
        });

        content.appendChild(form);
        return content;
    }

    createTabContentWithSubTabs(tabId, parameters) {
        const content = document.createElement('div');
        content.dataset.tab = tabId;
        Object.assign(content.style, {
            display: tabId === this.currentTab ? 'block' : 'none'
        });

        // Group parameters by category
        const categories = {};
        parameters.forEach(param => {
            if (!categories[param.category]) {
                categories[param.category] = [];
            }
            categories[param.category].push(param);
        });

        // Create category containers
        Object.keys(categories).forEach(category => {
            const categoryContainer = document.createElement('div');
            Object.assign(categoryContainer.style, {
                marginBottom: '24px'
            });

            // Category header
            const categoryHeader = document.createElement('div');
            Object.assign(categoryHeader.style, {
                fontWeight: '600',
                fontSize: '16px',
                color: '#007bff',
                marginBottom: '12px',
                paddingBottom: '8px',
                borderBottom: '2px solid #e9ecef'
            });
            categoryHeader.textContent = category;
            categoryContainer.appendChild(categoryHeader);

            // Category content
            const categoryContent = this.createCategoryContent(categories[category]);
            categoryContainer.appendChild(categoryContent);

            content.appendChild(categoryContainer);
        });

        return content;
    }

    createCategoryContent(parameters) {
        const content = document.createElement('div');
        Object.assign(content.style, {
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
        });

        parameters.forEach(param => {
            const parameterRow = document.createElement('div');
            Object.assign(parameterRow.style, {
                display: 'grid',
                gridTemplateColumns: '1fr 200px',
                gap: '20px',
                alignItems: 'start',
                padding: '16px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '8px',
                minHeight: '80px'
            });

            // Left column: Label and description
            const leftColumn = document.createElement('div');
            Object.assign(leftColumn.style, {
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minHeight: '60px'
            });

            const label = document.createElement('label');
            Object.assign(label.style, {
                fontWeight: '600',
                fontSize: '14px',
                color: '#495057',
                marginBottom: '6px',
                lineHeight: '1.2'
            });
            label.textContent = param.label;
            label.htmlFor = param.id;

            const description = document.createElement('div');
            Object.assign(description.style, {
                fontSize: '12px',
                color: '#6c757d',
                lineHeight: '1.4',
                fontStyle: 'italic',
                marginBottom: '4px'
            });
            description.textContent = param.description;

            leftColumn.appendChild(label);
            leftColumn.appendChild(description);

            // Right column: Input field with fixed width
            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                minHeight: '60px',
                width: '200px'
            });

            let input;

            // Handle different input types
            if (param.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = param.value;
                Object.assign(input.style, {
                    width: '24px',
                    height: '24px',
                    accentColor: '#007bff',
                    cursor: 'pointer',
                    margin: '0'
                });
            } else if (param.type === 'select') {
                input = document.createElement('select');
                param.options.forEach(option => {
                    const opt = document.createElement('option');
                    // Handle both string options and object options with value/label structure
                    if (typeof option === 'string') {
                        opt.value = option;
                        opt.textContent = option;
                    } else if (typeof option === 'object' && option.value !== undefined) {
                        opt.value = option.value;
                        opt.textContent = option.label || option.value;
                    } else {
                        opt.value = option;
                        opt.textContent = option;
                    }
                    if (opt.value === param.value) {
                        opt.selected = true;
                    }
                    input.appendChild(opt);
                });
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                });
            } else {
                input = document.createElement('input');
                input.type = param.type;
                input.value = param.value;
                Object.assign(input.style, {
                    width: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                });

                input.addEventListener('focus', () => {
                    input.style.borderColor = '#007bff';
                    input.style.boxShadow = '0 0 0 3px rgba(0, 123, 255, 0.15)';
                    input.style.transform = 'translateY(-1px)';
                });

                input.addEventListener('blur', () => {
                    input.style.borderColor = '#ced4da';
                    input.style.boxShadow = 'none';
                    input.style.transform = 'translateY(0)';
                });

                // Add hover effect
                input.addEventListener('mouseenter', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#adb5bd';
                        input.style.backgroundColor = '#f8f9fa';
                    }
                });

                input.addEventListener('mouseleave', () => {
                    if (input !== document.activeElement) {
                        input.style.borderColor = '#ced4da';
                        input.style.backgroundColor = '#ffffff';
                    }
                });
            }

            input.id = param.id;

            // Set additional attributes
            if (param.step) input.step = param.step;
            if (param.min !== undefined) input.min = param.min;
            if (param.max !== undefined) input.max = param.max;

            this.inputs.set(param.id, input);
            rightColumn.appendChild(input);

            parameterRow.appendChild(leftColumn);
            parameterRow.appendChild(rightColumn);
            content.appendChild(parameterRow);
        });

        return content;
    }

    createButton(text, bgColor, hoverColor) {
        const button = document.createElement('button');
        button.textContent = text;
        Object.assign(button.style, {
            padding: '8px 16px',
            backgroundColor: bgColor,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.2s'
        });

        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = hoverColor;
        });

        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = bgColor;
        });

        return button;
    }

    switchTab(tabId, activeTab, inactiveTabs, activeContent, inactiveContents) {
        this.currentTab = tabId;

        // Update active tab styles
        Object.assign(activeTab.style, {
            borderBottom: '2px solid #007bff',
            backgroundColor: '#f8f9fa',
            color: '#007bff',
            fontWeight: '600'
        });
        activeTab.classList.add('active');

        // Update inactive tab styles
        inactiveTabs.forEach(inactiveTab => {
            Object.assign(inactiveTab.style, {
                borderBottom: '2px solid transparent',
                backgroundColor: 'transparent',
                color: '#6c757d',
                fontWeight: '400'
            });
            inactiveTab.classList.remove('active');
        });

        // Update content visibility
        activeContent.style.display = 'block';
        inactiveContents.forEach(inactiveContent => {
            inactiveContent.style.display = 'none';
        });
    }

    getFormValues() {
        const values = {};

        // Collect all parameter values from all tabs
        [...this.snapshotLoadFlowParameters, ...this.timeDependentParameters, ...this.shortCircuitParameters, ...this.harmonicParameters, ...this.dynamicParameters].forEach(param => {
            const input = this.inputs.get(param.id);
            if (input) {
                if (param.type === 'number') {
                    values[param.id] = parseFloat(input.value) || 0;
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else if (param.type === 'select') {
                    values[param.id] = input.value;
                } else {
                    values[param.id] = input.value;
                }
            }
        });

        return values;
    }

    destroy() {
        // Call parent destroy method
        super.destroy();

        // Clear global dialog flags to allow future dialogs
        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
    }

    populateDialog(cellData) {
        // Update parameter values based on cell data
        if (cellData && cellData.attributes) {
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;

                // Update the dialog's parameter values (not DOM inputs)
                const snapshotParam = this.snapshotLoadFlowParameters.find(p => p.id === attributeName);
                if (snapshotParam) {
                    if (snapshotParam.type === 'checkbox') {
                        snapshotParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        snapshotParam.value = attributeValue;
                    }
                }

                const timeDependentParam = this.timeDependentParameters.find(p => p.id === attributeName);
                if (timeDependentParam) {
                    if (timeDependentParam.type === 'checkbox') {
                        timeDependentParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        timeDependentParam.value = attributeValue;
                    }
                }

                const shortCircuitParam = this.shortCircuitParameters.find(p => p.id === attributeName);
                if (shortCircuitParam) {
                    if (shortCircuitParam.type === 'checkbox') {
                        shortCircuitParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        shortCircuitParam.value = attributeValue;
                    }
                }

                const harmonicParam = this.harmonicParameters.find(p => p.id === attributeName);
                if (harmonicParam) {
                    if (harmonicParam.type === 'checkbox') {
                        harmonicParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        harmonicParam.value = attributeValue;
                    }
                }

                const dynamicParam = this.dynamicParameters.find(p => p.id === attributeName);
                if (dynamicParam) {
                    if (dynamicParam.type === 'checkbox') {
                        dynamicParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        dynamicParam.value = attributeValue;
                    }
                }
            }
        }
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsPVSystem = [defaultPVSystemData];

export const columnDefsPVSystem = [
    {
        field: "name",
        headerTooltip: "Name of the PVSystem",
        maxWidth: 150
    },
    {
        field: "irradiance",
        headerTooltip: "Present irradiance value in kW/sq-m",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "pmpp",
        headerTooltip: "Rated max power of the PV array for 1.0 kW/sq-m irradiance",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "temperature",
        headerTooltip: "Present temperature in degrees Celsius",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "phases",
        headerTooltip: "Number of phases for the PV system",
        maxWidth: 100,
        valueParser: 'numberParser'
    },
    {
        field: "kv",
        headerTooltip: "Nominal rated voltage in kV",
        maxWidth: 100,
        valueParser: 'numberParser'
    }
];

export const gridOptionsPVSystem = {
    columnDefs: columnDefsPVSystem,
    defaultColDef: {
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsPVSystem,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};

// Make all necessary variables globally available
globalThis.gridOptionsPVSystem = gridOptionsPVSystem;
globalThis.rowDefsPVSystem = rowDefsPVSystem;
globalThis.columnDefsPVSystem = columnDefsPVSystem;
globalThis.PVSystemDialog = PVSystemDialog;
