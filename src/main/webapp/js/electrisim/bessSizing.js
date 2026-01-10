// bessSizing.js - BESS Sizing calculation function
import { BessSizingDialog } from './dialogs/BessSizingDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

console.log('bessSizing.js LOADED');

// Import ENV for backend URL (same as loadFlow.js)
// ENV is set globally by environment.js, but we'll access it via window.ENV
const getBackendUrl = () => {
    if (window.ENV && window.ENV.backendUrl) {
        return window.ENV.backendUrl + '/';
    }
    // Fallback for development
    console.warn('ENV.backendUrl not found, using localhost fallback');
    return 'http://localhost:5000/';
};

/**
 * BESS Sizing calculation function
 * Similar to loadFlowPandaPower but for BESS sizing
 */
function bessSizing(a, b, c) {
    const startTime = performance.now();
    console.log('BESS Sizing calculation started');

    // Get editor UI
    const editorUi = a || window.App?.main?.editor?.editorUi;
    if (!editorUi) {
        console.error('Editor UI not found');
        return;
    }

    const graph = editorUi.editor.graph;
    if (!graph) {
        console.error('Graph not found');
        return;
    }

    // Show dialog to get parameters
    const dialog = new BessSizingDialog(editorUi);
    
    dialog.show(async (values) => {
        if (!values) {
            console.log('BESS Sizing dialog cancelled');
            return;
        }

        console.log('BESS Sizing parameters:', values);

        // Validate required parameters
        if (!values.storageId || !values.pocBusbarId) {
            alert('Please select both a Storage/Battery and a POC Busbar');
            return;
        }

        if (!values.targetP || !values.targetQ) {
            alert('Please specify target P and Q values');
            return;
        }

        // Show spinner immediately (same pattern as loadflowOpenDss.js)
        // Try multiple ways to access spinner to match loadflowOpenDss.js pattern
        const app = a || window.App || window.apka;
        if (app && app.spinner) {
            app.spinner.spin(document.body, "Calculating BESS sizing...");
        } else if (window.apka && window.apka.spinner) {
            window.apka.spinner.spin(document.body, "Calculating BESS sizing...");
        }

        try {
            // Prepare network data using the shared network preparation function
            // This ensures consistency with loadFlow and handles all component types
            const calculationMode = values.calculationMode || 'single';
            const isMultiple = calculationMode === 'multiple';
            
            const bessSizingParams = {
                typ: 'BessSizingPandaPower',
                storageId: values.storageId,
                pocBusbarId: values.pocBusbarId,
                calculationMode: calculationMode,
                tolerance: parseFloat(values.tolerance || '0.001'),
                maxIterations: parseInt(values.maxIterations || '50'),
                kpP: parseFloat(values.kpP || '0.5'),
                kpQ: parseFloat(values.kpQ || '0.5'),
                frequency: parseFloat(values.frequency || '50'),
                algorithm: values.algorithm || 'nr'
            };

            // Add single target or multiple scenarios
            if (isMultiple && values.scenarios) {
                bessSizingParams.scenarios = values.scenarios;
            } else {
                bessSizingParams.targetP = parseFloat(values.targetP);
                bessSizingParams.targetQ = parseFloat(values.targetQ);
            }
            
            const networkData = prepareNetworkData(graph, bessSizingParams, {
                removeResultCells: false  // Don't remove result cells for BESS sizing
            });

            // Restructure data to match backend expectations
            // Backend expects: in_data['bess_sizing_params'] with typ: 'BessSizingPandaPower'
            // And all other network components at top level with their original keys
            const in_data = {};
            
            // Find and extract simulation parameters (should be first element with typ: 'BessSizingPandaPower')
            let simParamsFound = false;
            const keys = Object.keys(networkData);
            
            for (const key of keys) {
                const item = networkData[key];
                if (item && item.typ === 'BessSizingPandaPower') {
                    // Create bess_sizing_params object as backend expects
                    const bessParams = {
                        typ: 'BessSizingPandaPower',
                        storageId: item.storageId,
                        pocBusbarId: item.pocBusbarId,
                        calculationMode: item.calculationMode || 'single',
                        tolerance: item.tolerance,
                        maxIterations: item.maxIterations,
                        kpP: item.kpP,
                        kpQ: item.kpQ,
                        frequency: item.frequency,
                        algorithm: item.algorithm,
                        user_email: item.user_email
                    };

                    // Add single target or multiple scenarios
                    if (item.calculationMode === 'multiple' && item.scenarios) {
                        bessParams.scenarios = item.scenarios;
                    } else {
                        bessParams.targetP = item.targetP;
                        bessParams.targetQ = item.targetQ;
                    }

                    in_data['bess_sizing_params'] = bessParams;
                    simParamsFound = true;
                } else if (item && item.typ) {
                    // Add all other network components with their original keys
                    // Backend iterates through all keys except 'bess_sizing_params'
                    in_data[key] = item;
                }
            }
            
            if (!simParamsFound) {
                console.error('BESS sizing parameters not found in network data!');
                console.error('Network data keys:', keys);
                console.error('First few items:', networkData[keys[0]], networkData[keys[1]]);
                throw new Error('Failed to prepare BESS sizing parameters');
            }

            // Get backend URL from ENV (same as loadFlow.js)
            const backendUrl = getBackendUrl();
            
            console.log('BESS Sizing - Using backend URL:', backendUrl);
            console.log('BESS Sizing - Network data prepared:', Object.keys(in_data).length, 'components');
            console.log('BESS Sizing - bess_sizing_params:', in_data['bess_sizing_params']);
            
            // Send request to backend
            const response = await fetch(backendUrl, {
                mode: "cors",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Encoding": "gzip, deflate, br"
                },
                body: JSON.stringify(in_data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Handle gzip compression (same as loadFlow)
            let responseData;
            const contentEncoding = response.headers.get('Content-Encoding');
            
            if (contentEncoding === 'gzip') {
                // Use pako if available, otherwise try native decompression
                if (typeof pako !== 'undefined') {
                    const arrayBuffer = await response.arrayBuffer();
                    const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
                    responseData = JSON.parse(decompressed);
                } else {
                    // Fallback: try to parse as JSON directly
                    const text = await response.text();
                    // Fix invalid JSON: Replace Infinity and -Infinity with null
                    const fixedText = text
                        .replace(/:\s*-Infinity/g, ': null')
                        .replace(/:\s*Infinity/g, ': null')
                        .replace(/:\s*NaN/g, ': null');
                    responseData = JSON.parse(fixedText);
                }
            } else {
                const text = await response.text();
                // Fix invalid JSON: Replace Infinity and -Infinity with null
                const fixedText = text
                    .replace(/:\s*-Infinity/g, ': null')
                    .replace(/:\s*Infinity/g, ': null')
                    .replace(/:\s*NaN/g, ': null');
                responseData = JSON.parse(fixedText);
            }

            // Process and display results
            processBessSizingResults(responseData, graph, editorUi, values);

        } catch (error) {
            console.error('Error in BESS sizing calculation:', error);
            alert('Error calculating BESS sizing: ' + error.message);
        } finally {
            // Always stop spinner in finally block (same pattern as loadflowOpenDss.js)
            try {
                if (app && app.spinner) {
                    app.spinner.stop();
                } else if (window.apka && window.apka.spinner) {
                    window.apka.spinner.stop();
                } else if (window.App && window.App.spinner) {
                    window.App.spinner.stop();
                }
            } catch (spinnerErr) {
                console.error('Error stopping spinner:', spinnerErr);
            }
        }
    });
}

// prepareNetworkDataForBessSizing is now replaced by the shared prepareNetworkData function
// from utils/networkDataPreparation.js, which handles all component types consistently

/**
 * Draw visualization plots for multiple scenarios
 */
function drawBessVisualization(scenarios) {
    // POC P–Q plot (target vs achieved)
    const pocCanvas = document.getElementById('bess-poc-plot');
    if (pocCanvas) {
        drawScatterPlot(pocCanvas, scenarios, 'poc');
    }

    // BESS P–Q plot
    const bessCanvas = document.getElementById('bess-bess-plot');
    if (bessCanvas) {
        drawScatterPlot(bessCanvas, scenarios, 'bess');
    }
}

/**
 * Draw a scatter plot on canvas
 */
function drawScatterPlot(canvas, scenarios, plotType) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = { top: 40, right: 40, bottom: 60, left: 60 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Determine data ranges
    let xMin, xMax, yMin, yMax;
    if (plotType === 'poc') {
        // For POC plot: target vs achieved
        const allP = scenarios.flatMap(s => [
            s.scenario_p || s.targetP || 0,
            s.achieved_p_mw || s.achievedP || 0
        ]);
        const allQ = scenarios.flatMap(s => [
            s.scenario_q || s.targetQ || 0,
            s.achieved_q_mvar || s.achievedQ || 0
        ]);
        xMin = Math.min(...allP);
        xMax = Math.max(...allP);
        yMin = Math.min(...allQ);
        yMax = Math.max(...allQ);
    } else {
        // For BESS plot: required BESS P–Q
        const allP = scenarios.map(s => s.bess_p_mw || s.bessP || 0);
        const allQ = scenarios.map(s => s.bess_q_mvar || s.bessQ || 0);
        xMin = Math.min(...allP);
        xMax = Math.max(...allP);
        yMin = Math.min(...allQ);
        yMax = Math.max(...allQ);
    }

    // Add padding to ranges
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    xMin -= xRange * 0.1;
    xMax += xRange * 0.1;
    yMin -= yRange * 0.1;
    yMax += yRange * 0.1;

    // Helper function to convert data coordinates to canvas coordinates
    const toCanvasX = (x) => padding.left + ((x - xMin) / (xMax - xMin)) * plotWidth;
    const toCanvasY = (y) => padding.top + plotHeight - ((y - yMin) / (yMax - yMin)) * plotHeight;

    // Draw grid
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 0.5;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
        const x = padding.left + (i / gridLines) * plotWidth;
        const y = padding.top + (i / gridLines) * plotHeight;
        
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + plotHeight);
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + plotWidth, y);
        ctx.stroke();
    }

    // Draw axes
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    
    // X-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotHeight);
    ctx.lineTo(padding.left + plotWidth, padding.top + plotHeight);
    ctx.stroke();
    
    // Y-axis
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotHeight);
    ctx.stroke();

    // Draw zero lines
    if (xMin <= 0 && xMax >= 0) {
        const zeroX = toCanvasX(0);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(zeroX, padding.top);
        ctx.lineTo(zeroX, padding.top + plotHeight);
        ctx.stroke();
    }
    
    if (yMin <= 0 && yMax >= 0) {
        const zeroY = toCanvasY(0);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(padding.left, zeroY);
        ctx.lineTo(padding.left + plotWidth, zeroY);
        ctx.stroke();
    }

    // Draw data points
    scenarios.forEach((scenario, index) => {
        const name = scenario.scenario_name || `Scenario ${index + 1}`;
        
        if (plotType === 'poc') {
            // Draw target point
            const targetP = scenario.scenario_p || scenario.targetP || 0;
            const targetQ = scenario.scenario_q || scenario.targetQ || 0;
            const targetX = toCanvasX(targetP);
            const targetY = toCanvasY(targetQ);
            
            ctx.fillStyle = '#007bff';
            ctx.beginPath();
            ctx.arc(targetX, targetY, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Draw achieved point
            const achievedP = scenario.achieved_p_mw || scenario.achievedP || 0;
            const achievedQ = scenario.achieved_q_mvar || scenario.achievedQ || 0;
            const achievedX = toCanvasX(achievedP);
            const achievedY = toCanvasY(achievedQ);
            
            ctx.fillStyle = '#28a745';
            ctx.beginPath();
            ctx.arc(achievedX, achievedY, 5, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 0.5;
            ctx.stroke();
            
            // Draw line connecting target to achieved
            ctx.strokeStyle = '#cccccc';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(achievedX, achievedY);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Annotate with scenario name (near achieved point)
            ctx.fillStyle = '#000000';
            ctx.font = '10px Arial';
            ctx.fillText(name, achievedX + 8, achievedY - 8);
        } else {
            // Draw BESS point
            const bessP = scenario.bess_p_mw || scenario.bessP || 0;
            const bessQ = scenario.bess_q_mvar || scenario.bessQ || 0;
            const bessX = toCanvasX(bessP);
            const bessY = toCanvasY(bessQ);
            
            ctx.fillStyle = '#28a745';
            ctx.beginPath();
            ctx.arc(bessX, bessY, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Annotate with scenario name
            ctx.fillStyle = '#000000';
            ctx.font = '10px Arial';
            ctx.fillText(name, bessX + 8, bessY - 8);
        }
    });

    // Draw legend (only for POC plot) - positioned at bottom-left to avoid overlap
    if (plotType === 'poc') {
        const legendX = padding.left + 10;
        const legendY = padding.top + plotHeight - 50;
        
        // Draw background box for legend
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillRect(legendX - 5, legendY - 15, 100, 45);
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX - 5, legendY - 15, 100, 45);
        
        // Target legend
        ctx.fillStyle = '#007bff';
        ctx.beginPath();
        ctx.arc(legendX, legendY, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.font = '11px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('Target', legendX + 10, legendY - 4);
        
        // Achieved legend
        ctx.fillStyle = '#28a745';
        ctx.beginPath();
        ctx.arc(legendX, legendY + 20, 4, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 0.5;
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.fillText('Achieved', legendX + 10, legendY + 16);
    }

    // Draw axis labels
    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // X-axis label
    const xLabel = plotType === 'poc' ? 'P at POC (MW)' : 'BESS P (MW)';
    ctx.fillText(xLabel, padding.left + plotWidth / 2, height - 10);
    
    // Y-axis label
    ctx.save();
    ctx.translate(15, padding.top + plotHeight / 2);
    ctx.rotate(-Math.PI / 2);
    const yLabel = plotType === 'poc' ? 'Q at POC (Mvar)' : 'BESS Q (Mvar)';
    ctx.fillText(yLabel, 0, 0);
    ctx.restore();

    // Draw axis tick labels
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    // X-axis ticks
    for (let i = 0; i <= 5; i++) {
        const x = padding.left + (i / 5) * plotWidth;
        const value = xMin + (i / 5) * (xMax - xMin);
        ctx.fillText(value.toFixed(1), x, padding.top + plotHeight + 5);
    }
    
    // Y-axis ticks
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + plotHeight - (i / 5) * plotHeight;
        const value = yMin + (i / 5) * (yMax - yMin);
        ctx.fillText(value.toFixed(1), padding.left - 5, y);
    }
}

/**
 * Process and display BESS sizing results
 */
function processBessSizingResults(dataJson, graph, editorUi, values) {
    console.log('Processing BESS sizing results:', dataJson);

    if (dataJson.error) {
        alert('BESS Sizing Error: ' + dataJson.error);
        return;
    }

    // Create results container with proper styling for scrolling
    const container = document.createElement('div');
    Object.assign(container.style, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px',
        lineHeight: '1.6',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        overflow: 'hidden'
    });

    // Create scrollable content area
    const contentArea = document.createElement('div');
    Object.assign(contentArea.style, {
        flex: '1 1 auto',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
        boxSizing: 'border-box'
    });

    // Check if multiple scenarios mode - handle both response structures
    const scenarios = dataJson.results || dataJson.scenarios || [];
    const isMultiple = (dataJson.mode === 'multiple' || dataJson.calculationMode === 'multiple') && scenarios.length > 0;
    let resultsHtml = '';

    if (isMultiple) {
        // Multiple scenarios display
        resultsHtml = `
            <h2 style="margin-top: 0; color: #007bff; margin-bottom: 20px;">BESS Sizing Results - Multiple Scenarios</h2>
            <p style="margin-bottom: 20px; color: #6c757d;">Total scenarios: ${dataJson.total_scenarios || scenarios.length}</p>
        `;

        // Add visualization plots container
        resultsHtml += `
            <div id="bess-visualization-container" style="margin-bottom: 30px; padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 4px;">
                <h3 style="margin-top: 0; margin-bottom: 15px; color: #495057; font-size: 16px;">Visualization</h3>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="flex: 1; min-width: 400px;">
                        <h4 style="margin-bottom: 10px; color: #007bff; font-size: 14px;">POC P–Q (Target vs Achieved)</h4>
                        <canvas id="bess-poc-plot" width="500" height="400" style="max-width: 100%; border: 1px solid #dee2e6; border-radius: 4px;"></canvas>
                    </div>
                    <div style="flex: 1; min-width: 400px;">
                        <h4 style="margin-bottom: 10px; color: #007bff; font-size: 14px;">Required BESS P–Q</h4>
                        <canvas id="bess-bess-plot" width="500" height="400" style="max-width: 100%; border: 1px solid #dee2e6; border-radius: 4px;"></canvas>
                    </div>
                </div>
            </div>
        `;

        scenarios.forEach((scenario, index) => {
            const bessS = Math.sqrt(Math.pow(scenario.bess_p_mw || 0, 2) + Math.pow(scenario.bess_q_mvar || 0, 2));
            resultsHtml += `
                <div style="margin-bottom: 20px; padding: 15px; background-color: ${index % 2 === 0 ? '#ffffff' : '#f8f9fa'}; border: 1px solid #dee2e6; border-radius: 4px;">
                    <h3 style="margin-top: 0; color: #007bff; border-bottom: 2px solid #007bff; padding-bottom: 8px;">${scenario.scenario_name || `Scenario ${index + 1}`}</h3>
                    
                    <div style="margin-bottom: 15px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                        <h4 style="margin-top: 0; margin-bottom: 8px; color: #495057; font-size: 13px;">Target at POC</h4>
                        <p style="margin: 3px 0;"><strong>Active Power (P):</strong> ${scenario.scenario_p?.toFixed(1) || 'N/A'} MW</p>
                        <p style="margin: 3px 0;"><strong>Reactive Power (Q):</strong> ${scenario.scenario_q?.toFixed(1) || 'N/A'} Mvar</p>
                    </div>

                    <div style="margin-bottom: 15px; padding: 10px; background-color: #d4edda; border-radius: 4px; border: 1px solid #c3e6cb;">
                        <h4 style="margin-top: 0; margin-bottom: 8px; color: #155724; font-size: 13px;">Required BESS Power</h4>
                        <p style="margin: 3px 0;"><strong>Active Power (P):</strong> ${scenario.bess_p_mw?.toFixed(4) || 'N/A'} MW</p>
                        <p style="margin: 3px 0;"><strong>Reactive Power (Q):</strong> ${scenario.bess_q_mvar?.toFixed(4) || 'N/A'} Mvar</p>
                        <p style="margin: 3px 0;"><strong>Apparent Power (S):</strong> ${bessS.toFixed(4)} MVA</p>
                    </div>

                    <div style="margin-bottom: 15px; padding: 10px; background-color: #e7f3ff; border-radius: 4px; border: 1px solid #b3d9ff;">
                        <h4 style="margin-top: 0; margin-bottom: 8px; color: #004085; font-size: 13px;">Achieved at POC</h4>
                        <p style="margin: 3px 0;"><strong>Active Power (P):</strong> ${scenario.achieved_p_mw?.toFixed(4) || 'N/A'} MW</p>
                        <p style="margin: 3px 0;"><strong>Reactive Power (Q):</strong> ${scenario.achieved_q_mvar?.toFixed(4) || 'N/A'} Mvar</p>
                    </div>

                    <div style="margin-bottom: 15px; padding: 10px; background-color: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
                        <h4 style="margin-top: 0; margin-bottom: 8px; color: #856404; font-size: 13px;">Errors</h4>
                        <p style="margin: 3px 0;"><strong>Active Power Error:</strong> ${scenario.error_p_mw?.toFixed(6) || 'N/A'} MW</p>
                        <p style="margin: 3px 0;"><strong>Reactive Power Error:</strong> ${scenario.error_q_mvar?.toFixed(6) || 'N/A'} Mvar</p>
                    </div>

                    <div style="padding: 10px; background-color: ${scenario.converged ? '#d4edda' : '#f8d7da'}; border-radius: 4px; border: 1px solid ${scenario.converged ? '#c3e6cb' : '#f5c6cb'};">
                        <p style="margin: 3px 0;"><strong>Converged:</strong> ${scenario.converged ? '✓ Yes' : '✗ No'}</p>
                        <p style="margin: 3px 0;"><strong>Iterations:</strong> ${scenario.iterations || 'N/A'}</p>
                    </div>
                </div>
            `;
        });
    } else {
        // Single target display (existing logic)
        resultsHtml = `
            <h2 style="margin-top: 0; color: #007bff; margin-bottom: 20px;">BESS Sizing Results</h2>
            
            <div style="margin-bottom: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #495057;">Target at POC</h3>
                <p style="margin: 5px 0;"><strong>Active Power (P):</strong> ${values.targetP} MW</p>
                <p style="margin: 5px 0;"><strong>Reactive Power (Q):</strong> ${values.targetQ} Mvar</p>
            </div>

            <div style="margin-bottom: 20px; padding: 15px; background-color: #d4edda; border-radius: 4px; border: 1px solid #c3e6cb;">
                <h3 style="margin-top: 0; color: #155724;">Required BESS Power</h3>
                <p style="margin: 5px 0;"><strong>Active Power (P):</strong> ${dataJson.bess_p_mw?.toFixed(4) || 'N/A'} MW</p>
                <p style="margin: 5px 0;"><strong>Reactive Power (Q):</strong> ${dataJson.bess_q_mvar?.toFixed(4) || 'N/A'} Mvar</p>
                <p style="margin: 5px 0;"><strong>Apparent Power (S):</strong> ${dataJson.bess_s_mva?.toFixed(4) || 'N/A'} MVA</p>
            </div>

            <div style="margin-bottom: 20px; padding: 15px; background-color: #e7f3ff; border-radius: 4px; border: 1px solid #b3d9ff;">
                <h3 style="margin-top: 0; color: #004085;">Achieved at POC</h3>
                <p style="margin: 5px 0;"><strong>Active Power (P):</strong> ${dataJson.achieved_p_mw?.toFixed(4) || 'N/A'} MW</p>
                <p style="margin: 5px 0;"><strong>Reactive Power (Q):</strong> ${dataJson.achieved_q_mvar?.toFixed(4) || 'N/A'} Mvar</p>
            </div>

            <div style="margin-bottom: 20px; padding: 15px; background-color: #fff3cd; border-radius: 4px; border: 1px solid #ffeaa7;">
                <h3 style="margin-top: 0; color: #856404;">Errors</h3>
                <p style="margin: 5px 0;"><strong>Active Power Error:</strong> ${dataJson.error_p_mw?.toFixed(6) || 'N/A'} MW</p>
                <p style="margin: 5px 0;"><strong>Reactive Power Error:</strong> ${dataJson.error_q_mvar?.toFixed(6) || 'N/A'} Mvar</p>
            </div>

            <div style="padding: 15px; background-color: ${dataJson.converged ? '#d4edda' : '#f8d7da'}; border-radius: 4px; border: 1px solid ${dataJson.converged ? '#c3e6cb' : '#f5c6cb'};">
                <p style="margin: 5px 0;"><strong>Converged:</strong> ${dataJson.converged ? '✓ Yes' : '✗ No'}</p>
                <p style="margin: 5px 0;"><strong>Iterations:</strong> ${dataJson.iterations || 'N/A'}</p>
            </div>
        `;
    }

    contentArea.innerHTML = resultsHtml;
    container.appendChild(contentArea);

    // Draw visualization plots if multiple scenarios
    // Use setTimeout to ensure DOM is ready
    if (isMultiple && scenarios && scenarios.length > 0) {
        setTimeout(() => {
            drawBessVisualization(scenarios);
        }, 100);
    }

    // Create button container with close button
    const buttonContainer = document.createElement('div');
    Object.assign(buttonContainer.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        padding: '15px 20px',
        borderTop: '1px solid #e9ecef',
        backgroundColor: '#f8f9fa',
        flexShrink: 0
    });

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    Object.assign(closeButton.style, {
        padding: '8px 20px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500'
    });
    
    // Add hover effect
    closeButton.onmouseover = () => {
        closeButton.style.backgroundColor = '#0056b3';
    };
    closeButton.onmouseout = () => {
        closeButton.style.backgroundColor = '#007bff';
    };

    // Close button handler
    closeButton.onclick = () => {
        if (editorUi && typeof editorUi.hideDialog === 'function') {
            editorUi.hideDialog();
        } else {
            // Fallback: try to find and remove the dialog
            const dialogs = document.querySelectorAll('.mxWindow');
            if (dialogs.length > 0) {
                const lastDialog = dialogs[dialogs.length - 1];
                if (lastDialog && lastDialog.parentNode) {
                    lastDialog.parentNode.removeChild(lastDialog);
                }
            }
        }
    };

    buttonContainer.appendChild(closeButton);
    container.appendChild(buttonContainer);

    // Display the dialog with dynamic sizing (similar to other dialogs in the app)
    if (editorUi && typeof editorUi.showDialog === 'function') {
        // Use dynamic sizing based on window size, with increased height to show all content
        const screenWidth = Math.min(800, window.innerWidth - 100);
        // Increased height to show all content without scrolling (use more of available height)
        const screenHeight = Math.min(window.innerHeight - 40, 1000);
        
        // showDialog(container, width, height, resizable, modal, closeCallback)
        editorUi.showDialog(container, screenWidth, screenHeight, true, false, () => {
            // Close callback - dialog can be closed
            console.log('BESS Sizing results dialog closed');
        });
    } else {
        // Fallback: use alert if showDialog is not available
        alert('BESS Sizing completed!\n\n' + 
              `Required BESS Power:\nP: ${dataJson.bess_p_mw?.toFixed(4)} MW\nQ: ${dataJson.bess_q_mvar?.toFixed(4)} Mvar\nS: ${dataJson.bess_s_mva?.toFixed(4)} MVA\n\n` +
              `Converged: ${dataJson.converged ? 'Yes' : 'No'}\nIterations: ${dataJson.iterations}`);
    }
}

// Export function
window.bessSizing = bessSizing;
