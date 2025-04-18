const  rowDefsExtendedWard = [
    { givenname: "Extended Ward", ps_mw:0.0,  qs_mvar: 0.0, pz_mw: 0.0, qz_mvar: 0.0, r_ohm: 0.0, x_ohm:0.0, vm_pu:0.0},
    
  ];  
  const columnDefsExtendedWard = [  
    {
      field: "givenname",
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
      
    },
    {
      field: "r_ohm",
      headerTooltip: "internal resistance of the voltage source",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "x_ohm",
      headerTooltip: "internal reactance of the voltage source",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vm_pu",
      headerTooltip: "voltage magnitude at the additional PV-node",
      maxWidth: 100,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsExtendedWard = {
    columnDefs: columnDefsExtendedWard,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsExtendedWard,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  