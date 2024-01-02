const  rowDefsCapacitor = [
    { name: "Capacitor", q_mvar:0.0,  loss_factor: 0.0, vn_kv: 0.0, step: 0.0, max_step: 0.0},
    
  ];  
  const columnDefsCapacitor= [  
    {
      field: "name",
    },
    {
      field: "q_mvar",
      headerTooltip: "reactive power of the capacitor bank at rated voltage",
      maxWidth: 100,
      
  
    },
    {
      field: "loss_factor",
      headerTooltip: "loss factor tan(delta) of the capacitor bank",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vn_kv",
      headerTooltip: "rated voltage of the shunt element",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "step",
      headerTooltip: "step position of the shunt",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "max_step",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    }    
  ];
  
  var gridOptionsCapacitor = {
    columnDefs: columnDefsCapacitor,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsCapacitor,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  