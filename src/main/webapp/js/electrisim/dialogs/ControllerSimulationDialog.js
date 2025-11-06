// ControllerSimulationDialog.js
(function() {
    class ControllerSimulationDialog {
        constructor(graph) {
            this.graph = graph;
            this.title = 'Controller Simulation Parameters';
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

            // Controller Types Section
            const controllerSection = document.createElement('div');
            controllerSection.innerHTML = '<h3 style="margin: 0 0 12px 0; color: #007cba;">Controller Types</h3>';
            
            // Voltage Control
            const voltageControl = this.createCheckbox('voltage_control', 'Voltage Control', 'Enable voltage control for generators');
            controllerSection.appendChild(voltageControl);
            
            // Tap Control
            const tapControl = this.createCheckbox('tap_control', 'Tap Control', 'Enable tap control for transformers');
            controllerSection.appendChild(tapControl);
            
            // Discrete Tap Control
            const discreteTapControl = this.createCheckbox('discrete_tap_control', 'Discrete Tap Control', 'Enable discrete tap control for transformers');
            controllerSection.appendChild(discreteTapControl);
            
            // Continuous Tap Control
            const continuousTapControl = this.createCheckbox('continuous_tap_control', 'Continuous Tap Control', 'Enable continuous tap control for transformers');
            controllerSection.appendChild(continuousTapControl);
            
            form.appendChild(controllerSection);

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
            submitButton.textContent = 'Run Controller Simulation';
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
                    console.log('ControllerSimulationDialog: Starting subscription check...');
                    const hasSubscription = await this.checkSubscriptionStatus();
                    console.log('ControllerSimulationDialog: Subscription check result:', hasSubscription);
                    
                    if (!hasSubscription) {
                        console.log('ControllerSimulationDialog: No subscription, showing modal...');
                        // Close the dialog first
                        document.body.removeChild(overlay);
                        
                        // Show subscription modal if no active subscription
                        if (window.showSubscriptionModal) {
                            console.log('ControllerSimulationDialog: Calling showSubscriptionModal');
                            window.showSubscriptionModal();
                        } else {
                            console.error('ControllerSimulationDialog: Subscription modal not available');
                            alert('A subscription is required to use the Controller Simulation feature.');
                        }
                        return;
                    }
                    
                    console.log('ControllerSimulationDialog: Subscription check passed, proceeding with simulation...');
                    
                    const values = [
                        document.getElementById('voltage_control').checked,
                        document.getElementById('tap_control').checked,
                        document.getElementById('discrete_tap_control').checked,
                        document.getElementById('continuous_tap_control').checked,
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
                    console.error('ControllerSimulationDialog: Error checking subscription status:', error);
                    alert('Unable to verify subscription status. Please try again.');
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
            console.log('ControllerSimulationDialog.checkSubscriptionStatus() called');
            try {
                // First ensure subscription functions are available
                console.log('ControllerSimulationDialog: Ensuring subscription functions are available...');
                if (window.ensureSubscriptionFunctions) {
                    const functionsStatus = await window.ensureSubscriptionFunctions();
                    console.log('ControllerSimulationDialog: Functions status:', functionsStatus);
                }
                
                // Use the global subscription check function
                if (window.checkSubscriptionStatus) {
                    console.log('ControllerSimulationDialog: Using window.checkSubscriptionStatus');
                    const result = await window.checkSubscriptionStatus();
                    console.log('ControllerSimulationDialog: window.checkSubscriptionStatus result:', result);
                    return result;
                }
                
                // Fallback: check if subscription manager exists
                if (window.SubscriptionManager && window.SubscriptionManager.checkSubscriptionStatus) {
                    console.log('ControllerSimulationDialog: Using SubscriptionManager.checkSubscriptionStatus');
                    const result = await window.SubscriptionManager.checkSubscriptionStatus();
                    console.log('ControllerSimulationDialog: SubscriptionManager result:', result);
                    return result;
                }
                
                console.warn('ControllerSimulationDialog: No subscription check function available');
                return false;
            } catch (error) {
                console.error('ControllerSimulationDialog: Error in checkSubscriptionStatus:', error);
                return false;
            }
        }

        createCheckbox(id, label, description) {
            const container = document.createElement('div');
            container.style.cssText = 'display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px;';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = id;
            checkbox.style.cssText = 'margin-top: 2px;';
            
            const labelElement = document.createElement('label');
            labelElement.htmlFor = id;
            labelElement.innerHTML = `<strong>${label}</strong><br><small style="color: #666;">${description}</small>`;
            labelElement.style.cssText = 'flex: 1; cursor: pointer;';
            
            container.appendChild(checkbox);
            container.appendChild(labelElement);
            return container;
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
        globalThis.ControllerSimulationDialog = ControllerSimulationDialog;
    } else if (typeof window !== 'undefined') {
        window.ControllerSimulationDialog = ControllerSimulationDialog;
    }
})(); 