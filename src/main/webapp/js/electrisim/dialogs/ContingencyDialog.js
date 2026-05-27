// ContingencyDialog.js - Dialog for Contingency Analysis parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class ContingencyDialog extends Dialog {
    constructor(editorUi) {
        super('Contingency Analysis Parameters', 'Analyze');

        /** Full-viewport modal shell (matches Load Flow dialog layout). */
        this.useStudyModalShell = true;
        this.studyModalBoxWidth = 740;
        
        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.parameters = [
            {
                id: 'element_type',
                label: 'Element Type to Analyze',
                type: 'radio',
                options: [
                    { value: 'line', label: 'Transmission Lines', default: true },
                    { value: 'transformer', label: 'Transformers' },
                    { value: 'generator', label: 'Generators' },
                    { value: 'all', label: 'All Elements' }
                ]
            },
            {
                id: 'voltage_limits',
                label: 'Check Voltage Limits',
                type: 'radio',
                options: [
                    { value: 'true', label: 'Yes', default: true },
                    { value: 'false', label: 'No' }
                ]
            },
            {
                id: 'thermal_limits',
                label: 'Check Thermal Limits',
                type: 'radio',
                options: [
                    { value: 'true', label: 'Yes', default: true },
                    { value: 'false', label: 'No' }
                ]
            },
            { 
                id: 'min_vm_pu', 
                label: 'Minimum Voltage (p.u.)', 
                type: 'number', 
                value: '0.95',
                min: '0.5',
                max: '1.0',
                step: '0.01'
            },
            { 
                id: 'max_vm_pu', 
                label: 'Maximum Voltage (p.u.)', 
                type: 'number', 
                value: '1.05',
                min: '1.0',
                max: '1.5',
                step: '0.01'
            },
            { 
                id: 'max_loading_percent', 
                label: 'Maximum Loading (%)', 
                type: 'number', 
                value: '100',
                min: '50',
                max: '200',
                step: '1'
            }
        ];
    }

    getDescription() {
        return '<strong>Configure contingency analysis parameters</strong><br>' +
               'Each in-service element of the selected type is switched out one at a time (N-1 screening) ' +
               'and an AC load flow is run to check voltage and thermal limits. ' +
               'See the <a href="https://electrisim.com/documentation.html#contingency-analysis" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
    }

    show(callback) {
        console.log('ContingencyDialog.show() called');
        super.show(async (values) => {
            console.log('ContingencyDialog Analyze button clicked, values:', values);
            
            // Check subscription status before proceeding
            try {
                console.log('ContingencyDialog: Starting subscription check...');
                const hasSubscription = await this.checkSubscriptionStatus();
                console.log('ContingencyDialog: Subscription check result:', hasSubscription);
                
                if (!hasSubscription) {
                    console.log('ContingencyDialog: No subscription, showing modal...');
                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        console.log('ContingencyDialog: Calling showSubscriptionModal');
                        window.showSubscriptionModal();
                    } else {
                        console.error('ContingencyDialog: Subscription modal not available');
                        alert('A subscription is required to use the Contingency Analysis feature.');
                    }
                    return;
                }
                
                console.log('ContingencyDialog: Subscription check passed, proceeding with analysis...');
                
                // Array order matches contingencyAnalysis.js: element_type, voltage_limits, thermal_limits, min/max V, max loading
                const valuesArray = [
                    values[0],  // element_type
                    values[1],  // voltage_limits
                    values[2],  // thermal_limits
                    values[3],  // min_vm_pu
                    values[4],  // max_vm_pu
                    values[5]   // max_loading_percent
                ];
                
                console.log('ContingencyDialog: Calling callback with values array:', valuesArray);
                
                if (callback) {
                    callback(valuesArray);
                }
            } catch (error) {
                console.error('ContingencyDialog: Error checking subscription status:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        });
    }

    // Function to check subscription status
    async checkSubscriptionStatus() {
        console.log('ContingencyDialog.checkSubscriptionStatus() called');
        try {
            // First ensure subscription functions are available
            console.log('ContingencyDialog: Ensuring subscription functions are available...');
            const functionsStatus = await ensureSubscriptionFunctions();
            console.log('ContingencyDialog: Functions status:', functionsStatus);
            
            // Use the global subscription check function
            if (window.checkSubscriptionStatus) {
                console.log('ContingencyDialog: Using window.checkSubscriptionStatus');
                const result = await window.checkSubscriptionStatus();
                console.log('ContingencyDialog: window.checkSubscriptionStatus result:', result);
                return result;
            }
            
            // Fallback: check if subscription manager exists
            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                console.log('ContingencyDialog: Using SubscriptionManager.checkSubscriptionStatus');
                const result = await window.SubscriptionManager.checkSubscriptionStatus();
                console.log('ContingencyDialog: SubscriptionManager result:', result);
                return result;
            }
            
            console.warn('ContingencyDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('ContingencyDialog: Error in checkSubscriptionStatus:', error);
            return false;
        }
    }
}

// Make ContingencyDialog available globally
globalThis.ContingencyDialog = ContingencyDialog; 