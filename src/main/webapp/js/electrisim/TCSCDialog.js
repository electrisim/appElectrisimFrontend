const  rowDefsTCSC = [
    { givenname: "TCSC", x_l_ohm:0.0,  x_cvar_ohm: 0.0, set_p_to_mw: 0.0, thyristor_firing_angle_degree: 0.0,  controllable: 'True',  min_angle_degree: 90,  max_angle_degree: 180},
    
  ];  
  const columnDefsTCSC = [  
    {
      field: "givenname",
    },
    {
      field: "x_l_ohm",
      headerTooltip: "impedance of the reactor component of TCSC",
      maxWidth: 100,
      valueParser: numberParser,  
    },
    {
      field: "x_cvar_ohm",
      headerTooltip: "impedance of the fixed capacitor component of TCSC",
      maxWidth: 120,
      valueParser: negativeNumberParser,      
    },
    {
      field: "set_p_to_mw",
      headerTooltip: "set-point for the branch active power at the to_bus",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "thyristor_firing_angle_degree",
      headerTooltip: "thyristor_firing_angle_degree - the value of thyristor firing angle of tcsc (is used directly if controllable==False)",
      maxWidth: 220,
      valueParser: numberParser,      
    },
    {
      field: "controllable",
      headerTooltip: "whether the element is considered as actively controlling or as a fixed series impedance",
      maxWidth: 120,      
    },
    {
      field: "min_angle_degree",
      headerTooltip: "minimum value of the thyristor_firing_angle_degree",
      maxWidth: 160,
      valueParser: numberParser,
    },
    {
      field: "max_angle_degree",
      headerTooltip: "maximum value of the thyristor_firing_angle_degree",
      maxWidth: 160,
      valueParser: numberParser,
    }

  ];
  
  var gridOptionsTCSC = {
    columnDefs: columnDefsTCSC,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsTCSC,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  