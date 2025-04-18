const  rowDefsShuntReactor = [
    { givenname: "Generator", p_mw:0.0,  q_mvar: 0.0, vn_kv: 0.0, step: 0.0, max_step: 0.0},
    
  ];  
  const columnDefsShuntReactor = [  
    {
      field: "givenname",
    },
    {
      field: "p_mw",
      headerTooltip: "shunt active power in MW at v= 1.0 p.u.",
      maxWidth: 100,
      valueParser: numberParser,  
    },
    {
      field: "q_mvar",
      headerTooltip: "shunt reactive power in MVAr at v= 1.0 p.u.",
      maxWidth: 100,
      
    },
    {
      field: "vn_kv",
      headerTooltip: "rated voltage of the shunt. Defaults to rated voltage of connected bus",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "step",
      headerTooltip: "step of shunt with which power values are multiplied",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "max_step",
      headerTooltip: "True for in_service or False for out of service",
      maxWidth: 120,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsShuntReactor = {
    columnDefs: columnDefsShuntReactor,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsShuntReactor,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  