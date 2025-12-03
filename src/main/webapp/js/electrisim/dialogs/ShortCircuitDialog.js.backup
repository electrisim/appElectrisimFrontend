// ShortCircuitDialog.js - Dialog for Short Circuit parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

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
        console.log('ShortCircuitDialog.show() called');
        super.show(async (values) => {
            console.log('ShortCircuitDialog Calculate button clicked, values:', values);
            
            // Check subscription status before proceeding
            try {
                console.log('ShortCircuitDialog: Starting subscription check...');
                const hasSubscription = await this.checkSubscriptionStatus();
                console.log('ShortCircuitDialog: Subscription check result:', hasSubscription);
                
                if (!hasSubscription) {
                    console.log('ShortCircuitDialog: No subscription, showing modal...');
                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        console.log('ShortCircuitDialog: Calling showSubscriptionModal');
                        window.showSubscriptionModal();
                    } else {
                        console.error('ShortCircuitDialog: Subscription modal not available');
                        alert('A subscription is required to use the Short Circuit calculation feature.');
                    }
                    return;
                }
                
                console.log('ShortCircuitDialog: Subscription check passed, proceeding with calculation...');
                console.log('ShortCircuitDialog: Calling callback with values:', values);
                
                if (callback) {
                    callback(values);
                }
            } catch (error) {
                console.error('ShortCircuitDialog: Error checking subscription status:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        });
    }

    // Function to check subscription status
    async checkSubscriptionStatus() {
        console.log('ShortCircuitDialog.checkSubscriptionStatus() called');
        try {
            // First ensure subscription functions are available
            console.log('ShortCircuitDialog: Ensuring subscription functions are available...');
            const functionsStatus = await ensureSubscriptionFunctions();
            console.log('ShortCircuitDialog: Functions status:', functionsStatus);
            
            // Use the global subscription check function
            if (window.checkSubscriptionStatus) {
                console.log('ShortCircuitDialog: Using window.checkSubscriptionStatus');
                const result = await window.checkSubscriptionStatus();
                console.log('ShortCircuitDialog: window.checkSubscriptionStatus result:', result);
                return result;
            }
            
            // Fallback: check if subscription manager exists
            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                console.log('ShortCircuitDialog: Using SubscriptionManager.checkSubscriptionStatus');
                const result = await window.SubscriptionManager.checkSubscriptionStatus();
                console.log('ShortCircuitDialog: SubscriptionManager result:', result);
                return result;
            }
            
            console.warn('ShortCircuitDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('ShortCircuitDialog: Error in checkSubscriptionStatus:', error);
            return false;
        }
    }
} 