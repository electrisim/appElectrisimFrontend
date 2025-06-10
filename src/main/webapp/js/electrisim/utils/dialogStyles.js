// dialogStyles.js - Common styles for all dialogs

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