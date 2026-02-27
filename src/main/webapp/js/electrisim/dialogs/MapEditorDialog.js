/**
 * MapEditorDialog - Dialog with embedded map for placing nodes and drawing cables
 * Generates electrical model with real cable lengths from geographic coordinates
 */

import { Dialog } from '../Dialog.js';
import { MapEditor, NODE_TYPES } from '../map/MapEditor.js';
import { mapToElectricalModel } from '../map/mapToElectricalModel.js';

export class MapEditorDialog extends Dialog {
    constructor(editorUi) {
        super('Map Editor - Geographic Layout', 'Generate Electrical Model');
        this.ui = editorUi || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;
        this.mapEditor = null;
    }

    show(callback) {
        this.callback = callback;
        this.ui = this.ui || window.App?.main?.editor?.editorUi;
        this.graph = this.ui?.editor?.graph;

        const container = document.createElement('div');
        Object.assign(container.style, {
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            width: '98vw',
            maxWidth: '1600px',
            height: '92vh',
            maxHeight: '900px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            boxSizing: 'border-box'
        });

        const desc = document.createElement('div');
        desc.style.cssText = 'padding:6px 8px;background:#e8f5e9;border-radius:4px;font-size:11px;color:#2e7d32;flex-shrink:0;';
        desc.innerHTML = '<b>Map Editor</b> – Place nodes from the palette on the map, draw cables between them. Cable lengths are calculated automatically from coordinates. Click <b>Generate Electrical Model</b> to create the schematic.';
        container.appendChild(desc);

        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:6px 8px;background:#f5f5f5;border-radius:4px;flex-shrink:0;';
        container.appendChild(toolbar);

        const addNode = (type, label) => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.cssText = 'padding:4px 8px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff;font-size:12px;';
            btn.onclick = () => {
                this.mapEditor?.setDefaultNodeType(type);
                this.mapEditor?.setMode('add_node');
                toolbar.querySelectorAll('button').forEach(b => b.style.background = '#fff');
                btn.style.background = '#c8e6c9';
            };
            toolbar.appendChild(btn);
        };

        const addGroup = (title, items) => {
            const span = document.createElement('span');
            span.style.cssText = 'font-size:11px;color:#666;margin-right:4px;';
            span.textContent = title + ':';
            toolbar.appendChild(span);
            items.forEach(([type, label]) => addNode(type, label));
        };

        addGroup('Sources', [
            [NODE_TYPES.OFFSHORE_WIND_TURBINE, 'Wind Turbine'],
            [NODE_TYPES.WIND_TURBINE, 'Generator'],
            [NODE_TYPES.ONSHORE_GRID, 'External Grid'],
            [NODE_TYPES.STATIC_GENERATOR, 'Static Gen'],
            [NODE_TYPES.SOURCE_DC, 'Source DC']
        ]);
        addGroup('Bus', [[NODE_TYPES.BUS, 'Bus']]);
        addGroup('Transformers', [
            [NODE_TYPES.OFFSHORE_SUBSTATION, 'Offshore Substation'],
            [NODE_TYPES.TRANSFORMER_3W, '3W Transformer']
        ]);
        addGroup('Compensation', [
            [NODE_TYPES.SHUNT_REACTOR, 'Shunt Reactor'],
            [NODE_TYPES.CAPACITOR, 'Capacitor'],
            [NODE_TYPES.GROUND, 'Ground']
        ]);
        addGroup('Load/Impedance', [
            [NODE_TYPES.LOAD, 'Load'],
            [NODE_TYPES.LOAD_ASYMMETRIC, 'A.Load'],
            [NODE_TYPES.IMPEDANCE, 'Impedance'],
            [NODE_TYPES.WARD, 'Ward'],
            [NODE_TYPES.EXTENDED_WARD, 'Ex.Ward']
        ]);
        addGroup('Rotating', [[NODE_TYPES.MOTOR, 'Motor']]);
        addGroup('Storage', [[NODE_TYPES.STORAGE, 'Storage']]);
        addGroup('Pandapower', [
            [NODE_TYPES.SVC, 'SVC'],
            [NODE_TYPES.TCSC, 'TCSC'],
            [NODE_TYPES.SSC, 'SSC'],
            [NODE_TYPES.DC_LINE, 'DC Line'],
            [NODE_TYPES.DC_BUS, 'DC Bus'],
            [NODE_TYPES.LOAD_DC, 'Load DC'],
            [NODE_TYPES.SWITCH, 'Switch'],
            [NODE_TYPES.VSC, 'VSC'],
            [NODE_TYPES.B2B_VSC, 'B2B VSC']
        ]);
        addGroup('OpenDSS', [[NODE_TYPES.PVSYSTEM, 'PVSystem']]);

        const sepActions = document.createElement('span');
        sepActions.style.cssText = 'width:1px;height:20px;background:#999;margin:0 8px;';
        toolbar.appendChild(sepActions);

        const drawCableBtn = document.createElement('button');
        drawCableBtn.textContent = 'Draw Cable';
        drawCableBtn.title = 'Draw straight or polyline cable: click start node, optional intermediate points on map, then end node';
        drawCableBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff;';
        drawCableBtn.onclick = () => {
            this.mapEditor?.setMode('draw_cable');
            this.mapEditor.cableDrawFrom = null;
            toolbar.querySelectorAll('button').forEach(b => b.style.background = '#fff');
            drawCableBtn.style.background = '#ffccbc';
            areaPanel.style.display = 'none';
        };
        toolbar.appendChild(drawCableBtn);

        const drawAreaBtn = document.createElement('button');
        drawAreaBtn.textContent = 'Draw Wind Farm Area';
        drawAreaBtn.title = 'Draw polygon: click to add vertices, click first point again to close. Then select area and configure turbines.';
        drawAreaBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #1e88e5;border-radius:4px;background:#e3f2fd;color:#1565c0;';
        drawAreaBtn.onclick = () => {
            this.mapEditor?.setDefaultNodeType(NODE_TYPES.OFFSHORE_WIND_TURBINE);
            this.mapEditor?.setMode('draw_area');
            this.mapEditor.areaDrawPoints = [];
            toolbar.querySelectorAll('button').forEach(b => b.style.background = '#fff');
            drawAreaBtn.style.background = '#bbdefb';
            areaPanel.style.display = 'none';
            const statusEl = document.getElementById('map-editor-status');
            if (statusEl) statusEl.textContent = 'Draw wind farm area: click to add vertices, click first point again to close. Esc to cancel.';
        };
        toolbar.appendChild(drawAreaBtn);

        const areaPanel = document.createElement('div');
        areaPanel.style.cssText = 'display:none;padding:8px 12px;background:#e3f2fd;border-radius:4px;border:1px solid #90caf9;flex-wrap:wrap;align-items:center;gap:8px;';
        areaPanel.innerHTML = '<span style="font-weight:600;color:#1565c0;">Area selected</span>';
        const turbineCountInput = document.createElement('input');
        turbineCountInput.type = 'number';
        turbineCountInput.min = '1';
        turbineCountInput.max = '500';
        turbineCountInput.value = '66';
        turbineCountInput.style.cssText = 'width:60px;padding:4px;';
        turbineCountInput.title = 'Number of wind turbines';
        const minDistInput = document.createElement('input');
        minDistInput.type = 'number';
        minDistInput.min = '0.2';
        minDistInput.step = '0.1';
        minDistInput.value = '1';
        minDistInput.style.cssText = 'width:70px;padding:4px;';
        minDistInput.title = 'Minimum distance between turbines (km)';
        const placeTurbinesBtn = document.createElement('button');
        placeTurbinesBtn.textContent = 'Place Turbines';
        placeTurbinesBtn.style.cssText = 'padding:4px 12px;cursor:pointer;border:1px solid #2e7d32;border-radius:4px;background:#c8e6c9;color:#1b5e20;';
        placeTurbinesBtn.onclick = () => {
            const areas = this.mapEditor?.selectedAreas;
            if (!areas || areas.size === 0) return;
            const count = Math.max(1, parseInt(turbineCountInput.value, 10) || 66);
            const minDist = Math.max(0.2, parseFloat(minDistInput.value) || 1);
            for (const areaId of areas) {
                const added = this.mapEditor.placeTurbinesInArea(areaId, count, minDist);
                if (added.length < count) {
                    alert(`Placed ${added.length} of ${count} turbines. Area may be too small for ${count} turbines with ${minDist} km spacing.`);
                }
            }
            this.mapEditor?.setMode('select');
            this.mapEditor?._clearSelection();
            areaPanel.style.display = 'none';
            drawAreaBtn.style.background = '#fff';
        };
        areaPanel.appendChild(turbineCountInput);
        areaPanel.appendChild(document.createTextNode(' turbines, min dist '));
        areaPanel.appendChild(minDistInput);
        areaPanel.appendChild(document.createTextNode(' km '));
        areaPanel.appendChild(placeTurbinesBtn);
        toolbar.appendChild(areaPanel);

        const selectBtn = document.createElement('button');
        selectBtn.textContent = 'Select / Pan';
        selectBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#c8e6c9;';
        selectBtn.onclick = () => {
            this.mapEditor?.setMode('select');
            toolbar.querySelectorAll('button').forEach(b => b.style.background = '#fff');
            selectBtn.style.background = '#c8e6c9';
            areaPanel.style.display = 'none';
        };
        toolbar.appendChild(selectBtn);

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete selected';
        deleteBtn.title = 'Delete selected nodes/cables/areas. Hold Ctrl or Shift and click to select multiple. Press Delete/Backspace to remove.';
        deleteBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #d32f2f;border-radius:4px;background:#ffebee;color:#c62828;';
        deleteBtn.onclick = () => this._deleteSelected();
        toolbar.appendChild(deleteBtn);

        const sep = document.createElement('span');
        sep.style.cssText = 'width:1px;height:20px;background:#ccc;margin:0 4px;';
        toolbar.appendChild(sep);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Map';
        saveBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #2196f3;border-radius:4px;background:#e3f2fd;color:#1976d2;';
        saveBtn.onclick = () => this._saveMap();
        toolbar.appendChild(saveBtn);

        const loadBtn = document.createElement('button');
        loadBtn.textContent = 'Load Map';
        loadBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #2196f3;border-radius:4px;background:#e3f2fd;color:#1976d2;';
        loadBtn.onclick = () => this._loadMapClick();
        toolbar.appendChild(loadBtn);

        const loadInput = document.createElement('input');
        loadInput.type = 'file';
        loadInput.accept = '.json,application/json';
        loadInput.style.display = 'none';
        loadInput.onchange = (e) => this._loadMapFile(e);
        toolbar.appendChild(loadInput);
        this._loadInput = loadInput;

        const saveLocalBtn = document.createElement('button');
        saveLocalBtn.textContent = 'Save to browser';
        saveLocalBtn.title = 'Store map in browser storage (survives refresh)';
        saveLocalBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #9c27b0;border-radius:4px;background:#f3e5f5;color:#7b1fa2;font-size:12px;';
        saveLocalBtn.onclick = () => this._saveToLocal();
        toolbar.appendChild(saveLocalBtn);

        const loadLocalBtn = document.createElement('button');
        loadLocalBtn.textContent = 'Load from browser';
        loadLocalBtn.title = 'Restore last saved map from browser storage';
        loadLocalBtn.style.cssText = 'padding:6px 12px;cursor:pointer;border:1px solid #9c27b0;border-radius:4px;background:#f3e5f5;color:#7b1fa2;font-size:12px;';
        loadLocalBtn.onclick = () => this._loadFromLocal();
        toolbar.appendChild(loadLocalBtn);

        const mapContainer = document.createElement('div');
        mapContainer.id = 'electrisim-map-editor-container';
        mapContainer.style.cssText = 'flex:1;min-height:550px;border:1px solid #ddd;border-radius:4px;overflow:hidden;';
        container.appendChild(mapContainer);

        const status = document.createElement('div');
        status.id = 'map-editor-status';
        status.style.cssText = 'font-size:15px;color:#333;padding:6px 8px;flex-shrink:0;';
        status.textContent = 'Nodes: 0 | Cables: 0';
        container.appendChild(status);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;padding:4px 0;flex-shrink:0;';
        const generateBtn = document.createElement('button');
        generateBtn.textContent = 'Generate Electrical Model';
        generateBtn.style.cssText = 'padding:10px 20px;cursor:pointer;border:none;border-radius:4px;background:#4caf50;color:#fff;font-weight:bold;';
        generateBtn.onclick = () => this._generateModel();
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Close';
        cancelBtn.style.cssText = 'padding:10px 20px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff;';
        cancelBtn.onclick = () => this._close();
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(generateBtn);
        container.appendChild(btnRow);

        this._showAsModal(container);

        this._keyHandler = (e) => {
            if (e.key === 'Escape') {
                if (this.mapEditor?.cancelCableDraw() || this.mapEditor?.cancelAreaDraw()) {
                    e.preventDefault();
                }
            } else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.target.matches('input, textarea')) {
                e.preventDefault();
                this._deleteSelected();
            }
        };
        document.addEventListener('keydown', this._keyHandler);

        const updateStatus = (text) => {
            const statusEl = document.getElementById('map-editor-status');
            if (statusEl) statusEl.textContent = text;
        };

        requestAnimationFrame(() => {
            try {
                this.mapEditor = new MapEditor('electrisim-map-editor-container', {
                    defaultCenter: [54.5, 8.0],
                    defaultZoom: 8
                }).init();
                this.mapEditor.on('change', (data) => {
                    updateStatus(`Nodes: ${data.nodes.length} | Cables: ${data.cables.length} | Areas: ${data.areas?.length ?? 0}`);
                });
                this.mapEditor.on('selectionChange', () => {
                    const n = this.mapEditor?.selectedNodes?.size ?? 0;
                    const c = this.mapEditor?.selectedCables?.size ?? 0;
                    const a = this.mapEditor?.selectedAreas?.size ?? 0;
                    const data = this.mapEditor?.getData();
                    const base = data ? `Nodes: ${data.nodes.length} | Cables: ${data.cables.length} | Areas: ${data.areas?.length ?? 0}` : '';
                    const sel = (n + c + a) > 0 ? ` | Selected: ${n} node(s), ${c} cable(s), ${a} area(s)` : '';
                    updateStatus(base + sel);
                    areaPanel.style.display = a > 0 ? 'flex' : 'none';
                });
                this.mapEditor.on('cableDrawStart', (node) => {
                    updateStatus(`Cable from ${node.name}: Length 0.00 km — Click map for intermediate points, or click end node to finish. Esc to cancel.`);
                });
                this.mapEditor.on('cableDrawUpdate', (lengthKm) => {
                    const from = this.mapEditor?.nodes.get(this.mapEditor?.cableDrawFrom);
                    if (from) {
                        updateStatus(`Cable from ${from.name}: Length ${lengthKm.toFixed(2)} km — Click map for intermediate points, or click end node to finish. Esc to cancel.`);
                    }
                });
                this.mapEditor.on('cableDrawEnd', () => {
                    const data = this.mapEditor.getData();
                    updateStatus(`Nodes: ${data.nodes.length} | Cables: ${data.cables.length} | Areas: ${data.areas?.length ?? 0}`);
                    drawCableBtn.style.background = '#fff';
                });
                this.mapEditor.on('areaDrawn', (area) => {
                    drawAreaBtn.style.background = '#fff';
                    const data = this.mapEditor.getData();
                    updateStatus(`Nodes: ${data.nodes.length} | Cables: ${data.cables.length} | Areas: ${data.areas?.length ?? 0}`);
                    this._showPlaceTurbinesDialog(area, updateStatus);
                });
                this.mapEditor.on('nodeAdded', (node) => {
                    if (node.type === NODE_TYPES.OFFSHORE_SUBSTATION) {
                        const turbines = this.mapEditor.getData().nodes.filter(n => n.type === NODE_TYPES.OFFSHORE_WIND_TURBINE);
                        if (turbines.length > 0) {
                            this.mapEditor.runAutoCableRouting();
                            const data = this.mapEditor.getData();
                            updateStatus(`Nodes: ${data.nodes.length} | Cables: ${data.cables.length} | Areas: ${data.areas?.length ?? 0} — 66 kV cable routing applied.`);
                        }
                    }
                });
            } catch (err) {
                console.error('MapEditor init error:', err);
                alert('Failed to initialize map. Make sure Leaflet is loaded.');
            }
        });
    }

    _showAsModal(container) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        overlay.onclick = (e) => { if (e.target === overlay) this._close(); };
        const box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:8px;padding:12px;max-height:95vh;overflow:auto;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
        box.onclick = (e) => e.stopPropagation();
        box.appendChild(container);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        this.modalOverlay = overlay;
    }

    _saveMap() {
        if (!this.mapEditor) return;
        const data = this.mapEditor.getData();
        const json = JSON.stringify({
            version: 1,
            savedAt: new Date().toISOString(),
            ...data
        }, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `electrisim-map-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    _loadMapClick() {
        this._loadInput?.click();
    }

    _loadMapFile(e) {
        const file = e.target?.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target?.result || '{}');
                const nodes = data.nodes || [];
                const cables = data.cables || [];
                const areas = data.areas || [];
                if (nodes.length === 0 && cables.length === 0 && areas.length === 0) {
                    alert('File contains no map data.');
                    return;
                }
                this.mapEditor?.loadData({ nodes, cables, areas });
            } catch (err) {
                console.error('Load map error:', err);
                alert('Invalid map file: ' + (err.message || 'parse error'));
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    static get LOCAL_STORAGE_KEY() { return 'electrisim-map-editor-data'; }

    _saveToLocal() {
        if (!this.mapEditor) return;
        try {
            const data = this.mapEditor.getData();
            const json = JSON.stringify({
                version: 1,
                savedAt: new Date().toISOString(),
                ...data
            });
            localStorage.setItem(MapEditorDialog.LOCAL_STORAGE_KEY, json);
            alert('Map saved to browser storage.');
        } catch (err) {
            console.error('Save to local error:', err);
            alert('Failed to save: ' + (err.message || 'storage error'));
        }
    }

    _loadFromLocal() {
        try {
            const json = localStorage.getItem(MapEditorDialog.LOCAL_STORAGE_KEY);
            if (!json) {
                alert('No saved map found in browser storage.');
                return;
            }
            const data = JSON.parse(json);
            const nodes = data.nodes || [];
            const cables = data.cables || [];
            const areas = data.areas || [];
            if (nodes.length === 0 && cables.length === 0 && areas.length === 0) {
                alert('Saved map is empty.');
                return;
            }
            this.mapEditor?.loadData({ nodes, cables, areas });
        } catch (err) {
            console.error('Load from local error:', err);
            alert('Failed to load: ' + (err.message || 'parse error'));
        }
    }

    _generateModel() {
        if (!this.mapEditor || !this.graph) {
            alert('Map or graph not ready.');
            return;
        }
        const data = this.mapEditor.getData();
        if (data.nodes.length === 0) {
            alert('Add at least one node to the map.');
            return;
        }
        try {
            const point = { x: 100, y: 100 };
            if (this.graph.getView()) {
                const tr = this.graph.getView().translate;
                const s = this.graph.getView().scale;
                point.x = 100 + tr.x * s;
                point.y = 100 + tr.y * s;
            }
            mapToElectricalModel(this.graph, data, point);
            this._close();
            if (this.callback) this.callback(data);
        } catch (err) {
            console.error('mapToElectricalModel error:', err);
            alert('Error generating model: ' + err.message);
        }
    }

    _deleteSelected() {
        if (!this.mapEditor) return;
        this.mapEditor.deleteSelected();
    }

    _showPlaceTurbinesDialog(area, updateStatus) {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:10001;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#fff;border-radius:8px;padding:16px;min-width:280px;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
        box.innerHTML = `<div style="font-weight:600;margin-bottom:12px;color:#1565c0;">Place wind turbines in ${area.id}</div>`;
        const countLabel = document.createElement('label');
        countLabel.style.cssText = 'display:block;margin-bottom:4px;font-size:12px;';
        countLabel.textContent = 'Number of turbines:';
        const countInput = document.createElement('input');
        countInput.type = 'number';
        countInput.min = '1';
        countInput.max = '500';
        countInput.value = '66';
        countInput.style.cssText = 'width:80px;padding:6px;margin-bottom:12px;';
        const distLabel = document.createElement('label');
        distLabel.style.cssText = 'display:block;margin-bottom:4px;font-size:12px;';
        distLabel.textContent = 'Minimum distance (km):';
        const distInput = document.createElement('input');
        distInput.type = 'number';
        distInput.min = '0.2';
        distInput.step = '0.1';
        distInput.value = '1';
        distInput.style.cssText = 'width:80px;padding:6px;margin-bottom:16px;';
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Skip';
        cancelBtn.style.cssText = 'padding:6px 14px;cursor:pointer;border:1px solid #ccc;border-radius:4px;background:#fff;';
        cancelBtn.onclick = () => {
            document.body.removeChild(overlay);
        };
        const placeBtn = document.createElement('button');
        placeBtn.textContent = 'Place Turbines';
        placeBtn.style.cssText = 'padding:6px 14px;cursor:pointer;border:none;border-radius:4px;background:#4caf50;color:#fff;font-weight:600;';
        placeBtn.onclick = () => {
            const count = Math.max(1, parseInt(countInput.value, 10) || 66);
            const minDist = Math.max(0.2, parseFloat(distInput.value) || 1);
            const added = this.mapEditor.placeTurbinesInArea(area.id, count, minDist);
            document.body.removeChild(overlay);
            if (updateStatus) {
                updateStatus('Please place one or more offshore substations on the map. Once placed, I will automatically calculate and draw the optimal 66 kV cable routing.');
            }
            if (added.length < count) {
                alert(`Placed ${added.length} of ${count} turbines. The area may be too small for ${count} turbines with ${minDist} km spacing.`);
            }
        };
        box.appendChild(countLabel);
        box.appendChild(countInput);
        box.appendChild(distLabel);
        box.appendChild(distInput);
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(placeBtn);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        overlay.onclick = (e) => { if (e.target === overlay) document.body.removeChild(overlay); };
        box.onclick = (e) => e.stopPropagation();
        document.body.appendChild(overlay);
    }

    _close() {
        if (this._keyHandler) {
            document.removeEventListener('keydown', this._keyHandler);
            this._keyHandler = null;
        }
        if (this.mapEditor) {
            this.mapEditor.destroy();
            this.mapEditor = null;
        }
        if (this.modalOverlay && this.modalOverlay.parentNode) {
            this.modalOverlay.parentNode.removeChild(this.modalOverlay);
        }
        this.modalOverlay = null;
    }
}
