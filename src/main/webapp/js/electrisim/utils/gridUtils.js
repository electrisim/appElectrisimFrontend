export const numberParser = (params) => {
    if (Number(params.newValue) >= 0) {
        return Number(params.newValue);
    } else {
        alert("The value of the " + params.colDef.field + " must be number (dot separated) or >= 0");
        return Number(params.oldValue);
    }
};

export const actionCellRenderer = (params) => {
    let eGui = document.createElement("div");
    
    let editingCells = params.api.getEditingCells();
    let isCurrentRowEditing = editingCells.some((cell) => {
        return cell.rowIndex === params.node.rowIndex;
    });
    
    if (isCurrentRowEditing) {
        eGui.innerHTML = `
            <button class="action-button update" data-action="update">update</button>
            <button class="action-button cancel" data-action="cancel">cancel</button>
        `;
    } else {
        eGui.innerHTML = `
            <button class="action-button edit" data-action="edit">edit</button>
            <button class="action-button delete" data-action="delete">delete</button>
            <button class="action-button update" data-action="add">add</button>
        `;
    }
    
    return eGui;
};

// Define and export utility functions for grid operations

// Get connected bus IDs for a cell
export const getConnectedBusId = (cell, isLine = false) => {
    console.log('cell in getConnectedBusId', cell);

    if (isLine) {                 
        return {            
            busFrom: cell.source?.mxObjectId?.replace('#', '_'),
            busTo: cell.target?.mxObjectId?.replace('#', '_')
        };            
    }
    const edge = cell.edges[0];
    // First check if edge exists
    if (!edge) {
        return null; // or some default value
    }

    // Then check if both target and source exist before accessing their properties
    if (!edge.target && !edge.source) {
        return null; // or some default value
    }

    // Make sure we're not accessing mxObjectId from a null object
    const bus = edge.target && edge.target.mxObjectId !== cell.mxObjectId ?
        (edge.target ? edge.target.mxObjectId : null) : 
        (edge.source ? edge.source.mxObjectId : null);

    // Only try to replace if bus is not null
    return bus ? bus.replace('#', '_') : null;
};

// Get transformer connections
export const getTransformerConnections = (cell) => {
    const hvEdge = cell.edges[0];
    const lvEdge = cell.edges[1];

    return {
        hv_bus: (hvEdge.target.mxObjectId !== cell.mxObjectId ?
            hvEdge.target.mxObjectId : hvEdge.source.mxObjectId).replace('#', '_'),
        lv_bus: (lvEdge.target.mxObjectId !== cell.mxObjectId ?
            lvEdge.target.mxObjectId : lvEdge.source.mxObjectId).replace('#', '_')
    };
};

// Get three winding transformer connections
export const getThreeWindingConnections = (cell) => {
    const hvEdge = cell.edges[0];
    const mvEdge = cell.edges[1];
    const lvEdge = cell.edges[2];

    const getConnectedBus = (edge) =>
        (edge.target.mxObjectId !== cell.mxObjectId ?
            edge.target.mxObjectId : edge.source.mxObjectId).replace('#', '_');

    return {
        hv_bus: getConnectedBus(hvEdge),
        mv_bus: getConnectedBus(mvEdge),
        lv_bus: getConnectedBus(lvEdge)
    };
};

// Get impedance connections
export const getImpedanceConnections = (cell) => {
    if (!cell.edges || cell.edges.length < 2) {
        throw new Error('Impedance must be connected to two buses');
    }

    const fromEdge = cell.edges[0];
    const toEdge = cell.edges[1];

    return {
        busFrom: (fromEdge.target.mxObjectId !== cell.mxObjectId ?
            fromEdge.target.mxObjectId : fromEdge.source.mxObjectId).replace('#', '_'),
        busTo: (toEdge.target.mxObjectId !== cell.mxObjectId ?
            toEdge.target.mxObjectId : toEdge.source.mxObjectId).replace('#', '_')
    };
};

// Get connected buses for a cell
export const getConnectedBuses = (cell) => {
    // First try source/target approach
    if (cell.source && cell.target) {
        return {
            busFrom: cell.source.mxObjectId.replace('#', '_'),
            busTo: cell.target.mxObjectId.replace('#', '_')
        };
    }
    
    // Fallback to edges approach
    if (!cell.edges || cell.edges.length < 2) {
        throw new Error('Element must be connected to two buses');
    }
    
    const fromEdge = cell.edges[0];
    const toEdge = cell.edges[1];

    return {
        busFrom: (fromEdge.target.mxObjectId !== cell.mxObjectId ?
            fromEdge.target.mxObjectId : fromEdge.source.mxObjectId).replace('#', '_'),
        busTo: (toEdge.target.mxObjectId !== cell.mxObjectId ?
            toEdge.target.mxObjectId : toEdge.source.mxObjectId).replace('#', '_')
    };
};

// Validate bus connections for a cell
export const validateBusConnections = (cell) => {
    // Check source/target approach first
    if (cell.source && cell.target) {
        if (!cell.source.mxObjectId || !cell.target.mxObjectId) {
            throw new Error('Line must be connected to two buses with valid IDs');
        }
        return;
    }
    
    // Fallback to edges approach
    if (!cell.edges || cell.edges.length < 2) {
        throw new Error('Line must be connected to two buses');
    }
};

// Update transformer bus connections
export const updateTransformerBusConnections = (transformers, busbars, graph) => {
    return transformers.map(transformer => {
        // Get the cell from the graph using the transformer's ID
        const cell = graph.getModel().getCell(transformer.id);
        if (!cell || !cell.edges || cell.edges.length < 2) {
            console.warn(`Transformer ${transformer.id} is not properly connected`);
            return transformer;
        }

        try {
            const connections = getTransformerConnections(cell);
            return {
                ...transformer,
                hv_bus: connections.hv_bus,
                lv_bus: connections.lv_bus
            };
        } catch (error) {
            console.error(`Error updating connections for transformer ${transformer.id}:`, error);
            return transformer;
        }
    });
};

// Update three winding transformer connections
export const updateThreeWindingTransformerConnections = (transformers, busbars, graph) => {
    return transformers.map(transformer => {
        // Get the cell from the graph using the transformer's ID
        const cell = graph.getModel().getCell(transformer.id);
        if (!cell || !cell.edges || cell.edges.length < 3) {
            console.warn(`Three winding transformer ${transformer.id} is not properly connected`);
            return transformer;
        }

        try {
            const connections = getThreeWindingConnections(cell);
            return {
                ...transformer,
                hv_bus: connections.hv_bus,
                mv_bus: connections.mv_bus,
                lv_bus: connections.lv_bus
            };
        } catch (error) {
            console.error(`Error updating connections for three winding transformer ${transformer.id}:`, error);
            return transformer;
        }
    });
};

// Make functions available globally for legacy code
window.getConnectedBusId = getConnectedBusId;
window.getTransformerConnections = getTransformerConnections;
window.getThreeWindingConnections = getThreeWindingConnections;
window.getImpedanceConnections = getImpedanceConnections;
window.getConnectedBuses = getConnectedBuses;
window.validateBusConnections = validateBusConnections;
window.updateTransformerBusConnections = updateTransformerBusConnections;
window.updateThreeWindingTransformerConnections = updateThreeWindingTransformerConnections;