// Library Dialog Manager - Handles all library dialogs with improved UI and functionality

export class LibraryDialogManager {
    constructor() {
        this.currentGrid = null;
        this.currentDialog = null;
    }

    createLibraryDialog(title, rowDefs, columnDefs, gridOptions, onSelect, onCancel) {
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
            flexDirection: 'column',
            backgroundColor: '#ffffff'
        });

        // Create header
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '20px 24px 16px 24px',
            borderBottom: '2px solid #e9ecef',
            backgroundColor: '#f8f9fa'
        });

        const titleElement = document.createElement('h2');
        titleElement.textContent = title;
        Object.assign(titleElement.style, {
            margin: '0 0 8px 0',
            fontSize: '24px',
            fontWeight: '600',
            color: '#2c3e50'
        });

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Select an item from the library to load its parameters';
        Object.assign(subtitle.style, {
            margin: '0',
            fontSize: '14px',
            color: '#6c757d',
            fontStyle: 'italic'
        });

        header.appendChild(titleElement);
        header.appendChild(subtitle);
        container.appendChild(header);

        // Create toolbar
        const toolbar = document.createElement('div');
        Object.assign(toolbar.style, {
            padding: '16px 24px',
            borderBottom: '1px solid #e9ecef',
            backgroundColor: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        // Left side toolbar - Action buttons
        const actionButtons = document.createElement('div');
        Object.assign(actionButtons.style, {
            display: 'flex',
            gap: '8px'
        });

        const addButton = this.createToolbarButton('Add New', '#28a745', '#218838', '📝');
        const editButton = this.createToolbarButton('Edit', '#ffc107', '#e0a800', '✏️');
        const deleteButton = this.createToolbarButton('Delete', '#dc3545', '#c82333', '🗑️');

        // Initially disable edit and delete buttons
        editButton.disabled = true;
        deleteButton.disabled = true;
        editButton.style.opacity = '0.5';
        deleteButton.style.opacity = '0.5';

        // Store button references for later use
        const elementType = title.split(' ')[0].toLowerCase();
        editButton.id = `${elementType}-edit-btn`;
        deleteButton.id = `${elementType}-delete-btn`;

        actionButtons.appendChild(addButton);
        actionButtons.appendChild(editButton);
        actionButtons.appendChild(deleteButton);

        // Right side toolbar - Info
        const infoText = document.createElement('div');
        Object.assign(infoText.style, {
            fontSize: '12px',
            color: '#6c757d',
            fontStyle: 'italic'
        });
        infoText.textContent = `${rowDefs.length} items available`;

        toolbar.appendChild(actionButtons);
        toolbar.appendChild(infoText);
        container.appendChild(toolbar);

        // Create grid container
        const gridContainer = document.createElement('div');
        Object.assign(gridContainer.style, {
            flex: '1',
            margin: '16px 24px',
            border: '2px solid #e9ecef',
            borderRadius: '8px',
            overflow: 'hidden',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        });
        container.appendChild(gridContainer);

        // Create footer with action buttons
        const footer = document.createElement('div');
        Object.assign(footer.style, {
            padding: '20px 24px',
            borderTop: '2px solid #e9ecef',
            backgroundColor: '#f8f9fa',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        // Left side - Selection info
        const selectionInfo = document.createElement('div');
        Object.assign(selectionInfo.style, {
            fontSize: '14px',
            color: '#6c757d',
            fontWeight: '500'
        });
        selectionInfo.textContent = 'No item selected';
        selectionInfo.id = 'selection-info';

        // Right side - Action buttons
        const footerButtons = document.createElement('div');
        Object.assign(footerButtons.style, {
            display: 'flex',
            gap: '12px'
        });

        const selectButton = this.createButton('Select & Load', '#007bff', '#0056b3');
        const cancelButton = this.createButton('Cancel', '#6c757d', '#5a6268');

        selectButton.disabled = true;
        selectButton.style.opacity = '0.5';

        footerButtons.appendChild(cancelButton);
        footerButtons.appendChild(selectButton);

        footer.appendChild(selectionInfo);
        footer.appendChild(footerButtons);
        container.appendChild(footer);

        // Initialize AG-Grid with improved options
        if (window.agGrid && rowDefs && columnDefs) {
            const enhancedGridOptions = {
                ...gridOptions,
                rowData: rowDefs,
                columnDefs: columnDefs,
                rowSelection: 'single',
                rowHeight: 40,
                headerHeight: 50,
                animateRows: true,
                enableCellChangeFlash: true,
                suppressRowClickSelection: false,
                
                // Enhanced styling
                getRowStyle: (params) => {
                    if (params.node.isSelected()) {
                        return { 
                            backgroundColor: '#e3f2fd', 
                            fontWeight: 'bold',
                            borderLeft: '4px solid #007bff'
                        };
                    }
                    return null;
                },
                
                // Row hover effect
                onRowMouseOver: (event) => {
                    if (!event.node.isSelected()) {
                        event.node.setRowHeight(42);
                        event.api.onRowHeightChanged();
                    }
                },
                
                onRowMouseLeave: (event) => {
                    if (!event.node.isSelected()) {
                        event.node.setRowHeight(40);
                        event.api.onRowHeightChanged();
                    }
                },
                
                onSelectionChanged: () => {
                    const selectedRows = enhancedGridOptions.api.getSelectedRows();
                    const hasSelection = selectedRows.length > 0;
                    
                    // Update footer buttons
                    selectButton.disabled = !hasSelection;
                    selectButton.style.opacity = hasSelection ? '1' : '0.5';
                    
                    // Update toolbar buttons
                    editButton.disabled = !hasSelection;
                    deleteButton.disabled = !hasSelection;
                    editButton.style.opacity = hasSelection ? '1' : '0.5';
                    deleteButton.style.opacity = hasSelection ? '1' : '0.5';
                    
                    // Update selection info
                    if (hasSelection) {
                        selectionInfo.textContent = `Selected: ${selectedRows[0].name}`;
                        selectionInfo.style.color = '#28a745';
                        selectionInfo.style.fontWeight = '600';
                    } else {
                        selectionInfo.textContent = 'No item selected';
                        selectionInfo.style.color = '#6c757d';
                        selectionInfo.style.fontWeight = '500';
                    }
                },
                
                onFirstDataRendered: (params) => {
                    params.api.sizeColumnsToFit();
                    
                    // Add custom CSS for better styling
                    const style = document.createElement('style');
                    style.textContent = `
                        .ag-theme-alpine .ag-header {
                            background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
                            border-bottom: 2px solid #dee2e6;
                        }
                        .ag-theme-alpine .ag-header-cell {
                            font-weight: 600;
                            color: #495057;
                        }
                        .ag-theme-alpine .ag-row:hover {
                            background-color: #f8f9fa !important;
                        }
                        .ag-theme-alpine .ag-row-selected {
                            background-color: #e3f2fd !important;
                            border-left: 4px solid #007bff;
                        }
                        .ag-theme-alpine .ag-row-selected:hover {
                            background-color: #bbdefb !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
            };

            // Create grid
            const grid = new window.agGrid.Grid(gridContainer, enhancedGridOptions);
            gridContainer._agGridInstance = grid;
            this.currentGrid = grid;
        }

        // Button event handlers
        selectButton.onclick = (e) => {
            e.preventDefault();
            const selectedRows = this.currentGrid.gridOptions.api.getSelectedRows();
            if (selectedRows.length > 0 && onSelect) {
                onSelect(selectedRows[0]);
            }
        };

        cancelButton.onclick = (e) => {
            e.preventDefault();
            if (onCancel) {
                onCancel();
            }
        };

        // Toolbar button handlers
        addButton.onclick = (e) => {
            e.preventDefault();
            this.handleAdd();
        };

        editButton.onclick = (e) => {
            e.preventDefault();
            const selectedRows = this.currentGrid.gridOptions.api.getSelectedRows();
            if (selectedRows.length > 0) {
                this.handleEdit(selectedRows[0]);
            }
        };

        deleteButton.onclick = (e) => {
            e.preventDefault();
            const selectedRows = this.currentGrid.gridOptions.api.getSelectedRows();
            if (selectedRows.length > 0) {
                this.handleDelete(selectedRows[0]);
            }
        };

        this.currentDialog = container;
        return container;
    }

    createButton(text, bgColor, hoverColor) {
        const button = document.createElement('button');
        button.textContent = text;
        Object.assign(button.style, {
            padding: '12px 24px',
            backgroundColor: bgColor,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.2s ease',
            minWidth: '120px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        });
        
        button.addEventListener('mouseenter', () => {
            if (!button.disabled) {
                button.style.backgroundColor = hoverColor;
                button.style.transform = 'translateY(-1px)';
                button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.disabled) {
                button.style.backgroundColor = bgColor;
                button.style.transform = 'translateY(0)';
                button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
            }
        });
        
        return button;
    }

    createToolbarButton(text, bgColor, hoverColor, icon = '') {
        const button = document.createElement('button');
        button.innerHTML = `${icon} ${text}`;
        Object.assign(button.style, {
            padding: '8px 16px',
            backgroundColor: bgColor,
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        });
        
        button.addEventListener('mouseenter', () => {
            if (!button.disabled) {
                button.style.backgroundColor = hoverColor;
                button.style.transform = 'translateY(-1px)';
            }
        });
        
        button.addEventListener('mouseleave', () => {
            if (!button.disabled) {
                button.style.backgroundColor = bgColor;
                button.style.transform = 'translateY(0)';
            }
        });
        
        return button;
    }

    handleAdd() {
        // Create a new empty row for editing
        if (this.currentGrid && this.currentGrid.gridOptions.api) {
            const newRow = { name: "New Item", /* other default values */ };
            this.currentGrid.gridOptions.api.applyTransaction({ add: [newRow] });
            
            // Select the new row and start editing
            const rowNode = this.currentGrid.gridOptions.api.getDisplayedRowAtIndex(
                this.currentGrid.gridOptions.api.getDisplayedRowCount() - 1
            );
            if (rowNode) {
                rowNode.setSelected(true);
                this.currentGrid.gridOptions.api.startEditingCell({
                    rowIndex: rowNode.rowIndex,
                    colKey: 'name'
                });
            }
        }
    }

    handleEdit(selectedItem) {
        // Start editing the selected row
        if (this.currentGrid && this.currentGrid.gridOptions.api) {
            const rowNode = this.currentGrid.gridOptions.api.getSelectedNodes()[0];
            if (rowNode) {
                this.currentGrid.gridOptions.api.startEditingCell({
                    rowIndex: rowNode.rowIndex,
                    colKey: 'name'
                });
            }
        }
    }

    handleDelete(selectedItem) {
        // Show confirmation dialog
        const confirmed = confirm(`Are you sure you want to delete "${selectedItem.name}"?`);
        if (confirmed && this.currentGrid && this.currentGrid.gridOptions.api) {
            const selectedNodes = this.currentGrid.gridOptions.api.getSelectedNodes();
            if (selectedNodes.length > 0) {
                this.currentGrid.gridOptions.api.applyTransaction({ 
                    remove: [selectedNodes[0].data] 
                });
                
                // Update the info text
                const infoText = document.querySelector('#selection-info');
                if (infoText) {
                    infoText.textContent = 'No item selected';
                    infoText.style.color = '#6c757d';
                    infoText.style.fontWeight = '500';
                }
            }
        }
    }

    destroy() {
        if (this.currentGrid) {
            this.currentGrid.destroy();
            this.currentGrid = null;
        }
        this.currentDialog = null;
    }
}

// Make it globally available
globalThis.LibraryDialogManager = LibraryDialogManager;
