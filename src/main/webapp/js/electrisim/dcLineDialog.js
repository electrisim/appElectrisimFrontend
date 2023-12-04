const  rowDefsDCLine = [
    { name: "DC line", p_mw:0.0,  loss_percent: 0.0, loss_mw: 0.0, vm_from_pu: 0.0, vm_to_pu: 0.0},
    
  ];  
  const columnDefsDCLine = [  
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
      field: "loss_percent",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "loss_mw",
      headerTooltip: "",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "vm_from_pu",
      headerTooltip: "",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "vm_to_pu",
      headerTooltip: "",
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
  
  
  
  