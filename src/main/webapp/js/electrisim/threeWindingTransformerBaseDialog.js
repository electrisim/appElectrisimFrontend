import { Dialog } from './Dialog.js';
import { rowDefsThreeWindingTransformerLibrary, gridOptionsThreeWindingTransformerLibrary, columnDefsThreeWindingTransformerLibrary } from './threeWindingTransformerLibraryDialog.js';
import { LibraryDialogManager } from './LibraryDialogManager.js';

// Default values for three-winding transformer parameters (based on pandapower documentation)
export const defaultThreeWindingTransformerData = {
    name: "Three Winding Transformer",
    sn_hv_mva: 0.0,
    sn_mv_mva: 0.0,
    sn_lv_mva: 0.0,
    vn_hv_kv: 0.0,
    vn_mv_kv: 0.0,
    vn_lv_kv: 0.0,
    vk_hv_percent: 0.0,
    vk_mv_percent: 0.0,
    vk_lv_percent: 0.0,
    vkr_hv_percent: 0.0,
    vkr_mv_percent: 0.0,
    vkr_lv_percent: 0.0,
    pfe_kw: 0.0,
    i0_percent: 0.0,
    shift_mv_degree: 0.0,
    shift_lv_degree: 0.0,
    tap_side: "hv",
    tap_neutral: 0.0,
    tap_min: -10.0,
    tap_max: 10.0,
    tap_step_percent: 1.0,
    tap_pos: 0.0,
    tap_phase_shifter: false,
    in_service: true,
    // Zero sequence parameters (optional)
    vk0_hv_percent: 0.0,
    vk0_mv_percent: 0.0,
    vk0_lv_percent: 0.0,
    vkr0_hv_percent: 0.0,
    vkr0_mv_percent: 0.0,
    vkr0_lv_percent: 0.0,
    vector_group: 'YNyn0d'
};

export class ThreeWindingTransformerDialog extends Dialog {
    constructor(editorUi) {
        super('Three Winding Transformer Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultThreeWindingTransformerData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Load Flow parameters (necessary for executing a power flow calculation)
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'Name',
                description: 'Name identifier for the three-winding transformer',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'sn_hv_mva',
                label: 'HV Rated Power (sn_hv_mva)',
                description: 'Rated apparent power in MVA of high voltage side (>0)',
                type: 'number',
                value: this.data.sn_hv_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'sn_mv_mva',
                label: 'MV Rated Power (sn_mv_mva)',
                description: 'Rated apparent power in MVA of medium voltage side (>0)',
                type: 'number',
                value: this.data.sn_mv_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'sn_lv_mva',
                label: 'LV Rated Power (sn_lv_mva)',
                description: 'Rated apparent power in MVA of low voltage side (>0)',
                type: 'number',
                value: this.data.sn_lv_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vn_hv_kv',
                label: 'HV Rated Voltage (vn_hv_kv)',
                description: 'Rated voltage in kV of high voltage side (>0)',
                type: 'number',
                value: this.data.vn_hv_kv.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vn_mv_kv',
                label: 'MV Rated Voltage (vn_mv_kv)',
                description: 'Rated voltage in kV of medium voltage side (>0)',
                type: 'number',
                value: this.data.vn_mv_kv.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vn_lv_kv',
                label: 'LV Rated Voltage (vn_lv_kv)',
                description: 'Rated voltage in kV of low voltage side (>0)',
                type: 'number',
                value: this.data.vn_lv_kv.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the transformer is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            },
            {
                id: 'vector_group',
                label: 'Vector Group',
                symbol: 'vector_group',
                description: 'Vector group of the transformer (e.g., YNynd, YNdyn, YNdd)',
                type: 'select',
                value: this.data.vector_group,
                options: ['YNynd', 'YNdyn', 'YNdd']
            },
            {
                id: 'tap_side',
                label: 'Tap Side (tap_side)',
                description: 'Where the tap changer is located (hv, mv, lv)',
                type: 'select',
                value: this.data.tap_side,
                options: ['hv', 'mv', 'lv']
            },
            {
                id: 'tap_neutral',
                label: 'Tap Neutral Position (tap_neutral)',
                description: 'Tap position where no voltage shift is present',
                type: 'number',
                value: this.data.tap_neutral.toString(),
                step: '1'
            },
            {
                id: 'tap_min',
                label: 'Minimum Tap Position (tap_min)',
                description: 'Minimum tap position',
                type: 'number',
                value: this.data.tap_min.toString(),
                step: '1'
            },
            {
                id: 'tap_max',
                label: 'Maximum Tap Position (tap_max)',
                description: 'Maximum tap position',
                type: 'number',
                value: this.data.tap_max.toString(),
                step: '1'
            },
            {
                id: 'tap_step_percent',
                label: 'Tap Step Size (tap_step_percent)',
                description: 'Tap step size in percent (>0)',
                type: 'number',
                value: this.data.tap_step_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'tap_pos',
                label: 'Current Tap Position (tap_pos)',
                description: 'Current tap position of the transformer. Defaults to tap_neutral if not set',
                type: 'number',
                value: this.data.tap_pos.toString(),
                step: '1'
            },
            {
                id: 'tap_phase_shifter',
                label: 'Phase Shifter (tap_phase_shifter)',
                description: 'Whether the transformer is an ideal phase shifter (True/False)',
                type: 'checkbox',
                value: this.data.tap_phase_shifter
            }
        ];
        
        // Short Circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'vk_hv_percent',
                label: 'HV Short Circuit Voltage (vk_hv_percent)',
                description: 'Short circuit voltage in percent of high voltage side (>0)',
                type: 'number',
                value: this.data.vk_hv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vk_mv_percent',
                label: 'MV Short Circuit Voltage (vk_mv_percent)',
                description: 'Short circuit voltage in percent of medium voltage side (>0)',
                type: 'number',
                value: this.data.vk_mv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vk_lv_percent',
                label: 'LV Short Circuit Voltage (vk_lv_percent)',
                description: 'Short circuit voltage in percent of low voltage side (>0)',
                type: 'number',
                value: this.data.vk_lv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr_hv_percent',
                label: 'HV Real Part SC Voltage (vkr_hv_percent)',
                description: 'Real part of short circuit voltage in percent of high voltage side (>=0)',
                type: 'number',
                value: this.data.vkr_hv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr_mv_percent',
                label: 'MV Real Part SC Voltage (vkr_mv_percent)',
                description: 'Real part of short circuit voltage in percent of medium voltage side (>=0)',
                type: 'number',
                value: this.data.vkr_mv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr_lv_percent',
                label: 'LV Real Part SC Voltage (vkr_lv_percent)',
                description: 'Real part of short circuit voltage in percent of low voltage side (>=0)',
                type: 'number',
                value: this.data.vkr_lv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'pfe_kw',
                label: 'Iron Losses (pfe_kw)',
                description: 'Iron losses in kW (>=0)',
                type: 'number',
                value: this.data.pfe_kw.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'i0_percent',
                label: 'Open Loop Losses (i0_percent)',
                description: 'Open loop losses in percent (>=0)',
                type: 'number',
                value: this.data.i0_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'shift_mv_degree',
                label: 'MV Angle Shift (shift_mv_degree)',
                description: 'Angle shift to medium voltage side in degrees',
                type: 'number',
                value: this.data.shift_mv_degree.toString(),
                step: '0.1'
            },
            {
                id: 'shift_lv_degree',
                label: 'LV Angle Shift (shift_lv_degree)',
                description: 'Angle shift to low voltage side in degrees',
                type: 'number',
                value: this.data.shift_lv_degree.toString(),
                step: '0.1'
            },
            {
                id: 'vk0_hv_percent',
                label: 'HV Zero Sequence SC Voltage (vk0_hv_percent)',
                description: 'Zero sequence short circuit voltage in percent of high voltage side (optional)',
                type: 'number',
                value: this.data.vk0_hv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vk0_mv_percent',
                label: 'MV Zero Sequence SC Voltage (vk0_mv_percent)',
                description: 'Zero sequence short circuit voltage in percent of medium voltage side (optional)',
                type: 'number',
                value: this.data.vk0_mv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vk0_lv_percent',
                label: 'LV Zero Sequence SC Voltage (vk0_lv_percent)',
                description: 'Zero sequence short circuit voltage in percent of low voltage side (optional)',
                type: 'number',
                value: this.data.vk0_lv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr0_hv_percent',
                label: 'HV Zero Sequence Real SC Voltage (vkr0_hv_percent)',
                description: 'Zero sequence real part of short circuit voltage in percent of high voltage side (optional)',
                type: 'number',
                value: this.data.vkr0_hv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr0_mv_percent',
                label: 'MV Zero Sequence Real SC Voltage (vkr0_mv_percent)',
                description: 'Zero sequence real part of short circuit voltage in percent of medium voltage side (optional)',
                type: 'number',
                value: this.data.vkr0_mv_percent.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'vkr0_lv_percent',
                label: 'LV Zero Sequence Real SC Voltage (vkr0_lv_percent)',
                description: 'Zero sequence real part of short circuit voltage in percent of low voltage side (optional)',
                type: 'number',
                value: this.data.vkr0_lv_percent.toString(),
                step: '0.1',
                min: '0'
            }
        ];
        
    }
    
    getDescription() {
        return '<strong>Configure Three Winding Transformer Parameters</strong><br>Set parameters for three-winding transformer with HV, MV, and LV sides. Based on <a href="https://pandapower.readthedocs.io/en/latest/elements/trafo3w.html" target="_blank">pandapower documentation</a>.';
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
            console.log('Three Winding Transformer values:', values);
            
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

        if (parameters.length === 0) {
            const emptyMessage = document.createElement('div');
            Object.assign(emptyMessage.style, {
                padding: '20px',
                textAlign: 'center',
                color: '#666',
                fontStyle: 'italic'
            });
            emptyMessage.textContent = 'No parameters available for this category.';
            content.appendChild(emptyMessage);
            return content;
        }

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
                gap: '4px',
                minWidth: '0'
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
                    // For optional parameters, convert 0 or empty strings to null for backend
                    const optionalParams = ['vk0_hv_percent', 'vk0_mv_percent', 'vk0_lv_percent', 
                                         'vkr0_hv_percent', 'vkr0_mv_percent', 'vkr0_lv_percent'];
                    if (optionalParams.includes(param.id)) {
                        const numValue = parseFloat(input.value);
                        values[param.id] = (input.value.trim() === '' || numValue === 0) ? null : numValue;
                    } else {
                        values[param.id] = parseFloat(input.value) || 0;
                    }
                } else if (param.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else {
                    // For text inputs, convert empty strings to null for optional parameters
                    const optionalTextParams = ['vector_group'];
                    if (optionalTextParams.includes(param.id)) {
                        values[param.id] = input.value.trim() === '' ? null : input.value;
                    } else {
                        values[param.id] = input.value;
                    }
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
        
        console.log('Three Winding Transformer dialog destroyed and flags cleared');
    }
    
    showLibrary() {
        const libraryManager = new LibraryDialogManager();
        
        const libraryContainer = libraryManager.createLibraryDialog(
            'Three Winding Transformer Library',
            rowDefsThreeWindingTransformerLibrary,
            columnDefsThreeWindingTransformerLibrary,
            gridOptionsThreeWindingTransformerLibrary,
            (selectedItem) => {
                // Handle selection
                this.loadThreeWindingTransformerData(selectedItem);
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


    
    loadThreeWindingTransformerData(transformerData) {
        // Map library data to dialog inputs
        const mappings = {
            'name': transformerData.name || 'Three Winding Transformer',
            'sn_hv_mva': transformerData.sn_hv_mva || 0,
            'sn_mv_mva': transformerData.sn_mv_mva || 0,
            'sn_lv_mva': transformerData.sn_lv_mva || 0,
            'vn_hv_kv': transformerData.vn_hv_kv || 0,
            'vn_mv_kv': transformerData.vn_mv_kv || 0,
            'vn_lv_kv': transformerData.vn_lv_kv || 0,
            'vk_hv_percent': transformerData.vk_hv_percent || 0,
            'vk_mv_percent': transformerData.vk_mv_percent || 0,
            'vk_lv_percent': transformerData.vk_lv_percent || 0,
            'vkr_hv_percent': transformerData.vkr_hv_percent || 0,
            'vkr_mv_percent': transformerData.vkr_mv_percent || 0,
            'vkr_lv_percent': transformerData.vkr_lv_percent || 0,
            'pfe_kw': transformerData.pfe_kw || 0,
            'i0_percent': transformerData.i0_percent || 0,
            'shift_mv_degree': transformerData.shift_mv_degree || 0,
            'shift_lv_degree': transformerData.shift_lv_degree || 0,
            'tap_side': transformerData.tap_side || 'hv',
            'tap_neutral': transformerData.tap_neutral || 0,
            'tap_min': transformerData.tap_min || -10,
            'tap_max': transformerData.tap_max || 10,
            'tap_step_percent': transformerData.tap_step_percent || 1,
            'tap_pos': transformerData.tap_pos || 0,
            'tap_phase_shifter': transformerData.tap_phase_shifter === 'True' || transformerData.tap_phase_shifter === true,
            'in_service': true,
            // Optional zero sequence parameters
            'vk0_hv_percent': transformerData.vk0_hv_percent || 0,
            'vk0_mv_percent': transformerData.vk0_mv_percent || 0,
            'vk0_lv_percent': transformerData.vk0_lv_percent || 0,
            'vkr0_hv_percent': transformerData.vkr0_hv_percent || 0,
            'vkr0_mv_percent': transformerData.vkr0_mv_percent || 0,
            'vkr0_lv_percent': transformerData.vkr0_lv_percent || 0,
            'vector_group': transformerData.vector_group || ''
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
                    // Handle values for optional parameters
                    if (value === null || value === undefined) {
                        input.value = '';
                    } else {
                        input.value = value.toString();
                    }
                }
            }
        });

        console.log('Loaded three winding transformer data:', mappings);
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
        
        console.log('Populated Three Winding Transformer dialog parameters with cell data');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsThreeWindingTransformerBase = [
    { name: "Three Winding Transformer", sn_hv_mva:0.0, sn_mv_mva:0.0, sn_lv_mva:0.0, vn_hv_kv:0.0, vn_mv_kv:0.0, vn_lv_kv:0.0, vk_hv_percent:0.0, vk_mv_percent:0.0, vk_lv_percent:0.0, vkr_hv_percent:0.0, vkr_mv_percent:0.0, vkr_lv_percent:0.0, pfe_kw:0.0, i0_percent:0.0, shift_mv_degree:0.0, shift_lv_degree:0.0, tap_side:"hv", tap_neutral:0.0, tap_min:-10.0, tap_max:10.0, tap_step_percent:1.0, tap_pos:0.0, tap_phase_shifter:false },
];
    
export const columnDefsThreeWindingTransformerBase = [  
    {
      field: "name",
    },
    {
      field: "sn_hv_mva",
      headerTooltip: "rated apparent power in MVA of high voltage side",
      maxWidth: 100,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "sn_mv_mva",
      headerTooltip: "rated apparent power in MVA of medium voltage side",
      maxWidth: 100,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "sn_lv_mva",
      headerTooltip: "rated apparent power in MVA of low voltage side",
      maxWidth: 100,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vn_hv_kv",
      headerTooltip: "rated voltage in kV of high voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vn_mv_kv",
      headerTooltip: "rated voltage in kV of medium voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vn_lv_kv",
      headerTooltip: "rated voltage in kV of low voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vk_hv_percent",
      headerTooltip: "short circuit voltage in percent of high voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vk_mv_percent",
      headerTooltip: "short circuit voltage in percent of medium voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vk_lv_percent",
      headerTooltip: "short circuit voltage in percent of low voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vkr_hv_percent",
      headerTooltip: "real part of short circuit voltage in percent of high voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vkr_mv_percent",
      headerTooltip: "real part of short circuit voltage in percent of medium voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "vkr_lv_percent",
      headerTooltip: "real part of short circuit voltage in percent of low voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "pfe_kw",
      headerTooltip: "iron losses in kW",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "i0_percent",
      headerTooltip: "open loop losses in percent",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "shift_mv_degree",
      headerTooltip: "angle shift to medium voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "shift_lv_degree",
      headerTooltip: "angle shift to low voltage side",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "tap_side",
      headerTooltip: "where the tap changer is located (hv, mv, lv)",
      maxWidth: 120,
    },
    {
      field: "tap_neutral",
      headerTooltip: "tap position where no voltage shift is present",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "tap_min",
      headerTooltip: "minimum tap position",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "tap_max",
      headerTooltip: "maximum tap position",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "tap_step_percent",
      headerTooltip: "tap step size in percent",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "tap_pos",
      headerTooltip: "current tap position of the transformer. Defaults to tap_neutral if not set",
      maxWidth: 120,
      valueParser: (params) => parseFloat(params.newValue) || 0,
    },
    {
      field: "tap_phase_shifter",
      headerTooltip: "whether the transformer is an ideal phase shifter",
      maxWidth: 120,
    }
  ];
  
export const gridOptionsThreeWindingTransformerBase = {
    columnDefs: columnDefsThreeWindingTransformerBase,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsThreeWindingTransformerBase,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     

// Make them globally available
globalThis.rowDefsThreeWindingTransformerBase = rowDefsThreeWindingTransformerBase;
globalThis.columnDefsThreeWindingTransformerBase = columnDefsThreeWindingTransformerBase;
globalThis.gridOptionsThreeWindingTransformerBase = gridOptionsThreeWindingTransformerBase;
globalThis.ThreeWindingTransformerDialog = ThreeWindingTransformerDialog;
  