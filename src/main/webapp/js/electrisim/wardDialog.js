const  rowDefsWard = [
    { givenname: "Ward", ps_mw:0.0,  qs_mvar: 0.0, pz_mw: 0.0, qz_mvar: 0.0},
    
  ];  
  const columnDefsWard = [  
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
      
    }
  ];
  
  var gridOptionsWard = {
    columnDefs: columnDefsWard,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsWard,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  