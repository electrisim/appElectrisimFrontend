import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsBus = [
    { name: "Bus", vn_kv:0.0},
];  

export const columnDefsBus = [  
    {
      field: "name", 
      maxWidth: 150
    },
    {
      field: "vn_kv",
      headerTooltip: "The grid voltage level",
      maxWidth: 100,
      valueParser: numberParser,
    }
];
  
export const gridOptionsBus = {
    columnDefs: columnDefsBus,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsBus,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true,
};

// Make them globally available for backward compatibility
globalThis.rowDefsBus = rowDefsBus;
globalThis.columnDefsBus = columnDefsBus;
globalThis.gridOptionsBus = gridOptionsBus;
  
  
  
  