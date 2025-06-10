import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsWard = [
    { name: "Ward", ps_mw:0.0,  qs_mvar: 0.0, pz_mw: 0.0, qz_mvar: 0.0},
    
  ];  
export const columnDefsWard = [  
    {
      field: "name",
    },
    {
      field: "ps_mw",
      headerTooltip: "active power of the PQ load",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "qs_mvar",
      headerTooltip: "reactive power of the PQ load",
      maxWidth: 100,
      
    },
    {
      field: "pz_mw",
      headerTooltip: "active power of the impedance load in MW at 1.pu voltage",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "qz_mvar",
      headerTooltip: "reactive power of the impedance load in MVar at 1.pu voltage",
      maxWidth: 120,
      valueParser: numberParser,
    }
  ];
  
export const gridOptionsWard = {
    columnDefs: columnDefsWard,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsWard,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     

// Make them globally available
globalThis.rowDefsWard = rowDefsWard;
globalThis.columnDefsWard = columnDefsWard;
globalThis.gridOptionsWard = gridOptionsWard;
  
  
  
  