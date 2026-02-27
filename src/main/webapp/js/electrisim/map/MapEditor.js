/**
 * MapEditor - Embedded map for placing nodes and drawing cables with automatic distance calculation
 * Uses Leaflet with OpenStreetMap
 */

import { haversineDistanceKm, polylineLengthKm, generateMapId, placeTurbinesInPolygon, computeOffshoreCableRouting } from './mapUtils.js';

const MIN_SUBSTATION_DISTANCE_KM = 0.3;

export const NODE_TYPES = {
    // Sources (backward compatible)
    WIND_TURBINE: 'wind_turbine',
    /** Offshore wind turbine: expands to Static Gen + LV Bus (0.69 kV) + Transformer (0.69/66 kV) + HV Bus (66 kV) */
    OFFSHORE_WIND_TURBINE: 'offshore_wind_turbine',
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
    [NODE_TYPES.OFFSHORE_WIND_TURBINE]: '🌀',
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
    [NODE_TYPES.OFFSHORE_WIND_TURBINE]: '#1e88e5',
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
    [NODE_TYPES.OFFSHORE_WIND_TURBINE]: 'Wind Turbine',
    [NODE_TYPES.OFFSHORE_SUBSTATION]: 'Offshore Substation',
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
        this.areas = new Map(); // id -> { id, coords, turbineCount, minDistanceKm }
        this.markers = new Map(); // id -> L.Marker
        this.polylines = new Map(); // id -> L.Polyline
        this.areaPolygons = new Map(); // id -> L.Polygon
        this.measureControl = null;
        this.mode = 'select'; // 'select' | 'add_node' | 'draw_cable' | 'draw_area'
        this.cableDrawFrom = null;
        this.cableDrawPoints = [];
        this.tempLine = null;
        this.tempLinePreview = null;
        this.areaDrawPoints = [];
        this.tempAreaPoly = null;
        this.tempAreaFirstMarker = null;
        this.selectedNodes = new Set();
        this.selectedCables = new Set();
        this.selectedAreas = new Set();
        this.arrayCableIds = new Set();
        this._listeners = { change: [], cableDrawStart: [], cableDrawEnd: [], cableDrawUpdate: [], selectionChange: [], areaDrawn: [], nodeAdded: [] };
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
            } else if (this.mode === 'draw_area') {
                this._handleAreaDrawClick(e.latlng);
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

    _handleAreaDrawClick(latlng) {
        const pts = this.areaDrawPoints;
        if (pts.length >= 3) {
            const first = pts[0];
            const d = haversineDistanceKm(latlng.lat, latlng.lng, first[0], first[1]);
            if (d < 0.08) {
                this._finishAreaDraw();
                return;
            }
        }
        pts.push([latlng.lat, latlng.lng]);
        this._updateTempAreaPoly();
    }

    _updateTempAreaPoly() {
        const pts = this.areaDrawPoints;
        if (pts.length >= 1) {
            const first = pts[0];
            if (!this.tempAreaFirstMarker) {
                this.tempAreaFirstMarker = L.circleMarker([first[0], first[1]], {
                    radius: 14,
                    fillColor: '#4caf50',
                    color: '#2e7d32',
                    weight: 3,
                    fillOpacity: 0.9
                }).addTo(this.map).bindTooltip('Click here to close area', {
                    permanent: true,
                    direction: 'top',
                    className: 'area-first-point-tooltip'
                });
            } else {
                this.tempAreaFirstMarker.setLatLng([first[0], first[1]]);
            }
        }
        if (pts.length < 2) return;
        if (this.tempAreaPoly) {
            this.tempAreaPoly.setLatLngs(pts);
        } else {
            this.tempAreaPoly = L.polygon(pts, {
                color: '#1e88e5',
                fillColor: '#1e88e5',
                fillOpacity: 0.2,
                weight: 3,
                dashArray: '5, 10'
            }).addTo(this.map);
        }
    }

    _cancelAreaDraw() {
        this.areaDrawPoints = [];
        if (this.tempAreaFirstMarker) {
            this.map.removeLayer(this.tempAreaFirstMarker);
            this.tempAreaFirstMarker = null;
        }
        if (this.tempAreaPoly) {
            this.map.removeLayer(this.tempAreaPoly);
            this.tempAreaPoly = null;
        }
    }

    _finishAreaDraw() {
        const pts = this.areaDrawPoints;
        if (pts.length < 3) {
            this._cancelAreaDraw();
            return;
        }
        const id = generateMapId('area', this.areas.keys());
        this.addArea({ id, coords: [...pts], turbineCount: 0, minDistanceKm: 1 });
        this._cancelAreaDraw();
        this.setMode('select');
        this._listeners.areaDrawn.forEach(f => f(this.areas.get(id)));
    }

    addArea(area) {
        const { id, coords } = area;
        const a = {
            id: id || generateMapId('area', this.areas.keys()),
            coords: coords || [],
            turbineCount: area.turbineCount ?? 0,
            minDistanceKm: area.minDistanceKm ?? 1,
            ...area
        };
        this.areas.set(a.id, a);
        const poly = L.polygon(a.coords, {
            color: '#1e88e5',
            fillColor: '#1e88e5',
            fillOpacity: 0.15,
            weight: 2
        }).addTo(this.map).bindPopup(`<b>${a.id}</b><br>Wind farm area<br>Click to configure turbines`);
        poly.on('click', (e) => {
            if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
            if (this.mode === 'add_node') {
                this._addNodeAt(e.latlng);
                return;
            }
            if (this.mode === 'select') {
                const addTo = !!(e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.shiftKey || e.originalEvent.metaKey));
                if (addTo) {
                    if (this.selectedAreas.has(a.id)) this.selectedAreas.delete(a.id);
                    else this.selectedAreas.add(a.id);
                } else {
                    this.selectedAreas.clear();
                    this.selectedAreas.add(a.id);
                    this.selectedNodes.clear();
                    this.selectedCables.clear();
                }
                this._updateAreaSelectionStyle();
                this._listeners.selectionChange.forEach(f => f());
            }
        });
        this.areaPolygons.set(a.id, poly);
        this._notifyChange();
        return a.id;
    }

    removeArea(areaId) {
        this.areaPolygons.get(areaId)?.remove();
        this.areaPolygons.delete(areaId);
        this.areas.delete(areaId);
        this.selectedAreas.delete(areaId);
        this._notifyChange();
    }

    _updateAreaSelectionStyle() {
        for (const [id, poly] of this.areaPolygons) {
            const area = this.areas.get(id);
            if (!area) continue;
            const selected = this.selectedAreas.has(id);
            poly.setStyle({
                color: selected ? '#ff9800' : '#1e88e5',
                fillColor: selected ? '#ff9800' : '#1e88e5',
                fillOpacity: selected ? 0.3 : 0.15,
                weight: selected ? 4 : 2
            });
        }
    }

    placeTurbinesInArea(areaId, count, minDistKm = 1) {
        const area = this.areas.get(areaId);
        if (!area) return [];
        const positions = placeTurbinesInPolygon(area.coords, count, minDistKm);
        const nodeType = this.options.defaultNodeType || NODE_TYPES.OFFSHORE_WIND_TURBINE;
        const added = [];
        for (const pos of positions) {
            const node = {
                lat: pos.lat,
                lng: pos.lng,
                type: nodeType,
                name: null,
                vn_kv: 66,
                p_mw: 15
            };
            const nid = this.addNode(node);
            added.push(nid);
        }
        area.turbineCount = count;
        area.minDistanceKm = minDistKm;
        this._notifyChange();
        return added;
    }

    cancelCableDraw() {
        if (this.mode === 'draw_cable' && this.cableDrawFrom) {
            this._cancelCableDraw();
            return true;
        }
        return false;
    }

    cancelAreaDraw() {
        if (this.mode === 'draw_area' && this.areaDrawPoints.length > 0) {
            this._cancelAreaDraw();
            return true;
        }
        return false;
    }

    _clearSelection() {
        this.selectedNodes.clear();
        this.selectedCables.clear();
        this.selectedAreas.clear();
        this._updateSelectionStyle();
        this._updateAreaSelectionStyle();
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
        const areasToRemove = [...this.selectedAreas];
        this.selectedNodes.clear();
        this.selectedCables.clear();
        this.selectedAreas.clear();
        cablesToRemove.forEach(id => this.removeCable(id));
        nodesToRemove.forEach(id => this.removeNode(id));
        areasToRemove.forEach(id => this.removeArea(id));
        this._updateSelectionStyle();
        this._updateAreaSelectionStyle();
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
        const nodeType = this.options.defaultNodeType || NODE_TYPES.BUS;
        if (nodeType === NODE_TYPES.OFFSHORE_SUBSTATION) {
            for (const n of this.nodes.values()) {
                if (n.type === NODE_TYPES.OFFSHORE_WIND_TURBINE) {
                    const d = haversineDistanceKm(latlng.lat, latlng.lng, n.lat, n.lng);
                    if (d < MIN_SUBSTATION_DISTANCE_KM) {
                        alert(`Please place the offshore substation at least ${MIN_SUBSTATION_DISTANCE_KM} km away from wind turbines.`);
                        return;
                    }
                }
            }
        }
        const id = generateMapId('node', this.nodes.keys());
        const node = {
            id,
            type: nodeType,
            lat: latlng.lat,
            lng: latlng.lng,
            name: id,
            vn_kv: nodeType === NODE_TYPES.WIND_TURBINE ? 66 : 110,
            p_mw: nodeType === NODE_TYPES.WIND_TURBINE ? 15 : 0
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
        this._listeners.nodeAdded.forEach(f => f(n));
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

    addCable(fromNodeId, toNodeId, coords = null, opts = {}) {
        const from = this.nodes.get(fromNodeId);
        const to = this.nodes.get(toNodeId);
        if (!from || !to) return null;

        const pts = coords || [[from.lat, from.lng], [to.lat, to.lng]];
        const length_km = polylineLengthKm(pts);
        const id = opts.id || generateMapId('cable', this.cables.keys());
        const voltage_kv = opts.voltage_kv ?? Math.min(from.vn_kv || 110, to.vn_kv || 110);

        const cable = {
            id,
            from: fromNodeId,
            to: toNodeId,
            coords: pts,
            length_km,
            voltage_kv,
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
        if (opts.isArrayCable) this.arrayCableIds.add(id);
        this._notifyChange();
        return id;
    }

    runAutoCableRouting() {
        this.arrayCableIds.forEach(id => this.removeCable(id));
        this.arrayCableIds.clear();
        const nodes = Array.from(this.nodes.values());
        const cablesToAdd = computeOffshoreCableRouting(nodes, 5);
        const existingIds = new Set(this.cables.keys());
        for (let i = 0; i < cablesToAdd.length; i++) {
            const c = cablesToAdd[i];
            let cableId = `array_${c.from}_${c.to}`;
            if (existingIds.has(cableId)) cableId = generateMapId('array', existingIds);
            existingIds.add(cableId);
            this.addCable(c.from, c.to, c.coords, { id: cableId, voltage_kv: 66, isArrayCable: true });
        }
        this._listeners.change.forEach(f => f(this.getData()));
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
        this._cancelAreaDraw();
        if (mode !== 'select') this._clearSelection();
    }

    startCableFrom(nodeId) {
        this.mode = 'draw_cable';
        this.cableDrawFrom = nodeId;
    }

    getData() {
        return {
            nodes: Array.from(this.nodes.values()),
            cables: Array.from(this.cables.values()),
            areas: Array.from(this.areas.values())
        };
    }

    loadData(data) {
        this.clear();
        (data.nodes || []).forEach(n => this.addNode(n));
        (data.cables || []).forEach(c => this._addCableFromData(c));
        (data.areas || []).forEach(a => this.addArea(a));
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
        if (id.startsWith('array_')) this.arrayCableIds.add(id);
        this._notifyChange();
        return id;
    }

    clear() {
        for (const m of this.markers.values()) m.remove();
        for (const p of this.polylines.values()) p.remove();
        for (const a of this.areaPolygons.values()) a.remove();
        this.markers.clear();
        this.polylines.clear();
        this.areaPolygons.clear();
        this.nodes.clear();
        this.cables.clear();
        this.areas.clear();
        this.arrayCableIds.clear();
        this.selectedAreas.clear();
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
