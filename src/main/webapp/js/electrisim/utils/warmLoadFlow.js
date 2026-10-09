const PQ_FIELDS = ['p_mw', 'q_mvar', 'scaling'];
const PARAM_SKIP = new Set([
    'initialization',
    'calculate_voltage_angles',
    'user_email',
    'exportPython',
    'exportPandapowerResults',
    'exportPdfReport',
    'animatePowerFlow',
    'colourDiagram',
    'topology_key',
    'warm_solve'
]);
const ZIP_FIELDS = [
    'const_z_percent',
    'const_i_percent',
    'const_z_p_percent',
    'const_z_q_percent',
    'const_i_p_percent',
    'const_i_q_percent'
];
const WARM_MIN_BUSES = 150;

let warmState = null;

function payloadKeys(payload) {
    return Object.keys(payload).sort((a, b) => {
        const na = Number(a);
        const nb = Number(b);
        const aNumeric = Number.isFinite(na) && String(na) === a;
        const bNumeric = Number.isFinite(nb) && String(nb) === b;
        if (aNumeric && bNumeric) {
            return na - nb;
        }
        if (a < b) return -1;
        if (a > b) return 1;
        return 0;
    });
}

function stable(value) {
    if (value === undefined) return 'null';
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
    const keys = Object.keys(value).sort();
    let text = '{';
    for (let i = 0; i < keys.length; i++) {
        if (i) text += ',';
        text += JSON.stringify(keys[i]) + ':' + stable(value[keys[i]]);
    }
    return text + '}';
}

function setpointFields(typ) {
    const name = String(typ || '');
    if (name.startsWith('External Grid')) return ['vm_pu', 'va_degree'];
    if (name.startsWith('Generator')) return ['p_mw', 'vm_pu', 'scaling'];
    if (name.startsWith('Shunt Reactor') || name.startsWith('Capacitor')) return ['p_mw', 'q_mvar'];
    if (name.startsWith('Load') || name.startsWith('Asymmetric Load') || name.startsWith('Static Generator')
        || name.startsWith('Asymmetric Static Generator') || name.startsWith('Storage') || name.startsWith('Wind Turbine')) {
        return PQ_FIELDS;
    }
    return null;
}

function isSetpointElement(typ) {
    return setpointFields(typ) != null;
}

function isControllerElement(element) {
    const name = String(element && element.typ || '');
    return name.indexOf('Controller') >= 0;
}

function skippedFields(element) {
    const typ = String(element && element.typ || '');
    if (typ.indexOf('PowerFlowPandaPower') >= 0) return PARAM_SKIP;
    const fields = setpointFields(typ);
    if (fields) return new Set(fields);
    return null;
}

function fingerprint(payload) {
    const keys = payloadKeys(payload);
    let text = '';
    for (let i = 0; i < keys.length; i++) {
        const element = payload[keys[i]];
        if (!element || typeof element !== 'object') continue;
        const skip = skippedFields(element);
        const fields = Object.keys(element).sort();
        text += keys[i] + '\n';
        for (let f = 0; f < fields.length; f++) {
            if (skip && skip.has(fields[f])) continue;
            text += fields[f] + '=' + stable(element[fields[f]]) + '\n';
        }
    }
    return text;
}

async function topologyKey(payload) {
    const text = fingerprint(payload);
    if (globalThis.crypto && crypto.subtle && typeof TextEncoder === 'function') {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
        return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

function flag(value) {
    return value === true || value === 1 || value === 'true' || value === '1';
}

function inService(element) {
    const value = element && element.in_service;
    return !(value === false || value === 'false' || value === 0 || value === '0');
}

function hasZip(element) {
    for (let i = 0; i < ZIP_FIELDS.length; i++) {
        const value = Number(element[ZIP_FIELDS[i]]);
        if (Number.isFinite(value) && Math.abs(value) > 1e-9) return true;
    }
    return false;
}

function blocksWarm(element) {
    const typ = String(element && element.typ || '');
    if (typ.indexOf('SVC') >= 0 || typ.indexOf('SSC') >= 0 || typ.indexOf('TCSC') >= 0) return true;
    if (typ.indexOf('VSC') >= 0 || typ.startsWith('DC')) return true;
    if ((typ.startsWith('Shunt') || typ.startsWith('Capacitor')) && flag(element.controllable)) return true;
    return hasZip(element);
}

function warmSkipReason(payload, params) {
    if (!params) return 'the study parameters are missing';
    if (String(params.algorithm) !== 'nr') return 'the algorithm is not Newton-Raphson';
    if (flag(params.exportPython) || flag(params.exportPandapowerResults)) return 'a Python or results export is selected';
    let buses = 0;
    let slacks = 0;
    const keys = Object.keys(payload);
    for (let i = 0; i < keys.length; i++) {
        const element = payload[keys[i]];
        if (!element || typeof element !== 'object') continue;
        const typ = String(element.typ || '');
        if (blocksWarm(element)) return 'element ' + typ + ' cannot reuse a saved model';
        if (typ.startsWith('Bus') && !typ.startsWith('DC')) buses += 1;
        if (!inService(element)) continue;
        if (typ.startsWith('External Grid')) slacks += 1;
        else if (typ.startsWith('Generator') && flag(element.slack)) slacks += 1;
    }
    if (buses <= WARM_MIN_BUSES) return 'the diagram has ' + buses + ' buses';
    if (slacks !== 1) return 'the diagram has ' + slacks + ' slack elements';
    return '';
}

function warmEligible(payload, params) {
    return warmSkipReason(payload, params) === '';
}

export function setpointSnapshot(payload) {
    const byId = {};
    const keys = Object.keys(payload);
    for (let i = 0; i < keys.length; i++) {
        const element = payload[keys[i]];
        if (!element || typeof element !== 'object' || !isSetpointElement(element.typ)) continue;
        if (element.id == null || element.id === '') continue;
        const snap = {};
        const fields = setpointFields(element.typ);
        for (let f = 0; f < fields.length; f++) {
            const field = fields[f];
            if (Object.prototype.hasOwnProperty.call(element, field)) snap[field] = element[field];
        }
        byId[String(element.id)] = snap;
    }
    return byId;
}

export function stampTopologyKey(payload, key) {
    const body = Object.assign({}, payload);
    const params = body[0] != null ? body[0] : body['0'];
    if (params && typeof params === 'object') {
        const stamped = Object.assign({}, params, { topology_key: key });
        delete stamped.warm_solve;
        if (body[0] != null) body[0] = stamped;
        else body['0'] = stamped;
    }
    return body;
}

export function clearWarmLoadFlow() {
    warmState = null;
}

export async function prepareWarmLoadFlow(payload) {
    const key = await topologyKey(payload);
    const params = payload[0] != null ? payload[0] : payload['0'];
    const skip = warmSkipReason(payload, params);
    if (skip || !warmState || warmState.key !== key || !warmState.byId) {
        const reason = skip || (!warmState
            ? 'this is the first solve, so the model is being saved for the next Calculate'
            : 'the diagram changed, so the model is being built again');
        return { key: key, warm: false, reason: reason, body: stampTopologyKey(payload, key) };
    }
    const now = setpointSnapshot(payload);
    const body = {};
    body[0] = Object.assign({}, params, { topology_key: key, warm_solve: true });
    let next = 1;
    const keys = Object.keys(payload);
    for (let i = 0; i < keys.length; i++) {
        const element = payload[keys[i]];
        if (!element || typeof element !== 'object') continue;
        if (String(element.typ || '').indexOf('PowerFlowPandaPower') >= 0) continue;
        if (isControllerElement(element)) {
            body[next++] = element;
            continue;
        }
        if (!isSetpointElement(element.typ)) continue;
        if (element.id == null || element.id === '') {
            return { key: key, warm: false, reason: 'a setpoint element has no id', body: stampTopologyKey(payload, key) };
        }
        const current = now[String(element.id)] || {};
        const previous = warmState.byId[String(element.id)];
        if (JSON.stringify(previous || null) === JSON.stringify(current)) continue;
        const update = { id: element.id, name: element.name, typ: element.typ };
        const fields = setpointFields(element.typ);
        for (let f = 0; f < fields.length; f++) {
            const field = fields[f];
            if (Object.prototype.hasOwnProperty.call(element, field)) update[field] = element[field];
        }
        body[next++] = update;
    }
    return { key: key, warm: true, reason: '', body: body };
}

export function noteWarmLoadFlowResult(payload, response) {
    if (!response || response.error || response.warm_miss || !response.topology_key) return;
    warmState = { key: response.topology_key, byId: setpointSnapshot(payload) };
}
