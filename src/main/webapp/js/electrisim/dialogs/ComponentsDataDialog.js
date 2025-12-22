// ComponentsDataDialog.js - Dialog for viewing all components data organized by tabs
import { Dialog } from '../Dialog.js';

// Component type constants (from loadFlow.js)
const COMPONENT_TYPES = {
    EXTERNAL_GRID: 'External Grid',
    GENERATOR: 'Generator',
    STATIC_GENERATOR: 'Static Generator',
    ASYMMETRIC_STATIC_GENERATOR: 'Asymmetric Static Generator',
    PV_SYSTEM: 'PV System',
    BUS: 'Bus',
    TRANSFORMER: 'Transformer',
    THREE_WINDING_TRANSFORMER: 'Three Winding Transformer',
    SHUNT_REACTOR: 'Shunt Reactor',
    CAPACITOR: 'Capacitor',
    LOAD: 'Load',
    ASYMMETRIC_LOAD: 'Asymmetric Load',
    IMPEDANCE: 'Impedance',
    WARD: 'Ward',
    EXTENDED_WARD: 'Extended Ward',
    MOTOR: 'Motor',
    STORAGE: 'Storage',
    SVC: 'SVC',
    TCSC: 'TCSC',
    SSC: 'SSC',
    DC_LINE: 'DC Line',
    LINE: 'Line'
};

// Simple stub implementation to prevent crashes
export class ComponentsDataDialog {
    constructor(ui, rootCell) {
        this.ui = ui;
        console.log('ComponentsDataDialog: Temporarily disabled due to syntax errors');
    }

    show() {
        alert('Components Data Dialog is temporarily unavailable due to maintenance. Basic Electrisim functionality is still available.');
    }

    close() {
        // Stub method
    }
}

// Make ComponentsDataDialog available globally for legacy compatibility
if (typeof window !== 'undefined') {
    window.ComponentsDataDialog = ComponentsDataDialog;
}