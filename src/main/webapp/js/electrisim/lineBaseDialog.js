import { Dialog } from './Dialog.js';
import { rowDefsLineLibrary, gridOptionsLineLibrary, columnDefsLineLibrary } from './lineLibraryDialog.js';
import { LibraryDialogManager } from './LibraryDialogManager.js';

// Default values for line parameters (based on pandapower documentation)
export const defaultLineData = {
    name: "Line",
    length_km: 1.0,
    r_ohm_per_km: 0.0,
    x_ohm_per_km: 0.0,
    c_nf_per_km: 0.0,
    g_us_per_km: 0.0,
    max_i_ka: 0.0,
    type: "cs",
    r0_ohm_per_km: 0.0,
    x0_ohm_per_km: 0.0,
    c0_nf_per_km: 0.0,
    endtemp_degree: 250.0,
    in_service: true,
    // Optional parameters
    parallel: 1,
    df: 1.0
};

export class LineDialog extends Dialog {
    constructor(editorUi) {
        super('Line Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultLineData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Load Flow parameters (necessary for executing a power flow calculation)
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'Name',
                description: 'Name identifier for the line',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'length_km',
                label: 'Length (length_km)',
                description: 'The line length in km (>0)',
                type: 'number',
                value: this.data.length_km.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'r_ohm_per_km',
                label: 'Resistance (r_ohm_per_km)',
                description: 'Line resistance in ohm per km (>=0)',
                type: 'number',
                value: this.data.r_ohm_per_km.toString(),
                step: '0.001',
                min: '0'
            },
            {
                id: 'x_ohm_per_km',
                label: 'Reactance (x_ohm_per_km)',
                description: 'Line reactance in ohm per km (>=0)',
                type: 'number',
                value: this.data.x_ohm_per_km.toString(),
                step: '0.001',
                min: '0'
            },
            {
                id: 'c_nf_per_km',
                label: 'Capacitance (c_nf_per_km)',
                description: 'Line capacitance (line-to-earth) in nano Farad per km (>=0)',
                type: 'number',
                value: this.data.c_nf_per_km.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'g_us_per_km',
                label: 'Conductance (g_us_per_km)',
                description: 'Dielectric conductance in micro Siemens per km (>=0)',
                type: 'number',
                value: this.data.g_us_per_km.toString(),
                step: '0.001',
                min: '0'
            },
            {
                id: 'max_i_ka',
                label: 'Max Current (max_i_ka)',
                description: 'Maximum thermal current in kilo Ampere (>0)',
                type: 'number',
                value: this.data.max_i_ka.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'type',
                label: 'Line Type (type)',
                description: 'Type of line ("ol" for overhead line or "cs" for cable system)',
                type: 'select',
                value: this.data.type,
                options: ['cs', 'ol']
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the line is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            },
            {
                id: 'parallel',
                label: 'Parallel Line Systems (parallel)',
                description: 'Number of parallel line systems (optional, default: 1)',
                type: 'number',
                value: this.data.parallel.toString(),
                step: '1',
                min: '1'
            },
            {
                id: 'df',
                label: 'Derating Factor (df)',
                description: 'Derating factor: maximum current of line in relation to nominal current of line (from 0 to 1, default: 1.0)',
                type: 'number',
                value: this.data.df.toString(),
                step: '0.1',
                min: '0',
                max: '1'
            }
        ];
        
        // Short Circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'r0_ohm_per_km',
                label: 'Zero Sequence Resistance (r0_ohm_per_km)',
                description: 'Zero sequence line resistance in ohm per km (>=0)',
                type: 'number',
                value: this.data.r0_ohm_per_km.toString(),
                step: '0.001',
                min: '0'
            },
            {
                id: 'x0_ohm_per_km',
                label: 'Zero Sequence Reactance (x0_ohm_per_km)',
                description: 'Zero sequence line reactance in ohm per km (>=0)',
                type: 'number',
                value: this.data.x0_ohm_per_km.toString(),
                step: '0.001',
                min: '0'
            },
            {
                id: 'c0_nf_per_km',
                label: 'Zero Sequence Capacitance (c0_nf_per_km)',
                description: 'Zero sequence line capacitance in nano Farad per km (>=0)',
                type: 'number',
                value: this.data.c0_nf_per_km.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'endtemp_degree',
                label: 'End Temperature (endtemp_degree)',
                description: 'Short-Circuit end temperature of the line in degrees Celsius',
                type: 'number',
                value: this.data.endtemp_degree.toString(),
                step: '1',
                min: '0'
            }
        ];
        
        // OPF (Optimal Power Flow) parameters
        this.opfParameters = [
            // Lines typically don't have specific OPF parameters beyond load flow
            // This tab is kept for consistency but may be empty or contain future extensions
        ];
    }
    
    getDescription() {
        return '<strong>Configure Line Parameters</strong><br>Set parameters for transmission/distribution line. Based on <a href="https://pandapower.readthedocs.io/en/latest/elements/line.html" target="_blank">pandapower documentation</a>.';
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
        const opfTab = this.createTab('OPF', 'opf', this.currentTab === 'opf');
        
        tabContainer.appendChild(loadFlowTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(opfTab);
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

        // Create tab contents
        const loadFlowContent = this.createTabContent('loadflow', this.loadFlowParameters);
        const shortCircuitContent = this.createTabContent('shortcircuit', this.shortCircuitParameters);
        const opfContent = this.createTabContent('opf', this.opfParameters);

        contentArea.appendChild(loadFlowContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(opfContent);
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
            console.log('Line values:', values);
            
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
        loadFlowTab.onclick = () => this.switchTab('loadflow', loadFlowTab, [shortCircuitTab, opfTab], loadFlowContent, [shortCircuitContent, opfContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [loadFlowTab, opfTab], shortCircuitContent, [loadFlowContent, opfContent]);
        opfTab.onclick = () => this.switchTab('opf', opfTab, [loadFlowTab, shortCircuitTab], opfContent, [loadFlowContent, shortCircuitContent]);

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
        
        // Update tab styles
        activeTab.style.borderBottom = '2px solid #007bff';
        activeTab.style.backgroundColor = '#f8f9fa';
        activeTab.style.color = '#007bff';
        activeTab.style.fontWeight = '600';
        
        inactiveTabs.forEach(tab => {
            tab.style.borderBottom = '2px solid transparent';
            tab.style.backgroundColor = 'transparent';
            tab.style.color = '#333';
            tab.style.fontWeight = '400';
        });
        
        // Update content visibility
        activeContent.style.display = 'block';
        inactiveContents.forEach(content => {
            content.style.display = 'none';
        });
    }
    
    getFormValues() {
        const values = {};
        
        // Collect values from all parameter sets
        [...this.loadFlowParameters, ...this.shortCircuitParameters, ...this.opfParameters].forEach(param => {
            if (this.inputs.has(param.id)) {
                const input = this.inputs.get(param.id);
                if (input.type === 'checkbox') {
                    values[param.id] = input.checked;
                } else if (input.tagName === 'SELECT') {
                    values[param.id] = input.value;
                } else {
                    // For parallel and df parameters, always include them with defaults if empty
                    const defaultParams = ['parallel', 'df'];
                    if (defaultParams.includes(param.id)) {
                        const numValue = parseFloat(input.value);
                        if (input.value.trim() === '' || isNaN(numValue)) {
                            // Use default values
                            values[param.id] = param.id === 'parallel' ? 1 : 1.0;
                        } else {
                            values[param.id] = numValue;
                        }
                    } else {
                        const numValue = parseFloat(input.value);
                        values[param.id] = isNaN(numValue) ? input.value : numValue;
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
        
        console.log('Line dialog destroyed and flags cleared');
    }
    
    showLibrary() {
        const libraryManager = new LibraryDialogManager();
        
        const libraryContainer = libraryManager.createLibraryDialog(
            'Line Library',
            rowDefsLineLibrary,
            columnDefsLineLibrary,
            gridOptionsLineLibrary,
            (selectedItem) => {
                // Handle selection
                this.loadLineData(selectedItem);
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

    
    loadLineData(lineData) {
        // Map library data to dialog inputs
        const mappings = {
            'name': lineData.name || 'Line',
            'length_km': 1.0, // Default length since library doesn't specify
            'r_ohm_per_km': lineData.r_ohm_per_km || 0,
            'x_ohm_per_km': lineData.x_ohm_per_km || 0,
            'c_nf_per_km': lineData.c_nf_per_km || 0,
            'g_us_per_km': lineData.g_us_per_km || 0,
            'max_i_ka': lineData.max_i_ka || 0,
            'type': lineData.type || 'cs',
            'r0_ohm_per_km': lineData.r0_ohm_per_km || 0,
            'x0_ohm_per_km': lineData.x0_ohm_per_km || 0,
            'c0_nf_per_km': lineData.c0_nf_per_km || 0,
            'endtemp_degree': lineData.endtemp_degree || 250,
            'in_service': true,
            'parallel': lineData.parallel || 1,
            'df': lineData.df || 1.0
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

        console.log('Loaded line data:', mappings);
    }
    
    populateDialog(cellData) {
        console.log('=== LineDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.loadFlowParameters, ...this.shortCircuitParameters, ...this.opfParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        // Update parameter values based on cell data
        if (cellData && cellData.attributes) {
            console.log(`Found ${cellData.attributes.length} attributes to process`);
            
            for (let i = 0; i < cellData.attributes.length; i++) {
                const attribute = cellData.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                console.log(`Processing attribute: ${attributeName} = ${attributeValue}`);
                
                // Update the dialog's parameter values (not DOM inputs)
                const loadFlowParam = this.loadFlowParameters.find(p => p.id === attributeName);
                if (loadFlowParam) {
                    const oldValue = loadFlowParam.value;
                    if (loadFlowParam.type === 'checkbox') {
                        loadFlowParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        loadFlowParam.value = attributeValue;
                    }
                    console.log(`  Updated loadFlow ${attributeName}: ${oldValue} → ${loadFlowParam.value}`);
                }
                
                const shortCircuitParam = this.shortCircuitParameters.find(p => p.id === attributeName);
                if (shortCircuitParam) {
                    const oldValue = shortCircuitParam.value;
                    if (shortCircuitParam.type === 'checkbox') {
                        shortCircuitParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        shortCircuitParam.value = attributeValue;
                    }
                    console.log(`  Updated shortCircuit ${attributeName}: ${oldValue} → ${shortCircuitParam.value}`);
                }
                
                const opfParam = this.opfParameters.find(p => p.id === attributeName);
                if (opfParam) {
                    const oldValue = opfParam.value;
                    if (opfParam.type === 'checkbox') {
                        opfParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        opfParam.value = attributeValue;
                    }
                    console.log(`  Updated opf ${attributeName}: ${oldValue} → ${opfParam.value}`);
                }
                
                if (!loadFlowParam && !shortCircuitParam && !opfParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.loadFlowParameters, ...this.shortCircuitParameters, ...this.opfParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        // Update DOM inputs with the parameter values
        console.log('Updating DOM inputs with parameter values...');
        [...this.loadFlowParameters, ...this.shortCircuitParameters, ...this.opfParameters].forEach(param => {
            if (this.inputs.has(param.id)) {
                const input = this.inputs.get(param.id);
                const value = param.value;
                
                if (input.type === 'checkbox') {
                    input.checked = Boolean(value);
                } else if (input.tagName === 'SELECT') {
                    input.value = value;
                } else {
                    input.value = value.toString();
                }
                console.log(`  Updated DOM input ${param.id}: ${value}`);
            }
        });
        
        console.log('=== LineDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsDataLineBaseDialog = [
    { name: "Line", length_km: 1.0, r_ohm_per_km: 0.0, x_ohm_per_km: 0.0, c_nf_per_km: 0.0, g_us_per_km: 0.0, max_i_ka: 0.0, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0, in_service: true },
];

export const columnDefsLineBaseDialog = [
    { field: "name", minWidth: 300 },
    { field: "length_km", headerTooltip: "The line length in km", maxWidth: 140, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "r_ohm_per_km", headerTooltip: "line resistance in ohm per km", maxWidth: 140, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "x_ohm_per_km", headerTooltip: "line reactance in ohm per km", maxWidth: 140, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "c_nf_per_km", headerTooltip: "line capacitance (line-to-earth) in nano Farad per km", maxWidth: 130, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "g_us_per_km", headerTooltip: "dielectric conductance in micro Siemens per km", maxWidth: 130, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "max_i_ka", headerTooltip: "maximum thermal current in kilo Ampere", maxWidth: 100, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "type", headerTooltip: 'type of line ("ol" for overhead line or "cs" for cable system)', maxWidth: 100 },
    { field: "r0_ohm_per_km", headerTooltip: "zero sequence line resistance in ohm per km", maxWidth: 150, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "x0_ohm_per_km", headerTooltip: "zero sequence line reactance in ohm per km", maxWidth: 150, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "c0_nf_per_km", headerTooltip: "zero sequence line capacitance in nano Farad per km", maxWidth: 130, valueParser: (params) => parseFloat(params.newValue) || 0 },
    { field: "endtemp_degree", headerTooltip: "Short-Circuit end temperature of the line", maxWidth: 150, valueParser: (params) => parseFloat(params.newValue) || 0 }
];

export const gridOptionsLineBaseDialog = { 
    columnDefs: columnDefsLineBaseDialog,
    defaultColDef: {
        editable: true    
    },  
    rowData: rowDefsDataLineBaseDialog,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};

// Make them globally available
globalThis.rowDefsDataLineBaseDialog = rowDefsDataLineBaseDialog;
globalThis.columnDefsLineBaseDialog = columnDefsLineBaseDialog;
globalThis.gridOptionsLineBaseDialog = gridOptionsLineBaseDialog;
globalThis.LineDialog = LineDialog;
