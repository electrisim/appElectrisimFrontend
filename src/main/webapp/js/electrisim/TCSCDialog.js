import { numberParser, actionCellRenderer } from './utils/gridUtils.js';

export const rowDefsTCSC = [
    { name: "TCSC", x_l_ohm:0.0,  x_cvar_ohm: 0.0, set_vm_pu: 0.0, thyristor_firing_angle_degree: 0.0, controllable:'True', min_angle_degree:90, max_angle_degree:180},
    
  ];  
export const columnDefsTCSC = [  
    {
      field: "name",
    },
    {
      field: "x_l_ohm",
      headerTooltip: "inductive reactance of the reactor component of TCSC",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "x_cvar_ohm",
      headerTooltip: "capacitive reactance of the fixed capacitor component of TCSC",
      maxWidth: 120,
      valueParser: negativeNumberParser,      
    },
    {
      field: "set_vm_pu",
      headerTooltip: "set-point for the bus voltage magnitude at the connection bus",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "thyristor_firing_angle_degree",
      headerTooltip: "thyristor_firing_angle_degree - the value of thyristor firing angle of TCSC (is used directly if controllable==False ",
      maxWidth: 200,
      valueParser: numberParser,      
    }, 
    {
      field: "controllable",
      headerTooltip: "whether the element is considered as actively controlling or as a fixed shunt impedance",
      maxWidth: 120,      
    }, 
    {
      field: "min_angle_degree",
      headerTooltip: "minimum value of the thyristor_firing_angle_degree",
      maxWidth: 140,
      valueParser: numberParser,      
    }, 
    {
      field: "max_angle_degree",
      headerTooltip: "maximum value of the thyristor_firing_angle_degree",
      maxWidth: 140,
      valueParser: numberParser,      
    }, 

  ];
  
export const gridOptionsTCSC = {
    columnDefs: columnDefsTCSC,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsTCSC,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     

export function negativeNumberParser(params) {
   
    if(Number(params.newValue) <= 0) {
      return(Number(params.newValue))
    }else {
      alert("The value "+ params +" must be number (dot separated) and <= 0")
      return(Number(params.oldValue))
    }
}

// Make them globally available
globalThis.rowDefsTCSC = rowDefsTCSC;
globalThis.columnDefsTCSC = columnDefsTCSC;
globalThis.gridOptionsTCSC = gridOptionsTCSC;
globalThis.negativeNumberParser = negativeNumberParser;