'use strict';

// Edge overlay functionality removed; keeping stub for compatibility.
export const ConnectionHandlerUtils = {
    initializeConnectionHandler: () => {},
    updateCalculationResults: () => {},
    clearAllCalculationOverlays: () => {},
    installGraphHook: () => {}
};

if (typeof window !== 'undefined') {
    window.ConnectionHandlerUtils = ConnectionHandlerUtils;
}
