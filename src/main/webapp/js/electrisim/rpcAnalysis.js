import { RPCDialog } from './dialogs/RPCDialog.js';
import { RPCResultsDialog } from './dialogs/RPCResultsDialog.js';
import { prepareNetworkData } from './utils/networkDataPreparation.js';

console.log('rpcAnalysis.js LOADED');

const getBackendUrl = () => {
    if (window.ENV && window.ENV.backendUrl) {
        return window.ENV.backendUrl + '/';
    }
    console.warn('ENV.backendUrl not found, using localhost fallback');
    return 'http://localhost:5000/';
};

function rpcAnalysis(a, b, c) {
    console.log('RPC Analysis started');

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

    const dialog = new RPCDialog(editorUi);

    dialog.show(async (values) => {
        if (!values) {
            console.log('RPC dialog cancelled');
            return;
        }

        console.log('RPC parameters:', values);

        if (!values.pccBusId) {
            alert('Please select a PCC Bus');
            return;
        }
        if (!values.extGridId) {
            alert('Please select an External Grid');
            return;
        }

        const selectedGenIds = values.generatorIds || [];
        if (selectedGenIds.length === 0) {
            alert('Please select at least one generator');
            return;
        }

        const app = a || window.App || window.apka;
        if (app && app.spinner) {
            app.spinner.spin(document.body, 'Running Reactive Power Capability analysis...');
        } else if (window.apka && window.apka.spinner) {
            window.apka.spinner.spin(document.body, 'Running Reactive Power Capability analysis...');
        }

        try {
            const voltageLevels = (values.voltageLevels || '1.0')
                .split(',')
                .map(s => parseFloat(s.trim()))
                .filter(v => !isNaN(v));

            // Resolve cell names from IDs
            const model = graph.getModel();
            const pccCell = model.getCell(values.pccBusId);
            const extGridCell = model.getCell(values.extGridId);

            const pccBusName = _getCellNetworkName(pccCell);
            const extGridName = _getCellNetworkName(extGridCell);

            const generatorNames = selectedGenIds.map(id => {
                const cell = model.getCell(id);
                return _getCellNetworkName(cell);
            }).filter(n => n !== null);

            // Build requirements in the format backend expects:
            // { "vKey": { p_mw: [...], q_req_max_mvar: [...], q_req_min_mvar: [...] } }
            let requirements = null;
            if (values.requirements && values.requirements.length > 0) {
                const sorted = [...values.requirements].sort((a, b) => a.p - b.p);
                const reqObj = {};
                voltageLevels.forEach(v => {
                    const vKey = String(parseFloat(v).toFixed(4));
                    reqObj[vKey] = {
                        p_mw: sorted.map(r => r.p),
                        q_req_max_mvar: sorted.map(r => r.qMax),
                        q_req_min_mvar: sorted.map(r => r.qMin)
                    };
                });
                requirements = reqObj;
            }

            const rpcParams = {
                typ: 'RPCAnalysisPandaPower Parameters',
                pcc_bus_name: pccBusName,
                ext_grid_name: extGridName,
                generator_names: generatorNames,
                voltage_levels: voltageLevels,
                p_min_mw: 0,
                p_max_mw: parseFloat(values.pMaxMw) || 0,
                p_steps: parseInt(values.pSteps) || 20,
                q_capability_mode: values.qCapabilityMode || 'from_rating',
                limit_overloads: values.limitOverloads || false,
                max_loading_percent: parseFloat(values.maxLoadingPercent) || 100,
                requirements: requirements,
                frequency: parseFloat(values.frequency) || 50,
                user_email: _getUserEmail()
            };

            const networkData = prepareNetworkData(graph, rpcParams, { removeResultCells: false });

            const in_data = {};
            const keys = Object.keys(networkData);
            for (const key of keys) {
                const item = networkData[key];
                if (item && item.typ) {
                    in_data[key] = item;
                }
            }

            const backendUrl = getBackendUrl();
            console.log('RPC Analysis - Sending to backend:', backendUrl);
            console.log('RPC Analysis - Generator names:', generatorNames);
            console.log('RPC Analysis - PCC bus name:', pccBusName);

            const response = await fetch(backendUrl, {
                mode: 'cors',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept-Encoding': 'gzip, deflate, br'
                },
                body: JSON.stringify(in_data)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', errorText);
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            let responseData;
            const contentEncoding = response.headers.get('Content-Encoding');
            if (contentEncoding === 'gzip' || contentEncoding === 'br') {
                const buffer = await response.arrayBuffer();
                const decoder = new TextDecoder('utf-8');
                responseData = decoder.decode(buffer);
            } else {
                responseData = await response.text();
            }

            const dataJson = JSON.parse(responseData);
            console.log('RPC Analysis response:', dataJson);

            // Stop spinner
            if (app && app.spinner) app.spinner.stop();
            else if (window.apka && window.apka.spinner) window.apka.spinner.stop();

            if (dataJson.error) {
                alert('RPC Analysis Error: ' + dataJson.error);
                return;
            }

            const resultsDialog = new RPCResultsDialog(editorUi);
            resultsDialog.show(dataJson);

        } catch (error) {
            console.error('RPC Analysis failed:', error);
            if (app && app.spinner) app.spinner.stop();
            else if (window.apka && window.apka.spinner) window.apka.spinner.stop();
            alert('Reactive Power Capability analysis failed: ' + error.message);
        }
    });
}

function _getCellNetworkName(cell) {
    try {
        if (!cell) return null;
        if (cell.mxObjectId) return cell.mxObjectId.replace('#', '_');
        return null;
    } catch (e) {
        return null;
    }
}

function _getUserEmail() {
    try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            const user = JSON.parse(userStr);
            if (user && user.email) return user.email;
        }
        return 'unknown@user.com';
    } catch (e) {
        return 'unknown@user.com';
    }
}

window.rpcAnalysis = rpcAnalysis;
