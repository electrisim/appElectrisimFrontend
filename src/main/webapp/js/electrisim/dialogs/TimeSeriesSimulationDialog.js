// TimeSeriesSimulationDialog.js
(function() {
    class TimeSeriesSimulationDialog {
        constructor(graph) {
            this.graph = graph;
            this.title = 'Time Series Simulation Parameters';
        }

        show(callback) {
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                padding: max(12px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
                box-sizing: border-box;
                overflow-y: auto;
            `;

            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: white;
                border-radius: 8px;
                box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
                width: min(540px, 94vw);
                max-width: 94vw;
                height: calc(100vh - 48px);
                max-height: calc(100vh - 48px);
                overflow: hidden;
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                margin: auto;
                font-family: Arial, sans-serif;
                box-sizing: border-box;
            `;

            const title = document.createElement('h2');
            title.textContent = this.title;
            title.style.cssText = `
                margin: 0;
                padding: 18px 24px 8px;
                color: #333;
                font-size: 18px;
                font-weight: 600;
                flex-shrink: 0;
            `;
            dialog.appendChild(title);

            const blurb = document.createElement('div');
            blurb.style.cssText = `
                margin: 0 24px 12px;
                padding: 8px 12px;
                background: #e8f4fc;
                border: 1px solid #b8dae9;
                border-radius: 6px;
                font-size: 12px;
                line-height: 1.45;
                color: #0d47a1;
                flex-shrink: 0;
                box-sizing: border-box;
            `;
            blurb.innerHTML = 'Run sequential load flows with time-varying load and generation profiles. See the <a href="https://electrisim.com/documentation.html#time-series-simulation" target="_blank" rel="noopener noreferrer">Electrisim documentation</a>.';
            dialog.appendChild(blurb);

            const formScroll = document.createElement('div');
            formScroll.style.cssText = `
                flex: 1 1 0%;
                min-height: 0;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 4px 24px 12px;
                scrollbar-width: thin;
                scrollbar-color: #c5ccd3 #f1f3f5;
            `;

            const form = document.createElement('form');
            form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            // Time Series Parameters Section
            const tsSection = document.createElement('div');
            tsSection.innerHTML = '<h3 style="margin: 0 0 12px 0; color: #007cba;">Time Series Parameters</h3>';

            const timeSteps = this.createNumberInput('time_steps', 'Time Steps (hours)', '24', '1', '168');
            tsSection.appendChild(timeSteps);

            const loadProfile = this.createSelect('load_profile', 'Load Profile', [
                { value: 'constant', label: 'Constant' },
                { value: 'daily', label: 'Daily (Residential)' },
                { value: 'industrial', label: 'Industrial' },
                { value: 'variable', label: 'Variable (High Variation)' }
            ]);
            tsSection.appendChild(loadProfile);

            const generationProfile = this.createSelect('generation_profile', 'Generation Profile', [
                { value: 'constant', label: 'Constant' },
                { value: 'solar', label: 'Solar' },
                { value: 'wind', label: 'Wind' },
                { value: 'variable', label: 'Variable (High Variation)' }
            ]);
            tsSection.appendChild(generationProfile);

            form.appendChild(tsSection);

            // Power Flow Parameters Section
            const pfSection = document.createElement('div');
            pfSection.innerHTML = '<h3 style="margin: 20px 0 12px 0; color: #007cba;">Power Flow Parameters</h3>';

            const frequency = this.createNumberInput('frequency', 'Frequency (Hz)', '50', '0.1', '1000');
            pfSection.appendChild(frequency);

            const algorithm = this.createSelect('algorithm', 'Algorithm', [
                { value: 'nr', label: 'Newton-Raphson (NR)' },
                { value: 'iwamoto_nr', label: 'Iwamoto Newton-Raphson' },
                { value: 'fastdecoupled', label: 'Fast Decoupled' },
                { value: 'dc', label: 'DC Power Flow' }
            ]);
            pfSection.appendChild(algorithm);

            const calcVoltageAngles = this.createSelect('calculate_voltage_angles', 'Calculate Voltage Angles', [
                { value: 'auto', label: 'Auto' },
                { value: true, label: 'Yes' },
                { value: false, label: 'No' }
            ]);
            pfSection.appendChild(calcVoltageAngles);

            const init = this.createSelect('init', 'Initialization', [
                { value: 'dc', label: 'DC' },
                { value: 'flat', label: 'Flat' },
                { value: 'pf', label: 'Power Flow' }
            ]);
            pfSection.appendChild(init);

            form.appendChild(pfSection);

            formScroll.appendChild(form);
            dialog.appendChild(formScroll);

            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = `
                display: flex;
                gap: 12px;
                justify-content: flex-end;
                flex-shrink: 0;
                padding: 14px 24px 18px;
                border-top: 1px solid #e9ecef;
                background: #fafbfc;
            `;

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

            dialog.appendChild(buttonContainer);

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