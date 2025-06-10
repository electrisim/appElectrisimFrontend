import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsCapacitor = [
    { name: "Capacitor", q_mvar:0.0,  loss_factor: 0.0, vn_kv: 0.0, step: 0.0, max_step: 0.0},
];  

export const columnDefsCapacitor = [  
    {
      field: "name",
    },
    {
      field: "q_mvar",
      headerTooltip: "reactive power of the capacitor bank at rated voltage",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "loss_factor",
      headerTooltip: "loss factor tan(delta) of the capacitor bank",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vn_kv",
      headerTooltip: "rated voltage of the shunt element",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "step",
      headerTooltip: "step position of the shunt",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "max_step",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    }    
];
  
export const gridOptionsCapacitor = {
    columnDefs: columnDefsCapacitor,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsCapacitor,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true,
};     

// Make them globally available for backward compatibility
globalThis.rowDefsCapacitor = rowDefsCapacitor;
globalThis.columnDefsCapacitor = columnDefsCapacitor;
globalThis.gridOptionsCapacitor = gridOptionsCapacitor;
  
  
  
  