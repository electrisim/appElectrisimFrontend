const OVERLAY_ID = 'simulation-progress-overlay';
const LEGACY_OVERLAY_ID = 'rpc-progress-overlay';
const SPIN_STYLE_ID = 'simulation-progress-spin-style';

const COMPACT_LOG = {
    position: 'absolute',
    left: 'auto',
    top: 'auto',
    right: '20px',
    bottom: '20px',
    transform: 'none',
    width: 'min(440px, calc(100vw - 40px))',
    height: 'min(240px, 35vh)',
    maxWidth: 'min(440px, calc(100vw - 40px))',
    maxHeight: 'min(240px, 35vh)'
};

const EXPANDED_LOG = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)',
    width: 'min(80vw, 1100px)',
    height: 'min(70vh, 720px)',
    maxWidth: 'min(80vw, 1100px)',
    maxHeight: 'min(70vh, 720px)'
};

function _removeExistingOverlays() {
    [OVERLAY_ID, LEGACY_OVERLAY_ID].forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
    });
}

function _ensureSpinStyle() {
    if (document.getElementById(SPIN_STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = SPIN_STYLE_ID;
    style.textContent = '@keyframes simulation-progress-spin { to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
}

function _makeActionButton(label, opts = {}) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    const danger = !!opts.danger;
    Object.assign(btn.style, {
        margin: '0',
        padding: opts.compact ? '4px 10px' : '8px 18px',
        border: danger ? 'none' : '1px solid rgba(255,255,255,0.22)',
        borderRadius: '6px',
        background: danger ? '#c92a2a' : 'rgba(255,255,255,0.08)',
        color: '#fff',
        fontSize: opts.compact ? '12px' : '13px',
        fontWeight: '600',
        cursor: 'pointer',
        fontFamily: 'Helvetica, Arial, sans-serif',
        boxShadow: danger ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
        whiteSpace: 'nowrap',
        lineHeight: '1.2'
    });
    if (danger) {
        btn.addEventListener('mouseenter', () => {
            if (!btn.disabled && btn.dataset.mode !== 'close') btn.style.background = '#a61e1e';
        });
        btn.addEventListener('mouseleave', () => {
            if (!btn.disabled && btn.dataset.mode !== 'close') btn.style.background = '#c92a2a';
        });
    } else {
        btn.addEventListener('mouseenter', () => {
            if (!btn.disabled) btn.style.background = 'rgba(255,255,255,0.16)';
        });
        btn.addEventListener('mouseleave', () => {
            if (!btn.disabled) btn.style.background = 'rgba(255,255,255,0.08)';
        });
    }
    btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (typeof opts.onClick === 'function') opts.onClick();
    });
    return btn;
}

function _clock() {
    return new Date().toISOString().slice(11, 19);
}

function _safeSlug(value) {
    const s = String(value || 'simulation').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return s || 'simulation';
}

export function isAbortError(error) {
    if (!error) return false;
    if (error.name === 'AbortError') return true;
    const msg = String(error.message || error).toLowerCase();
    return msg.includes('stopped by user') || msg.includes('the user aborted') || msg.includes('aborterror');
}

export function isNetworkStreamError(error) {
    if (isAbortError(error)) return false;
    const msg = String(error && error.message ? error.message : error).toLowerCase();
    return msg.includes('network error') ||
        msg.includes('failed to fetch') ||
        msg.includes('http2') ||
        msg.includes('protocol error') ||
        msg.includes('stream');
}

export function formatDurationMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 0) return '0 ms';
    if (n < 1000) return `${Math.round(n)} ms`;
    return `${(n / 1000).toFixed(1)} s`;
}

/**
 * Parse an NDJSON body (progress / result / error / cancelled / heartbeat).
 * @returns {Promise<*>} result payload from a `result` event
 */
export async function readNdjsonStream(response, { onProgress } = {}) {
    if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error('Streaming response body is not readable');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let dataJson = null;

    const handleEvt = (evt) => {
        if (!evt || typeof evt !== 'object') return;
        if (evt.type === 'heartbeat') return;
        if (evt.type === 'progress' && typeof evt.message === 'string') {
            if (typeof onProgress === 'function') onProgress(evt.message.trimEnd());
        } else if (evt.type === 'cancelled') {
            const err = new Error(evt.message || 'Stopped by user');
            err.name = 'AbortError';
            throw err;
        } else if (evt.type === 'error') {
            throw new Error(evt.message || 'Unknown stream error');
        } else if (evt.type === 'result' && evt.data) {
            dataJson = evt.data;
        }
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() || '';
        for (const line of parts) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let evt;
            try {
                evt = JSON.parse(trimmed);
            } catch (pe) {
                console.warn('NDJSON stream parse line:', pe);
                continue;
            }
            handleEvt(evt);
        }
    }
    if (buffer.trim()) {
        try {
            handleEvt(JSON.parse(buffer.trim()));
        } catch (e) {
            if (!(e instanceof SyntaxError)) throw e;
        }
    }
    return dataJson;
}

/**
 * Blocking progress overlay: center status card + bottom-right log viewer.
 * @param {{ title?: string, statusText?: string, filePrefix?: string, onStop?: function }} options
 */
export function createSimulationProgressOverlay(options = {}) {
    const titleText = options.title || 'Simulation progress';
    const statusText = options.statusText || 'Running simulation…';
    const filePrefix = _safeSlug(options.filePrefix || 'simulation');
    const onStop = typeof options.onStop === 'function' ? options.onStop : null;

    _removeExistingOverlays();
    _ensureSpinStyle();

    const wrap = document.createElement('div');
    wrap.id = OVERLAY_ID;
    Object.assign(wrap.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2000000001',
        background: 'rgba(0,0,0,0.32)',
        pointerEvents: 'auto'
    });

    const card = document.createElement('div');
    Object.assign(card.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#4B4243',
        color: '#fff',
        fontFamily: 'Helvetica, Arial, sans-serif',
        padding: '16px 20px 14px',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        minWidth: '280px',
        textAlign: 'center'
    });
    const spin = document.createElement('div');
    Object.assign(spin.style, {
        width: '28px',
        height: '28px',
        margin: '0 auto 10px',
        border: '3px solid rgba(255,255,255,0.25)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'simulation-progress-spin 0.8s linear infinite'
    });
    const status = document.createElement('div');
    status.textContent = statusText;
    Object.assign(status.style, { fontSize: '13px', marginBottom: '12px', lineHeight: '1.4' });

    const logBox = document.createElement('div');
    Object.assign(logBox.style, {
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(33, 37, 41, 0.94)',
        color: '#e9ecef',
        fontFamily: 'Consolas, "Courier New", monospace',
        fontSize: '12px',
        padding: '12px 14px',
        borderRadius: '8px',
        boxShadow: '0 6px 28px rgba(0,0,0,0.4)',
        lineHeight: '1.5',
        border: '1px solid rgba(255,255,255,0.12)',
        overflow: 'hidden',
        boxSizing: 'border-box'
    });
    Object.assign(logBox.style, COMPACT_LOG);

    const header = document.createElement('div');
    Object.assign(header.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        marginBottom: '8px',
        flexShrink: '0',
        flexWrap: 'wrap'
    });
    const title = document.createElement('div');
    title.textContent = titleText;
    Object.assign(title.style, {
        fontWeight: '600',
        color: '#adb5bd',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        flex: '1 1 auto',
        minWidth: '80px'
    });
    const actions = document.createElement('div');
    Object.assign(actions.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        flexWrap: 'wrap',
        justifyContent: 'flex-end'
    });

    const pre = document.createElement('pre');
    Object.assign(pre.style, {
        margin: '0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        overflow: 'auto',
        flex: '1',
        minHeight: '0'
    });

    let expanded = false;
    let closed = false;
    let closeResolve = null;
    let finished = false;

    const state = {};

    const finishClose = () => {
        if (closed) return;
        closed = true;
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (closeResolve) closeResolve();
    };

    const applyLogSize = () => {
        Object.assign(logBox.style, expanded ? EXPANDED_LOG : COMPACT_LOG);
        card.style.display = expanded ? 'none' : '';
        enlargeBtn.textContent = expanded ? 'Restore' : 'Enlarge';
    };

    const append = (text, opts = {}) => {
        if (closed) return;
        const raw = text == null ? '' : String(text);
        const line = opts.time ? `[${_clock()}] ${raw}` : raw;
        pre.textContent += line + (line.endsWith('\n') ? '' : '\n');
        pre.scrollTop = pre.scrollHeight;
    };

    const clear = () => {
        pre.textContent = '';
    };

    const download = () => {
        const body = pre.textContent || '';
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const blob = new Blob([body], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `electrisim-${filePrefix}-${stamp}.log`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleStopOrClose = () => {
        if (finished) {
            finishClose();
            return;
        }
        if (onStop) onStop();
    };

    const stopCenter = _makeActionButton('Stop', { danger: true, onClick: handleStopOrClose });
    const stopLog = _makeActionButton('Stop', { danger: true, compact: true, onClick: handleStopOrClose });
    const clearBtn = _makeActionButton('Clear', { compact: true, onClick: () => clear() });
    const enlargeBtn = _makeActionButton('Enlarge', { compact: true, onClick: () => {
        expanded = !expanded;
        applyLogSize();
    } });
    const downloadBtn = _makeActionButton('Download', { compact: true, onClick: () => download() });

    const stopButtons = [stopCenter, stopLog];

    const setStopping = () => {
        if (finished || closed) return;
        status.textContent = 'Stopping…';
        stopButtons.forEach((btn) => {
            btn.disabled = true;
            btn.textContent = 'Stopping…';
            btn.style.background = '#868e96';
            btn.style.cursor = 'default';
            btn.style.border = 'none';
        });
    };

    const setFinished = () => {
        if (closed) return;
        finished = true;
        spin.style.display = 'none';
        stopButtons.forEach((btn) => {
            btn.disabled = false;
            btn.dataset.mode = 'close';
            btn.textContent = 'Close';
            btn.style.background = '#495057';
            btn.style.cursor = 'pointer';
            btn.style.border = 'none';
        });
    };

    card.appendChild(spin);
    card.appendChild(status);
    card.appendChild(stopCenter);
    wrap.appendChild(card);

    actions.appendChild(clearBtn);
    actions.appendChild(enlargeBtn);
    actions.appendChild(downloadBtn);
    actions.appendChild(stopLog);
    header.appendChild(title);
    header.appendChild(actions);
    logBox.appendChild(header);
    logBox.appendChild(pre);
    wrap.appendChild(logBox);
    document.body.appendChild(wrap);

    Object.assign(state, {
        wrap,
        pre,
        status,
        stopButtons,
        append,
        clear,
        download,
        setStatus(text) {
            if (!closed && text != null) status.textContent = String(text);
        },
        setStopping,
        setFinished,
        getText() {
            return pre.textContent || '';
        },
        waitUntilClosed() {
            if (closed) return Promise.resolve();
            return new Promise((resolve) => {
                closeResolve = resolve;
            });
        },
        remove() {
            finishClose();
        }
    });
    return state;
}

/**
 * Create overlay + AbortController wired to Stop.
 */
export function startSimulationProgress(options = {}) {
    try {
        if (typeof window !== 'undefined' && typeof window.clearFaultLocationMarkers === 'function') {
            const app = window.App;
            const graph = options.graph
                || app?._editorUi?.editor?.graph
                || app?.editor?.graph
                || app?.main?.editor?.graph
                || null;
            window.clearFaultLocationMarkers(graph);
        }
    } catch (e) { /* overlay must still open */ }
    const abortController = new AbortController();
    let overlay;
    overlay = createSimulationProgressOverlay({
        ...options,
        onStop: () => {
            if (abortController.signal.aborted) return;
            overlay.setStopping();
            overlay.append('Stop requested…', { time: true });
            abortController.abort();
        }
    });
    return { overlay, abortController, signal: abortController.signal };
}

/**
 * Success: remove overlay. Abort: remove silently. Error: keep until Close.
 * @returns {Promise<{ aborted: boolean, error?: * }>}
 */
export async function settleSimulationProgress(overlay, error, abortController) {
    if (!overlay) {
        return { aborted: !!(error && isAbortError(error)) };
    }
    if (!error) {
        overlay.remove();
        return { aborted: false };
    }
    if (isAbortError(error) || abortController?.signal?.aborted) {
        overlay.remove();
        return { aborted: true };
    }
    overlay.append('Error: ' + (error && error.message ? error.message : error), { time: true });
    overlay.setStatus('Failed');
    overlay.setFinished();
    await overlay.waitUntilClosed();
    return { aborted: false, error };
}
