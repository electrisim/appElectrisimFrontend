// ShortCircuitDialog.js - Dialog for Short Circuit parameters
import { Dialog } from '../Dialog.js';

export class ShortCircuitDialog extends Dialog {
    constructor(editorUi) {
        super('Short Circuit Parameters', 'Calculate');
        
        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.parameters = [
            {
                id: 'fault',
                label: 'Fault',
                type: 'radio',
                options: [
                    { value: '3ph', label: 'Three Phase', default: true },
                    { value: '2ph', label: 'Two Phase' },
                    { value: '1ph', label: 'Single Phase' }
                ]
            },
            {
                id: 'case',
                label: 'Case',
                type: 'radio',
                options: [
                    { value: 'max', label: 'Maximum', default: true },
                    { value: 'min', label: 'Minimum' }
                ]
            },
            {
                id: 'lv_tol_percent',
                label: 'Voltage tolerance in low voltage grids',
                type: 'radio',
                options: [
                    { value: '6', label: '6%', default: true },
                    { value: '10', label: '10%' }
                ]
            },
            {
                id: 'topology',
                label: 'Define option for meshing',
                type: 'radio',
                options: [
                    { value: 'auto', label: 'Auto', default: true },
                    { value: 'radial', label: 'Radial' },
                    { value: 'meshed', label: 'Meshed' }
                ]
            },
            { id: 'tk_s', label: 'Failure clearing time in seconds (only relevant for ith)', type: 'number', value: '1' },
            { id: 'r_fault_ohm', label: 'Fault resistance in Ohm', type: 'number', value: '0' },
            { id: 'x_fault_ohm', label: 'Fault reactance in Ohm', type: 'number', value: '0' },
            {
                id: 'inverse_y',
                label: 'Inverse should be used instead of LU factorization',
                type: 'radio',
                options: [
                    { value: 'True', label: 'True', default: true },
                    { value: 'False', label: 'False' }
                ]
            }
        ];
    }

    getDescription() {
        return '<strong>Configure short circuit calculation parameters</strong><br>Select the type of fault and calculation settings.';
    }

    show(callback) {
        super.show((values) => {
            console.log('Short Circuit Dialog values:', values);
            
            if (callback) {
                callback(values);
            }
        });
    }
} 