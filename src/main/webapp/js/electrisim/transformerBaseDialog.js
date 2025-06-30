export const rowDefsTransformerBase = [
    { name: "Transformer", sn_mva: 0.0, vn_hv_kv: 0.0, vn_lv_kv: 0.0, vk_percent: 0.0, vkr_percent: 0.0, pfe_kw: 0.0, i0_percent: 0.0, shift_degree: 0.0, tap_side: "hv", tap_neutral: 0.0, tap_min: -10.0, tap_max: 10.0, tap_step_percent: 1.0, tap_step_degree: 0.0, tap_pos: 0.0, tap_phase_shifter: false },
];

export const columnDefsTransformerBase = [
    { 
      field: "name", 
      minWidth: 300 
    },
    { 
      field: "sn_mva",
      headerTooltip: "rated apparent power in MVA",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "vn_hv_kv",
      headerTooltip: "rated voltage on high voltage side in kV",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "vn_lv_kv",
      headerTooltip: "rated voltage on low voltage side in kV",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "vk_percent",
      headerTooltip: "short circuit voltage in percent",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "vkr_percent",
      headerTooltip: "real part of short circuit voltage in percent",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "pfe_kw",
      headerTooltip: "iron losses in kW",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "i0_percent",
      headerTooltip: "open loop losses in percent",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "shift_degree",
      headerTooltip: "angle shift in degrees",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { 
      field: "tap_side",
      headerTooltip: 'where the tap changer is located ("hv" for high voltage or "lv" for low voltage)',
      maxWidth: 100,
    },
    { 
      field: "tap_neutral",
      headerTooltip: "tap position where no voltage shift is present",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { 
      field: "tap_min",
      headerTooltip: "minimum tap position",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { 
      field: "tap_max",
      headerTooltip: "maximum tap position",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { 
      field: "tap_step_percent",
      headerTooltip: "tap step size in percent",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { 
      field: "tap_step_degree",
      headerTooltip: "tap step size for voltage angle in degree, only considered in load flow if calculate_voltage_angles = True",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { 
      field: "tap_pos",
      headerTooltip: "current tap position of the transformer. Defaults to tap_neutral if not set",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { 
      field: "tap_phase_shifter",
      headerTooltip: "whether the transformer is an ideal phase shifter",
      maxWidth: 150,
    }
];

//***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */

function numberParser(params) {
  if(Number(params.newValue) >= 0) {
    return(Number(params.newValue))
  } else {
    alert("The value " + params + " must be number (dot separated) and >= 0")
    return(Number(params.oldValue))
  }
}
/*********************************************** */

//***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */

function negativeNumberParser(params) {
  if(Number(params.newValue) <= 0) {
    return(Number(params.newValue))
  } else {
    alert("The value " + params + " must be number (dot separated) and <= 0")
    return(Number(params.oldValue))
  }
}
/*********************************************** */


export const gridOptionsTransformerBase = { 
    columnDefs: columnDefsTransformerBase,
    defaultColDef: {
      editable: true    
    },  
    rowData: rowDefsTransformerBase,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość     
};

// Make them globally available
globalThis.rowDefsTransformerBase = rowDefsTransformerBase;
globalThis.columnDefsTransformerBase = columnDefsTransformerBase;
globalThis.gridOptionsTransformerBase = gridOptionsTransformerBase;
globalThis.numberParser = numberParser;
globalThis.negativeNumberParser = negativeNumberParser;



