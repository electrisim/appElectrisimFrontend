const  rowDefsDCLine = [
    { givenname: "DC line", p_mw:0.0,  loss_percent: 0.0, loss_mw: 0.0, vm_from_pu: 0.0, vm_to_pu: 0.0},
    
  ];  
  const columnDefsDCLine = [  
    {
      field: "givenname",
    },
    {
      field: "p_mw",
      headerTooltip: "Active power transmitted from from_bus to to_bus",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "loss_percent",
      headerTooltip: "Relative transmission loss in percent of active power transmission",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "loss_mw",
      headerTooltip: "Total transmission loss in MW",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vm_from_pu",
      headerTooltip: "Voltage setpoint at from bus",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vm_to_pu",
      headerTooltip: "Voltage setpoint at to bus",
      maxWidth: 120,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsDCLine = {
    columnDefs: columnDefsDCLine,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsDCLine,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  