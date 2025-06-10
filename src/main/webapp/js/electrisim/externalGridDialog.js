import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsExternalGrid = [
    { name: "External Grid", vm_pu:0.0,  va_degree: 0.0, s_sc_max_mva: 1000000.0, s_sc_min_mva: 0.0, rx_max: 0.0, rx_min:0.0, r0x0_max:0.0, x0x_max: 0.0},
];  

export const columnDefsExternalGrid = [  
    {
      field: "name",
    },
    {
      field: "vm_pu",
      headerTooltip: "voltage at the slack node in per unit",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "va_degree",
      headerTooltip: "voltage angle at the slack node in degrees. Only considered in loadflow if calculate_voltage_angles = True",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "s_sc_max_mva",
      headerTooltip: "maximal short circuit apparent power to calculate internal impedance of ext_grid for short circuit calculations",
      maxWidth: 160,
      valueParser: numberParser,
    },
    {
      field: "s_sc_min_mva",
      headerTooltip: "minimal short circuit apparent power to calculate internal impedance of ext_grid for short circuit calculations",
      maxWidth: 160,
      valueParser: numberParser,
    },
    {
      field: "rx_max",
      headerTooltip: "maximal R/X-ratio to calculate internal impedance of ext_grid for short circuit calculations",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "rx_min",
      headerTooltip: "minimal R/X-ratio to calculate internal impedance of ext_grid for short circuit calculations",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "r0x0_max",
      headerTooltip: "maximal R/X-ratio to calculate Zero sequence internal impedance of ext_grid",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "x0x_max",
      headerTooltip: "maximal X0/X-ratio to calculate Zero sequence internal impedance of ext_grid",
      maxWidth: 120,
      valueParser: numberParser,
    }
];
  
export const gridOptionsExternalGrid = {
    columnDefs: columnDefsExternalGrid,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsExternalGrid,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
};     

// Make all necessary variables globally available
globalThis.gridOptionsExternalGrid = gridOptionsExternalGrid;
globalThis.rowDefsExternalGrid = rowDefsExternalGrid;
globalThis.columnDefsExternalGrid = columnDefsExternalGrid;
  
  
  
  