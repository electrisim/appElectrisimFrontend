// dialogStyles.js - Common styles for all dialogs

/** Viewport-relative height for Draw.io embedded study dialogs */
export function getDrawioStudyDialogHeight() {
    if (typeof window === 'undefined' || typeof window.innerHeight !== 'number') {
        return 760;
    }
    return Math.min(860, Math.max(560, Math.floor(window.innerHeight * 0.9)));
}

/** Simulation input dialogs are wide enough for two columns of fields (see enableStudyFormColumns). */
export const STUDY_DIALOG_WIDE_PX = 1040;

/** Width for Draw.io embedded study dialogs: wide, but never wider than the window. */
export function getDrawioStudyDialogWidth(preferredPx = STUDY_DIALOG_WIDE_PX) {
    if (typeof window === 'undefined' || typeof window.innerWidth !== 'number') return preferredPx;
    return Math.max(480, Math.min(preferredPx, Math.floor(window.innerWidth * 0.94)));
}

/** Scroll region: fills remaining space inside flex column layouts */
export const SIMULATION_FORM_SCROLL_STYLE = {
    flex: '1 1 0%',
    minHeight: '0',
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: '8px',
    scrollbarWidth: 'thin',
    scrollbarColor: '#c5ccd3 #f1f3f5',
    /* Also the marker enableStudyFormColumns looks for: every scroll region built from this style. */
    overscrollBehavior: 'contain'
};

/** Compact info banner used at top of calculation / study dialogs */
export const SIMULATION_INFO_BANNER_STYLE = {
    padding: '8px 12px',
    backgroundColor: '#e8f4fc',
    border: '1px solid #b8dae9',
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: '1.45',
    color: '#0d47a1',
    marginBottom: '10px',
    flexShrink: '0',
    boxSizing: 'border-box'
};

/** Must stack above {@link STUDY_MODAL_OVERLAY_STYLE} and Draw.io study dialogs. */
export const SUBSCRIPTION_MODAL_Z_INDEX = 11000;

/** Full-screen overlay for custom study modals (Load Flow, Harmonics, …) */
export const STUDY_MODAL_OVERLAY_STYLE = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: '10000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 'max(12px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(12px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px))',
    boxSizing: 'border-box',
    overflowY: 'auto'
};

/**
 * Dialog shell with explicit viewport-based height so flex descendants get a real height budget
 * (fixes inner scroll staying short when only max-height was set).
 * @param {number} widthPx preferred max width in px before vw cap
 */
export function getStudyModalDialogBoxStyle(widthPx = 640) {
    /* Wide and not taller than needed: fields flow into two columns, so the form is about half as tall. */
    const shellH = 'min(calc(100vh - 48px), 880px)';
    const w = Math.max(Number(widthPx) || 0, STUDY_DIALOG_WIDE_PX);
    return {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12)',
        width: `min(${w}px, 94vw)`,
        maxWidth: '94vw',
        height: shellH,
        maxHeight: shellH,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: '0',
        boxSizing: 'border-box'
    };
}

/** Below title bar: grows and clips so only the form region scrolls */
export const STUDY_MODAL_CONTENT_WRAPPER_STYLE = {
    padding: '16px 20px',
    flex: '1 1 0%',
    minHeight: '0',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box'
};

/**
 * Prevent accidental dialog close/submit from Enter or implicit form submission.
 * @param {HTMLFormElement} form
 */
export function preventAccidentalFormSubmit(form) {
    if (!form || form._electrisimFormGuard) return;
    form._electrisimFormGuard = true;
    form.addEventListener('submit', (e) => e.preventDefault());
    form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            e.preventDefault();
        }
    });
}

/** Apply {@link preventAccidentalFormSubmit} to every form under root. */
export function preventAccidentalFormSubmitOnTree(root) {
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('form').forEach(preventAccidentalFormSubmit);
}

/** Stop diagram/graph handlers from seeing pointer events inside the dialog shell. */
export function isolateDialogShellPointerEvents(dialogPanel) {
    if (!dialogPanel || dialogPanel._electrisimPointerIsolation) return;
    dialogPanel._electrisimPointerIsolation = true;
    const stop = (e) => e.stopPropagation();
    dialogPanel.addEventListener('mousedown', stop);
    dialogPanel.addEventListener('pointerdown', stop);
}

/**
 * Close modal only when mousedown and click both occur on the backdrop.
 * Avoids ghost clicks from native &lt;select&gt; / &lt;input type="number"&gt; controls.
 * @param {HTMLElement} overlay
 * @param {HTMLElement|null} dialogPanel
 * @param {Function} onClose
 */
export function attachBackdropCloseHandler(overlay, dialogPanel, onClose) {
    if (!overlay) return;
    if (dialogPanel) isolateDialogShellPointerEvents(dialogPanel);
    if (overlay._electrisimBackdropClose) return;
    overlay._electrisimBackdropClose = true;
    let pointerDownOnOverlay = false;
    overlay.addEventListener('mousedown', (e) => {
        pointerDownOnOverlay = (e.target === overlay);
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay && pointerDownOnOverlay && typeof onClose === 'function') {
            onClose(e);
        }
        pointerDownOnOverlay = false;
    });
}

/**
 * Hide a full-screen overlay so the diagram is usable, and show a restore chip.
 * @returns {{ restore: Function, dismiss: Function }}
 */
export function parkOverlayForCanvas(overlay, {
    restoreLabel = 'Back to dialog',
    zIndex = 10001,
    accent = '#2563eb',
} = {}) {
    const noop = { restore() {}, dismiss() {} };
    if (!overlay) return noop;

    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');

    const removeChip = () => {
        const existing = overlay._electrisimRestoreBtn;
        if (existing?.parentNode) existing.parentNode.removeChild(existing);
        overlay._electrisimRestoreBtn = null;
    };
    removeChip();

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = restoreLabel;
    btn.title = restoreLabel;
    btn.style.cssText = `
        position:fixed;right:20px;bottom:20px;z-index:${Number(zIndex) || 10001};
        max-width:min(420px, calc(100vw - 40px));
        padding:10px 16px;background:${accent};color:#fff;border:none;
        border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;
        box-shadow:0 4px 14px rgba(0,0,0,0.35);font-family:Arial,sans-serif;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    `;
    btn.onmouseenter = () => { btn.style.filter = 'brightness(0.92)'; };
    btn.onmouseleave = () => { btn.style.filter = ''; };

    const restore = () => {
        removeChip();
        if (overlay.isConnected) {
            overlay.style.display = 'flex';
            overlay.removeAttribute('aria-hidden');
        }
    };
    btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        restore();
    };
    document.body.appendChild(btn);
    overlay._electrisimRestoreBtn = btn;

    return { restore, dismiss: removeChip };
}

export const DIALOG_STYLES = {
    // Common dialog container styles
    container: {
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '24px',
        maxWidth: '90%',
        width: '480px',
        margin: '20px auto',
        fontFamily: 'Arial, sans-serif'
    },

    // Header styles
    header: {
        color: '#333333',
        fontSize: '24px',
        fontWeight: '600',
        marginBottom: '20px',
        textAlign: 'center',
        borderBottom: '1px solid #eaeaea',
        paddingBottom: '15px'
    },

    // Form group styles
    formGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
    },

    // Label styles
    label: {
        fontSize: '14px',
        fontWeight: '600',
        color: '#24292e'
    },

    // Input styles
    input: {
        padding: '5px 12px',
        fontSize: '14px',
        lineHeight: '20px',
        color: '#24292e',
        backgroundColor: '#ffffff',
        border: '1px solid #e1e4e8',
        borderRadius: '6px',
        boxShadow: 'inset 0 1px 0 rgba(225,228,232,0.2)',
        minHeight: '32px'
    },

    // Input focus styles
    inputFocus: {
        borderColor: '#48d800',
        outline: 'none',
        boxShadow: '0 0 0 2px rgba(72, 216, 0, 0.1)'
    },

    // Select styles
    select: {
        width: '100%',
        padding: '10px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        fontSize: '14px',
        color: '#333',
        backgroundColor: '#fff',
        cursor: 'pointer'
    },

    // Button styles
    button: {
        backgroundColor: '#48d800',
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        padding: '12px 24px',
        fontSize: '16px',
        fontWeight: '500',
        cursor: 'pointer',
        width: '100%',
        transition: 'background-color 0.3s ease'
    },

    // Button hover styles
    buttonHover: {
        backgroundColor: '#3fb500'
    },

    // Secondary button styles
    buttonSecondary: {
        backgroundColor: '#ffffff',
        color: '#48d800',
        border: '1px solid #48d800'
    },

    // Error message styles
    error: {
        color: '#dc3545',
        fontSize: '14px',
        marginTop: '8px',
        textAlign: 'center'
    },

    // Success message styles
    success: {
        color: '#48d800',
        fontSize: '14px',
        marginTop: '8px',
        textAlign: 'center'
    },

    // Dialog overlay styles
    overlay: {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: String(SUBSCRIPTION_MODAL_Z_INDEX)
    },

    // Grid layout styles
    grid: {
        display: 'grid',
        gap: '16px'
    },

    // Divider styles
    divider: {
        margin: '20px 0',
        borderTop: '1px solid #eaeaea'
    },

    // Info text styles
    info: {
        color: '#24292e',
        fontSize: '14px',
        lineHeight: '1.5'
    },

    // Results section styles
    results: {
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        padding: '15px',
        marginTop: '20px'
    },

    // Result item styles
    resultItem: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '8px',
        fontSize: '14px'
    },

    // Loading indicator styles
    loading: {
        textAlign: 'center',
        padding: '20px'
    }
}; 
/* ------------------------------------------------------------------------------------------
 * Two-column simulation input dialogs.
 * Every study dialog builds a scroll region from SIMULATION_FORM_SCROLL_STYLE (marked by
 * overscroll-behavior: contain). Its form flows into CSS columns (top-to-bottom, then the next
 * column), so the reading order is unchanged and the dialog is about half as tall. Fields keep
 * their own DOM nodes and listeners. Wide items (tables, charts) span both columns.
 * A dialog opts out with data-study-columns="off" on the scroll region or the form.
 * ---------------------------------------------------------------------------------------- */

/** requestAnimationFrame, with a timer fallback for hidden / background tabs where frames pause. */
function nextFrame(fn) {
    let done = false;
    const run = () => { if (!done) { done = true; fn(); } };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
    setTimeout(run, 60);
}

const STUDY_COLS_CLASS = 'es-study-cols';
const STUDY_COLS_STYLE_ID = 'es-study-cols-style';
const STUDY_COL_MIN_PX = 300;

function ensureStudyColumnsCss() {
    if (typeof document === 'undefined' || document.getElementById(STUDY_COLS_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STUDY_COLS_STYLE_ID;
    s.textContent = `
.${STUDY_COLS_CLASS} {
  display: block !important;
  column-width: ${STUDY_COL_MIN_PX}px;
  column-count: 2;
  column-gap: 28px;
  column-rule: 1px solid #eef1f4;
}
.${STUDY_COLS_CLASS} > * { break-inside: avoid; page-break-inside: avoid; }
.${STUDY_COLS_CLASS} input:not([type="checkbox"]):not([type="radio"]), .${STUDY_COLS_CLASS} select, .${STUDY_COLS_CLASS} textarea { max-width: 100%; box-sizing: border-box; }
.${STUDY_COLS_CLASS} > .es-study-span { column-span: all; }
.${STUDY_COLS_CLASS} > .es-study-split { break-inside: auto; }
`;
    document.head.appendChild(s);
}

function isStudyScrollRegion(el) {
    return !!(el && el.nodeType === 1 && el.style
        && el.style.overscrollBehavior === 'contain'
        && (el.style.overflowY === 'auto' || el.style.overflowY === 'scroll'));
}

/** The element whose children are the field groups: a lone form/div child, or the region itself. */
function columnHostOf(region) {
    let host = region;
    for (let depth = 0; depth < 3; depth++) {
        const kids = [...host.children].filter((c) => c.tagName !== 'SCRIPT' && c.tagName !== 'STYLE');
        if (kids.length === 1 && (kids[0].tagName === 'FORM' || kids[0].tagName === 'DIV')) {
            host = kids[0];
            continue;
        }
        break;
    }
    if (host === region) {
        /* Fields sit directly in the scroll region: wrap them so the region itself still scrolls vertically. */
        const wrap = document.createElement('div');
        while (region.firstChild) wrap.appendChild(region.firstChild);
        region.appendChild(wrap);
        host = wrap;
    }
    return host;
}

function hasTabs(host) {
    return !!host.querySelector('[role="tablist"], .tab-buttons, .es-tabs, [data-tab]');
}

/** Keep each field's spacing (the flex gap is lost when the host becomes a column box). */
function applyGapAsMargins(host) {
    let gap = 0;
    try {
        const cs = getComputedStyle(host);
        gap = parseFloat(cs.rowGap) || parseFloat(cs.gap) || 0;
    } catch (e) { /* ignore */ }
    if (gap <= 0) gap = 12;
    [...host.children].forEach((child) => {
        let mb = 0;
        try { mb = parseFloat(getComputedStyle(child).marginBottom) || 0; } catch (e) { /* ignore */ }
        if (mb < gap) child.style.marginBottom = `${gap}px`;
        child.style.marginTop = '0';
    });
}

/** Wide content spans both columns; very tall groups may split so the columns stay balanced. */
function refineStudyColumns(host) {
    if (!host.isConnected || !host.classList.contains(STUDY_COLS_CLASS)) return;
    const total = host.scrollHeight || 1;
    [...host.children].forEach((child) => {
        if (child.classList.contains('es-study-span')) return;
        const overflow = child.scrollWidth > child.clientWidth + 24;
        const wideWidget = child.querySelector('table, canvas, svg[width], .es-wide');
        const wideW = wideWidget ? wideWidget.getBoundingClientRect().width : 0;
        if (overflow || wideW > child.clientWidth + 4 || child.dataset.studySpan === 'all') {
            child.classList.add('es-study-span');
        } else if (child.offsetHeight > total * 0.6) {
            child.classList.add('es-study-split');
        }
    });
}

/**
 * Lay the fields of a study dialog scroll region out in two columns (one when narrow).
 * Safe to call more than once.
 */
function layoutStudyHost(host) {
    if (!host || host._esStudyColsHost) return;
    if (host.dataset?.studyColumns === 'off' || hasTabs(host) || host.children.length < 3) return;
    host._esStudyColsHost = true;
    ensureStudyColumnsCss();
    applyGapAsMargins(host);
    host.classList.add(STUDY_COLS_CLASS);
    const refine = () => refineStudyColumns(host);
    nextFrame(refine);
    setTimeout(refine, 250);
    /* Sections that appear later (toggled options, templates) get the same treatment. */
    if (typeof MutationObserver === 'function') {
        let pending = false;
        new MutationObserver(() => {
            if (pending) return;
            pending = true;
            nextFrame(() => { pending = false; applyGapAsMargins(host); refine(); });
        }).observe(host, { childList: true });
    }
}

/**
 * Lay the fields of a study dialog scroll region out in two columns (one when narrow).
 * Safe to call more than once. The region is watched, so a form that is rebuilt and swapped in
 * (Load Flow's Pandapower / OpenDSS tabs, templates, …) is laid out again.
 */
export function enableStudyFormColumns(region) {
    if (!region || typeof document === 'undefined') return;
    if (region.dataset?.studyColumns === 'off') return;
    if (region.children.length) layoutStudyHost(columnHostOf(region));
    if (region._esStudyCols || typeof MutationObserver !== 'function') return;
    region._esStudyCols = true;
    let pending = false;
    new MutationObserver(() => {
        if (pending) return;
        pending = true;
        nextFrame(() => {
            pending = false;
            if (region.isConnected && region.children.length) layoutStudyHost(columnHostOf(region));
        });
    }).observe(region, { childList: true });
}

function scanForStudyScrollRegions(root) {
    if (!root || root.nodeType !== 1) return;
    if (isStudyScrollRegion(root)) enableStudyFormColumns(root);
    root.querySelectorAll?.('div').forEach((el) => {
        if (isStudyScrollRegion(el) && !el._esStudyCols) enableStudyFormColumns(el);
    });
}

/** Watch a dialog for scroll regions created after it opened (e.g. a tab that rebuilds its body). */
function watchDialogRoot(root) {
    if (!root || root.nodeType !== 1 || root._esStudyColsWatch || typeof MutationObserver !== 'function') return;
    root._esStudyColsWatch = true;
    let pending = false;
    const obs = new MutationObserver(() => {
        if (!root.isConnected) { obs.disconnect(); return; }
        if (pending) return;
        pending = true;
        nextFrame(() => { pending = false; scanForStudyScrollRegions(root); });
    });
    obs.observe(root, { childList: true, subtree: true });
}

/** Dialogs are appended to <body> once built; lay out each new one. */
function installStudyColumnsObserver() {
    if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return;
    if (globalThis.__esStudyColumnsObserver) return;
    const start = () => {
        if (!document.body || globalThis.__esStudyColumnsObserver) return;
        const obs = new MutationObserver((records) => {
            records.forEach((r) => r.addedNodes.forEach((n) => {
                /* Content is often filled in right after the shell is attached. */
                nextFrame(() => {
                    scanForStudyScrollRegions(n);
                    if (n.nodeType === 1 && (n.style?.position === 'fixed' || n.classList?.contains('geDialog')
                        || n.querySelector?.('form, input, select'))) watchDialogRoot(n);
                });
            }));
        });
        obs.observe(document.body, { childList: true });
        globalThis.__esStudyColumnsObserver = obs;
    };
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start, { once: true });
}

installStudyColumnsObserver();
