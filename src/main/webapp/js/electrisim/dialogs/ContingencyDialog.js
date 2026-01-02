// ContingencyDialog.js - Dialog for Contingency Analysis parameters
import { Dialog } from '../Dialog.js';
import { ensureSubscriptionFunctions } from '../ensureSubscriptionFunctions.js';

export class ContingencyDialog extends Dialog {
    constructor(editorUi) {
        super('Contingency Analysis Parameters', 'Analyze');
        
        // Use global App if editorUi is not valid
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.parameters = [
            {
                id: 'contingency_type',
                label: 'Contingency Type',
                type: 'radio',
                options: [
                    { value: 'N-1', label: 'N-1 (Single Element Outage)', default: true },
                    { value: 'N-2', label: 'N-2 (Double Element Outage)' },
                    { value: 'N-K', label: 'N-K (Multiple Element Outage)' }
                ]
            },
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
                id: 'elements_to_analyze',
                label: 'Elements to Analyze',
                type: 'radio',
                options: [
                    { value: 'all', label: 'All Elements', default: true },
                    { value: 'critical', label: 'Critical Elements Only' },
                    { value: 'selected', label: 'Selected Elements Only' }
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
            },
            {
                id: 'post_contingency_actions',
                label: 'Post-Contingency Actions',
                type: 'radio',
                options: [
                    { value: 'none', label: 'No Actions', default: true },
                    { value: 'redispatch', label: 'Generation Redispatch' },
                    { value: 'load_shedding', label: 'Load Shedding' },
                    { value: 'both', label: 'Both Actions' }
                ]
            },
            {
                id: 'analysis_mode',
                label: 'Analysis Mode',
                type: 'radio',
                options: [
                    { value: 'fast', label: 'Fast Screening', default: true },
                    { value: 'detailed', label: 'Detailed Analysis' },
                    { value: 'comprehensive', label: 'Comprehensive Analysis' }
                ]
            }
        ];
    }

    getDescription() {
        return '<strong>Configure contingency analysis parameters</strong><br>' +
               'Contingency analysis evaluates system security by simulating outages of network elements. ' +
               'N-1 analysis is the most common standard for power system security assessment.';
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
                
                // Convert object to array format expected by contingencyAnalysis.js
                // The callback expects: [contingency_type, element_type, elements_to_analyze, voltage_limits, thermal_limits, min_vm_pu, max_vm_pu, max_loading_percent, post_contingency_actions, analysis_mode]
                const valuesArray = [
                    values[0],  // contingency_type
                    values[1],  // element_type
                    values[2],  // elements_to_analyze
                    values[3],  // voltage_limits
                    values[4],  // thermal_limits
                    values[5],  // min_vm_pu
                    values[6],  // max_vm_pu
                    values[7],  // max_loading_percent
                    values[8],  // post_contingency_actions
                    values[9]   // analysis_mode
                ];
                
                console.log('ContingencyDialog: Calling callback with values array:', valuesArray);
                
                if (callback) {
                    callback(valuesArray);
                }
            } catch (error) {
                console.error('ContingencyDialog: Error checking subscription status:', error);
                // Provide more helpful error messages based on error type
                if (error.message && error.message.includes('Token expired')) {
                    alert('Your session has expired. Please log in again.');
                    // Redirect to login if possible
                    if (window.location.href.includes('app.electrisim.com')) {
                        window.location.href = '/login.html';
                    }
                } else if (error.message && error.message.includes('NetworkError')) {
                    alert('Network connection error. Please check your internet connection and try again.');
                } else if (error.message && error.message.includes('Failed to fetch')) {
                    alert('Unable to connect to the server. Please check your internet connection and try again.');
                } else {
                    alert('Unable to verify subscription status. Please try again. If the issue persists, contact support.');
                }
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
            // Re-throw so the show() catch block can handle it with specific error messages
            throw error;
        }
    }
}

// Make ContingencyDialog available globally
globalThis.ContingencyDialog = ContingencyDialog; 