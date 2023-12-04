const  rowDefsLoad = [
    { name: "Load", p_mw:0.0,  q_mvar: 0.0, const_z_percent: 0.0, const_i_percent: 0.0, sn_mva: 0.0, scaling:0.0, type:'Wye'},
    
  ];  
  const columnDefsLoad = [  
    {
      field: "name",
    },
    {
      field: "p_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,  
    },
    {
      field: "q_mvar",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "const_z_percent",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "const_i_percent",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "sn_mva",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "",
      maxWidth: 100,     
    }
  ];
  
  var gridOptionsLoad = {
    columnDefs: columnDefsLoad,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsLoad,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  