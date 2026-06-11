// Import COMPONENT_TYPES from the utils
import { COMPONENT_TYPES } from './utils/componentTypes.js';
import { getAttributesAsObject, formatResultNameHeader, createDialogNameResolver } from './utils/attributeUtils.js';
import { ShortCircuitDialog } from './dialogs/ShortCircuitDialog.js';
import ENV from './config/environment.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

// Make the shortCircuit function available globally
window.shortCircuitPandaPower = function(a, b, c) {
    let apka = a;
    let grafka = b;

    // Create counters object
    const counters = {
        externalGrid: 0,
        generator: 0,
        staticGenerator: 0,
        asymmetricGenerator: 0,
        busbar: 0,
        transformer: 0,
        threeWindingTransformer: 0,
        shuntReactor: 0,
        capacitor: 0,
        load: 0,
        asymmetricLoad: 0,
        impedance: 0,
        ward: 0,
        extendedWard: 0,
        motor: 0,
        storage: 0,
        SVC: 0,
        TCSC: 0,
        SSC: 0,
        dcLine: 0,
        line: 0
    };

    // Create arrays for different components
    const componentArrays = {
        simulationParameters: [],
        externalGrid: [],
        generator: [],
        staticGenerator: [],
        asymmetricGenerator: [],
        busbar: [],
        transformer: [],
        threeWindingTransformer: [],
        shuntReactor: [],
        capacitor: [],
        load: [],
        asymmetricLoad: [],
        impedance: [],
        ward: [],
        extendedWard: [],
        motor: [],
        storage: [],
        SVC: [],
        TCSC: [],
        SSC: [],
        dcLine: [],
        line: []
    };

    // Cache styles and configurations
    const STYLES = {
        label: {
            [mxConstants.STYLE_FONTSIZE]: '6',
            [mxConstants.STYLE_ALIGN]: 'ALIGN_LEFT'
        },
        line: {
            [mxConstants.STYLE_FONTSIZE]: '6',
            [mxConstants.STYLE_STROKE_OPACITY]: '0',
            [mxConstants.STYLE_STROKECOLOR]: 'white',
            [mxConstants.STYLE_STROKEWIDTH]: '0',
            [mxConstants.STYLE_OVERFLOW]: 'hidden'
        }
    };

    // Helper function to format numbers
    const formatNumber = (num, decimals = 3) => {
        // Handle NaN, null, undefined, or string 'NaN' values
        if (num === null || num === undefined || num === 'NaN' || (typeof num === 'number' && isNaN(num))) {
            return 'N/A';
        }
        return parseFloat(num).toFixed(decimals);
    };
    const replaceUnderscores = name => name.replace('_', '#');

    const createTableRow = (columns, widths) => {
        return columns.map((col, i) => {
            const str = String(col);
            return str.padEnd(widths[i], ' ');
        }).join(' | ');
    };

    const createTableSeparator = (widths) => {
        return widths.map(w => '-'.repeat(w)).join('-+-');
    };

    const downloadPandapowerShortCircuitResults = (dataJson, graph) => {
        try {
            const dialogNameFor = createDialogNameResolver(graph);
            let resultsText = '========================================\n';
            resultsText += '   Pandapower Short Circuit Results\n';
            resultsText += '========================================\n\n';
            resultsText += `Generated: ${new Date().toISOString()}\n\n`;

            if (dataJson.busbars && dataJson.busbars.length > 0) {
                resultsText += '--- BUSES ---\n';
                const widths = [18, 18, 12, 12, 12, 12, 12];
                const headers = ['Object id', 'Dialog name', 'ikss [kA]', 'ip [kA]', 'ith [kA]', 'rk [ohm]', 'xk [ohm]'];
                resultsText += createTableRow(headers, widths) + '\n';
                resultsText += createTableSeparator(widths) + '\n';
                dataJson.busbars.forEach(bus => {
                    const row = [
                        bus.name || 'N/A',
                        dialogNameFor(bus) || '—',
                        formatNumber(bus.ikss_ka),
                        formatNumber(bus.ip_ka),
                        formatNumber(bus.ith_ka),
                        formatNumber(bus.rk_ohm),
                        formatNumber(bus.xk_ohm)
                    ];
                    resultsText += createTableRow(row, widths) + '\n';
                });
                resultsText += '\n';
            }

            if (dataJson.lines_sc && dataJson.lines_sc.length > 0) {
                resultsText += '--- LINES ---\n';
                const widths = [18, 18, 12, 12, 12];
                const headers = ['Object id', 'Dialog name', 'ikss [kA]', 'ip [kA]', 'ith [kA]'];
                resultsText += createTableRow(headers, widths) + '\n';
                resultsText += createTableSeparator(widths) + '\n';
                dataJson.lines_sc.forEach(line => {
                    const row = [
                        line.name || 'N/A',
                        dialogNameFor(line) || '—',
                        formatNumber(line.ikss_ka),
                        formatNumber(line.ip_ka),
                        formatNumber(line.ith_ka)
                    ];
                    resultsText += createTableRow(row, widths) + '\n';
                });
                resultsText += '\n';
            }

            if (dataJson.trafos_sc && dataJson.trafos_sc.length > 0) {
                resultsText += '--- TRANSFORMERS (2W) ---\n';
                const widths = [18, 18, 14, 14];
                const headers = ['Object id', 'Dialog name', 'ikss_hv [kA]', 'ikss_lv [kA]'];
                resultsText += createTableRow(headers, widths) + '\n';
                resultsText += createTableSeparator(widths) + '\n';
                dataJson.trafos_sc.forEach(t => {
                    const row = [
                        t.name || 'N/A',
                        dialogNameFor(t) || '—',
                        formatNumber(t.ikss_hv_ka),
                        formatNumber(t.ikss_lv_ka)
                    ];
                    resultsText += createTableRow(row, widths) + '\n';
                });
                resultsText += '\n';
            }

            if (dataJson.trafos3w_sc && dataJson.trafos3w_sc.length > 0) {
                resultsText += '--- TRANSFORMERS (3W) ---\n';
                const widths = [16, 16, 14, 14, 14];
                const headers = ['Object id', 'Dialog name', 'ikss_hv [kA]', 'ikss_mv [kA]', 'ikss_lv [kA]'];
                resultsText += createTableRow(headers, widths) + '\n';
                resultsText += createTableSeparator(widths) + '\n';
                dataJson.trafos3w_sc.forEach(t => {
                    const row = [
                        t.name || 'N/A',
                        dialogNameFor(t) || '—',
                        formatNumber(t.ikss_hv_ka ?? t.ikss_hv),
                        formatNumber(t.ikss_mv_ka ?? t.ikss_mv),
                        formatNumber(t.ikss_lv_ka ?? t.ikss_lv)
                    ];
                    resultsText += createTableRow(row, widths) + '\n';
                });
                resultsText += '\n';
            }

            if (dataJson.ext_grid_sc && dataJson.ext_grid_sc.length > 0) {
                resultsText += '--- EXTERNAL GRIDS ---\n';
                const widths = [18, 18, 12, 12, 12, 12, 12];
                const headers = ['Object id', 'Dialog name', 'ikss [kA]', 'ip [kA]', 'ith [kA]', 'rk [ohm]', 'xk [ohm]'];
                resultsText += createTableRow(headers, widths) + '\n';
                resultsText += createTableSeparator(widths) + '\n';
                dataJson.ext_grid_sc.forEach(g => {
                    const row = [
                        g.name || 'N/A',
                        dialogNameFor(g) || '—',
                        formatNumber(g.ikss_ka),
                        formatNumber(g.ip_ka),
                        formatNumber(g.ith_ka),
                        formatNumber(g.rk_ohm),
                        formatNumber(g.xk_ohm)
                    ];
                    resultsText += createTableRow(row, widths) + '\n';
                });
                resultsText += '\n';
            }

            resultsText += '========================================\n';
            resultsText += '          End of Results\n';
            resultsText += '========================================\n';

            const blob = new Blob([resultsText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            link.download = `Pandapower_ShortCircuit_Results_${timestamp}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading Pandapower short circuit results:', error);
            alert('Failed to download Pandapower short circuit results. ' + error.message);
        }
    };

    // Error handler
    function handleNetworkErrors(dataJson) {
        // Check for diagnostic response format (new error handling)
        if (dataJson.error && dataJson.diagnostic) {
            console.log('Short Circuit failed with diagnostic information:', dataJson);
            if (window.DiagnosticReportDialog) {
                // Pass the entire response including message and exception
                const diagnosticDialog = new window.DiagnosticReportDialog(dataJson.diagnostic, {
                    message: dataJson.message,
                    exception: dataJson.exception
                });
                diagnosticDialog.show();
            } else {
                alert(`Short Circuit calculation failed: ${dataJson.message}\n\nException: ${dataJson.exception}`);
            }
            return true;
        }

        // Legacy error handling
        const errorTypes = {
            'line': 'Line',
            'bus': 'Bus',
            'ext_grid': 'External Grid',
            'trafo3w': 'Three-winding transformer: nominal voltage does not match',
            'overload': 'One of the element is overloaded. The load flow did not converge. Contact electrisim@electrisim.com'
        };

        if (!dataJson[0]) return false;

        const errorType = Array.isArray(dataJson[0]) ? dataJson[0][0] : dataJson[0];

        if (errorType === 'trafo3w' || errorType === 'overload') {
            alert(errorTypes[errorType]);
            return true;
        }

        if (errorTypes[errorType]) {
            for (let i = 1; i < dataJson.length; i++) {
                alert(`${errorTypes[errorType]}${dataJson[i][0]} ${dataJson[i][1]} = ${dataJson[i][2]} (restriction: ${dataJson[i][3]})\nPower Flow did not converge`);
            }
            return true;
        }

        return false;
    }


    // Helper: resolve cell from backend id/name (cellIdMap + model.getCell fallbacks)
    const resolveCell = (cell, b, cellIdMap) => {
        const model = b.getModel();
        const id = cell.id;
        const name = cell.name;
        const nameUnderscore = (name || '').replace('#', '_');
        const nameHash = (name || '').replace('_', '#');
        return (cellIdMap && (cellIdMap.get(id) || cellIdMap.get(nameUnderscore) || cellIdMap.get(nameHash)))
            || model.getCell(id)
            || model.getCell(nameUnderscore)
            || model.getCell(nameHash)
            || null;
    };

    // Network element processors (FROM BACKEND TO FRONTEND)
    // Same approach as pandapower load flow: find existing placeholder, update in place; else insert
    const elementProcessors = {
        busbars: (data, b, grafka, cellIdMap) => {
            const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
            const insertFn = typeof window !== 'undefined' && window.insertResultBox;
            const fallbackStyle = (typeof window !== 'undefined' && window.RESULT_BOX_STYLE) || 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';
            data.forEach(cell => {
                const resultCell = resolveCell(cell, b, cellIdMap);
                if (!resultCell) {
                    console.warn('Short circuit: could not find busbar cell for id=', cell.id, 'name=', cell.name);
                    return;
                }
                cell.name = replaceUnderscores(cell.name);

                const busLabel = formatResultNameHeader(resultCell, cell.name, 'Bus');
                const resultString = `${busLabel}
                ikss[kA]: ${formatNumber(cell.ikss_ka)}
                ip[kA]: ${formatNumber(cell.ip_ka)}
                ith[kA]: ${formatNumber(cell.ith_ka)}
                rk[ohm]: ${formatNumber(cell.rk_ohm)}
                xk[ohm]: ${formatNumber(cell.xk_ohm)}`;

                const parent = resultCell;
                const existing = findFn ? findFn(b, parent) : null;
                if (existing) {
                    b.getModel().setValue(existing, resultString);
                } else {
                    const labelka = insertFn
                        ? insertFn(b, parent, resultString, { width: 45, height: 70, positionX: 0, positionY: 1.0 })
                        : b.insertVertex(parent, null, resultString, 0, 1.0, 45, 70, fallbackStyle, true);
                }
            });
        },
        lines_sc: (data, b, grafka, cellIdMap) => {
            const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
            const insertFn = typeof window !== 'undefined' && window.insertResultBox;
            const fallbackStyle = (typeof window !== 'undefined' && window.RESULT_BOX_STYLE) || 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';
            data.forEach(cell => {
                const resultCell = resolveCell(cell, b, cellIdMap);
                if (!resultCell) return;
                const lineName = formatResultNameHeader(resultCell, cell.name, 'Line');
                const resultString = `${lineName}
                ikss[kA]: ${formatNumber(cell.ikss_ka)}
                ip[kA]: ${formatNumber(cell.ip_ka)}
                ith[kA]: ${formatNumber(cell.ith_ka)}`;
                const parent = resultCell;
                const existing = findFn ? findFn(b, parent) : null;
                if (existing) {
                    b.getModel().setValue(existing, resultString);
                } else {
                    const labelka = insertFn
                        ? insertFn(b, parent, resultString, { width: 95, height: 70, positionX: 0.5, positionY: 0, isLine: true })
                        : b.insertVertex(parent, null, resultString, 0.5, 0, 95, 70, fallbackStyle, true);
                    if (labelka && b.orderCells) b.orderCells(true, [labelka]);
                }
            });
        },
        trafos_sc: (data, b, grafka, cellIdMap) => {
            const findCompFn = typeof window !== 'undefined' && window.findResultPlaceholderForComponent;
            const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
            const insertFn = typeof window !== 'undefined' && window.insertResultBox;
            const fallbackStyle = (typeof window !== 'undefined' && window.RESULT_BOX_STYLE) || 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';
            data.forEach(cell => {
                const resultCell = resolveCell(cell, b, cellIdMap);
                if (!resultCell) {
                    console.warn('Short circuit: could not find transformer cell for id=', cell.id, 'name=', cell.name);
                    return;
                }
                const trafoName = formatResultNameHeader(resultCell, cell.name, 'Trafo');
                const resultString = `${trafoName}
                ikss_hv[kA]: ${formatNumber(cell.ikss_hv_ka)}
                ikss_lv[kA]: ${formatNumber(cell.ikss_lv_ka)}`;
                let existing = findCompFn ? findCompFn(b, resultCell) : null;
                if (!existing) {
                    const edges = (b.getEdges && b.getEdges(resultCell)) || resultCell.edges || [];
                    const parent = edges[0] || resultCell;
                    existing = findFn ? findFn(b, parent) : null;
                }
                const parent = existing ? b.getModel().getParent(existing) : ((b.getEdges && b.getEdges(resultCell))?.[0] || resultCell);
                if (existing) {
                    b.getModel().setValue(existing, resultString);
                } else {
                    const labelka = insertFn
                        ? insertFn(b, parent, resultString, { width: 95, height: 58, positionX: -0.3 })
                        : b.insertVertex(parent, null, resultString, -0.15, 1.1, 95, 58, fallbackStyle, true);
                }
            });
        },
        trafos3w_sc: (data, b, grafka, cellIdMap) => {
            const findCompFn = typeof window !== 'undefined' && window.findResultPlaceholderForComponent;
            const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
            const insertFn = typeof window !== 'undefined' && window.insertResultBox;
            const fallbackStyle = (typeof window !== 'undefined' && window.RESULT_BOX_STYLE) || 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';
            data.forEach(cell => {
                const resultCell = resolveCell(cell, b, cellIdMap);
                if (!resultCell) {
                    console.warn('Short circuit: could not find 3w-transformer cell for id=', cell.id, 'name=', cell.name);
                    return;
                }
                const trafoName = formatResultNameHeader(resultCell, cell.name, 'Trafo3w');
                const resultString = `${trafoName}
                ikss_hv[kA]: ${formatNumber(cell.ikss_hv_ka ?? cell.ikss_hv)}
                ikss_mv[kA]: ${formatNumber(cell.ikss_mv_ka ?? cell.ikss_mv)}
                ikss_lv[kA]: ${formatNumber(cell.ikss_lv_ka ?? cell.ikss_lv)}`;
                let existing = findCompFn ? findCompFn(b, resultCell) : null;
                if (!existing) {
                    const edges = (b.getEdges && b.getEdges(resultCell)) || resultCell.edges || [];
                    const parent = edges[0] || resultCell;
                    existing = findFn ? findFn(b, parent) : null;
                }
                const parent = existing ? b.getModel().getParent(existing) : ((b.getEdges && b.getEdges(resultCell))?.[0] || resultCell);
                if (existing) {
                    b.getModel().setValue(existing, resultString);
                } else {
                    const labelka = insertFn
                        ? insertFn(b, parent, resultString, { width: 95, height: 70, positionX: -0.3 })
                        : b.insertVertex(parent, null, resultString, -0.15, 1.1, 95, 70, fallbackStyle, true);
                }
            });
        },
        ext_grid_sc: (data, b, grafka, cellIdMap) => {
            const findCompFn = typeof window !== 'undefined' && window.findResultPlaceholderForComponent;
            const findFn = typeof window !== 'undefined' && window.findResultPlaceholder;
            const insertFn = typeof window !== 'undefined' && window.insertResultBox;
            const fallbackStyle = (typeof window !== 'undefined' && window.RESULT_BOX_STYLE) || 'shapeELXXX=Result;shape=rounded;rounded=1;arcSize=6;fillColor=#F8F9FA;strokeColor=#6C757D;strokeWidth=1.5;dashed=1;dashPattern=5 5;opacity=70;whiteSpace=wrap;html=1;overflow=hidden;align=center;verticalAlign=middle;fontSize=7;fontColor=#6C757D;fontStyle=0;spacing=3';
            data.forEach(cell => {
                const resultCell = resolveCell(cell, b, cellIdMap);
                if (!resultCell) {
                    console.warn('Short circuit: could not find external grid cell for id=', cell.id, 'name=', cell.name);
                    return;
                }
                cell.name = replaceUnderscores(cell.name);
                const extLabel = formatResultNameHeader(resultCell, cell.name, 'External Grid');
                const resultString = `${extLabel}
                ikss[kA]: ${formatNumber(cell.ikss_ka)}
                ip[kA]: ${formatNumber(cell.ip_ka)}
                ith[kA]: ${formatNumber(cell.ith_ka)}
                rk[ohm]: ${formatNumber(cell.rk_ohm)}
                xk[ohm]: ${formatNumber(cell.xk_ohm)}`;
                let existing = findCompFn ? findCompFn(b, resultCell) : null;
                if (!existing) {
                    const edges = (b.getEdges && b.getEdges(resultCell)) || resultCell.edges || [];
                    const parent = edges[0] || resultCell;
                    existing = findFn ? findFn(b, parent) : null;
                }
                const parent = existing ? b.getModel().getParent(existing) : ((b.getEdges && b.getEdges(resultCell))?.[0] || resultCell);
                if (existing) {
                    b.getModel().setValue(existing, resultString);
                } else {
                    const labelka = insertFn
                        ? insertFn(b, parent, resultString, { width: 95, height: 58, positionX: -0.3 })
                        : b.insertVertex(parent, null, resultString, -0.15, 1.1, 95, 58, fallbackStyle, true);
                }
            });
        }
    };

    // Main processing function (FROM BACKEND TO FRONTEND)
    async function processNetworkData(url, obj, b, grafka) {
        try {
            // Initialize styles once
            b.getStylesheet().putCellStyle('labelstyle', STYLES.label);
            b.getStylesheet().putCellStyle('lineStyle', STYLES.line);

            // PERFORMANCE OPTIMIZATION: Request gzip compression
            const requestStart = performance.now();
            const response = await fetch(url, {
                mode: "cors",
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                    "Accept-Encoding": "gzip",  // Request compressed response
                },
                body: JSON.stringify(obj)
            });

            if (response.status !== 200) {
                throw new Error("server");
            }

            const dataJson = await response.json();
            const requestTime = performance.now() - requestStart;
            console.log(`Short circuit backend response received in ${requestTime.toFixed(0)}ms`);
            console.log('dataJson')
            console.log(dataJson)

            // Handle errors first
            if (handleNetworkErrors(dataJson)) {
                return;
            }

            const param0 = obj && (obj[0] ?? obj['0']);
            if (param0 && param0.exportPandapowerResults) {
                downloadPandapowerShortCircuitResults(dataJson, b);
            }

            // Build cellIdMap for reliable lookups (id, mxObjectId, mxObjectId with _/# variants)
            const cellIdMap = new Map();
            const cells = b.getModel().cells;
            if (cells && typeof cells === 'object') {
                const keys = Object.keys(cells);
                for (let i = 0; i < keys.length; i++) {
                    const cell = cells[keys[i]];
                    if (cell && cell.id != null) {
                        cellIdMap.set(String(cell.id), cell);
                        if (cell.mxObjectId) {
                            cellIdMap.set(String(cell.mxObjectId), cell);
                            cellIdMap.set(String(cell.mxObjectId).replace('#', '_'), cell);
                            cellIdMap.set(String(cell.mxObjectId).replace('_', '#'), cell);
                        }
                    }
                }
            }

            // PERFORMANCE OPTIMIZATION: Batch all DOM updates
            // This prevents layout thrashing and improves rendering speed
            console.log('Processing short circuit results...');
            const processingStart = performance.now();
            const model = b.getModel();
            model.beginUpdate();
            try {
                // Process each type of network element
                Object.entries(elementProcessors).forEach(([type, processor]) => {
                    if (dataJson[type]) {
                        processor(dataJson[type], b, grafka, cellIdMap);
                    }
                });
            } finally {
                model.endUpdate();
                if (b.getView && b.getView().refresh) b.getView().refresh();
            }
            
            const processingTime = performance.now() - processingStart;
            console.log(`Processed short circuit results in ${processingTime.toFixed(0)}ms`);
            console.log(`Total round-trip time: ${(requestTime + processingTime).toFixed(0)}ms`);

        } catch (err) {
            if (err.message === "server") return;
            alert('Error processing network data.' + err + '\n \nCheck input data or contact electrisim@electrisim.com');
        } finally {
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
        }
    }

    // Helper functions for transformer connections (imported from loadFlow.js logic)
    
    // Helper function for regular transformer connections  
    const updateTransformerBusConnections = (transformerArray, busbarArray, graphModel) => {
        const getTransformerCell = (transformerId) => {
            const cell = graphModel.getModel().getCell(transformerId);
            if (!cell) {
                throw new Error(`Invalid transformer cell: ${transformerId}`);
            }
            return cell;
        };

        const updateTransformerStyle = (cell, color) => {
            const style = graphModel.getModel().getStyle(cell);
            const newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
            graphModel.setCellStyle(newStyle, [cell]);
        };

        const findConnectedBusbars = (hvBusName, lvBusName) => {
            const bus1 = busbarArray.find(element => element.name === hvBusName);
            const bus2 = busbarArray.find(element => element.name === lvBusName);

            if (!bus1 || !bus2) {
                throw new Error("Transformer is not connected to valid busbars.");
            }

            return [bus1, bus2];
        };

        const sortBusbarsByVoltage = (busbars) => {
            if (busbars.length !== 2) {
                throw new Error("Transformer requires exactly two busbars.");
            }

            const [bus1, bus2] = busbars;
            const voltage1 = parseFloat(bus1.vn_kv);
            const voltage2 = parseFloat(bus2.vn_kv);

            return voltage1 > voltage2 ? 
                { highVoltage: bus1.name, lowVoltage: bus2.name } :
                { highVoltage: bus2.name, lowVoltage: bus1.name };
        };

        const processTransformer = (transformer) => {
            const transformerCell = getTransformerCell(transformer.id);

            try {
                const connectedBusbars = findConnectedBusbars(transformer.hv_bus, transformer.lv_bus);
                updateTransformerStyle(transformerCell, 'black');
                const { highVoltage, lowVoltage } = sortBusbarsByVoltage(connectedBusbars);

                return {
                    ...transformer,
                    hv_bus: highVoltage,
                    lv_bus: lowVoltage
                };

            } catch (error) {
                console.log(`Error processing transformer ${transformer.id}:`, error.message);
                updateTransformerStyle(transformerCell, 'red');
                alert('The transformer is not connected to the bus. Please check the transformer highlighted in red and connect it to the appropriate bus.');
                return transformer;
            }
        };

        return transformerArray.map(transformer => processTransformer(transformer));
    };

    // Helper function for three-winding transformer connections
    const updateThreeWindingTransformerConnections = (threeWindingTransformerArray, busbarArray, graphModel) => {
        const getTransformerCell = (transformerId) => {
            const cell = graphModel.getModel().getCell(transformerId);
            if (!cell) {
                throw new Error(`Invalid three-winding transformer cell: ${transformerId}`);
            }
            return cell;
        };

        const updateTransformerStyle = (cell, color) => {
            const style = graphModel.getModel().getStyle(cell);
            const newStyle = mxUtils.setStyle(style, mxConstants.STYLE_STROKECOLOR, color);
            graphModel.setCellStyle(newStyle, [cell]);
        };

        const findConnectedBusbars = (hvBusName, mvBusName, lvBusName) => {
            const bus1 = busbarArray.find(element => element.name === hvBusName);
            const bus2 = busbarArray.find(element => element.name === mvBusName);
            const bus3 = busbarArray.find(element => element.name === lvBusName);

            if (!bus1 || !bus2 || !bus3) {
                throw new Error("Three-winding transformer is not connected to valid busbars.");
            }

            return [bus1, bus2, bus3];
        };

        const sortBusbarsByVoltage = (busbars) => {
            if (busbars.length !== 3) {
                throw new Error("Three-winding transformer requires exactly three busbars.");
            }

            const busbarWithHighestVoltage = busbars.reduce((prev, current) =>
                parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
            );

            const busbarWithLowestVoltage = busbars.reduce((prev, current) =>
                parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
            );

            const busbarWithMiddleVoltage = busbars.find(
                element => element.name !== busbarWithHighestVoltage.name &&
                    element.name !== busbarWithLowestVoltage.name
            );

            return {
                highVoltage: busbarWithHighestVoltage.name,
                mediumVoltage: busbarWithMiddleVoltage.name,
                lowVoltage: busbarWithLowestVoltage.name
            };
        };

        const processThreeWindingTransformer = (transformer) => {
            const transformerCell = getTransformerCell(transformer.id);

            try {
                const connectedBusbars = findConnectedBusbars(
                    transformer.hv_bus,
                    transformer.mv_bus,
                    transformer.lv_bus
                );

                updateTransformerStyle(transformerCell, 'black');
                const { highVoltage, mediumVoltage, lowVoltage } = sortBusbarsByVoltage(connectedBusbars);

                return {
                    ...transformer,
                    hv_bus: highVoltage,
                    mv_bus: mediumVoltage,
                    lv_bus: lowVoltage
                };

            } catch (error) {
                console.log(`Error processing three-winding transformer ${transformer.id}:`, error.message);
                updateTransformerStyle(transformerCell, 'red');
                alert('The three-winding transformer is not connected to the bus. Please check the three-winding transformer highlighted in red and connect it to the appropriate bus.');
                return transformer;
            }
        };

        return threeWindingTransformerArray.map(transformer =>
            processThreeWindingTransformer(transformer)
        );
    };

    // Helper functions for getting connections
    const getConnectedBusId = (cell, isLine = false, graph = null) => {
        if (isLine) {                 
            return {            
                busFrom: cell.source?.mxObjectId?.replace('#', '_'),
                busTo: cell.target?.mxObjectId?.replace('#', '_')
            };            
        }
        let edges = cell.edges;
        if ((!edges || edges.length === 0) && graph && graph.getEdges) {
            edges = graph.getEdges(cell);
        }
        const edge = edges && edges[0];
        if (!edge) {
            return null;
        }

        if (!edge.target && !edge.source) {
            return null;
        }

        if (edge.target && edge.target.mxObjectId !== cell.mxObjectId) {
            return edge.target.mxObjectId.replace('#', '_');
        } else if (edge.source && edge.source.mxObjectId !== cell.mxObjectId) {
            return edge.source.mxObjectId.replace('#', '_');
        }
        
        return null;
    };

    const getThreeWindingConnections = (cell, graph = null) => {
        let edges = cell.edges;
        if ((!edges || edges.length === 0) && graph && graph.getEdges) {
            edges = graph.getEdges(cell);
        }
        if (!edges || edges.length < 3) return null;
        const [lvEdge, mvEdge, hvEdge] = edges;
        const getConnectedBus = (edge) =>
            (edge.target.mxObjectId !== cell.mxObjectId ?
                edge.target.mxObjectId : edge.source.mxObjectId).replace('#', '_');

        return {
            hv_bus: getConnectedBus(hvEdge),
            mv_bus: getConnectedBus(mvEdge),
            lv_bus: getConnectedBus(lvEdge)
        };
    };

    const getTransformerConnections = (cell) => {
        if (!cell.edges || cell.edges.length < 2) return null;
        const [hvEdge, lvEdge] = cell.edges;
        const getConnectedBus = (edge) =>
            (edge.target.mxObjectId !== cell.mxObjectId ?
                edge.target.mxObjectId : edge.source.mxObjectId).replace('#', '_');

        return {
            hv_bus: getConnectedBus(hvEdge),
            lv_bus: getConnectedBus(lvEdge)
        };
    };

    // Add other helper functions that might be missing
    const getConnectedBuses = (cell) => {
        // For lines, use the direct source/target approach like in getConnectedBusId(cell, true)
        // This matches the approach used in loadFlow.js
        return {
            busFrom: cell.source?.mxObjectId?.replace('#', '_'),
            busTo: cell.target?.mxObjectId?.replace('#', '_')
        };
    };

    const getImpedanceConnections = (cell, graph = null) => {
        let edges = cell.edges;
        if ((!edges || edges.length === 0) && graph && graph.getEdges) {
            edges = graph.getEdges(cell);
        }
        if (!edges || edges.length < 2) {
            throw new Error(`Impedance ${cell.mxObjectId} must be connected to exactly two buses`);
        }
        
        const [edge1, edge2] = edges;
        
        const getBusId = (edge) => {
            if (edge.target && edge.target.mxObjectId !== cell.mxObjectId) {
                return edge.target.mxObjectId.replace('#', '_');
            } else if (edge.source && edge.source.mxObjectId !== cell.mxObjectId) {
                return edge.source.mxObjectId.replace('#', '_');
            }
            throw new Error(`Invalid edge connection for impedance ${cell.mxObjectId}`);
        };

        return {
            busFrom: getBusId(edge1),
            busTo: getBusId(edge2)
        };
    };

    const parseCellStyle = (styleString) => {
        if (!styleString) return null;
        
        const styleObj = {};
        const pairs = styleString.split(';');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key && value) {
                styleObj[key] = value;
            }
        });
        
        return styleObj;
    };

    const validateBusConnections = (cell) => {
        const connections = getConnectedBuses(cell);
        if (!connections.busFrom || !connections.busTo) {
            throw new Error(`Line ${cell.mxObjectId} is not connected to two buses`);
        }
        
        return true;
    };

    // Main function execution
    if (b.isEnabled() && !b.isCellLocked(b.getDefaultParent())) {
        // Use modern ShortCircuitDialog directly
        const dialog = new ShortCircuitDialog(a);
        dialog.show(async function (values) {
        // OpenDSS engine: delegate to loadflowOpenDss
        if (values && values.engine === 'opendss') {
            const { executeOpenDSSShortCircuit } = await import('./loadflowOpenDss.js');
            executeOpenDSSShortCircuit(values, apka, grafka);
            return;
        }

        // Pandapower engine: use object format (fault, case, lv_tol_percent, etc.)
        const a = values && typeof values === 'object' && !Array.isArray(values)
            ? values
            : (Array.isArray(values) ? { fault: values[0], case: values[1], lv_tol_percent: values[2], topology: 'auto', tk_s: '1', r_fault_ohm: '0', x_fault_ohm: '0', inverse_y: 'True' } : {});

        apka.spinner.spin(document.body, "Waiting for results...");

        const hasParams = Array.isArray(a) ? a.length > 0 : (a && typeof a === 'object' && ('fault' in a || 'engine' in a));
        if (!hasParams) {
            apka.spinner.stop();
            return;
        }

        function getUserEmail() {
            try {
                const userStr = localStorage.getItem('user');
                if (userStr) {
                    const user = JSON.parse(userStr);
                    if (user?.email) return user.email;
                }
                if (typeof getCurrentUser === 'function') {
                    const currentUser = getCurrentUser();
                    if (currentUser?.email) return currentUser.email;
                }
                if (window.getCurrentUser?.()?.email) return window.getCurrentUser().email;
                if (window.authHandler?.getCurrentUser?.()?.email) {
                    return window.authHandler.getCurrentUser().email;
                }
            } catch (error) {
                console.warn('Error getting user email:', error);
            }
            return 'unknown@user.com';
        }

        const simulationParameters = {
            typ: "ShortCircuitPandaPower Parameters",
            fault_type: a.fault || a[0] || '3ph',
            fault_location: a.case || a[1] || 'max',
            fault_impedance: a.lv_tol_percent || a[2] || '6',
            topology: a.topology || 'auto',
            tk_s: a.tk_s || '1',
            r_fault_ohm: a.r_fault_ohm || '0',
            x_fault_ohm: a.x_fault_ohm || '0',
            inverse_y: a.inverse_y || 'True',
            exportPandapowerResults: a.exportPandapowerResults === true,
            user_email: getUserEmail()
        };

        try {
            const obj = prepareNetworkData(b, simulationParameters, { removeResultCells: false });
            console.log('Short Circuit data prepared:', JSON.stringify(obj));
            console.log('Using backend URL:', ENV.backendUrl);
            processNetworkData(ENV.backendUrl + "/", obj, b, grafka);
        } catch (error) {
            console.error('Short circuit network preparation failed:', error);
            alert('Short circuit preparation failed: ' + (error.message || error));
            if (typeof apka !== 'undefined' && apka.spinner) {
                apka.spinner.stop();
            }
        }
        });
    }
}

// Also export it as a module
export const shortCircuitPandaPower = window.shortCircuitPandaPower;



