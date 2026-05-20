// dialogStyles.js - Common styles for all dialogs

/** Viewport-relative height for Draw.io embedded study dialogs */
export function getDrawioStudyDialogHeight() {
    if (typeof window === 'undefined' || typeof window.innerHeight !== 'number') {
        return 760;
    }
    return Math.min(880, Math.max(560, Math.floor(window.innerHeight * 0.9)));
}

/** Scroll region: fills remaining space inside flex column layouts */
export const SIMULATION_FORM_SCROLL_STYLE = {
    flex: '1 1 0%',
    minHeight: '0',
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingRight: '8px',
    scrollbarWidth: 'thin',
    scrollbarColor: '#c5ccd3 #f1f3f5'
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
    const shellH = 'calc(100vh - 48px)';
    return {
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 6px 24px rgba(0, 0, 0, 0.12)',
        width: `min(${widthPx}px, 94vw)`,
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
        zIndex: '1000'
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