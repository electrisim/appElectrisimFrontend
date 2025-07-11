// LoadFlowDialog.js - Dialog for Load Flow parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class LoadFlowDialog extends Dialog {
    constructor(editorUi) {
        super('Load Flow Parameters', 'Calculate');
        
        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.parameters = [
            {
                id: 'frequency',
                label: 'Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            },
            {
                id: 'algorithm',
                label: 'Algorithm',
                type: 'radio',
                options: [
                    { value: 'nr', label: 'Newton-Raphson', default: true },
                    { value: 'iwamoto_nr', label: 'Iwamoto' },
                    { value: 'bfsw', label: 'Backward Forward Sweep' },
                    { value: 'gs', label: 'Gauss-Seidel' },
                    { value: 'fdbx', label: 'FDBX' },
                    { value: 'fdxb', label: 'FDXB' }
                ]
            },
            {
                id: 'calculate_voltage_angles',
                label: 'Calculate Voltage Angles',
                type: 'radio',
                options: [
                    { value: 'auto', label: 'Auto', default: true },
                    { value: 'True', label: 'True' },
                    { value: 'False', label: 'False' }
                ]
            },
            {
                id: 'initialization',
                label: 'Initialization',
                type: 'radio',
                options: [
                    { value: 'auto', label: 'Auto', default: true },
                    { value: 'flat', label: 'Flat' },
                    { value: 'dc', label: 'DC' }
                ]
            },
            { id: 'maxIterations', label: 'Max Iterations', type: 'number', value: '100' },
            { id: 'tolerance', label: 'Tolerance', type: 'number', value: '1e-6' },
            { id: 'enforceLimits', label: 'Enforce Q Limits', type: 'checkbox', value: false }
        ];
    }

    getDescription() {
        return '<strong>Configure load flow calculation parameters</strong><br>The Newton-Raphson method is recommended for most cases.';
    }

    show(callback) {
        console.log('LoadFlowDialog.show() called');
        super.show(async (values) => {
            console.log('LoadFlowDialog Calculate button clicked, values:', values);
            
            // Check subscription status before proceeding
            try {
                console.log('LoadFlowDialog: Starting subscription check...');
                const hasSubscription = await this.checkSubscriptionStatus();
                console.log('LoadFlowDialog: Subscription check result:', hasSubscription);
                
                if (!hasSubscription) {
                    console.log('LoadFlowDialog: No subscription, showing modal...');
                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        console.log('LoadFlowDialog: Calling showSubscriptionModal');
                        window.showSubscriptionModal();
                    } else {
                        console.error('LoadFlowDialog: Subscription modal not available');
                        alert('A subscription is required to use the Load Flow calculation feature.');
                    }
                    return;
                }
                
                console.log('LoadFlowDialog: Subscription check passed, proceeding with calculation...');
                
                // Convert object to array format expected by loadFlow.js
                // The callback expects: [frequency, algorithm, calculate_voltage_angles, initialization, maxIterations, tolerance, enforceLimits]
                const valuesArray = [
                    values[0], // frequency
                    values[1], // algorithm
                    values[2], // calculate_voltage_angles
                    values[3], // initialization
                    values[4], // maxIterations
                    values[5], // tolerance
                    values[6]  // enforceLimits
                ];
                
                console.log('LoadFlowDialog: Calling callback with values array:', valuesArray);
                
                if (callback) {
                    callback(valuesArray);
                }
            } catch (error) {
                console.error('LoadFlowDialog: Error checking subscription status:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        });
    }

    // Function to check subscription status
    async checkSubscriptionStatus() {
        console.log('LoadFlowDialog.checkSubscriptionStatus() called');
        try {
            // First ensure subscription functions are available
            console.log('LoadFlowDialog: Ensuring subscription functions are available...');
            const functionsStatus = await ensureSubscriptionFunctions();
            console.log('LoadFlowDialog: Functions status:', functionsStatus);
            
            // Use the global subscription check function
            if (window.checkSubscriptionStatus) {
                console.log('LoadFlowDialog: Using window.checkSubscriptionStatus');
                const result = await window.checkSubscriptionStatus();
                console.log('LoadFlowDialog: window.checkSubscriptionStatus result:', result);
                return result;
            }
            
            // Fallback: check if subscription manager exists
            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                console.log('LoadFlowDialog: Using SubscriptionManager.checkSubscriptionStatus');
                const result = await window.SubscriptionManager.checkSubscriptionStatus();
                console.log('LoadFlowDialog: SubscriptionManager result:', result);
                return result;
            }
            
            console.warn('LoadFlowDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('LoadFlowDialog: Error in checkSubscriptionStatus:', error);
            return false;
        }
    }
} 