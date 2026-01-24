import { Dialog } from './Dialog.js';
import { rowDefsTransformerLibrary, gridOptionsTransformerLibrary, columnDefsTransformerLibrary } from './transformerLibraryDialog.js';
import { LibraryDialogManager } from './LibraryDialogManager.js';

// Default values for transformer parameters (based on pandapower documentation)
// Updated: Vector Group moved to Load Flow tab
export const defaultTransformerData = {
    name: "Transformer",
    sn_mva: 0.0,
    vn_hv_kv: 0.0,
    vn_lv_kv: 0.0,
    vk_percent: 0.0,
    vkr_percent: 0.0,
    pfe_kw: 0.0,
    i0_percent: 0.0,
    shift_degree: 0.0,
    tap_side: "hv",
    tap_neutral: 0.0,
    tap_min: -10.0,
    tap_max: 10.0,
    tap_step_percent: 1.0,
    tap_step_degree: 0.0,
    tap_pos: 0.0,
    tap_phase_shifter: false,
    tap_changer_type: "Ratio",  // New in pandapower 3.0+: "Ratio" or "Symmetrical"
    in_service: true,
    // Discrete Tap Control (pandapower control loop - two-winding transformers only)
    discrete_tap_control: false,
    control_side: "lv",  // Which bus voltage to control: "lv" or "hv"
    vm_lower_pu: 0.99,
    vm_upper_pu: 1.01,
    // Short circuit parameters with defaults
    vector_group: "Dyn",
    vk0_percent: 0.0,  // Will be set to vk_percent if not specified
    vkr0_percent: 0.0, // Will be set to vkr_percent if not specified
    mag0_percent: 0.0,
    mag0_rx: 0.0,      // Zero sequence magnetizing r/x ratio
    si0_hv_partial: 0.0,
    parallel: 1
};

export class TransformerDialog extends Dialog {
    constructor(editorUi) {
        super('Transformer Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultTransformerData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Load Flow parameters (necessary for executing a power flow calculation)
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'Name',
                symbol: 'name',
                description: 'Name identifier for the transformer',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'sn_mva',
                label: 'Rated Apparent Power',
                symbol: 'sn_mva',
                unit: 'MVA',
                description: 'Rated apparent power (>0)',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vn_hv_kv',
                label: 'HV Rated Voltage',
                symbol: 'vn_hv_kv',
                unit: 'kV',
                description: 'Rated voltage on high voltage side (>0)',
                type: 'number',
                value: this.data.vn_hv_kv.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vn_lv_kv',
                label: 'LV Rated Voltage',
                symbol: 'vn_lv_kv',
                unit: 'kV',
                description: 'Rated voltage on low voltage side (>0)',
                type: 'number',
                value: this.data.vn_lv_kv.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'in_service',
                label: 'In Service',
                symbol: 'in_service',
                description: 'Specifies if the transformer is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            },
            {
                id: 'vector_group',
                label: 'Vector Group',
                symbol: 'vector_group',
                description: 'Vector group of the transformer (e.g., Dyn, Yd, Yy)',
                type: 'select',
                value: this.data.vector_group,
                options: ['Dyn', 'Yd', 'Yy', 'Dd', 'Yz', 'Dz', 'YNd']
            },
            {
                id: 'shift_degree',
                label: 'Angle Shift',
                symbol: 'shift_degree',
                unit: 'degrees',
                description: 'Angle shift in degrees',
                type: 'number',
                value: this.data.shift_degree.toString(),
                step: '0.1'
            },
            {
                id: 'parallel',
                label: 'Parallel Transformers',
                symbol: 'parallel',
                description: 'Number of parallel transformer systems (optional, default: 1)',
                type: 'number',
                value: this.data.parallel.toString(),
                step: '1',
                min: '1'
            },
            {
                id: 'tap_side',
                label: 'Tap Side',
                symbol: 'tap_side',
                description: 'Where the tap changer is located (hv for high voltage or lv for low voltage)',
                type: 'select',
                value: this.data.tap_side,
                options: ['hv', 'lv']
            },
            {
                id: 'tap_neutral',
                label: 'Tap Neutral Position',
                symbol: 'tap_neutral',
                description: 'Tap position where no voltage shift is present',
                type: 'number',
                value: this.data.tap_neutral.toString(),
                step: '1'
            },
            {
                id: 'tap_min',
                label: 'Minimum Tap Position',
                symbol: 'tap_min',
                description: 'Minimum tap position',
                type: 'number',
                value: this.data.tap_min.toString(),
                step: '1'
            },
            {
                id: 'tap_max',
                label: 'Maximum Tap Position',
                symbol: 'tap_max',
                description: 'Maximum tap position',
                type: 'number',
                value: this.data.tap_max.toString(),
                step: '1'
            },
            {
                id: 'tap_step_percent',
                label: 'Tap Step Size',
                symbol: 'tap_step_percent',
                unit: '%',
                description: 'Tap step size in percent (>0)',
                type: 'number',
                value: this.data.tap_step_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'tap_step_degree',
                label: 'Tap Step Angle',
                symbol: 'tap_step_degree',
                unit: 'degrees',
                description: 'Tap step size for voltage angle in degree, only considered in load flow if calculate_voltage_angles = True',
                type: 'number',
                value: this.data.tap_step_degree.toString(),
                step: '0.1'
            },
            {
                id: 'tap_pos',
                label: 'Current Tap Position',
                symbol: 'tap_pos',
                description: 'Current tap position of the transformer. Defaults to tap_neutral if not set',
                type: 'number',
                value: this.data.tap_pos.toString(),
                step: '1'
            },
            {
                id: 'tap_phase_shifter',
                label: 'Phase Shifter',
                symbol: 'tap_phase_shifter',
                description: 'Whether the transformer is an ideal phase shifter (True/False)',
                type: 'checkbox',
                value: this.data.tap_phase_shifter
            },
            {
                id: 'tap_changer_type',
                label: 'Tap Changer Type',
                symbol: 'tap_changer_type',
                description: 'Type of tap changer: "Ratio" (default) adjusts voltage magnitude only, "Symmetrical" distributes tap change to both windings',
                type: 'select',
                value: this.data.tap_changer_type,
                options: ['Ratio', 'Symmetrical']
            },
            {
                id: 'discrete_tap_control',
                label: 'Discrete Tap Control',
                symbol: 'discrete_tap_control',
                description: 'Enable DiscreteTapControl: keep controlled bus voltage within vm_lower_pu–vm_upper_pu deadband during load flow (requires "Include controllers" in Load Flow dialog)',
                type: 'checkbox',
                value: this.data.discrete_tap_control
            },
            {
                id: 'control_side',
                label: 'Control Side',
                symbol: 'control_side',
                description: 'Which bus voltage to monitor and control: "hv" for high voltage side or "lv" for low voltage side (typically "lv")',
                type: 'select',
                value: this.data.control_side,
                options: ['lv', 'hv']
            },
            {
                id: 'vm_lower_pu',
                label: 'Voltage Lower Limit',
                symbol: 'vm_lower_pu',
                unit: 'pu',
                description: 'Lower bound of permissible voltage band for Discrete Tap Control (e.g. 0.99)',
                type: 'number',
                value: this.data.vm_lower_pu.toString(),
                step: '0.01',
                min: '0.9'
            },
            {
                id: 'vm_upper_pu',
                label: 'Voltage Upper Limit',
                symbol: 'vm_upper_pu',
                unit: 'pu',
                description: 'Upper bound of permissible voltage band for Discrete Tap Control (e.g. 1.01)',
                type: 'number',
                value: this.data.vm_upper_pu.toString(),
                step: '0.01',
                min: '0.9'
            }
        ];
        
        // Short Circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'vk_percent',
                label: 'Short Circuit Voltage',
                symbol: 'vk_percent',
                unit: '%',
                description: 'Short circuit voltage in percent (>0)',
                type: 'number',
                value: this.data.vk_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr_percent',
                label: 'Real Part of SC Voltage',
                symbol: 'vkr_percent',
                unit: '%',
                description: 'Real part of short circuit voltage in percent (>=0)',
                type: 'number',
                value: this.data.vkr_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'pfe_kw',
                label: 'Iron Losses',
                symbol: 'pfe_kw',
                unit: 'kW',
                description: 'Iron losses in kW (>=0)',
                type: 'number',
                value: this.data.pfe_kw.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'i0_percent',
                label: 'Open Loop Losses',
                symbol: 'i0_percent',
                unit: '%',
                description: 'Open loop losses in percent (>=0)',
                type: 'number',
                value: this.data.i0_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vk0_percent',
                label: 'Zero Sequence SC Voltage',
                symbol: 'vk0_percent',
                unit: '%',
                description: 'Zero sequence short circuit voltage in percent (>=0). If not specified, defaults to vk_percent',
                type: 'number',
                value: this.data.vk0_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr0_percent',
                label: 'Zero Sequence SC Voltage Real Part',
                symbol: 'vkr0_percent',
                unit: '%',
                description: 'Zero sequence real part of short circuit voltage in percent (>=0). If not specified, defaults to vkr_percent',
                type: 'number',
                value: this.data.vkr0_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'mag0_percent',
                label: 'Zero Sequence Magnetizing Current',
                symbol: 'mag0_percent',
                unit: '%',
                description: 'Zero sequence magnetizing current in percent (>=0)',
                type: 'number',
                value: this.data.mag0_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'mag0_rx',
                label: 'Zero Sequence Magnetizing R/X Ratio',
                symbol: 'mag0_rx',
                unit: '',
                description: 'Zero sequence magnetizing r/x ratio (>=0)',
                type: 'number',
                value: this.data.mag0_rx.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'si0_hv_partial',
                label: 'Zero Sequence Partial Current',
                symbol: 'si0_hv_partial',
                unit: '%',
                description: 'Zero sequence partial current on HV side in percent (>=0)',
                type: 'number',
                value: this.data.si0_hv_partial.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
    }
    
    getDescription() {
        return '<strong>Configure Transformer Parameters</strong><br>Set parameters for two-winding transformer. See the <a href="https://electrisim.com/documentation#transformer" target="_blank">Electrisim documentation</a>.';
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
        const loadFlowTab = this.createTab('Load Flow', 'loadflow', this.currentTab === 'loadflow');
        const shortCircuitTab = this.createTab('Short Circuit', 'shortcircuit', this.currentTab === 'shortcircuit');
        
        tabContainer.appendChild(loadFlowTab);
        tabContainer.appendChild(shortCircuitTab);
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

        // Create tab content containers
        const loadFlowContent = this.createTabContent('loadflow', this.loadFlowParameters);
        const shortCircuitContent = this.createTabContent('shortcircuit', this.shortCircuitParameters);
        
        contentArea.appendChild(loadFlowContent);
        contentArea.appendChild(shortCircuitContent);
        container.appendChild(contentArea);

        // Add button container
        const buttonContainer = document.createElement('div');
        Object.assign(buttonContainer.style, {
            display: 'flex',
            gap: '8px',
            justifyContent: 'space-between',
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #e9ecef'
        });

        // Left side buttons
        const leftButtons = document.createElement('div');
        Object.assign(leftButtons.style, {
            display: 'flex',
            gap: '8px'
        });

        const libraryButton = this.createButton('Library', '#28a745', '#218838');
        libraryButton.onclick = (e) => {
            e.preventDefault();
            this.showLibrary();
        };
        leftButtons.appendChild(libraryButton);

        // Right side buttons  
        const rightButtons = document.createElement('div');
        Object.assign(rightButtons.style, {
            display: 'flex',
            gap: '8px'
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
            console.log('Transformer values:', values);
            
            if (this.callback) {
                this.callback(values);
            }
            
            this.destroy();
            if (this.ui && typeof this.ui.hideDialog === 'function') {
                this.ui.hideDialog();
            }
        };

        rightButtons.appendChild(cancelButton);
        rightButtons.appendChild(applyButton);
        
        buttonContainer.appendChild(leftButtons);
        buttonContainer.appendChild(rightButtons);
        container.appendChild(buttonContainer);

        this.container = container;
        
        // Tab click handlers
        loadFlowTab.onclick = () => this.switchTab('loadflow', loadFlowTab, [shortCircuitTab], loadFlowContent, [shortCircuitContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [loadFlowTab], shortCircuitContent, [loadFlowContent]);

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
            color: isActive ? '#007bff' : '#333',
            fontWeight: isActive ? '600' : '400',
            transition: 'all 0.2s ease'
        });
        tab.textContent = title;
        tab.setAttribute('data-tab', tabId);
        
        // Add hover effect
        tab.addEventListener('mouseenter', () => {
            if (!isActive) {
                tab.style.backgroundColor = '#f8f9fa';
                tab.style.color = '#007bff';
            }
        });
        
        tab.addEventListener('mouseleave', () => {
            if (!isActive) {
                tab.style.backgroundColor = 'transparent';
                tab.style.color = '#333';
            }
        });
        
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
            // Include symbol and unit in label if available
            let labelText = param.label;
            if (param.symbol) {
                labelText += ` (${param.symbol})`;
            }
            if (param.unit) {
                labelText += ` [${param.unit}]`;
            }
            label.textContent = labelText;
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
                    opt.value = option;
                    opt.textContent = option;
                    if (option === param.value) {
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
            } else {
                input = document.createElement('input');
                input.type = param.type;
                input.value = param.value;
                if (param.step) input.step = param.step;
                if (param.min !== undefined) input.min = param.min;
                if (param.max !== undefined) input.max = param.max;
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
            this.inputs.set(param.id, input);
            rightColumn.appendChild(input);

            parameterRow.appendChild(leftColumn);
            parameterRow.appendChild(rightColumn);
            form.appendChild(parameterRow);
        });

        content.appendChild(form);
        return content;
    }
    
    switchTab(tabId, activeTab, inactiveTabs, activeContent, inactiveContents) {
        // Update current tab
        this.currentTab = tabId;
        
        // Update tab appearance
        activeTab.style.borderBottom = '2px solid #007bff';
        activeTab.style.backgroundColor = '#f8f9fa';
        activeTab.style.color = '#007bff';
        activeTab.style.fontWeight = '600';
        activeTab.classList.add('active');
        
        inactiveTabs.forEach(inactiveTab => {
            inactiveTab.style.borderBottom = '2px solid transparent';
            inactiveTab.style.backgroundColor = 'transparent';
            inactiveTab.style.color = '#333';
            inactiveTab.style.fontWeight = '400';
            Object.assign(inactiveTab.style, {
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
        [...this.loadFlowParameters, ...this.shortCircuitParameters].forEach(param => {
            const input = this.inputs.get(param.id);
            if (input) {
                if (param.type === 'number') {
                    values[param.id] = parseFloat(input.value) || 0;
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else {
                    values[param.id] = input.value;
                }
            }
        });
        
        return values;
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
    
    destroy() {
        // Call parent destroy method
        super.destroy();
        
        // Clear global dialog flags to allow future dialogs
        if (window._globalDialogShowing) {
            delete window._globalDialogShowing;
        }
        
        // console.log('Transformer dialog destroyed and flags cleared');
    }
    
    showLibrary() {
        const libraryManager = new LibraryDialogManager();
        
        const libraryContainer = libraryManager.createLibraryDialog(
            'Transformer Library',
            rowDefsTransformerLibrary,
            columnDefsTransformerLibrary,
            gridOptionsTransformerLibrary,
            (selectedItem) => {
                // Handle selection
                this.loadTransformerData(selectedItem);
                if (this.ui && typeof this.ui.hideDialog === 'function') {
                    this.ui.hideDialog();
                }
            },
            () => {
                // Handle cancel
                if (this.ui && typeof this.ui.hideDialog === 'function') {
                    this.ui.hideDialog();
                }
            }
        );

        // Show library dialog
        if (this.ui && typeof this.ui.showDialog === 'function') {
            const screenHeight = window.innerHeight - 80;
            this.ui.showDialog(libraryContainer, 1800, screenHeight, true, false);
        }
    }


    
    loadTransformerData(transformerData) {
        // Map library data to dialog inputs
        const mappings = {
            'name': transformerData.name || 'Transformer',
            'sn_mva': transformerData.sn_mva || 0,
            'vn_hv_kv': transformerData.vn_hv_kv || 0,
            'vn_lv_kv': transformerData.vn_lv_kv || 0,
            'vk_percent': transformerData.vk_percent || 0,
            'vkr_percent': transformerData.vkr_percent || 0,
            'pfe_kw': transformerData.pfe_kw || 0,
            'i0_percent': transformerData.i0_percent || 0,
            'shift_degree': transformerData.shift_degree || 0,
            'tap_side': transformerData.tap_side || 'hv',
            'tap_neutral': transformerData.tap_neutral || 0,
            'tap_min': transformerData.tap_min || -10,
            'tap_max': transformerData.tap_max || 10,
            'tap_step_percent': transformerData.tap_step_percent || 1,
            'tap_step_degree': transformerData.tap_step_degree || 0,
            'tap_pos': transformerData.tap_pos || 0,
            'tap_phase_shifter': transformerData.tap_phase_shifter === 'True' || transformerData.tap_phase_shifter === true,
            'tap_changer_type': transformerData.tap_changer_type || 'Ratio',
            'in_service': true,
            'discrete_tap_control': transformerData.discrete_tap_control === 'True' || transformerData.discrete_tap_control === true,
            'control_side': transformerData.control_side || 'lv',
            'vm_lower_pu': transformerData.vm_lower_pu != null ? parseFloat(transformerData.vm_lower_pu) : 0.99,
            'vm_upper_pu': transformerData.vm_upper_pu != null ? parseFloat(transformerData.vm_upper_pu) : 1.01
        };

        // Update input values
        Object.keys(mappings).forEach(key => {
            if (this.inputs.has(key)) {
                const input = this.inputs.get(key);
                const value = mappings[key];
                
                if (input.type === 'checkbox') {
                    input.checked = Boolean(value);
                } else if (input.tagName === 'SELECT') {
                    input.value = value;
                } else {
                    input.value = value.toString();
                }
            }
        });

        console.log('Loaded transformer data:', mappings);
    }
    
    populateDialog(cellData) {
        // Update parameter values based on cell data
        if (cellData && cellData.attributes) {
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                // Update the dialog's parameter values (not DOM inputs)
                const loadFlowParam = this.loadFlowParameters.find(p => p.id === attributeName);
                if (loadFlowParam) {
                    if (loadFlowParam.type === 'checkbox') {
                        loadFlowParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        loadFlowParam.value = attributeValue;
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
                
            }
        }
        
        // console.log('Populated Transformer dialog parameters with cell data');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsTransformerBase = [
    { name: "Transformer", sn_mva: 0.0, vn_hv_kv: 0.0, vn_lv_kv: 0.0, vk_percent: 0.0, vkr_percent: 0.0, pfe_kw: 0.0, i0_percent: 0.0, shift_degree: 0.0, tap_side: "hv", tap_neutral: 0.0, tap_min: -10.0, tap_max: 10.0, tap_step_percent: 1.0, tap_step_degree: 0.0, tap_pos: 0.0, tap_phase_shifter: false, tap_changer_type: "Ratio" },
];

export const columnDefsTransformerBase = [
    { 
      field: "name", 
      minWidth: 300 
    },
    { 
      field: "sn_mva",
      headerTooltip: "rated apparent power in MVA",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "vn_hv_kv",
      headerTooltip: "rated voltage on high voltage side in kV",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "vn_lv_kv",
      headerTooltip: "rated voltage on low voltage side in kV",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "vk_percent",
      headerTooltip: "short circuit voltage in percent",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "vkr_percent",
      headerTooltip: "real part of short circuit voltage in percent",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "pfe_kw",
      headerTooltip: "iron losses in kW",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "i0_percent",
      headerTooltip: "open loop losses in percent",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "shift_degree",
      headerTooltip: "angle shift in degrees",
      maxWidth: 140,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "tap_side",
      headerTooltip: 'where the tap changer is located ("hv" for high voltage or "lv" for low voltage)',
      maxWidth: 100,
    },
    { 
      field: "tap_neutral",
      headerTooltip: "tap position where no voltage shift is present",
      maxWidth: 150,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "tap_min",
      headerTooltip: "minimum tap position",
      maxWidth: 150,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "tap_max",
      headerTooltip: "maximum tap position",
      maxWidth: 150,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "tap_step_percent",
      headerTooltip: "tap step size in percent",
      maxWidth: 150,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "tap_step_degree",
      headerTooltip: "tap step size for voltage angle in degree, only considered in load flow if calculate_voltage_angles = True",
      maxWidth: 150,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "tap_pos",
      headerTooltip: "current tap position of the transformer. Defaults to tap_neutral if not set",
      maxWidth: 150,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    { 
      field: "tap_phase_shifter",
      headerTooltip: "whether the transformer is an ideal phase shifter",
      maxWidth: 150,
    },
    { 
      field: "tap_changer_type",
      headerTooltip: "tap changer type: 'Ratio' (default) or 'Symmetrical' - new in pandapower 3.0+",
      maxWidth: 150,
    }
];

//***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */
function numberParser(params) {
  if(Number(params.newValue) >= 0) {
    return(Number(params.newValue))
  } else {
    alert("The value " + params + " must be number (dot separated) and >= 0")
    return(Number(params.oldValue))
  }
}

function negativeNumberParser(params) {
  if(Number(params.newValue) <= 0) {
    return(Number(params.newValue))
  } else {
    alert("The value " + params + " must be number (dot separated) and <= 0")
    return(Number(params.oldValue))
  }
}

export const gridOptionsTransformerBase = { 
    columnDefs: columnDefsTransformerBase,
    defaultColDef: {
      editable: true    
    },  
    rowData: rowDefsTransformerBase,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość     
};

// Make them globally available
globalThis.rowDefsTransformerBase = rowDefsTransformerBase;
globalThis.columnDefsTransformerBase = columnDefsTransformerBase;
globalThis.gridOptionsTransformerBase = gridOptionsTransformerBase;
globalThis.numberParser = numberParser;
globalThis.negativeNumberParser = negativeNumberParser;
globalThis.TransformerDialog = TransformerDialog;
