/**
 * MapEditor - Embedded map for placing nodes and drawing cables with automatic distance calculation
 * Uses Leaflet with OpenStreetMap
 */

import { haversineDistanceKm, polylineLengthKm, generateMapId } from './mapUtils.js';

export const NODE_TYPES = {
    // Sources (backward compatible)
    WIND_TURBINE: 'wind_turbine',
    OFFSHORE_SUBSTATION: 'offshore_substation',
    ONSHORE_GRID: 'onshore_grid',
    BUS: 'bus',
    // Additional palette elements
    STATIC_GENERATOR: 'static_generator',
    SOURCE_DC: 'source_dc',
    TRANSFORMER_3W: 'transformer_3w',
    SHUNT_REACTOR: 'shunt_reactor',
    CAPACITOR: 'capacitor',
    GROUND: 'ground',
    LOAD: 'load',
    LOAD_ASYMMETRIC: 'load_asymmetric',
    IMPEDANCE: 'impedance',
    WARD: 'ward',
    EXTENDED_WARD: 'extended_ward',
    MOTOR: 'motor',
    STORAGE: 'storage',
    SVC: 'svc',
    TCSC: 'tcsc',
    SSC: 'ssc',
    DC_LINE: 'dc_line',
    DC_BUS: 'dc_bus',
    LOAD_DC: 'load_dc',
    SWITCH: 'switch',
    VSC: 'vsc',
    B2B_VSC: 'b2b_vsc',
    PVSYSTEM: 'pvsystem'
};

const NODE_ICONS = {
    [NODE_TYPES.WIND_TURBINE]: '🔄',
    [NODE_TYPES.OFFSHORE_SUBSTATION]: '⚡',
    [NODE_TYPES.ONSHORE_GRID]: '🔌',
    [NODE_TYPES.BUS]: '▣',
    [NODE_TYPES.STATIC_GENERATOR]: '⊙',
    [NODE_TYPES.SOURCE_DC]: '⊡',
    [NODE_TYPES.TRANSFORMER_3W]: '⚙',
    [NODE_TYPES.SHUNT_REACTOR]: '∿',
    [NODE_TYPES.CAPACITOR]: '⊓',
    [NODE_TYPES.GROUND]: '⊥',
    [NODE_TYPES.LOAD]: '▽',
    [NODE_TYPES.LOAD_ASYMMETRIC]: '△',
    [NODE_TYPES.IMPEDANCE]: 'Z',
    [NODE_TYPES.WARD]: 'W',
    [NODE_TYPES.EXTENDED_WARD]: 'E',
    [NODE_TYPES.MOTOR]: 'M',
    [NODE_TYPES.STORAGE]: '⊞',
    [NODE_TYPES.SVC]: 'S',
    [NODE_TYPES.TCSC]: 'T',
    [NODE_TYPES.SSC]: 'C',
    [NODE_TYPES.DC_LINE]: '—',
    [NODE_TYPES.DC_BUS]: '▬',
    [NODE_TYPES.LOAD_DC]: '▽',
    [NODE_TYPES.SWITCH]: '◯',
    [NODE_TYPES.VSC]: 'V',
    [NODE_TYPES.B2B_VSC]: 'B',
    [NODE_TYPES.PVSYSTEM]: '☀'
};

const NODE_COLORS = {
    [NODE_TYPES.WIND_TURBINE]: '#3388ff',
    [NODE_TYPES.OFFSHORE_SUBSTATION]: '#2ecc71',
    [NODE_TYPES.ONSHORE_GRID]: '#e74c3c',
    [NODE_TYPES.BUS]: '#95a5a6',
    [NODE_TYPES.STATIC_GENERATOR]: '#3498db',
    [NODE_TYPES.SOURCE_DC]: '#9b59b6',
    [NODE_TYPES.TRANSFORMER_3W]: '#27ae60',
    [NODE_TYPES.SHUNT_REACTOR]: '#f39c12',
    [NODE_TYPES.CAPACITOR]: '#e67e22',
    [NODE_TYPES.GROUND]: '#7f8c8d',
    [NODE_TYPES.LOAD]: '#1abc9c',
    [NODE_TYPES.LOAD_ASYMMETRIC]: '#16a085',
    [NODE_TYPES.IMPEDANCE]: '#8e44ad',
    [NODE_TYPES.WARD]: '#2980b9',
    [NODE_TYPES.EXTENDED_WARD]: '#34495e',
    [NODE_TYPES.MOTOR]: '#d35400',
    [NODE_TYPES.STORAGE]: '#c0392b',
    [NODE_TYPES.SVC]: '#f1c40f',
    [NODE_TYPES.TCSC]: '#d4ac0d',
    [NODE_TYPES.SSC]: '#b7950b',
    [NODE_TYPES.DC_LINE]: '#1a5276',
    [NODE_TYPES.DC_BUS]: '#2471a3',
    [NODE_TYPES.LOAD_DC]: '#148f77',
    [NODE_TYPES.SWITCH]: '#5d6d7e',
    [NODE_TYPES.VSC]: '#a569bd',
    [NODE_TYPES.B2B_VSC]: '#7d3c98',
    [NODE_TYPES.PVSYSTEM]: '#f4d03f'
};

/** Display names matching the Electrisim palette */
const NODE_DISPLAY_NAMES = {
    [NODE_TYPES.WIND_TURBINE]: 'Generator',
    [NODE_TYPES.OFFSHORE_SUBSTATION]: 'Transformer',
    [NODE_TYPES.ONSHORE_GRID]: 'External Grid',
    [NODE_TYPES.BUS]: 'Bus',
    [NODE_TYPES.STATIC_GENERATOR]: 'Static Gen',
    [NODE_TYPES.SOURCE_DC]: 'Source DC',
    [NODE_TYPES.TRANSFORMER_3W]: '3W Transformer',
    [NODE_TYPES.SHUNT_REACTOR]: 'Shunt Reactor',
    [NODE_TYPES.CAPACITOR]: 'Capacitor',
    [NODE_TYPES.GROUND]: 'Ground',
    [NODE_TYPES.LOAD]: 'Load',
    [NODE_TYPES.LOAD_ASYMMETRIC]: 'A.Load',
    [NODE_TYPES.IMPEDANCE]: 'Impedance',
    [NODE_TYPES.WARD]: 'Ward',
    [NODE_TYPES.EXTENDED_WARD]: 'Ex.Ward',
    [NODE_TYPES.MOTOR]: 'Motor',
    [NODE_TYPES.STORAGE]: 'Storage',
    [NODE_TYPES.SVC]: 'SVC',
    [NODE_TYPES.TCSC]: 'TCSC',
    [NODE_TYPES.SSC]: 'SSC',
    [NODE_TYPES.DC_LINE]: 'DC Line',
    [NODE_TYPES.DC_BUS]: 'DC Bus',
    [NODE_TYPES.LOAD_DC]: 'Load DC',
    [NODE_TYPES.SWITCH]: 'Switch',
    [NODE_TYPES.VSC]: 'VSC',
    [NODE_TYPES.B2B_VSC]: 'B2B VSC',
    [NODE_TYPES.PVSYSTEM]: 'PVSystem'
};

export class MapEditor {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.options = {
            defaultCenter: options.defaultCenter || [54.5, 8.0], // North Sea default
            defaultZoom: options.defaultZoom || 8,
            ...options
        };
        this.map = null;
        this.nodes = new Map(); // id -> { id, type, lat, lng, name, vn_kv, p_mw, ... }
        this.cables = new Map(); // id -> { id, from, to, coords, length_km, voltage_kv, r_ohm_per_km, x_ohm_per_km }
        this.markers = new Map(); // id -> L.Marker
        this.polylines = new Map(); // id -> L.Polyline
        this.measureControl = null;
        this.mode = 'select'; // 'select' | 'add_node' | 'draw_cable'
        this.cableDrawFrom = null;
        this.cableDrawPoints = [];
        this.tempLine = null;
        this.tempLinePreview = null;
        this.selectedNodes = new Set();
        this.selectedCables = new Set();
        this._listeners = { change: [], cableDrawStart: [], cableDrawEnd: [], cableDrawUpdate: [], selectionChange: [] };
    }

    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            throw new Error(`Map container #${this.containerId} not found`);
        }

        this.map = L.map(this.containerId).setView(
            this.options.defaultCenter,
            this.options.defaultZoom
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(this.map);

        // Measure control for distance
        this.measureControl = L.control.polylineMeasure({
            unit: 'kilometres',
            measureControlTitleOn: 'Turn off measuring',
            measureControlTitleOff: 'Turn on measuring',
            measureControlLabel: 'km',
            showBearings: false,
            clearMeasurementsOnStop: false
        }).addTo(this.map);

        this._setupClickHandler();
        this._setupMouseMoveHandler();
        return this;
    }

    _setupClickHandler() {
        this.map.on('click', (e) => {
            if (this.mode === 'add_node') {
                this._addNodeAt(e.latlng);
            } else if (this.mode === 'draw_cable') {
                const node = this._getNodeAt(e.latlng);
                if (node) {
                    if (!this.cableDrawFrom) {
                        this.cableDrawFrom = node.id;
                        this.cableDrawPoints = [];
                        if (this._listeners.cableDrawStart) this._listeners.cableDrawStart.forEach(f => f(node));
                    } else if (this.cableDrawFrom === node.id) {
                        this._cancelCableDraw();
                    } else {
                        const from = this.nodes.get(this.cableDrawFrom);
                        const coords = [
                            [from.lat, from.lng],
                            ...this.cableDrawPoints,
                            [node.lat, node.lng]
                        ];
                        this._finishCableDraw(this.cableDrawFrom, node, coords);
                        if (this._listeners.cableDrawEnd) this._listeners.cableDrawEnd.forEach(f => f());
                    }
                } else {
                    if (this.cableDrawFrom) {
                        this.cableDrawPoints.push([e.latlng.lat, e.latlng.lng]);
                        this._updateTempLine();
                    }
                }
            } else if (this.mode === 'select') {
                this._clearSelection();
            }
        });
    }

    _setupMouseMoveHandler() {
        this.map.on('mousemove', (e) => {
            if (this.mode === 'draw_cable' && this.cableDrawFrom) {
                this._updateTempLine(e.latlng);
            }
        });
    }

    _getTempLineCoords(mouseLatLng = null) {
        const from = this.nodes.get(this.cableDrawFrom);
        if (!from) return [];
        const pts = [[from.lat, from.lng], ...this.cableDrawPoints];
        if (mouseLatLng) pts.push([mouseLatLng.lat, mouseLatLng.lng]);
        return pts;
    }

    _updateTempLine(mouseLatLng = null) {
        const pts = this._getTempLineCoords(mouseLatLng);
        if (pts.length < 2) return;
        if (this.tempLine) {
            this.tempLine.setLatLngs(pts);
        } else {
            this.tempLine = L.polyline(pts, {
                color: '#e74c3c',
                weight: 3,
                opacity: 0.8,
                dashArray: '5, 10'
            }).addTo(this.map);
        }
        const lengthKm = polylineLengthKm(pts);
        this._listeners.cableDrawUpdate.forEach(f => f(lengthKm));
    }

    _cancelCableDraw() {
        this.cableDrawFrom = null;
        this.cableDrawPoints = [];
        if (this.tempLine) {
            this.map.removeLayer(this.tempLine);
            this.tempLine = null;
        }
    }

    cancelCableDraw() {
        if (this.mode === 'draw_cable' && this.cableDrawFrom) {
            this._cancelCableDraw();
            return true;
        }
        return false;
    }

    _clearSelection() {
        this.selectedNodes.clear();
        this.selectedCables.clear();
        this._updateSelectionStyle();
        (this._listeners.selectionChange || []).forEach(f => f());
    }

    _selectNode(nodeId, addToSelection = false) {
        if (addToSelection) {
            if (this.selectedNodes.has(nodeId)) this.selectedNodes.delete(nodeId);
            else this.selectedNodes.add(nodeId);
        } else {
            this.selectedNodes.clear();
            this.selectedNodes.add(nodeId);
            this.selectedCables.clear();
        }
        this._updateSelectionStyle();
    }

    _selectCable(cableId, addToSelection = false) {
        if (addToSelection) {
            if (this.selectedCables.has(cableId)) this.selectedCables.delete(cableId);
            else this.selectedCables.add(cableId);
        } else {
            this.selectedCables.clear();
            this.selectedCables.add(cableId);
            this.selectedNodes.clear();
        }
        this._updateSelectionStyle();
        (this._listeners.selectionChange || []).forEach(f => f());
    }

    _updateSelectionStyle() {
        const selColor = '#ff9800';
        const selWeight = 6;
        for (const [id, marker] of this.markers) {
            const node = this.nodes.get(id);
            if (!node) continue;
            const color = this.selectedNodes.has(id) ? selColor : (NODE_COLORS[node.type] || '#3388ff');
            const border = this.selectedNodes.has(id) ? '3px solid #333' : '2px solid #fff';
            marker.setIcon(L.divIcon({
                className: 'map-node-marker',
                html: `<div style="
                    width:28px;height:28px;border-radius:50%;
                    background:${color};border:${border};box-shadow:0 2px 5px rgba(0,0,0,0.3);
                    display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;
                ">${NODE_ICONS[node.type] || '▣'}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }));
        }
        for (const [id, polyline] of this.polylines) {
            if (this.selectedCables.has(id)) {
                polyline.setStyle({ color: selColor, weight: selWeight, opacity: 1 });
            } else {
                polyline.setStyle({ color: '#e74c3c', weight: 4, opacity: 0.8 });
            }
        }
    }

    deleteSelected() {
        const nodesToRemove = [...this.selectedNodes];
        const cablesToRemove = [...this.selectedCables];
        this.selectedNodes.clear();
        this.selectedCables.clear();
        cablesToRemove.forEach(id => this.removeCable(id));
        nodesToRemove.forEach(id => this.removeNode(id));
        this._updateSelectionStyle();
    }

    _getNodeAt(latlng, toleranceKm = 0.3) {
        let closest = null;
        let minDist = toleranceKm;
        for (const [, node] of this.nodes) {
            const d = haversineDistanceKm(latlng.lat, latlng.lng, node.lat, node.lng);
            if (d < minDist) {
                minDist = d;
                closest = node;
            }
        }
        return closest;
    }

    _addNodeAt(latlng) {
        const id = generateMapId('node', this.nodes.keys());
        const node = {
            id,
            type: this.options.defaultNodeType || NODE_TYPES.BUS,
            lat: latlng.lat,
            lng: latlng.lng,
            name: id,
            vn_kv: this.options.defaultNodeType === NODE_TYPES.WIND_TURBINE ? 66 : 110,
            p_mw: this.options.defaultNodeType === NODE_TYPES.WIND_TURBINE ? 15 : 0
        };
        this.addNode(node);
        this._notifyChange();
    }

    addNode(node) {
        const { id, lat, lng, type, name, vn_kv, p_mw } = node;
        const n = {
            id: id || generateMapId('node', this.nodes.keys()),
            type: type || NODE_TYPES.BUS,
            lat, lng,
            name: name || id,
            vn_kv: vn_kv || 110,
            p_mw: p_mw || 0,
            ...node
        };
        this.nodes.set(n.id, n);

        const color = NODE_COLORS[n.type] || '#3388ff';
        const icon = L.divIcon({
            className: 'map-node-marker',
            html: `<div style="
                width:28px;height:28px;border-radius:50%;
                background:${color};border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.3);
                display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff;
            ">${NODE_ICONS[n.type] || '▣'}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
        const marker = L.marker([n.lat, n.lng], { icon, draggable: true })
            .addTo(this.map)
            .bindPopup(`<b>${n.name}</b><br>${NODE_DISPLAY_NAMES[n.type] || n.type}<br>${n.vn_kv} kV${n.p_mw ? `<br>${n.p_mw} MW` : ''}`);
        marker.on('click', (e) => {
            if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            if (this.mode === 'draw_cable') {
                if (!this.cableDrawFrom) {
                    this.cableDrawFrom = n.id;
                    this.cableDrawPoints = [];
                    if (this._listeners.cableDrawStart) this._listeners.cableDrawStart.forEach(f => f(n));
                } else if (this.cableDrawFrom === n.id) {
                    this._cancelCableDraw();
                    if (this._listeners.cableDrawEnd) this._listeners.cableDrawEnd.forEach(f => f());
                } else {
                    const from = this.nodes.get(this.cableDrawFrom);
                    const coords = [
                        [from.lat, from.lng],
                        ...this.cableDrawPoints,
                        [n.lat, n.lng]
                    ];
                    this._finishCableDraw(this.cableDrawFrom, n, coords);
                    if (this._listeners.cableDrawEnd) this._listeners.cableDrawEnd.forEach(f => f());
                }
            } else if (this.mode === 'select') {
                const addTo = !!(e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.shiftKey || e.originalEvent.metaKey));
                this._selectNode(n.id, addTo);
            }
        });
        marker.on('dragend', () => {
            const pos = marker.getLatLng();
            n.lat = pos.lat;
            n.lng = pos.lng;
            this._updateCablesForNode(n.id);
            this._notifyChange();
        });
        this.markers.set(n.id, marker);
        return n.id;
    }

    _updateCablesForNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return;
        for (const [, cable] of this.cables) {
            if (cable.from === nodeId || cable.to === nodeId) {
                const fromNode = this.nodes.get(cable.from);
                const toNode = this.nodes.get(cable.to);
                if (fromNode && toNode) {
                    cable.coords = [[fromNode.lat, fromNode.lng], [toNode.lat, toNode.lng]];
                    cable.length_km = haversineDistanceKm(fromNode.lat, fromNode.lng, toNode.lat, toNode.lng);
                    const pl = this.polylines.get(cable.id);
                    if (pl) pl.setLatLngs(cable.coords);
                }
            }
        }
    }

    removeNode(nodeId) {
        this.markers.get(nodeId)?.remove();
        this.markers.delete(nodeId);
        const toRemove = [];
        for (const [cableId, cable] of this.cables) {
            if (cable.from === nodeId || cable.to === nodeId) toRemove.push(cableId);
        }
        toRemove.forEach(id => this.removeCable(id));
        this.nodes.delete(nodeId);
        this._notifyChange();
    }

    addCable(fromNodeId, toNodeId, coords = null) {
        const from = this.nodes.get(fromNodeId);
        const to = this.nodes.get(toNodeId);
        if (!from || !to) return null;

        const pts = coords || [[from.lat, from.lng], [to.lat, to.lng]];
        const length_km = polylineLengthKm(pts);
        const id = generateMapId('cable', this.cables.keys());

        const cable = {
            id,
            from: fromNodeId,
            to: toNodeId,
            coords: pts,
            length_km,
            voltage_kv: Math.min(from.vn_kv || 110, to.vn_kv || 110),
            r_ohm_per_km: 0.122,
            x_ohm_per_km: 0.112,
            max_i_ka: 0.5
        };
        this.cables.set(id, cable);

        const polyline = L.polyline(pts, {
            color: '#e74c3c',
            weight: 4,
            opacity: 0.8
        }).addTo(this.map).bindPopup(`<b>${id}</b><br>${length_km.toFixed(2)} km`);
        polyline.on('click', (e) => {
            if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            if (this.mode === 'select') {
                const addTo = !!(e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.shiftKey || e.originalEvent.metaKey));
                this._selectCable(id, addTo);
            }
        });
        this.polylines.set(id, polyline);
        this._notifyChange();
        return id;
    }

    _finishCableDraw(fromId, toNode, coords) {
        if (fromId === toNode.id) return;
        this.addCable(fromId, toNode.id, coords);
        this._cancelCableDraw();
        this.setMode('select');
    }

    removeCable(cableId) {
        this.polylines.get(cableId)?.remove();
        this.polylines.delete(cableId);
        this.cables.delete(cableId);
        this._notifyChange();
    }

    setMode(mode) {
        this.mode = mode;
        this._cancelCableDraw();
        if (mode !== 'select') this._clearSelection();
    }

    startCableFrom(nodeId) {
        this.mode = 'draw_cable';
        this.cableDrawFrom = nodeId;
    }

    getData() {
        return {
            nodes: Array.from(this.nodes.values()),
            cables: Array.from(this.cables.values())
        };
    }

    loadData(data) {
        this.clear();
        (data.nodes || []).forEach(n => this.addNode(n));
        (data.cables || []).forEach(c => this._addCableFromData(c));
    }

    _addCableFromData(c) {
        const from = this.nodes.get(c.from);
        const to = this.nodes.get(c.to);
        if (!from || !to) return null;
        const pts = c.coords || [[from.lat, from.lng], [to.lat, to.lng]];
        const length_km = c.length_km ?? polylineLengthKm(pts);
        const id = c.id || generateMapId('cable', this.cables.keys());
        const cable = {
            id,
            from: c.from,
            to: c.to,
            coords: pts,
            length_km,
            voltage_kv: c.voltage_kv ?? Math.min(from.vn_kv || 110, to.vn_kv || 110),
            r_ohm_per_km: c.r_ohm_per_km ?? 0.122,
            x_ohm_per_km: c.x_ohm_per_km ?? 0.112,
            max_i_ka: c.max_i_ka ?? 0.5
        };
        this.cables.set(id, cable);
        const polyline = L.polyline(pts, {
            color: '#e74c3c',
            weight: 4,
            opacity: 0.8
        }).addTo(this.map).bindPopup(`<b>${id}</b><br>${length_km.toFixed(2)} km`);
        polyline.on('click', (e) => {
            if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            if (this.mode === 'select') {
                const addTo = !!(e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.shiftKey || e.originalEvent.metaKey));
                this._selectCable(id, addTo);
            }
        });
        this.polylines.set(id, polyline);
        this._notifyChange();
        return id;
    }

    clear() {
        for (const m of this.markers.values()) m.remove();
        for (const p of this.polylines.values()) p.remove();
        this.markers.clear();
        this.polylines.clear();
        this.nodes.clear();
        this.cables.clear();
        this._notifyChange();
    }

    setDefaultNodeType(type) {
        this.options.defaultNodeType = type;
    }

    on(event, fn) {
        if (this._listeners[event]) this._listeners[event].push(fn);
    }

    _notifyChange() {
        this._listeners.change.forEach(fn => fn(this.getData()));
    }

    destroy() {
        this.clear();
        if (this.measureControl) this.map.removeControl(this.measureControl);
        this.map.remove();
        this.map = null;
    }
}
