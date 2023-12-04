const  rowDefsImpedance = [
    { name: "Impedance", r_pu:0.0,  x_pu: 0.0, sn_mva: 0.0},
    
  ];  
  const columnDefsImpedance = [  
    {
      field: "name",
    },
    {
      field: "r_pu",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,  
    },
    {
      field: "x_pu",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "sn_mva",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsImpedance = {
    columnDefs: columnDefsImpedance,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsImpedance,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  