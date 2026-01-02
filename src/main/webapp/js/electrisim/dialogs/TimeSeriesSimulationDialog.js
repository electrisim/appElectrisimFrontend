// TimeSeriesSimulationDialog.js
(function() {
    class TimeSeriesSimulationDialog {
        constructor(graph) {
            this.graph = graph;
            this.title = 'Time Series Simulation Parameters';
        }

        show(callback) {
            // Overlay
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
            `;

            // Dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                max-width: 500px; max-height: 90vh; overflow-y: auto; padding: 24px; margin: 20px;
                font-family: Arial, sans-serif;
            `;

            // Title
            const title = document.createElement('h2');
            title.textContent = this.title;
            title.style.cssText = 'margin: 0 0 20px 0; color: #333;';
            dialog.appendChild(title);

            // Form
            const form = document.createElement('form');
            form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            // Time Series Parameters Section
            const tsSection = document.createElement('div');
            tsSection.innerHTML = '<h3 style="margin: 0 0 12px 0; color: #007cba;">Time Series Parameters</h3>';
            
            // Time Steps
            const timeSteps = this.createNumberInput('time_steps', 'Time Steps (hours)', '24', '1', '168');
            tsSection.appendChild(timeSteps);
            
            // Load Profile
            const loadProfile = this.createSelect('load_profile', 'Load Profile', [
                {value: 'constant', label: 'Constant'},
                {value: 'daily', label: 'Daily (Residential)'},
                {value: 'industrial', label: 'Industrial'},
                {value: 'variable', label: 'Variable (High Variation)'}
            ]);
            tsSection.appendChild(loadProfile);
            
            // Generation Profile
            const generationProfile = this.createSelect('generation_profile', 'Generation Profile', [
                {value: 'constant', label: 'Constant'},
                {value: 'solar', label: 'Solar'},
                {value: 'wind', label: 'Wind'},
                {value: 'variable', label: 'Variable (High Variation)'}
            ]);
            tsSection.appendChild(generationProfile);
            
            form.appendChild(tsSection);

            // Power Flow Parameters Section
            const pfSection = document.createElement('div');
            pfSection.innerHTML = '<h3 style="margin: 20px 0 12px 0; color: #007cba;">Power Flow Parameters</h3>';
            
            // Frequency
            const frequency = this.createNumberInput('frequency', 'Frequency (Hz)', '50', '0.1', '1000');
            pfSection.appendChild(frequency);
            
            // Algorithm
            const algorithm = this.createSelect('algorithm', 'Algorithm', [
                {value: 'nr', label: 'Newton-Raphson (NR)'},
                {value: 'iwamoto_nr', label: 'Iwamoto Newton-Raphson'},
                {value: 'fastdecoupled', label: 'Fast Decoupled'},
                {value: 'dc', label: 'DC Power Flow'}
            ]);
            pfSection.appendChild(algorithm);
            
            // Calculate Voltage Angles
            const calcVoltageAngles = this.createSelect('calculate_voltage_angles', 'Calculate Voltage Angles', [
                {value: 'auto', label: 'Auto'},
                {value: true, label: 'Yes'},
                {value: false, label: 'No'}
            ]);
            pfSection.appendChild(calcVoltageAngles);
            
            // Initialization
            const init = this.createSelect('init', 'Initialization', [
                {value: 'dc', label: 'DC'},
                {value: 'flat', label: 'Flat'},
                {value: 'pf', label: 'Power Flow'}
            ]);
            pfSection.appendChild(init);
            
            form.appendChild(pfSection);

            // Buttons
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;';

            const cancelButton = document.createElement('button');
            cancelButton.textContent = 'Cancel';
            cancelButton.type = 'button';
            cancelButton.style.cssText = 'padding: 8px 16px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;';
            cancelButton.onclick = () => document.body.removeChild(overlay);
            buttonContainer.appendChild(cancelButton);

            const submitButton = document.createElement('button');
            submitButton.textContent = 'Run Time Series Simulation';
            submitButton.type = 'submit';
            submitButton.style.cssText = 'padding: 8px 16px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;';
            buttonContainer.appendChild(submitButton);

            form.appendChild(buttonContainer);
            dialog.appendChild(form);

            // Form submission
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Check subscription status before proceeding
                try {
                    console.log('TimeSeriesSimulationDialog: Starting subscription check...');
                    const hasSubscription = await this.checkSubscriptionStatus();
                    console.log('TimeSeriesSimulationDialog: Subscription check result:', hasSubscription);
                    
                    if (!hasSubscription) {
                        console.log('TimeSeriesSimulationDialog: No subscription, showing modal...');
                        // Close the dialog first
                        document.body.removeChild(overlay);
                        
                        // Show subscription modal if no active subscription
                        if (window.showSubscriptionModal) {
                            console.log('TimeSeriesSimulationDialog: Calling showSubscriptionModal');
                            window.showSubscriptionModal();
                        } else {
                            console.error('TimeSeriesSimulationDialog: Subscription modal not available');
                            alert('A subscription is required to use the Time Series Simulation feature.');
                        }
                        return;
                    }
                    
                    console.log('TimeSeriesSimulationDialog: Subscription check passed, proceeding with simulation...');
                    
                    const values = [
                        document.getElementById('time_steps').value,
                        document.getElementById('load_profile').value,
                        document.getElementById('generation_profile').value,
                        document.getElementById('frequency').value,
                        document.getElementById('algorithm').value,
                        document.getElementById('calculate_voltage_angles').value,
                        document.getElementById('init').value
                    ];

                    document.body.removeChild(overlay);
                    
                    if (callback) {
                        callback(values);
                    }
                } catch (error) {
                    console.error('TimeSeriesSimulationDialog: Error checking subscription status:', error);
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

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) document.body.removeChild(overlay);
            });
        }

        // Function to check subscription status
        async checkSubscriptionStatus() {
            console.log('TimeSeriesSimulationDialog.checkSubscriptionStatus() called');
            try {
                // First ensure subscription functions are available
                console.log('TimeSeriesSimulationDialog: Ensuring subscription functions are available...');
                if (window.ensureSubscriptionFunctions) {
                    const functionsStatus = await window.ensureSubscriptionFunctions();
                    console.log('TimeSeriesSimulationDialog: Functions status:', functionsStatus);
                }
                
                // Use the global subscription check function
                if (window.checkSubscriptionStatus) {
                    console.log('TimeSeriesSimulationDialog: Using window.checkSubscriptionStatus');
                    const result = await window.checkSubscriptionStatus();
                    console.log('TimeSeriesSimulationDialog: window.checkSubscriptionStatus result:', result);
                    return result;
                }
                
                // Fallback: check if subscription manager exists
                if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                    console.log('TimeSeriesSimulationDialog: Using SubscriptionManager.checkSubscriptionStatus');
                    const result = await window.SubscriptionManager.checkSubscriptionStatus();
                    console.log('TimeSeriesSimulationDialog: SubscriptionManager result:', result);
                    return result;
                }
                
                console.warn('TimeSeriesSimulationDialog: No subscription check function available');
                return false;
            } catch (error) {
                console.error('TimeSeriesSimulationDialog: Error in checkSubscriptionStatus:', error);
                // Re-throw so the show() catch block can handle it with specific error messages
                throw error;
            }
        }

        createNumberInput(id, label, defaultValue, step, max) {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = id;
            labelElement.textContent = label;
            labelElement.style.cssText = 'font-weight: bold; color: #333;';
            
            const input = document.createElement('input');
            input.type = 'number';
            input.id = id;
            input.value = defaultValue;
            input.step = step;
            input.max = max;
            input.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
            
            container.appendChild(labelElement);
            container.appendChild(input);
            return container;
        }

        createSelect(id, label, options) {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = id;
            labelElement.textContent = label;
            labelElement.style.cssText = 'font-weight: bold; color: #333;';
            
            const select = document.createElement('select');
            select.id = id;
            select.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
            
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option.value;
                optionElement.textContent = option.label;
                select.appendChild(optionElement);
            });
            
            container.appendChild(labelElement);
            container.appendChild(select);
            return container;
        }
    }

    // Make available globally
    if (typeof globalThis !== 'undefined') {
        globalThis.TimeSeriesSimulationDialog = TimeSeriesSimulationDialog;
    } else if (typeof window !== 'undefined') {
        window.TimeSeriesSimulationDialog = TimeSeriesSimulationDialog;
    }
})(); 