// DiagnosticReportDialog.js - Dialog for displaying diagnostic reports
(function() {
    class DiagnosticReportDialog {
        constructor(diagnosticData) {
            this.diagnosticData = diagnosticData;
            this.title = 'Power Flow Diagnostic Report';
        }

        show() {
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
                max-width: 800px; max-height: 90vh; overflow-y: auto; padding: 24px; margin: 20px;
                font-family: Arial, sans-serif;
            `;

            // Title
            const title = document.createElement('h2');
            title.textContent = this.title;
            title.style.cssText = 'margin: 0 0 20px 0; color: #d32f2f; font-size: 20px;';
            dialog.appendChild(title);

            // Error summary
            const errorSummary = document.createElement('div');
            errorSummary.style.cssText = `
                background: #ffebee; border: 1px solid #ffcdd2; border-radius: 4px;
                padding: 16px; margin-bottom: 20px;
            `;
            errorSummary.innerHTML = `
                <h3 style="margin: 0 0 8px 0; color: #d32f2f;">⚠️ Power Flow Failed</h3>
                <p style="margin: 0; color: #c62828;">The power flow calculation could not converge. Please review the diagnostic information below and fix the issues in your network.</p>
            `;
            dialog.appendChild(errorSummary);

            // Content container
            const content = document.createElement('div');
            content.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

            // Process diagnostic data
            this.processDiagnosticData(content);

            dialog.appendChild(content);

            // Close button
            const buttonContainer = document.createElement('div');
            buttonContainer.style.cssText = 'display: flex; justify-content: flex-end; margin-top: 24px;';

            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.style.cssText = `
                padding: 8px 16px; background: #d32f2f; color: white; 
                border: none; border-radius: 4px; cursor: pointer; font-size: 14px;
            `;
            closeButton.onclick = () => document.body.removeChild(overlay);
            buttonContainer.appendChild(closeButton);

            dialog.appendChild(buttonContainer);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Close on overlay click
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) document.body.removeChild(overlay);
            });

            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(overlay);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }

        processDiagnosticData(content) {
            const data = this.diagnosticData;

            // Handle different types of diagnostic data
            if (Array.isArray(data)) {
                // Handle array format (error messages)
                this.createErrorSection(content, 'Error Messages', data);
            } else if (typeof data === 'object') {
                // Handle object format (detailed diagnostic)
                this.createDetailedDiagnostic(content, data);
            } else {
                // Handle string format
                this.createErrorSection(content, 'Error', [String(data)]);
            }
        }

        createErrorSection(content, title, errors) {
            const section = document.createElement('div');
            section.style.cssText = 'border: 1px solid #ddd; border-radius: 4px; padding: 16px;';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = title;
            sectionTitle.style.cssText = 'margin: 0 0 12px 0; color: #333; font-size: 16px;';
            section.appendChild(sectionTitle);

            const errorList = document.createElement('ul');
            errorList.style.cssText = 'margin: 0; padding-left: 20px; color: #d32f2f;';

            errors.forEach(error => {
                const listItem = document.createElement('li');
                listItem.textContent = String(error);
                listItem.style.cssText = 'margin-bottom: 4px;';
                errorList.appendChild(listItem);
            });

            section.appendChild(errorList);
            content.appendChild(section);
        }

        createDetailedDiagnostic(content, diagnosticData) {
            // Handle overload issues
            if (diagnosticData.overload) {
                this.createOverloadSection(content, diagnosticData.overload);
            }

            // Handle invalid values
            if (diagnosticData.invalid_values) {
                this.createInvalidValuesSection(content, diagnosticData.invalid_values);
            }

            // Handle nominal voltage mismatches
            if (diagnosticData.nominal_voltages_dont_match) {
                this.createVoltageMismatchSection(content, diagnosticData.nominal_voltages_dont_match);
            }

            // Handle isolated buses
            if (diagnosticData.isolated_buses) {
                this.createIsolatedBusesSection(content, diagnosticData.isolated_buses);
            }

            // Handle convergence issues
            if (diagnosticData.convergence) {
                this.createConvergenceSection(content, diagnosticData.convergence);
            }
        }

        createOverloadSection(content, overloadData) {
            const section = document.createElement('div');
            section.style.cssText = 'border: 1px solid #ff9800; border-radius: 4px; padding: 16px; background: #fff3e0;';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = '🚨 Overload Issues';
            sectionTitle.style.cssText = 'margin: 0 0 12px 0; color: #e65100; font-size: 16px;';
            section.appendChild(sectionTitle);

            const description = document.createElement('p');
            description.textContent = 'The following elements are overloaded and may cause power flow convergence issues:';
            description.style.cssText = 'margin: 0 0 12px 0; color: #bf360c;';
            section.appendChild(description);

            Object.keys(overloadData).forEach(elementType => {
                const elementSection = document.createElement('div');
                elementSection.style.cssText = 'margin-bottom: 12px;';

                const elementTitle = document.createElement('h4');
                elementTitle.textContent = `${elementType.charAt(0).toUpperCase() + elementType.slice(1)} Elements`;
                elementTitle.style.cssText = 'margin: 0 0 8px 0; color: #e65100; font-size: 14px;';
                elementSection.appendChild(elementTitle);

                const elementList = document.createElement('ul');
                elementList.style.cssText = 'margin: 0; padding-left: 20px; color: #bf360c;';

                if (Array.isArray(overloadData[elementType])) {
                    overloadData[elementType].forEach(item => {
                        const listItem = document.createElement('li');
                        listItem.textContent = String(item);
                        elementList.appendChild(listItem);
                    });
                } else {
                    const listItem = document.createElement('li');
                    listItem.textContent = String(overloadData[elementType]);
                    elementList.appendChild(listItem);
                }

                elementSection.appendChild(elementList);
                section.appendChild(elementSection);
            });

            content.appendChild(section);
        }

        createInvalidValuesSection(content, invalidData) {
            const section = document.createElement('div');
            section.style.cssText = 'border: 1px solid #f44336; border-radius: 4px; padding: 16px; background: #ffebee;';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = '❌ Invalid Values';
            sectionTitle.style.cssText = 'margin: 0 0 12px 0; color: #d32f2f; font-size: 16px;';
            section.appendChild(sectionTitle);

            const description = document.createElement('p');
            description.textContent = 'The following elements have invalid parameter values:';
            description.style.cssText = 'margin: 0 0 12px 0; color: #c62828;';
            section.appendChild(description);

            Object.keys(invalidData).forEach(elementType => {
                const elementSection = document.createElement('div');
                elementSection.style.cssText = 'margin-bottom: 12px;';

                const elementTitle = document.createElement('h4');
                elementTitle.textContent = `${elementType.charAt(0).toUpperCase() + elementType.slice(1)} Elements`;
                elementTitle.style.cssText = 'margin: 0 0 8px 0; color: #d32f2f; font-size: 14px;';
                elementSection.appendChild(elementTitle);

                const elementList = document.createElement('ul');
                elementList.style.cssText = 'margin: 0; padding-left: 20px; color: #c62828;';

                if (Array.isArray(invalidData[elementType])) {
                    invalidData[elementType].forEach(item => {
                        const listItem = document.createElement('li');
                        listItem.textContent = String(item);
                        elementList.appendChild(listItem);
                    });
                } else {
                    const listItem = document.createElement('li');
                    listItem.textContent = String(invalidData[elementType]);
                    elementList.appendChild(listItem);
                }

                elementSection.appendChild(elementList);
                section.appendChild(elementSection);
            });

            content.appendChild(section);
        }

        createVoltageMismatchSection(content, voltageData) {
            const section = document.createElement('div');
            section.style.cssText = 'border: 1px solid #ff9800; border-radius: 4px; padding: 16px; background: #fff3e0;';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = '⚡ Voltage Mismatch Issues';
            sectionTitle.style.cssText = 'margin: 0 0 12px 0; color: #e65100; font-size: 16px;';
            section.appendChild(sectionTitle);

            const description = document.createElement('p');
            description.textContent = 'Nominal voltages do not match between connected elements:';
            description.style.cssText = 'margin: 0 0 12px 0; color: #bf360c;';
            section.appendChild(description);

            Object.keys(voltageData).forEach(elementType => {
                const elementSection = document.createElement('div');
                elementSection.style.cssText = 'margin-bottom: 12px;';

                const elementTitle = document.createElement('h4');
                elementTitle.textContent = `${elementType.charAt(0).toUpperCase() + elementType.slice(1)} Elements`;
                elementTitle.style.cssText = 'margin: 0 0 8px 0; color: #e65100; font-size: 14px;';
                elementSection.appendChild(elementTitle);

                const elementList = document.createElement('ul');
                elementList.style.cssText = 'margin: 0; padding-left: 20px; color: #bf360c;';

                if (Array.isArray(voltageData[elementType])) {
                    voltageData[elementType].forEach(item => {
                        const listItem = document.createElement('li');
                        listItem.textContent = String(item);
                        elementList.appendChild(listItem);
                    });
                } else {
                    const listItem = document.createElement('li');
                    listItem.textContent = String(voltageData[elementType]);
                    elementList.appendChild(listItem);
                }

                elementSection.appendChild(elementList);
                section.appendChild(elementSection);
            });

            content.appendChild(section);
        }

        createIsolatedBusesSection(content, isolatedBuses) {
            const section = document.createElement('div');
            section.style.cssText = 'border: 1px solid #f44336; border-radius: 4px; padding: 16px; background: #ffebee;';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = '🔌 Isolated Buses';
            sectionTitle.style.cssText = 'margin: 0 0 12px 0; color: #d32f2f; font-size: 16px;';
            section.appendChild(sectionTitle);

            const description = document.createElement('p');
            description.textContent = 'The following buses are not connected to any power source:';
            description.style.cssText = 'margin: 0 0 12px 0; color: #c62828;';
            section.appendChild(description);

            const busList = document.createElement('ul');
            busList.style.cssText = 'margin: 0; padding-left: 20px; color: #c62828;';

            isolatedBuses.forEach(bus => {
                const listItem = document.createElement('li');
                listItem.textContent = `Bus ${bus}`;
                busList.appendChild(listItem);
            });

            section.appendChild(busList);
            content.appendChild(section);
        }

        createConvergenceSection(content, convergenceData) {
            const section = document.createElement('div');
            section.style.cssText = 'border: 1px solid #ff9800; border-radius: 4px; padding: 16px; background: #fff3e0;';

            const sectionTitle = document.createElement('h3');
            sectionTitle.textContent = '🔄 Convergence Issues';
            sectionTitle.style.cssText = 'margin: 0 0 12px 0; color: #e65100; font-size: 16px;';
            section.appendChild(sectionTitle);

            const description = document.createElement('p');
            description.textContent = 'The power flow calculation failed to converge. This may be due to:';
            description.style.cssText = 'margin: 0 0 12px 0; color: #bf360c;';
            section.appendChild(description);

            const reasons = document.createElement('ul');
            reasons.style.cssText = 'margin: 0 0 12px 0; padding-left: 20px; color: #bf360c;';
            reasons.innerHTML = `
                <li>Insufficient generation capacity</li>
                <li>Network topology issues</li>
                <li>Invalid parameter values</li>
                <li>Overloaded elements</li>
                <li>Voltage violations</li>
            `;
            section.appendChild(reasons);

            if (convergenceData) {
                const details = document.createElement('div');
                details.style.cssText = 'font-family: monospace; font-size: 12px; background: white; padding: 8px; border-radius: 2px;';
                details.textContent = JSON.stringify(convergenceData, null, 2);
                section.appendChild(details);
            }

            content.appendChild(section);
        }
    }

    // Make available globally
    if (typeof globalThis !== 'undefined') {
        globalThis.DiagnosticReportDialog = DiagnosticReportDialog;
    } else if (typeof window !== 'undefined') {
        window.DiagnosticReportDialog = DiagnosticReportDialog;
    }
})(); 