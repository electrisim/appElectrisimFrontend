const  rowDefsBus = [
    { name: "Bus", vn_kv:0.0},
    
  ];  
  const columnDefsBus = [  
    {
      field: "name",
    },
    {
      field: "vn_kv",
      headerTooltip: "The grid voltage level",
      maxWidth: 100,
      valueParser: numberParser,
  
    }
  ];
  
  var gridOptionsBus = {
    columnDefs: columnDefsBus,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsBus,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  