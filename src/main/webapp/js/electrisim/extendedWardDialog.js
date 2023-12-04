const  rowDefsExtendedWard = [
    { name: "Extended Ward", ps_mw:0.0,  qs_mvar: 0.0, pz_mw: 0.0, qz_mvar: 0.0, r_ohm: 0.0, x_ohm:0.0, vm_pu:0.0},
    
  ];  
  const columnDefsExtendedWard = [  
    {
      field: "name",
    },
    {
      field: "ps_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "qs_mvar",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "pz_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "qz_mvar",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "r_ohm",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "x_ohm",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vm_pu",
      headerTooltip: "",
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
  
  
  
  