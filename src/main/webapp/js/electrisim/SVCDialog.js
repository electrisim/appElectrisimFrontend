const  rowDefsSVC = [
    { givenname: "SVC", x_l_ohm:0.0,  x_cvar_ohm: 0.0, set_vm_pu: 0.0, thyristor_firing_angle_degree: 0.0, controllable:'True', min_angle_degree:90, max_angle_degree:180},
    
  ];  
  const columnDefsSVC = [  
    {
      field: "givenname",
    },
    {
      field: "x_l_ohm",
      headerTooltip: "inductive reactance of the reactor component of SVC",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "x_cvar_ohm",
      headerTooltip: "capacitive reactance of the fixed capacitor component of SVC",
      maxWidth: 120,
      valueParser: negativeNumberParser,      
    },
    {
      field: "set_vm_pu",
      headerTooltip: "set-point for the bus voltage magnitude at the connection bus",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "thyristor_firing_angle_degree",
      headerTooltip: "thyristor_firing_angle_degree - the value of thyristor firing angle of svc (is used directly if controllable==False ",
      maxWidth: 200,
      valueParser: numberParser,      
    }, 
    {
      field: "controllable",
      headerTooltip: "whether the element is considered as actively controlling or as a fixed shunt impedance",
      maxWidth: 120,      
    }, 
    {
      field: "min_angle_degree",
      headerTooltip: "minimum value of the thyristor_firing_angle_degree",
      maxWidth: 140,
      valueParser: numberParser,      
    }, 
    {
      field: "max_angle_degree",
      headerTooltip: "maximum value of the thyristor_firing_angle_degree",
      maxWidth: 140,
      valueParser: numberParser,      
    }, 

  ];
  
  var gridOptionsSVC = {
    columnDefs: columnDefsSVC,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsSVC,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  