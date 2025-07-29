// TimeSeriesSimulationResultsDialog.js
(function() {
    class TimeSeriesSimulationResultsDialog {
        constructor(results) {
            this.results = results;
            this.title = 'Time Series Simulation Results';
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
                max-width: 1200px; max-height: 90vh; overflow-y: auto; padding: 24px; margin: 20px;
                font-family: Arial, sans-serif;
            `;

            // Title
            const title = document.createElement('h2');
            title.textContent = this.title;
            dialog.appendChild(title);

            // Summary
            const summary = document.createElement('div');
            summary.innerHTML = `
                <b>Status:</b> ${this.results.timeseries_converged ? 'Converged' : 'Not converged'}<br>
                <b>Time Steps:</b> ${this.results.time_steps || 'N/A'}<br>
                <b>Time Period:</b> ${this.results.time_stamps ? `${this.results.time_stamps[0]} to ${this.results.time_stamps[this.results.time_stamps.length-1]}` : 'N/A'}<br>
            `;
            summary.style.marginBottom = '16px';
            dialog.appendChild(summary);

            // Add Chart.js CDN
            const chartScript = document.createElement('script');
            chartScript.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            chartScript.onload = () => {
                this.createPlots(dialog);
            };
            document.head.appendChild(chartScript);

            // Voltage Statistics
            if (this.results.voltage_statistics) {
                const voltageSection = document.createElement('div');
                voltageSection.innerHTML = '<h3 style="margin-top:18px">Voltage Statistics</h3>';
                
                const voltageTable = document.createElement('table');
                voltageTable.style.cssText = 'border-collapse:collapse;width:100%;margin-bottom:12px;border:1px solid #ddd;';
                voltageTable.innerHTML = `
                    <tr style="background:#f5f5f5;">
                        <th style="border:1px solid #ddd;padding:8px;">Bus Name</th>
                        <th style="border:1px solid #ddd;padding:8px;">Min V (pu)</th>
                        <th style="border:1px solid #ddd;padding:8px;">Max V (pu)</th>
                        <th style="border:1px solid #ddd;padding:8px;">Avg V (pu)</th>
                    </tr>
                `;
                
                Object.entries(this.results.voltage_statistics).forEach(([busName, stats]) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="border:1px solid #ddd;padding:8px;">${busName}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${stats.min_vm_pu.toFixed(4)}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${stats.max_vm_pu.toFixed(4)}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${stats.avg_vm_pu.toFixed(4)}</td>
                    `;
                    voltageTable.appendChild(row);
                });
                
                voltageSection.appendChild(voltageTable);
                dialog.appendChild(voltageSection);
            }

            // Loading Statistics
            if (this.results.loading_statistics) {
                const loadingSection = document.createElement('div');
                loadingSection.innerHTML = '<h3 style="margin-top:18px">Line Loading Statistics</h3>';
                
                const loadingTable = document.createElement('table');
                loadingTable.style.cssText = 'border-collapse:collapse;width:100%;margin-bottom:12px;border:1px solid #ddd;';
                loadingTable.innerHTML = `
                    <tr style="background:#f5f5f5;">
                        <th style="border:1px solid #ddd;padding:8px;">Line Name</th>
                        <th style="border:1px solid #ddd;padding:8px;">Min Loading (%)</th>
                        <th style="border:1px solid #ddd;padding:8px;">Max Loading (%)</th>
                        <th style="border:1px solid #ddd;padding:8px;">Avg Loading (%)</th>
                    </tr>
                `;
                
                Object.entries(this.results.loading_statistics).forEach(([lineName, stats]) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td style="border:1px solid #ddd;padding:8px;">${lineName}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${stats.min_loading_percent.toFixed(2)}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${stats.max_loading_percent.toFixed(2)}</td>
                        <td style="border:1px solid #ddd;padding:8px;">${stats.avg_loading_percent.toFixed(2)}</td>
                    `;
                    loadingTable.appendChild(row);
                });
                
                loadingSection.appendChild(loadingTable);
                dialog.appendChild(loadingSection);
            }

            // Sample Time Series Data
            if (this.results.busbars && this.results.busbars.length > 0) {
                const sampleSection = document.createElement('div');
                sampleSection.innerHTML = '<h3 style="margin-top:18px">Sample Time Series Data</h3>';
                
                const sampleTable = document.createElement('table');
                sampleTable.style.cssText = 'border-collapse:collapse;width:100%;margin-bottom:12px;border:1px solid #ddd;';
                sampleTable.innerHTML = `
                    <tr style="background:#f5f5f5;">
                        <th style="border:1px solid #ddd;padding:8px;">Time Step</th>
                        <th style="border:1px solid #ddd;padding:8px;">Bus Name</th>
                        <th style="border:1px solid #ddd;padding:8px;">V (pu)</th>
                        <th style="border:1px solid #ddd;padding:8px;">Angle (deg)</th>
                        <th style="border:1px solid #ddd;padding:8px;">P (MW)</th>
                        <th style="border:1px solid #ddd;padding:8px;">Q (MVar)</th>
                    </tr>
                `;
                
                // Show first few time steps for each bus
                const buses = [...new Set(this.results.busbars.map(b => b.name))];
                const timeSteps = [...new Set(this.results.busbars.map(b => b.time_step))].slice(0, 5);
                
                timeSteps.forEach(timeStep => {
                    buses.forEach(busName => {
                        const busData = this.results.busbars.find(b => b.name === busName && b.time_step === timeStep);
                        if (busData) {
                            const row = document.createElement('tr');
                            row.innerHTML = `
                                <td style="border:1px solid #ddd;padding:8px;">${timeStep}</td>
                                <td style="border:1px solid #ddd;padding:8px;">${busName}</td>
                                <td style="border:1px solid #ddd;padding:8px;">${busData.vm_pu.toFixed(4)}</td>
                                <td style="border:1px solid #ddd;padding:8px;">${busData.va_degree.toFixed(2)}</td>
                                <td style="border:1px solid #ddd;padding:8px;">${busData.p_mw.toFixed(2)}</td>
                                <td style="border:1px solid #ddd;padding:8px;">${busData.q_mvar.toFixed(2)}</td>
                            `;
                            sampleTable.appendChild(row);
                        }
                    });
                });
                
                sampleSection.appendChild(sampleTable);
                dialog.appendChild(sampleSection);
            }

            // Close button
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.style.cssText = `
                background: #007bff; color: white; border: none; padding: 10px 20px;
                border-radius: 4px; cursor: pointer; margin-top: 16px;
            `;
            closeButton.onclick = () => {
                document.body.removeChild(overlay);
            };
            dialog.appendChild(closeButton);

            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
        }

        createPlots(dialog) {
            // Create plots section
            const plotsSection = document.createElement('div');
            plotsSection.innerHTML = '<h3 style="margin-top:18px">Time Series Plots</h3>';
            plotsSection.style.marginBottom = '20px';
            dialog.insertBefore(plotsSection, dialog.lastElementChild);

            // Prepare data for plotting
            const timeSteps = [...new Set(this.results.busbars.map(b => b.time_step))].sort((a, b) => a - b);
            const buses = [...new Set(this.results.busbars.map(b => b.name))];
            const lines = [...new Set(this.results.lines.map(l => l.name))];

            // Voltage Magnitude Plot
            if (this.results.busbars && this.results.busbars.length > 0) {
                const voltagePlotContainer = document.createElement('div');
                voltagePlotContainer.style.cssText = 'margin: 20px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;';
                voltagePlotContainer.innerHTML = '<h4>Voltage Magnitude Over Time</h4>';
                
                const voltageCanvas = document.createElement('canvas');
                voltageCanvas.id = 'voltageChart';
                voltageCanvas.style.cssText = 'max-height: 300px;';
                voltagePlotContainer.appendChild(voltageCanvas);
                plotsSection.appendChild(voltagePlotContainer);

                // Prepare voltage data
                const voltageDatasets = buses.map(busName => {
                    const data = timeSteps.map(timeStep => {
                        const busData = this.results.busbars.find(b => b.name === busName && b.time_step === timeStep);
                        return busData ? busData.vm_pu : null;
                    });
                    return {
                        label: busName,
                        data: data,
                        borderColor: this.getRandomColor(),
                        backgroundColor: this.getRandomColor(0.1),
                        tension: 0.1
                    };
                });

                new Chart(voltageCanvas, {
                    type: 'line',
                    data: {
                        labels: timeSteps,
                        datasets: voltageDatasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Voltage Magnitude [p.u.]'
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Time Step'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Voltage Magnitude [p.u.]'
                                }
                            }
                        }
                    }
                });
            }

            // Line Loading Plot
            if (this.results.lines && this.results.lines.length > 0) {
                const loadingPlotContainer = document.createElement('div');
                loadingPlotContainer.style.cssText = 'margin: 20px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;';
                loadingPlotContainer.innerHTML = '<h4>Line Loading Over Time</h4>';
                
                const loadingCanvas = document.createElement('canvas');
                loadingCanvas.id = 'loadingChart';
                loadingCanvas.style.cssText = 'max-height: 300px;';
                loadingPlotContainer.appendChild(loadingCanvas);
                plotsSection.appendChild(loadingPlotContainer);

                // Prepare loading data
                const loadingDatasets = lines.map(lineName => {
                    const data = timeSteps.map(timeStep => {
                        const lineData = this.results.lines.find(l => l.name === lineName && l.time_step === timeStep);
                        return lineData ? lineData.loading_percent : null;
                    });
                    return {
                        label: lineName,
                        data: data,
                        borderColor: this.getRandomColor(),
                        backgroundColor: this.getRandomColor(0.1),
                        tension: 0.1
                    };
                });

                new Chart(loadingCanvas, {
                    type: 'line',
                    data: {
                        labels: timeSteps,
                        datasets: loadingDatasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Line Loading [%]'
                            }
                        },
                        scales: {
                            x: {
                                title: {
                                    display: true,
                                    text: 'Time Step'
                                }
                            },
                            y: {
                                title: {
                                    display: true,
                                    text: 'Line Loading [%]'
                                }
                            }
                        }
                    }
                });
            }

            // Load Power Plot (if we have load data)
            if (this.results.busbars && this.results.busbars.length > 0) {
                const loadPlotContainer = document.createElement('div');
                loadPlotContainer.style.cssText = 'margin: 20px 0; padding: 10px; border: 1px solid #ddd; border-radius: 4px;';
                loadPlotContainer.innerHTML = '<h4>Load Power Over Time</h4>';
                
                const loadCanvas = document.createElement('canvas');
                loadCanvas.id = 'loadChart';
                loadCanvas.style.cssText = 'max-height: 300px;';
                loadPlotContainer.appendChild(loadCanvas);
                plotsSection.appendChild(loadPlotContainer);

                // Prepare load data (negative P values indicate loads)
                const loadBuses = buses.filter(busName => {
                    const busData = this.results.busbars.find(b => b.name === busName && b.time_step === 0);
                    return busData && busData.p_mw < 0;
                });

                const loadDatasets = loadBuses.map(busName => {
                    const data = timeSteps.map(timeStep => {
                        const busData = this.results.busbars.find(b => b.name === busName && b.time_step === timeStep);
                        return busData ? Math.abs(busData.p_mw) : null; // Use absolute value for display
                    });
                    return {
                        label: busName + ' (Load)',
                        data: data,
                        borderColor: this.getRandomColor(),
                        backgroundColor: this.getRandomColor(0.1),
                        tension: 0.1
                    };
                });

                if (loadDatasets.length > 0) {
                    new Chart(loadCanvas, {
                        type: 'line',
                        data: {
                            labels: timeSteps,
                            datasets: loadDatasets
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Load Power [MW]'
                                }
                            },
                            scales: {
                                x: {
                                    title: {
                                        display: true,
                                        text: 'Time Step'
                                    }
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: 'Load Power [MW]'
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }

        getRandomColor(alpha = 1) {
            const colors = [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
            ];
            const color = colors[Math.floor(Math.random() * colors.length)];
            if (alpha < 1) {
                return color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
            }
            return color;
        }
    }

    // Make TimeSeriesSimulationResultsDialog available globally
    if (typeof globalThis !== 'undefined') {
        globalThis.TimeSeriesSimulationResultsDialog = TimeSeriesSimulationResultsDialog;
    } else if (typeof window !== 'undefined') {
        window.TimeSeriesSimulationResultsDialog = TimeSeriesSimulationResultsDialog;
    }

    // Export for module usage if supported
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { TimeSeriesSimulationResultsDialog };
    } else if (typeof exports === 'object') {
        try {
            exports.TimeSeriesSimulationResultsDialog = TimeSeriesSimulationResultsDialog;
        } catch (e) {
            // Ignore export errors in non-module environments
        }
    }
})(); 