import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsStorage = [
    { name: "Storage", p_mw:0.0,  max_e_mwh: 0.0, q_mvar: 0.0, sn_mva: 0.0, soc_percent: 0.0, min_e_mwh:0.0, scaling:0.0, type: 0.0},
    
  ];  
export const columnDefsStorage = [  
    {
      field: "name",
    },
    {
      field: "p_mw",
      headerTooltip: "The momentary active power of the storage (positive for charging, negative for discharging)",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "max_e_mwh",
      headerTooltip: "The maximum energy content of the storage (maximum charge level)",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "q_mvar",
      headerTooltip: "The reactive power of the storage",
      maxWidth: 100,
      
    },
    {
      field: "sn_mva",
      headerTooltip: "Nominal power of the storage",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "soc_percent",
      headerTooltip: "The state of charge of the storage",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "min_e_mwh",
      headerTooltip: "The minimum energy content of the storage (minimum charge level)",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplys with p_mw and q_mvar.",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "type variable to classify the storage",
      maxWidth: 120,
      
    }
  ];
  
export const gridOptionsStorage = {
    columnDefs: columnDefsStorage,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsStorage,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     

// Make them globally available
globalThis.rowDefsStorage = rowDefsStorage;
globalThis.columnDefsStorage = columnDefsStorage;
globalThis.gridOptionsStorage = gridOptionsStorage;
  
// Override the default StorageDialog behavior
window.addEventListener('load', function() {
    // Store the original StorageDialog
    var originalStorageDialog = window.StorageDialog;
    
    // Override StorageDialog
    window.StorageDialog = function(editorUi, fn, rowLimit) {
        // Skip the dialog and directly use Device Storage
        editorUi.setMode(App.MODE_DEVICE, true);
        fn();
        return {
            container: document.createElement('div') // Return empty container since we're not showing the dialog
        };
    };
});
  
  
  
  