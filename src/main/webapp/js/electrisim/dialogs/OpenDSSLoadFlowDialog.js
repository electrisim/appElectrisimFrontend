// OpenDSSLoadFlowDialog.js - Dialog specifically for OpenDSS Load Flow parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class OpenDSSLoadFlowDialog extends Dialog {
    constructor(editorUi) {
        super('OpenDSS Load Flow Parameters', 'Calculate');
        
        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        
        // OpenDSS specific parameters based on the backend implementation
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
                    { value: 'Admittance', label: 'Admittance (Iterative Load Flow)', default: true },
                    { value: 'PowerFlow', label: 'PowerFlow (Direct Solution)' }
                ]
            },
            {
                id: 'maxIterations',
                label: 'Max Iterations',
                type: 'number',
                value: '100'
            },
            {
                id: 'tolerance',
                label: 'Tolerance',
                type: 'number',
                value: '1e-6'
            },
            {
                id: 'convergence',
                label: 'Convergence Method',
                type: 'radio',
                options: [
                    { value: 'normal', label: 'Normal', default: true },
                    { value: 'accelerated', label: 'Accelerated' }
                ]
            },
            {
                id: 'voltageControl',
                label: 'Voltage Control',
                type: 'checkbox',
                value: true
            },
            {
                id: 'tapControl',
                label: 'Tap Control',
                type: 'checkbox',
                value: true
            }
        ];
    }

    getDescription() {
        return '<strong>Configure OpenDSS load flow calculation parameters</strong><br>OpenDSS provides robust power flow analysis with advanced control capabilities.';
    }

    show(callback) {
        console.log('OpenDSSLoadFlowDialog.show() called');
        super.show(async (values) => {
            console.log('OpenDSSLoadFlowDialog Calculate button clicked, values:', values);
            
            // Check subscription status before proceeding
            try {
                console.log('OpenDSSLoadFlowDialog: Starting subscription check...');
                const hasSubscription = await this.checkSubscriptionStatus();
                console.log('OpenDSSLoadFlowDialog: Subscription check result:', hasSubscription);
                
                if (!hasSubscription) {
                    console.log('OpenDSSLoadFlowDialog: No subscription, showing modal...');
                    // Close the dialog first
                    if (this.modalOverlay && this.modalOverlay.parentNode) {
                        document.body.removeChild(this.modalOverlay);
                    }
                    
                    // Show subscription modal if no active subscription
                    if (window.showSubscriptionModal) {
                        console.log('OpenDSSLoadFlowDialog: Calling showSubscriptionModal');
                        window.showSubscriptionModal();
                    } else {
                        console.error('OpenDSSLoadFlowDialog: Subscription modal not available');
                        alert('A subscription is required to use the OpenDSS Load Flow calculation feature.');
                    }
                    return;
                }
                
                console.log('OpenDSSLoadFlowDialog: Subscription check passed, proceeding with calculation...');
                
                // Convert object to array format expected by loadflowOpenDss.js
                // The callback expects: [frequency, algorithm, maxIterations, tolerance, convergence, voltageControl, tapControl]
                const valuesArray = [
                    values.frequency || '50',
                    values.algorithm || 'Admittance',
                    values.maxIterations || '100',
                    values.tolerance || '1e-6',
                    values.convergence || 'normal',
                    values.voltageControl || true,
                    values.tapControl || true
                ];
                
                console.log('OpenDSSLoadFlowDialog: Calling callback with values array:', valuesArray);
                
                if (callback) {
                    callback(valuesArray);
                }
            } catch (error) {
                console.error('OpenDSSLoadFlowDialog: Error checking subscription status:', error);
                alert('Unable to verify subscription status. Please try again.');
            }
        });
    }

    // Function to check subscription status
    async checkSubscriptionStatus() {
        console.log('OpenDSSLoadFlowDialog.checkSubscriptionStatus() called');
        try {
            // First ensure subscription functions are available
            console.log('OpenDSSLoadFlowDialog: Ensuring subscription functions are available...');
            const functionsStatus = await ensureSubscriptionFunctions();
            console.log('OpenDSSLoadFlowDialog: Functions status:', functionsStatus);
            
            // Use the global subscription check function
            if (window.checkSubscriptionStatus) {
                console.log('OpenDSSLoadFlowDialog: Using window.checkSubscriptionStatus');
                const result = await window.checkSubscriptionStatus();
                console.log('OpenDSSLoadFlowDialog: window.checkSubscriptionStatus result:', result);
                return result;
            }
            
            // Fallback: check if subscription manager exists
            if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                console.log('OpenDSSLoadFlowDialog: Using SubscriptionManager.checkSubscriptionStatus');
                const result = await window.SubscriptionManager.checkSubscriptionStatus();
                console.log('OpenDSSLoadFlowDialog: SubscriptionManager result:', result);
                return result;
            }
            
            console.warn('OpenDSSLoadFlowDialog: No subscription check function available');
            return false;
        } catch (error) {
            console.error('OpenDSSLoadFlowDialog: Error in checkSubscriptionStatus:', error);
            return false;
        }
    }
}
