// EditDataDialog.js - Dialog for editing cell data with AG-Grid support
import { DIALOG_STYLES } from '../utils/dialogStyles.js';

export class EditDataDialog {
    constructor(ui, cell) {
        try {
            if (!ui || !cell) {
                throw new Error('EditDataDialog requires both UI and cell parameters');
            }

            this.ui = ui;
            this.cell = cell;
            this.shouldShowDialog = true; // Flag to control whether dialog should be shown
            
            // Parse the cell style to get element type
            const style = cell.getStyle() || '';
            const styleProps = this.parseStyle(style);
            this.elementType = styleProps.shapeELXXX;
            
            console.log('EditDataDialog - Element type:', this.elementType);
            
            // Create a minimal container first (this ensures container is always set)
            this.container = document.createElement('div');
            
            // Check for special cases first
            if (this.elementType === "NotEditableLine") {
                this.handleNotEditableLine();
                return;
            }
            
            if (this.elementType === "Result") {
                this.handleResultElement();
                return;
            }
            
            // Create the main container for normal elements
            this.container = this.createContainer();
            
        } catch (error) {
            console.error('Error initializing EditDataDialog:', error);
            // Create a minimal container to prevent crashes
            this.container = document.createElement('div');
            this.container.textContent = 'Error loading dialog: ' + error.message;
        }
    }
    
    parseStyle(style) {
        const result = {};
        if (style) {
            const pairs = style.split(';');
            pairs.forEach(pair => {
                const [key, value] = pair.split('=');
                if (key && value) {
                    result[key.trim()] = value.trim();
                }
            });
        }
        return result;
    }
    
    handleNotEditableLine() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Use the styled message dialog
        this.showStyledMessageDialog(
            'Cannot Edit Element',
            'This element cannot be edited. To model a line or cable, place it between two buses.',
            '#FF9800', // Orange color for warning
            '⚠️' // Warning icon
        );
    }
    
    handleResultElement() {
        this.shouldShowDialog = false; // Prevent main dialog from being shown
        
        // Set container to a minimal hidden div to prevent appendChild errors
        this.container.style.display = 'none';
        this.container.innerHTML = '';
        
        // Use the styled message dialog
        this.showStyledMessageDialog(
            'Information',
            'This element is a result label. It cannot be edited',
            '#2196F3', // Blue color for info
            '📊' // Icon
        );
    }
    
    createContainer() {
        // Create main container with proper sizing like the original
        const div = document.createElement('div');
        div.style.height = '100%';
        div.style.width = '100%';
        div.style.padding = '0px';  // Remove any padding
        div.style.margin = '0px';   // Remove any margin
        div.style.overflow = 'hidden'; // Prevent any overflow space
        div.style.display = 'flex';    // Use flexbox for precise control
        div.style.flexDirection = 'column'; // Vertical layout
        div.setAttribute('class', 'ag-theme-alpine');
        
        // Create the grid container with ultra-compact sizing
        const gridDiv = document.createElement('div');
        gridDiv.style.height = '75px';  // Reverted back to 75px
        gridDiv.style.width = '100%';
        gridDiv.style.maxHeight = '75px';  // Enforce maximum height
        gridDiv.style.minHeight = '75px';  // Enforce minimum height
        gridDiv.style.overflow = 'hidden'; // Prevent any overflow
        gridDiv.style.flex = '0 0 75px';   // Flex: don't grow, don't shrink, fixed 75px
        gridDiv.style.position = 'relative';
        gridDiv.setAttribute('class', 'ag-theme-alpine');
        
        // Get grid configuration based on element type
        const { gridOptions, rowDefs } = this.getGridConfiguration();
        
        if (gridOptions && rowDefs) {
            // Initialize AG-Grid
            try {
                // Ensure grid has proper configuration for headers
                if (gridOptions.columnDefs) {
                    gridOptions.columnDefs.forEach(col => {
                        // Calculate better width based on actual header text length to prevent truncation
                        const headerText = col.headerName || col.field || 'Column';
                        const headerLength = headerText.length;
                        
                        // Extremely generous width calculation to guarantee no truncation with full-width dialog
                        const minWidthBasedOnHeader = Math.max(160, headerLength * 15 + 80);
                        
                        if (!col.minWidth) col.minWidth = minWidthBasedOnHeader;
                        if (!col.width) col.width = Math.max(180, minWidthBasedOnHeader);
                        
                        // Ensure text wrapping and overflow handling
                        if (!col.cellStyle) {
                            col.cellStyle = {
                                'white-space': 'normal',
                                'word-wrap': 'break-word',
                                'text-overflow': 'ellipsis'
                            };
                        }
                    });
                }
                
                // Ensure headers are enabled with compact height
                gridOptions.headerHeight = 30;  // Reverted back to 30px
                gridOptions.rowHeight = 26;     // Reverted back to 26px
                gridOptions.suppressHorizontalScroll = false;
                gridOptions.suppressVerticalScroll = true;  // Prevent vertical scrolling in compact mode
                gridOptions.suppressScrollOnNewData = true;
                gridOptions.suppressAnimationFrame = true;
                
                // Pre-calculate container width for optimal column sizing
                const containerWidth = Math.max(1200, window.innerWidth - 60); // Estimate container width
                
                // Pre-calculate optimal column widths to prevent visual jumping
                const calculateOptimalColumnWidths = (columnDefs, containerWidth, elementType) => {
                    if (!columnDefs || columnDefs.length === 0) return columnDefs;
                    
                    const numColumns = columnDefs.length;
                    const availableWidth = containerWidth - 50; // Account for margins and scrollbar
                    
                    // Calculate base target width
                    const baseTargetWidth = Math.floor(availableWidth / numColumns);
                    
                    // Use reasonable minimum widths
                    let minWidth = 140; // Good default for most columns
                    if (numColumns > 6) minWidth = 130;
                    if (numColumns > 8) minWidth = 120;
                    if (numColumns > 10) minWidth = 110;
                    if (numColumns > 12) minWidth = 100;
                    if (numColumns > 15) minWidth = 90;
                    if (numColumns > 18) minWidth = 80;
                    
                    const finalWidth = Math.max(minWidth, baseTargetWidth);
                    
                    // Apply calculated width to all columns with element-specific handling
                    return columnDefs.map(col => {
                        let columnWidth = finalWidth;
                        
                     
                        
                        // Special handling for index columns (all elements)
                        if (col.field === 'index' || col.headerName === 'Index') {
                            columnWidth = Math.min(70, finalWidth); // Index columns can be narrow
                        }
                        
                        // Special handling for ID columns (all elements)
                        if (col.field === 'id' || col.headerName === 'ID' || 
                            col.field === 'ID' || col.headerName === 'id') {
                            columnWidth = Math.min(80, finalWidth); // ID columns can be narrow
                        }
                        
                        return {
                            ...col,
                            width: columnWidth,
                            suppressSizeToFit: false
                        };
                    });
                };

                // Apply optimal column widths before grid creation
                if (gridOptions.columnDefs) {
                    gridOptions.columnDefs = calculateOptimalColumnWidths(gridOptions.columnDefs, containerWidth, this.elementType);
                }
                
                gridOptions.animateRows = false;
                gridOptions.enableRangeSelection = true;
                gridOptions.enableFillHandle = true;
                gridOptions.enableRangeHandle = true;
                gridOptions.undoRedoCellEditing = true;
                gridOptions.undoRedoCellEditingLimit = 20;
                gridOptions.rowHeight = 24;
                gridOptions.headerHeight = 28;
                gridOptions.suppressAnimationFrame = true;
                
                // Use onGridReady for final adjustments instead of setTimeout
                const originalOnGridReady = gridOptions.onGridReady;
                gridOptions.onGridReady = (params) => {
                    // Call original onGridReady if it exists
                    if (originalOnGridReady) {
                        originalOnGridReady(params);
                    }
                    
                    // Fine-tune column sizing after grid is ready (no visible jump)
                    try {
                        const actualContainerWidth = gridDiv.clientWidth - 30;
                        const columns = params.columnApi.getAllColumns();
                        
                        if (columns && columns.length > 0) {
                            const totalUsedWidth = columns.length * (gridOptions.columnDefs[0]?.width || 150);
                            
                            // Only adjust if there's significant space left or overflow
                            if (Math.abs(totalUsedWidth - actualContainerWidth) > 50) {
                                params.api.sizeColumnsToFit();
                            }
                        }
                    } catch (error) {
                        console.warn('Error in final column adjustment:', error);
                    }
                };
                
                // Check if AG Grid is available
                if (!window.agGrid) {
                    throw new Error('AG Grid library not loaded. Please ensure ag-grid-community.min.js is loaded before this module.');
                }
                
                const grid = new window.agGrid.Grid(gridDiv, gridOptions);
                
                // Populate grid with cell data
                this.populateGridData(gridOptions, rowDefs);
                
                div.appendChild(gridDiv);
            } catch (error) {
                console.error('Error creating AG-Grid:', error);
                div.textContent = 'Error creating grid: ' + error.message;
            }
        } else {
            div.textContent = `Choose some component in the model first. Unsupported element type: ${this.elementType}`;
        }
        
        // Add buttons at the bottom with ultra-compact layout
        const buttonContainer = this.createButtonContainer(gridOptions);
        buttonContainer.style.position = 'relative';
        buttonContainer.style.bottom = '0px';
        buttonContainer.style.marginTop = '2px';  // Minimal margin
        buttonContainer.style.marginBottom = '0px';
        buttonContainer.style.paddingTop = '0px';
        buttonContainer.style.paddingBottom = '0px';
        buttonContainer.style.height = '28px';    // Reverted back to 28px
        buttonContainer.style.flex = '0 0 28px';  // Fixed 28px height
        div.appendChild(buttonContainer);
        
        return div;
    }
    
    getGridConfiguration() {
        // Get grid configuration based on element type
        const configs = {
            'External Grid': () => ({ 
                gridOptions: window.gridOptionsExternalGrid, 
                rowDefs: window.rowDefsExternalGrid,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/ext_grid.html'
            }),
            'Generator': () => ({ 
                gridOptions: window.gridOptionsGenerator, 
                rowDefs: window.rowDefsGenerator,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/gen.html'
            }),
            'Static Generator': () => ({ 
                gridOptions: window.gridOptionsStaticGenerator, 
                rowDefs: window.rowDefsStaticGenerator,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/sgen.html'
            }),
            'Asymmetric Static Generator': () => ({ 
                gridOptions: window.gridOptionsAsymmetricStaticGenerator, 
                rowDefs: window.rowDefsAsymmetricStaticGenerator,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/asymmetric_sgen.html'
            }),
            'Bus': () => ({ 
                gridOptions: window.gridOptionsBus, 
                rowDefs: window.rowDefsBus,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/bus.html'
            }),
            'Shunt Reactor': () => ({ 
                gridOptions: window.gridOptionsShuntReactor, 
                rowDefs: window.rowDefsShuntReactor,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/shunt.html'
            }),
            'Capacitor': () => ({ 
                gridOptions: window.gridOptionsCapacitor, 
                rowDefs: window.rowDefsCapacitor,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/shunt.html'
            }),
            'Load': () => ({ 
                gridOptions: window.gridOptionsLoad, 
                rowDefs: window.rowDefsLoad,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/load.html'
            }),
            'Asymmetric Load': () => ({ 
                gridOptions: window.gridOptionsAsymmetricLoad, 
                rowDefs: window.rowDefsAsymmetricLoad,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/asymmetric_load.html'
            }),
            'Impedance': () => ({ 
                gridOptions: window.gridOptionsImpedance, 
                rowDefs: window.rowDefsImpedance,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/impedance.html'
            }),
            'Ward': () => ({ 
                gridOptions: window.gridOptionsWard, 
                rowDefs: window.rowDefsWard,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/ward.html'
            }),
            'Extended Ward': () => ({ 
                gridOptions: window.gridOptionsExtendedWard, 
                rowDefs: window.rowDefsExtendedWard,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/xward.html'
            }),
            'Motor': () => ({ 
                gridOptions: window.gridOptionsMotor, 
                rowDefs: window.rowDefsMotor,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/motor.html'
            }),
            'Storage': () => ({ 
                gridOptions: window.gridOptionsStorage, 
                rowDefs: window.rowDefsStorage,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/storage.html'
            }),
            'DC Line': () => ({ 
                gridOptions: window.gridOptionsDCLine, 
                rowDefs: window.rowDefsDCLine,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/dcline.html'
            }),
            'Transformer': () => ({ 
                gridOptions: window.gridOptionsTransformerBase, 
                rowDefs: window.rowDefsTransformerBase,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/trafo.html',
                hasLibrary: true
            }),
            'Three Winding Transformer': () => ({ 
                gridOptions: window.gridOptionsThreeWindingTransformerBase, 
                rowDefs: window.rowDefsThreeWindingTransformerBase,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/trafo3w.html',
                hasLibrary: true
            }),
            'Line': () => ({ 
                gridOptions: window.gridOptionsLineBaseDialog, 
                rowDefs: window.rowDefsDataLineBaseDialog,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/line.html',
                hasLibrary: true
            }),
            'SVC': () => ({ 
                gridOptions: window.gridOptionsSVC, 
                rowDefs: window.rowDefsSVC,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/svc.html',
                hasLibrary: true
            }),
            'TCSC': () => ({ 
                gridOptions: window.gridOptionsTCSC, 
                rowDefs: window.rowDefsTCSC,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/tcsc.html',
                hasLibrary: true
            }),
            'SSC': () => ({ 
                gridOptions: window.gridOptionsSSC, 
                rowDefs: window.rowDefsSSC,
                helpUrl: 'https://pandapower.readthedocs.io/en/latest/elements/ssc.html',
                hasLibrary: true
            })
        };
        
        const config = configs[this.elementType];
        if (config) {
            const result = config();
            this.helpUrl = result.helpUrl;
            this.hasLibrary = result.hasLibrary;
            return result;
        }
        
        return { gridOptions: null, rowDefs: null };
    }
    
    populateGridData(gridOptions, rowDefs) {
        if (!gridOptions || !gridOptions.api || !rowDefs || !rowDefs[0]) {
            console.warn('Grid options, API, or row definitions not available');
            return;
        }
        
        const rowNode = gridOptions.api.getRowNode('0');
        if (!rowNode) {
            console.warn('Row node not found');
            return;
        }
        
        // Iterate over the attributes of the cell and populate the grid
        if (this.cell.value && this.cell.value.attributes) {
            for (let i = 0; i < this.cell.value.attributes.length; i++) {
                const attribute = this.cell.value.attributes[i];
                const attributeName = attribute.name;
                const attributeValue = attribute.value;
                
                if (rowDefs[0].hasOwnProperty(attributeName)) {
                    try {
                        this.safeSetDataValue(rowNode, attributeName, attributeValue, gridOptions);
                    } catch (error) {
                        console.warn(`Error setting data value for ${attributeName}:`, error);
                    }
                }
            }
        }
    }
    
    safeSetDataValue(rowNode, attributeName, attributeValue, gridOptions) {
        if (!rowNode || !attributeName) {
            console.warn('rowNode or attributeName is null/undefined');
            return false;
        }
        
        try {
            // Check if the column exists in the grid
            const columnApi = gridOptions.columnApi || (gridOptions.api && gridOptions.api.getColumnApi());
            if (columnApi && columnApi.getColumn && !columnApi.getColumn(attributeName)) {
                console.warn(`Column '${attributeName}' not found in grid definition`);
                return false;
            }
            
            rowNode.setDataValue(attributeName, attributeValue);
            return true;
        } catch (error) {
            console.warn(`Error setting data value for ${attributeName}:`, error);
            return false;
        }
    }
    
    createButtonContainer(gridOptions) {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.marginTop = '4px';  // Reverted back to 4px
        buttonContainer.style.marginBottom = '0px';  // No bottom margin
        buttonContainer.style.paddingTop = '0px';   // No padding
        buttonContainer.style.paddingBottom = '0px'; // No bottom padding
        buttonContainer.style.textAlign = 'center';
        buttonContainer.style.whiteSpace = 'nowrap';
        buttonContainer.style.height = '28px'; // Reverted back to 28px
        buttonContainer.style.display = 'flex';
        buttonContainer.style.alignItems = 'center';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.gap = '6px';  // Reverted back to 6px
        buttonContainer.style.overflow = 'hidden'; // Prevent any overflow
        
        // Cancel button
        const cancelBtn = this.createButton('Cancel', () => {
            this.ui.hideDialog();
        });
        buttonContainer.appendChild(cancelBtn);
        
        // Library button (for certain element types)
        if (this.hasLibrary) {
            const libraryBtn = this.createButton('Library', () => {
                this.ui.hideDialog();
                this.showLibraryDialog();
            });
            libraryBtn.style.background = 'orange';
            libraryBtn.style.verticalAlign = 'middle';
            buttonContainer.appendChild(libraryBtn);
        }
        
        // Help button
        if (this.helpUrl) {
            const helpBtn = this.createButton('Help', () => {
                this.ui.openLink(this.helpUrl);
            });
            helpBtn.style.verticalAlign = 'middle';
            buttonContainer.appendChild(helpBtn);
        }
        
        // Apply button
        const applyBtn = this.createButton('Apply', () => {
            this.applyChanges(gridOptions);
            this.ui.hideDialog();
        });
        applyBtn.className = 'geBtn gePrimaryBtn';
        applyBtn.style.verticalAlign = 'middle';
        buttonContainer.appendChild(applyBtn);
        
        return buttonContainer;
    }
    
    createButton(text, onClick) {
        const button = mxUtils.button(text, onClick);
        button.className = 'geBtn';
        button.style.margin = '0 4px';  // Reverted back to 4px
        button.style.height = '26px';  // Reverted back to 26px
        button.style.minWidth = '70px';  // Reverted back to 70px
        button.style.fontSize = '12px';  // Reverted back to 12px
        return button;
    }
    
    showLibraryDialog() {
        // Delegate to specific library dialogs based on element type
        if (this.elementType === 'Transformer') {
            this.ui.showTransformerDialog('', 'Apply', this.cell);
        } else if (this.elementType === 'Three Winding Transformer') {
            this.ui.showThreeWindingTransformerDialog('', 'Apply', this.cell);
        } else if (this.elementType === 'Line') {
            this.ui.showLineDialog('', 'Apply', this.cell);
        }
    }
    
    applyChanges(gridOptions) {
        try {
            if (!gridOptions || !gridOptions.api) {
                console.warn('Grid options or API not available for applying changes');
                return;
            }
            
            const rowNode = gridOptions.api.getRowNode('0');
            if (!rowNode || !rowNode.data) {
                console.warn('Row node or data not available for applying changes');
                return;
            }
            
            // Iterate over the attributes of rownode and copy to cell
            for (const attributeName in rowNode.data) {
                if (rowNode.data.hasOwnProperty(attributeName)) {
                    const attributeValue = rowNode.data[attributeName];
                    // Set the attribute value in the cell
                    this.cell.value.setAttribute(attributeName, attributeValue);
                }
            }
            
            console.log('Changes applied successfully');
        } catch (error) {
            console.error('Error applying changes:', error);
        }
    }
    
    init() {
        // The container is already set up in the constructor
        // This method is kept for compatibility
    }

    showStyledMessageDialog(title, message, accentColor, icon) {
        // Create overlay for modal effect
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Create the main dialog container
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 480px;
            width: 90%;
            overflow: hidden;
            animation: slideIn 0.3s ease-out;
        `;

        // Create header with icon and title
        const header = document.createElement('div');
        header.style.cssText = `
            background: ${accentColor};
            color: white;
            padding: 20px 24px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 18px;
            font-weight: 600;
        `;

        const iconSpan = document.createElement('span');
        iconSpan.textContent = icon;
        iconSpan.style.fontSize = '24px';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;

        header.appendChild(iconSpan);
        header.appendChild(titleSpan);

        // Create content area
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 24px;
            font-size: 15px;
            line-height: 1.5;
            color: #333;
        `;
        content.textContent = message;

        // Create button area
        const buttonArea = document.createElement('div');
        buttonArea.style.cssText = `
            padding: 16px 24px 24px;
            text-align: right;
        `;

        // Create OK button
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.cssText = `
            background: ${accentColor};
            color: white;
            border: none;
            border-radius: 6px;
            padding: 10px 24px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-width: 80px;
        `;

        // Add hover effect
        okButton.onmouseenter = () => {
            okButton.style.transform = 'translateY(-1px)';
            okButton.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        };
        okButton.onmouseleave = () => {
            okButton.style.transform = 'translateY(0)';
            okButton.style.boxShadow = 'none';
        };

        // Close dialog on button click
        okButton.onclick = () => {
            overlay.style.animation = 'fadeOut 0.2s ease-in';
            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, 200);
        };

        // Close on overlay click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                okButton.click();
            }
        };

        // Close on ESC key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                okButton.click();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Assemble the dialog
        buttonArea.appendChild(okButton);
        dialog.appendChild(header);
        dialog.appendChild(content);
        dialog.appendChild(buttonArea);
        overlay.appendChild(dialog);

        // Add CSS animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px) scale(0.95);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);

        // Add to document
        document.body.appendChild(overlay);

        // Focus the OK button for keyboard accessibility
        setTimeout(() => okButton.focus(), 100);
    }
}

// Set default help link
EditDataDialog.placeholderHelpLink = 'https://pandapower.readthedocs.io/en/latest/elements.html';

// Make EditDataDialog available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.EditDataDialog = EditDataDialog;
} 