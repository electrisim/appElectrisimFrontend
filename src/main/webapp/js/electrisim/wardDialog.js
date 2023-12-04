const  rowDefsWard = [
    { name: "Ward", ps_mw:0.0,  qs_mvar: 0.0, pz_mw: 0.0, qz_mvar: 0.0},
    
  ];  
  const columnDefsWard = [  
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
  
  
  
  