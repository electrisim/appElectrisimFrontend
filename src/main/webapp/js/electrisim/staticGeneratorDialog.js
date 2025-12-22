import { Dialog } from './Dialog.js';

// Default values for static generator parameters (based on pandapower documentation)
export const defaultStaticGeneratorData = {
    name: "Static Generator",
    p_mw: 0.0,
    q_mvar: 0.0,
    sn_mva: 0.0,
    scaling: 1.0,
    type: 'wye',
    k: 0.0,
    rx: 0.0,
    generator_type: 'async',
    lrc_pu: 0.0,
    max_ik_ka: 0.0,
    kappa: 0.0,
    current_source: true,
    in_service: true
};

export class StaticGeneratorDialog extends Dialog {
    constructor(editorUi) {
        super('Static Generator Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'power';
        this.data = { ...defaultStaticGeneratorData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Power parameters (necessary for executing a power flow calculation)
        this.powerParameters = [
            {
                id: 'name',
                label: 'Generator Name',
                description: 'Name identifier for the static generator',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'p_mw',
                label: 'Active Power (MW)',
                description: 'The active power of the static generator (positive for generation!)',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1'
            },
            {
                id: 'q_mvar',
                label: 'Reactive Power (MVar)',
                description: 'The reactive power of the static generator',
                type: 'number',
                value: this.data.q_mvar.toString(),
                step: '0.1'
            }
        ];
        
        // Rating parameters
        this.ratingParameters = [
            {
                id: 'sn_mva',
                label: 'Nominal Power (MVA)',
                description: 'Nominal power of the static generator',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'scaling',
                label: 'Scaling Factor',
                description: 'An OPTIONAL scaling factor to be set customly. Multiplies with p_mw and q_mvar',
                type: 'number',
                value: this.data.scaling.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'type',
                label: 'Connection Type',
                description: 'Type of generator connection',
                type: 'select',
                value: this.data.type,
                options: ['wye', 'delta']
            }
        ];
        
        // Short-circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'k',
                label: 'Current Ratio (k)',
                description: 'Ratio of nominal current to short circuit current',
                type: 'number',
                value: this.data.k.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'rx',
                label: 'R/X Ratio',
                description: 'R/X ratio for short circuit impedance. Only relevant if type is specified as motor so that sgen is treated as asynchronous motor.',
                type: 'number',
                value: this.data.rx.toString(),
                step: '0.01'
            },
            {
                id: 'generator_type',
                label: 'Generator Type',
                description: 'Can be one of "current_source" (full size converter), "async" (asynchronous generator), or "async_doubly_fed" (doubly fed asynchronous generator, DFIG).',
                type: 'select',
                value: this.data.generator_type,
                options: ['current_source', 'async', 'async_doubly_fed']
            }
        ];
        
        // Advanced short-circuit parameters
        this.advancedParameters = [
            {
                id: 'lrc_pu',
                label: 'Locked Rotor Current (p.u.)',
                description: 'Locked rotor current in relation to the rated generator current. Relevant if the generator_type is "async".',
                type: 'number',
                value: this.data.lrc_pu.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'max_ik_ka',
                label: 'Max Short-Circuit Current (kA)',
                description: 'The highest instantaneous short-circuit value in case of a three-phase short-circuit (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
                type: 'number',
                value: this.data.max_ik_ka.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'kappa',
                label: 'Peak Factor (κ)',
                description: 'The factor for the calculation of the peak short-circuit current, referred to the high-voltage side (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
                type: 'number',
                value: this.data.kappa.toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'current_source',
                label: 'Current Source Model',
                description: 'Model this sgen as a current source during short-circuit calculations; useful in some cases, for example the simulation of full-size converters per IEC 60909-0:2016.',
                type: 'checkbox',
                value: this.data.current_source
            },
            {
                id: 'in_service',
                label: 'In Service',
                description: 'Specifies if the static generator is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Static Generator Parameters</strong><br>Set parameters for static generator with power flow and short-circuit capabilities. See the <a href="https://electrisim.com/documentation#static-generator" target="_blank">Electrisim documentation</a>.';
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
        const powerTab = this.createTab('Power', 'power', this.currentTab === 'power');
        const ratingTab = this.createTab('Rating', 'rating', this.currentTab === 'rating');
        const shortCircuitTab = this.createTab('Short Circuit', 'shortcircuit', this.currentTab === 'shortcircuit');
        const advancedTab = this.createTab('Advanced', 'advanced', this.currentTab === 'advanced');
        
        tabContainer.appendChild(powerTab);
        tabContainer.appendChild(ratingTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(advancedTab);
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
        const powerContent = this.createTabContent('power', this.powerParameters);
        const ratingContent = this.createTabContent('rating', this.ratingParameters);
        const shortCircuitContent = this.createTabContent('shortcircuit', this.shortCircuitParameters);
        const advancedContent = this.createTabContent('advanced', this.advancedParameters);
        
        contentArea.appendChild(powerContent);
        contentArea.appendChild(ratingContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(advancedContent);
        container.appendChild(contentArea);

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
            console.log('Static Generator values:', values);
            
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
        powerTab.onclick = () => this.switchTab('power', powerTab, [ratingTab, shortCircuitTab, advancedTab], powerContent, [ratingContent, shortCircuitContent, advancedContent]);
        ratingTab.onclick = () => this.switchTab('rating', ratingTab, [powerTab, shortCircuitTab, advancedTab], ratingContent, [powerContent, shortCircuitContent, advancedContent]);
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, [powerTab, ratingTab, advancedTab], shortCircuitContent, [powerContent, ratingContent, advancedContent]);
        advancedTab.onclick = () => this.switchTab('advanced', advancedTab, [powerTab, ratingTab, shortCircuitTab], advancedContent, [powerContent, ratingContent, shortCircuitContent]);

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
                param.options.forEach(option => {
                    const optionElement = document.createElement('option');
                    optionElement.value = option;
                    optionElement.textContent = option.charAt(0).toUpperCase() + option.slice(1);
                    if (option === param.value) {
                        optionElement.selected = true;
                    }
                    input.appendChild(optionElement);
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
                    outline: 'none',
                    cursor: 'pointer'
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
        [...this.powerParameters, ...this.ratingParameters, ...this.shortCircuitParameters, ...this.advancedParameters].forEach(param => {
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
        
        console.log('Static Generator dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== StaticGeneratorDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
        // Log initial parameter values
        console.log('Initial parameter values:');
        [...this.powerParameters, ...this.ratingParameters, ...this.shortCircuitParameters, ...this.advancedParameters].forEach(param => {
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
                const powerParam = this.powerParameters.find(p => p.id === attributeName);
                if (powerParam) {
                    const oldValue = powerParam.value;
                    if (powerParam.type === 'checkbox') {
                        powerParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        powerParam.value = attributeValue;
                    }
                    console.log(`  Updated power ${attributeName}: ${oldValue} → ${powerParam.value}`);
                }
                
                const ratingParam = this.ratingParameters.find(p => p.id === attributeName);
                if (ratingParam) {
                    const oldValue = ratingParam.value;
                    if (ratingParam.type === 'checkbox') {
                        ratingParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        ratingParam.value = attributeValue;
                    }
                    console.log(`  Updated rating ${attributeName}: ${oldValue} → ${ratingParam.value}`);
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
                
                const advancedParam = this.advancedParameters.find(p => p.id === attributeName);
                if (advancedParam) {
                    const oldValue = advancedParam.value;
                    if (advancedParam.type === 'checkbox') {
                        advancedParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        advancedParam.value = attributeValue;
                    }
                    console.log(`  Updated advanced ${attributeName}: ${oldValue} → ${advancedParam.value}`);
                }
                
                if (!powerParam && !ratingParam && !shortCircuitParam && !advancedParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        // Log final parameter values
        console.log('Final parameter values:');
        [...this.powerParameters, ...this.ratingParameters, ...this.shortCircuitParameters, ...this.advancedParameters].forEach(param => {
            console.log(`  ${param.id}: ${param.value} (${param.type})`);
        });
        
        console.log('=== StaticGeneratorDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsStaticGenerator = [defaultStaticGeneratorData];

export const columnDefsStaticGenerator = [  
    {
        field: "name",
        headerTooltip: "Name of the static generator",
        maxWidth: 150
    },
    {
        field: "p_mw",
        headerTooltip: "The active power of the static generator (positive for generation!)",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "q_mvar",
        headerTooltip: "The reactive power of the static generator",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "sn_mva",
        headerTooltip: "Nominal power of the static generator",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "scaling",
        headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplies with p_mw and q_mvar",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "type",
        headerTooltip: "Type of generator connection",
        maxWidth: 120
    },
    {
        field: "k",
        headerTooltip: "Ratio of nominal current to short circuit current",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
        field: "rx",
        headerTooltip: "R/X ratio for short circuit impedance. Only relevant if type is specified as motor so that sgen is treated as asynchronous motor.",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "generator_type",
        headerTooltip: 'Can be one of "current_source" (full size converter), "async" (asynchronous generator), or "async_doubly_fed" (doubly fed asynchronous generator, DFIG).',
        maxWidth: 160
    },
    {
        field: "lrc_pu",
        headerTooltip: 'Locked rotor current in relation to the rated generator current. Relevant if the generator_type is "async".',
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
        field: "max_ik_ka",
        headerTooltip: 'The highest instantaneous short-circuit value in case of a three-phase short-circuit (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
        maxWidth: 160,
        valueParser: 'numberParser'
    },
    {
        field: "kappa",
        headerTooltip: 'The factor for the calculation of the peak short-circuit current, referred to the high-voltage side (provided by the manufacturer). Relevant if the generator_type is "async_doubly_fed".',
        maxWidth: 160,
        valueParser: 'numberParser'
    },
    {
        field: "current_source",
        headerTooltip: "Model this sgen as a current source during short-circuit calculations; useful in some cases, for example the simulation of full-size converters per IEC 60909-0:2016.",
        maxWidth: 140
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the static generator is in service (True/False)",
        maxWidth: 100
    }
];
  
export const gridOptionsStaticGenerator = {
    columnDefs: columnDefsStaticGenerator,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsStaticGenerator,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
};     

// Make all necessary variables globally available
globalThis.gridOptionsStaticGenerator = gridOptionsStaticGenerator;
globalThis.rowDefsStaticGenerator = rowDefsStaticGenerator;
globalThis.columnDefsStaticGenerator = columnDefsStaticGenerator;
globalThis.StaticGeneratorDialog = StaticGeneratorDialog;
  
  
  
  