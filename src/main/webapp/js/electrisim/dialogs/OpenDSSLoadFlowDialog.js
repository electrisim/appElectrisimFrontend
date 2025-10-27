// OpenDSSLoadFlowDialog.js - Dialog specifically for OpenDSS Load Flow parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class OpenDSSLoadFlowDialog extends Dialog {
    constructor(editorUi) {
        super('OpenDSS Load Flow Parameters', 'Calculate');
        
        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        
        // OpenDSS specific parameters based on OpenDSS documentation
        // Reference: https://opendss.epri.com/PowerFlow.html
        this.parameters = [
            {
                id: 'frequency',
                label: 'Base Frequency',
                type: 'radio',
                options: [
                    { value: '50', label: '50 Hz', default: true },
                    { value: '60', label: '60 Hz' }
                ]
            },
            {
                id: 'mode',
                label: 'Solution Mode',
                type: 'radio',
                options: [
                    { value: 'Snapshot', label: 'Snapshot (Single Solution)', default: true },
                    { value: 'Daily', label: 'Daily (24-hour simulation)' },
                    { value: 'Dutycycle', label: 'Dutycycle (Time-varying)' },
                    { value: 'Yearly', label: 'Yearly' }
                ]
            },
            {
                id: 'algorithm',
                label: 'Solution Algorithm',
                type: 'radio',
                options: [
                    { value: 'Normal', label: 'Normal (Fast current injection)', default: true },
                    { value: 'Newton', label: 'Newton (Robust for difficult circuits)' }
                ]
            },
            {
                id: 'loadmodel',
                label: 'Load Model',
                type: 'radio',
                options: [
                    { value: 'Powerflow', label: 'Powerflow (Iterative with power injections)', default: true },
                    { value: 'Admittance', label: 'Admittance (Direct solution)' }
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
                label: 'Convergence Tolerance',
                type: 'number',
                value: '0.0001'
            },
            {
                id: 'controlmode',
                label: 'Control Mode',
                type: 'radio',
                options: [
                    { value: 'Static', label: 'Static (No control actions)', default: true },
                    { value: 'Event', label: 'Event (Time-based controls)' },
                    { value: 'Time', label: 'Time (Continuous controls)' }
                ]
            },
            {
                id: 'exportCommands',
                label: 'Export OpenDSS Commands (download .txt file)',
                type: 'checkbox',
                value: false
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
                // The callback expects: [frequency, mode, algorithm, loadmodel, maxIterations, tolerance, controlmode, exportCommands]
                const valuesArray = [
                    values.frequency || '50',
                    values.mode || 'Snapshot',
                    values.algorithm || 'Normal',
                    values.loadmodel || 'Powerflow',
                    values.maxIterations || '100',
                    values.tolerance || '0.0001',
                    values.controlmode || 'Static',
                    values.exportCommands || false
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
