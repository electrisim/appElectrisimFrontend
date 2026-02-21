import { Dialog } from './Dialog.js';

// Default values for load parameters (based on pandapower documentation)
export const defaultLoadData = {
    name: "Load",
    p_mw: 0.0,
    q_mvar: 0.0,
    const_z_percent: 0.0,
    const_i_percent: 0.0,
    sn_mva: 0.0,
    scaling: 1.0,
    type: 'wye',
    controllable: false,
    max_p_mw: 0.0,
    min_p_mw: 0.0,
    max_q_mvar: 0.0,
    min_q_mvar: 0.0,
    in_service: true,
    // Harmonic analysis parameters (OpenDSS)
    // Reference: https://opendss.epri.com/HarmonicsLoadModeling.html
    spectrum: 'defaultload',
    spectrum_csv: '',
    pctSeriesRL: 100,
    conn: 'wye',
    puXharm: 0.0,
    XRharm: 6.0
};

export class LoadDialog extends Dialog {
    constructor(editorUi) {
        super('Load Parameters', 'Apply');
        
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.currentTab = 'loadflow';
        this.data = { ...defaultLoadData };
        this.inputs = new Map(); // Initialize inputs map for form elements
        
        // Load Flow parameters (necessary for executing a power flow calculation)
        this.loadFlowParameters = [
            {
                id: 'name',
                label: 'Name',
                symbol: 'name',
                description: 'Name identifier for the load',
                type: 'text',
                value: this.data.name
            },
            {
                id: 'p_mw',
                label: 'Active Power',
                symbol: 'p_mw',
                unit: 'MW',
                description: 'The active power of the load (>=0)',
                type: 'number',
                value: this.data.p_mw.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'q_mvar',
                label: 'Reactive Power',
                symbol: 'q_mvar',
                unit: 'MVar',
                description: 'The reactive power of the load',
                type: 'number',
                value: this.data.q_mvar.toString(),
                step: '0.1'
            },
            {
                id: 'const_z_percent',
                label: 'Constant Impedance',
                symbol: 'const_z_percent',
                unit: '%',
                description: 'Percentage of p_mw and q_mvar that will be associated to constant impedance load at rated voltage (0...100)',
                type: 'number',
                value: this.data.const_z_percent.toString(),
                step: '0.1',
                min: '0',
                max: '100'
            },
            {
                id: 'const_i_percent',
                label: 'Constant Current',
                symbol: 'const_i_percent',
                unit: '%',
                description: 'Percentage of p_mw and q_mvar that will be associated to constant current load at rated voltage (0...100)',
                type: 'number',
                value: this.data.const_i_percent.toString(),
                step: '0.1',
                min: '0',
                max: '100'
            },
            {
                id: 'scaling',
                label: 'Scaling Factor',
                symbol: 'scaling',
                description: 'Scaling factor for the load power (>0)',
                type: 'number',
                value: this.data.scaling.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'in_service',
                label: 'In Service',
                symbol: 'in_service',
                description: 'Specifies if the load is in service (True/False)',
                type: 'checkbox',
                value: this.data.in_service
            }
        ];
        
        // Short Circuit parameters
        this.shortCircuitParameters = [
            {
                id: 'sn_mva',
                label: 'Nominal Power',
                symbol: 'sn_mva',
                unit: 'MVA',
                description: 'Nominal power of the load for short circuit calculation (>0)',
                type: 'number',
                value: this.data.sn_mva.toString(),
                step: '0.1',
                min: '0'
            },
            {
                id: 'type',
                label: 'Connection Type',
                symbol: 'type',
                description: 'Type variable to classify the load: wye/delta',
                type: 'select',
                value: this.data.type,
                options: ['wye', 'delta']
            }
        ];
        
        // OPF (Optimal Power Flow) parameters
        this.opfParameters = [
            {
                id: 'controllable',
                label: 'Controllable',
                symbol: 'controllable',
                description: 'True if load is controllable by OPF (True/False)',
                type: 'checkbox',
                value: this.data.controllable
            },
            {
                id: 'max_p_mw',
                label: 'Maximum Active Power',
                symbol: 'max_p_mw',
                unit: 'MW',
                description: 'Maximum active power consumption. Only respected for OPF calculations',
                type: 'number',
                value: this.data.max_p_mw.toString(),
                step: '1'
            },
            {
                id: 'min_p_mw',
                label: 'Minimum Active Power',
                symbol: 'min_p_mw',
                unit: 'MW',
                description: 'Minimum active power consumption. Only respected for OPF calculations',
                type: 'number',
                value: this.data.min_p_mw.toString(),
                step: '1'
            },
            {
                id: 'max_q_mvar',
                label: 'Maximum Reactive Power',
                symbol: 'max_q_mvar',
                unit: 'MVar',
                description: 'Maximum reactive power consumption. Only respected for OPF calculations',
                type: 'number',
                value: this.data.max_q_mvar.toString(),
                step: '1'
            },
            {
                id: 'min_q_mvar',
                label: 'Minimum Reactive Power',
                symbol: 'min_q_mvar',
                unit: 'MVar',
                description: 'Minimum reactive power consumption. Only respected for OPF calculations',
                type: 'number',
                value: this.data.min_q_mvar.toString(),
                step: '1'
            }
        ];

        // Harmonic analysis parameters (OpenDSS)
        // Reference: https://opendss.epri.com/HarmonicsLoadModeling.html
        this.harmonicParameters = [
            {
                id: 'spectrum',
                label: 'Harmonic Spectrum',
                description: 'Name of the harmonic spectrum for this load element. ' +
                    '"defaultload" is the built-in spectrum (has 1st, 3rd, 5th, 7th harmonics). ' +
                    '"Linear" is purely sinusoidal (fundamental only, no harmonic distortion). ' +
                    '"TCR_PU" and "HVDC_PU" are IEEE benchmark spectra (thyristor-controlled reactor and HVDC). ' +
                    '"custom" uses the CSV data below (harmonic,magnitude,angle per line). ' +
                    'The spectrum defines the magnitude and angle of harmonic current injections ' +
                    'relative to the fundamental.',
                type: 'select',
                value: this.data.spectrum || 'defaultload',
                options: ['defaultload', 'defaultgen', 'defaultvsource', 'Linear', 'TCR_PU', 'HVDC_PU', 'custom', 'none']
            },
            {
                id: 'spectrum_csv',
                label: 'Custom Spectrum CSV',
                description: 'Paste or upload CSV in format: harmonic,magnitude,angle (one line per harmonic). ' +
                    'Used when spectrum is "custom". Units: harmonic = order (integer, 1=fundamental, 5=5th, 7=7th); ' +
                    'magnitude = % of fundamental (100 for 1st harmonic); angle = phase in degrees (°). ' +
                    'Example: 1,100,46.9  5,7.01,-124.4  7,2.5,-29.9',
                type: 'textarea',
                value: this.data.spectrum_csv || ''
            },
            {
                id: 'conn',
                label: 'Connection (wye/delta)',
                description: 'Load connection type for harmonic studies. ' +
                    'TCR_PU: delta (IEEE benchmark). HVDC_PU: wye (harmonics cancelling). ' +
                    'Other loads: wye or delta as set.',
                type: 'select',
                value: (this.data.conn || 'wye').toLowerCase(),
                options: ['wye', 'delta']
            },
            {
                id: 'pctSeriesRL',
                label: '%SeriesRL (percent series R-L)',
                description: 'Percent of load that is series R-L for harmonic studies. ' +
                    'Default is 100% (IEEE benchmark). Set to 0 for a pure parallel (Y) model. Set to 100 for a pure series model. ' +
                    'This controls how load impedance behaves at harmonic frequencies.',
                type: 'number',
                value: (this.data.pctSeriesRL ?? 100).toString(),
                step: '1',
                min: '0',
                max: '100'
            },
            {
                id: 'puXharm',
                label: 'puXharm (per-unit reactance for harmonics)',
                description: 'Special reactance, per-unit (based on kVA, kV properties), for the series impedance branch ' +
                    'in the load model for HARMONICS analysis. Generally used to represent motor load blocked rotor reactance. ' +
                    'Default is 0.0. If set to 0 (default), the series branch is computed from %SeriesRL. ' +
                    'If specified (>0), it overrides the %SeriesRL calculation. Typical value: ~0.20 pu.',
                type: 'number',
                value: (this.data.puXharm || 0.0).toString(),
                step: '0.01',
                min: '0'
            },
            {
                id: 'XRharm',
                label: 'XRharm (X/R ratio for harmonics)',
                description: 'X/R ratio of the special harmonics mode reactance specified by puXharm at fundamental frequency. ' +
                    'Default is 6.0. Used when puXharm > 0 to define the series R-L branch for motor loads. ' +
                    'Typical range for conventional motors: 3-6. High efficiency motors can have values > 10.',
                type: 'number',
                value: (this.data.XRharm || 6.0).toString(),
                step: '0.1',
                min: '0'
            }
        ];
    }
    
    getDescription() {
        return '<strong>Configure Load Parameters</strong><br>Set parameters for electrical load with power values and load characteristics. See the <a href="https://electrisim.com/documentation#load" target="_blank">Electrisim documentation</a>.';
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
        const harmonicTab = this.createTab('Harmonic', 'harmonic', this.currentTab === 'harmonic');
        
        tabContainer.appendChild(loadFlowTab);
        tabContainer.appendChild(shortCircuitTab);
        tabContainer.appendChild(opfTab);
        tabContainer.appendChild(harmonicTab);
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
        const opfContent = this.createTabContent('opf', this.opfParameters);
        const harmonicContent = this.createTabContent('harmonic', this.harmonicParameters);
        
        contentArea.appendChild(loadFlowContent);
        contentArea.appendChild(shortCircuitContent);
        contentArea.appendChild(opfContent);
        contentArea.appendChild(harmonicContent);
        container.appendChild(contentArea);

        // Toggle spectrum_csv visibility when spectrum is 'custom'
        const spectrumSelect = this.inputs.get('spectrum');
        const spectrumCsvInput = this.inputs.get('spectrum_csv');
        if (spectrumSelect && spectrumCsvInput) {
            const spectrumCsvRow = harmonicContent.querySelector('[data-spectrum-csv-row]');
            const updateSpectrumCsvVisibility = () => {
                const show = spectrumSelect.value === 'custom';
                if (spectrumCsvRow) spectrumCsvRow.style.display = show ? 'grid' : 'none';
            };
            updateSpectrumCsvVisibility();
            spectrumSelect.addEventListener('change', updateSpectrumCsvVisibility);
        }

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
            console.log('Load values:', values);
            
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
        const allTabs = [loadFlowTab, shortCircuitTab, opfTab, harmonicTab];
        const allContents = [loadFlowContent, shortCircuitContent, opfContent, harmonicContent];
        loadFlowTab.onclick = () => this.switchTab('loadflow', loadFlowTab, allTabs.filter(t => t !== loadFlowTab), loadFlowContent, allContents.filter(c => c !== loadFlowContent));
        shortCircuitTab.onclick = () => this.switchTab('shortcircuit', shortCircuitTab, allTabs.filter(t => t !== shortCircuitTab), shortCircuitContent, allContents.filter(c => c !== shortCircuitContent));
        opfTab.onclick = () => this.switchTab('opf', opfTab, allTabs.filter(t => t !== opfTab), opfContent, allContents.filter(c => c !== opfContent));
        harmonicTab.onclick = () => this.switchTab('harmonic', harmonicTab, allTabs.filter(t => t !== harmonicTab), harmonicContent, allContents.filter(c => c !== harmonicContent));

        // Show dialog using DrawIO's dialog system
        if (this.ui && typeof this.ui.showDialog === 'function') {
            const screenHeight = window.innerHeight - 80;
            // Pass onDialogClose so destroy() runs when closed via ESC (ensures cleanupCallback runs)
            this.ui.showDialog(container, 1000, screenHeight, true, false, () => {
                this.destroy();
                return 1; // Allow DrawIO to proceed with DOM removal
            });
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
            if (param.id === 'spectrum_csv') parameterRow.dataset.spectrumCsvRow = '1';
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
            } else if (param.type === 'textarea') {
                input = document.createElement('textarea');
                input.value = param.value;
                input.rows = 6;
                input.placeholder = '1,100,46.9\n5,7.01,-124.4\n7,2.5,-29.9';
                Object.assign(input.style, {
                    width: '100%',
                    minWidth: '180px',
                    padding: '10px 14px',
                    border: '2px solid #ced4da',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    outline: 'none'
                });
                // Add file upload for spectrum_csv
                if (param.id === 'spectrum_csv') {
                    const wrapper = document.createElement('div');
                    Object.assign(wrapper.style, { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', minWidth: '180px' });
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.accept = '.csv,text/csv,text/plain';
                    fileInput.style.display = 'none';
                    const uploadBtn = document.createElement('button');
                    uploadBtn.textContent = 'Upload CSV file';
                    Object.assign(uploadBtn.style, {
                        padding: '8px 12px',
                        fontSize: '13px',
                        backgroundColor: '#e9ecef',
                        border: '1px solid #ced4da',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        alignSelf: 'flex-start'
                    });
                    uploadBtn.onclick = () => fileInput.click();
                    uploadBtn.type = 'button';
                    fileInput.onchange = () => {
                        const f = fileInput.files?.[0];
                        if (f) {
                            const r = new FileReader();
                            r.onload = () => { input.value = r.result || ''; };
                            r.readAsText(f);
                        }
                        fileInput.value = '';
                    };
                    wrapper.appendChild(input);
                    wrapper.appendChild(uploadBtn);
                    rightColumn.appendChild(wrapper);
                } else {
                    rightColumn.appendChild(input);
                }
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
            if (!(param.type === 'textarea' && param.id === 'spectrum_csv')) {
                rightColumn.appendChild(input);
            }

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
        [...this.loadFlowParameters, ...this.shortCircuitParameters, ...this.opfParameters, ...this.harmonicParameters].forEach(param => {
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
        
        console.log('Load dialog destroyed and flags cleared');
    }
    
    populateDialog(cellData) {
        console.log('=== LoadDialog.populateDialog called ===');
        console.log('Cell data:', cellData);
        
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
                
                const harmonicParam = this.harmonicParameters.find(p => p.id === attributeName);
                if (harmonicParam) {
                    if (harmonicParam.type === 'checkbox') {
                        harmonicParam.value = attributeValue === 'true' || attributeValue === true;
                    } else {
                        harmonicParam.value = attributeValue;
                    }
                }
                
                if (!loadFlowParam && !shortCircuitParam && !opfParam && !harmonicParam) {
                    console.log(`  WARNING: No parameter found for attribute ${attributeName}`);
                }
            }
        } else {
            console.log('No cell data or attributes found');
        }
        
        console.log('=== LoadDialog.populateDialog completed ===');
    }
}

// Legacy exports for backward compatibility (maintaining AG-Grid structure for existing code)
export const rowDefsLoad = [defaultLoadData];

export const columnDefsLoad = [  
    {
      field: "name",
        headerTooltip: "Name of the load",
        maxWidth: 150
    },
    {
      field: "p_mw",
      headerTooltip: "The active power of the load",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
      field: "q_mvar",
      headerTooltip: "The reactive power of the load",
        maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
      field: "const_z_percent",
        headerTooltip: "Percentage of p_mw and q_mvar that will be associated to constant impedance load at rated voltage",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
      field: "const_i_percent",
        headerTooltip: "Percentage of p_mw and q_mvar that will be associated to constant current load at rated voltage",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
      field: "sn_mva",
      headerTooltip: "Nominal power of the load",
      maxWidth: 120,
        valueParser: 'numberParser'
    },
    {
      field: "scaling",
        headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplies with p_mw and q_mvar.",
        maxWidth: 140,
        valueParser: 'numberParser'
    },
    {
      field: "type",
        headerTooltip: "Type variable to classify the load: wye/delta",
        maxWidth: 100
    },
    {
        field: "in_service",
        headerTooltip: "Specifies if the load is in service (True/False)",
        maxWidth: 100
    }
  ];
  
export const gridOptionsLoad = {
    columnDefs: columnDefsLoad,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsLoad,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true
  };     

// Make all necessary variables globally available
globalThis.gridOptionsLoad = gridOptionsLoad;
globalThis.rowDefsLoad = rowDefsLoad;
globalThis.columnDefsLoad = columnDefsLoad;
globalThis.LoadDialog = LoadDialog;
  
  
  
  