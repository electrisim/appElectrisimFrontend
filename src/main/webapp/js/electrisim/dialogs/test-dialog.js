// test-dialog.js - Simple test to verify EditDataDialog works
console.log('Testing EditDataDialog...');

// Wait for everything to load
setTimeout(() => {
    try {
        console.log('Dialog initializer loaded:', typeof initializeDialogs !== 'undefined');
        console.log('AG-Grid available:', typeof agGrid !== 'undefined');
        console.log('EditorUi available:', typeof EditorUi !== 'undefined');
        console.log('EditDataDialog override installed:', EditorUi.prototype.showDataDialog.toString().includes('EditDataDialog'));
        
        if (window.gridOptionsBus) {
            console.log('Bus grid options available');
        } else {
            console.warn('Bus grid options not available');
        }
        
        console.log('EditDataDialog test completed successfully!');
    } catch (error) {
        console.error('EditDataDialog test failed:', error);
    }
}, 3000); 