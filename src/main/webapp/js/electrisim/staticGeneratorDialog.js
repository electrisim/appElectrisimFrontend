const  rowDefsStaticGenerator = [
    { name: "Static Generator", p_mw:0.0,  q_mvar: 0.0, sn_mva: 0.0, scaling: 0.0, type: 'Wye', k:0.0, rx:0.0, generator_type: 'async', lrc_pu: 0.0, max_ik_ka: 0.0, kappa: 0.0, current_source: true},
    
  ];  
  const columnDefsStaticGenerator = [  
    {
      field: "name",
    },
    {
      field: "p_mw",
      headerTooltip: "The active power of the static generator (positive for generation!)",
      maxWidth: 100,
      valueParser: numberParser,
  
    },
    {
      field: "q_mvar",
      headerTooltip: "The reactive power of the static generator",
      maxWidth: 100,
      
    },
    {
      field: "sn_mva",
      headerTooltip: "Nominal power of the static generator",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "scaling",
      headerTooltip: "An OPTIONAL scaling factor to be set customly. Multiplys with p_mw and q_mvar",
      maxWidth: 120,
      valueParser: numberParser,
    },
    {
      field: "type",
      headerTooltip: "Three phase Connection type of the static generator: wye/delta",
      maxWidth: 120,
   
    },
    {
      field: "k",
      headerTooltip: "Ratio of nominal current to short circuit current",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "rx",
      headerTooltip: "R/X ratio for short circuit impedance. Only relevant if type is specified as motor so that sgen is treated as asynchronous motor. Relevant for short-circuit calculation for all generator types",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "generator_type",
      headerTooltip: "can be one of “current_source” (full size converter), “async” (asynchronous generator), or “async_doubly_fed” (doubly fed asynchronous generator, DFIG). Represents the type of the static generator in the context of the short-circuit calculations of wind power station units. If None, other short-circuit-related parameters are not set",
      maxWidth: 120,
    
    },
    {
      field: "lrc_pu",
      headerTooltip: "locked rotor current in relation to the rated generator current. Relevant if the generator_type is “async”.",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "max_ik_ka",
      headerTooltip: "the highest instantaneous short-circuit value in case of a three-phase short-circuit (provided by the manufacturer). Relevant if the generator_type is “async_doubly_fed”.",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "kappa",
      headerTooltip: "the factor for the calculation of the peak short-circuit current, referred to the high-voltage side (provided by the manufacturer). Relevant if the generator_type is “async_doubly_fed”.",
      maxWidth: 100,
      valueParser: numberParser,
    },
    {
      field: "current_source",
      headerTooltip: "Model this sgen as a current source during short- circuit calculations; useful in some cases, for example the simulation of full- size converters per IEC 60909-0:2016.",
      maxWidth: 100,
      valueParser: numberParser,
    }
  ];
  
  var gridOptionsStaticGenerator = {
    columnDefs: columnDefsStaticGenerator,
    defaultColDef: {  
        minWidth: 100,
        editable: true,
    },
    rowData: rowDefsStaticGenerator,
    singleClickEdit: true,
    stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  };     
  
  
  
  