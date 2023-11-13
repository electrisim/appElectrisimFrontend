const  rowDefsTestowanie = [
  { name: "Transformer", sn_mva:0.0,  vn_hv_kv: 0.0, vn_lv_kv: 0.0, vkr_percent: 0.0, vk_percent: 0.0, pfe_kw:0.0, i0_percent:0.0, shift_degree: 0.0, vector_group:"Dyn", vk0_percent:0.0, vkr0_percent:0.0, mag0_percent:0.0, si0_hv_partial:0.0, tap_max:0.0, tap_min:0.0, tap_step_percent:0.0, tap_step_degree:0, tap_phase_shifter:'False'},
  
];  
const columnDefsTestowanie = [
  {
    field: "name",
  },
  {
    field: "sn_mva",
    headerTooltip: "Rated apparent power in MVA",
    maxWidth: 100,
    valueParser: numberParser,

  },
  {
    field: "vn_hv_kv",
    headerTooltip: "rated voltage on high voltage side in kV",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "vn_lv_kv",
    headerTooltip: "rated voltage on low voltage side in kV",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "vkr_percent",
    headerTooltip: "real part of relative short-circuit voltage in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vk_percent",
    headerTooltip: "relative short-circuit voltage in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "pfe_kw",
    headerTooltip: "iron losses in kW",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "i0_percent",
    headerTooltip: "open loop losses in percent of rated current in %",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "shift_degree",
    headerTooltip: "Angle shift over the transformer",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vector_group",
    headerTooltip: "Vector group of the transformer; HV side is Uppercase letters and LV side is lower case",
    maxWidth: 120
  },

  {
    field: "vk0_percent",
    headerTooltip: "zero sequence relative short-circuit voltage in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "vkr0_percent",
    headerTooltip: "real part of zero sequence relative short-circuit voltage in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "mag0_percent",
    headerTooltip: "zero sequence magnetizing impedance in %",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "si0_hv_partial",
    headerTooltip: "distribution of zero sequence leakage impedances for HV side",
    maxWidth: 120,
    valueParser: numberParser,
  },
  {
    field: "tap_max",
    headerTooltip: "maximal allowed tap position",
    maxWidth: 100,
    valueParser: numberParser,
  },
  {
    field: "tap_min",
    headerTooltip: "minimal allowed tap position",
    maxWidth: 100 //tutaj może być liczba ujemna dlatego nie używam numberParser     
  },
  {
    field: "tap_step_percent",
    headerTooltip: "tap step size for voltage magnitude in %",
    maxWidth: 140,
    valueParser: numberParser,
  },
  {
    field: "tap_step_degree",
    headerTooltip: "tap step size for voltage angle in degree",
    maxWidth: 130,
    valueParser: numberParser,
  },
  {
    field: "tap_phase_shifter",
    headerTooltip: "whether the transformer is an ideal phase shifter",
    maxWidth: 140
  }
];
var gridOptionsTrafo = {
  columnDefs: columnDefsTestowanie,
  defaultColDef: {
      //flex: 1,
      minWidth: 100,
      editable: true,
  },
  rowData: rowDefsTestowanie,
  singleClickEdit: true,
  stopEditingWhenGridLosesFocus: true, //musi być żeby przy naciśnięciu Apply zapisywała się wartość 
  //onCellClickedTrafo: onCellClickedTrafo,
  //onRowEditingStarted: onRowEditingStarted, 
  //onRowEditingStopped: onRowEditingStopped,
  onCellValueChanged: onCellValueChanged,
};     

function onCellValueChanged(params) {
  //var rowNode = gridOptionsTrafo.api.getRowNode(params.node.rowIndex);   
  var rowNode = params.node
  console.log("rowNode")    
  console.log(rowNode) 
  rowNode.setData(params.node.data); 
  console.log("rowNode po SETDATA")    
  console.log(rowNode) 
  console.log('Data after change is', params.node);
}
   
  
  
  /*
  const  rowDefsDataTransformerBaseDialog= [
    { name: "Transformer", sn_mva: 0.0, vn_hv_kv: 0.0, vn_lv_kv: 0, vkr_percent: 0, vk_percent: 0, pfe_kw:0, i0_percent:0, shift_degree: 0, vector_group:"Dyn", vk0_percent:0.0, vkr0_percent:0.0, mag0_percent:0.0, si0_hv_partial:0.0, tap_max:0, tap_min:0, tap_step_percent:0, tap_step_degree:0, tap_phase_shifter:'False'},
    
  ];  
  //c.getValue().getAttribute("sn_mva").value
  
  const columnDefsTransformerBaseDialog  = [
      {
        headerName: "Action",
        minWidth: 100,
        cellRenderer: actionCellRenderer,      
        editable: false,
        colId: "action"
      },
      { field: "name", 
        editable: true
       },
      { field: "sn_mva",
         maxWidth: 100,
         headerTooltip: "Rated apparent power in MVA",
        valueParser: numberParser,
      },
      { field: "vn_hv_kv",
      maxWidth: 100,
      valueParser: numberParser,
      },
      { field: "vn_lv_kv",
      maxWidth: 100,
      valueParser: numberParser,
      },
      { field: "vkr_percent",
      maxWidth: 120,
      valueParser: numberParser,
      },
      { field: "vk_percent",
      maxWidth: 120,
      valueParser: numberParser,
      },
      { field: "pfe_kw",
      maxWidth: 100,
      valueParser: numberParser,
      },
      { field: "i0_percent",
      maxWidth: 100,
      valueParser: numberParser,
      },
      { field: "shift_degree",
      maxWidth: 120,
      valueParser: numberParser,
      },
      { field: "vector_group",
      maxWidth: 120 },
      
      { field: "vk0_percent",
      maxWidth: 120,
      valueParser: numberParser,
      },
      { field: "vkr0_percent",
      maxWidth: 120,
      valueParser: numberParser,
      },
      { field: "mag0_percent",
      maxWidth: 120,
      valueParser: numberParser,
      },
      { field: "si0_hv_partial",
      maxWidth: 120,
      valueParser: numberParser,
      },
      { field: "tap_max",
      maxWidth: 100,
      valueParser: numberParser,
      },
      { field: "tap_min", maxWidth: 100 //tutaj może być liczba ujemna dlatego nie używam numberParser     
      },
      { field: "tap_step_percent",
      maxWidth: 140,
      valueParser: numberParser,
      },
      { field: "tap_step_degree",
      maxWidth: 130,
      valueParser: numberParser,
      },
      { field: "tap_phase_shifter",
      maxWidth: 140
      
      }

  ];
  
  
  //edit, delete, update, cancel*********
  function onCellClicked(params) {
  
    // Handle click event for action cells
    if (params.column.colId === "action" && params.event.target.dataset.action) {
      let action = params.event.target.dataset.action;
  
      if (action === "edit") {
        params.api.startEditingCell({
          rowIndex: params.node.rowIndex,
          // gets the first columnKey
          colKey: params.columnApi.getDisplayedCenterColumns()[0].colId
        });
      }
  
      if (action === "delete") {
        console.log(params)
        console.log(params.rowIndex)
  
        let removeRowIndex = params.rowIndex;   
        rowDefsDataTransformerBaseDialog.splice(removeRowIndex, 1); //usun jeden element z indexu
        
          
        params.api.applyTransaction({
          remove: [params.node.data]
        });
      }
  
      if (action === "update") {
        var rowNode = gridOptionsTransformerBaseDialog.api.getRowNode(params.node.rowIndex);      
        rowNode.setData(params.node.data);  
        //rowDefsDataTransformerBaseDialog.push(params.node.data)

        params.api.stopEditing(false);
      }
  
      if (action === "cancel") {
        params.api.stopEditing(true);
      }
      if (action === "add") {  
        
        params.api.applyTransaction({
          add: [{}],
        }); 
        
      }
    }
  }
  function onRowEditingStarted(params) {
    params.api.refreshCells({
      columns: ["action"],
      rowNodes: [params.node],
      force: true
    });
  }
  function onRowEditingStopped(params) { 
   console.log(params) 

    params.api.refreshCells({
      columns: ["action"],
      rowNodes: [params.node],
      force: true
    });
  }
  function actionCellRenderer(params) {
  //function actionCellRenderer(params) {
      let eGui = document.createElement("div");
    
      let editingCells = params.api.getEditingCells();
      // checks if the rowIndex matches in at least one of the editing cells
      let isCurrentRowEditing = editingCells.some((cell) => {
        return cell.rowIndex === params.node.rowIndex;
      });
    
      if (isCurrentRowEditing) {
        eGui.innerHTML = `
            <button  
              class="action-button update"
              data-action="update">
                   update  
            </button>
            <button  
              class="action-button cancel"
              data-action="cancel">
                   cancel
            </button>          
            `;
      } else {
        eGui.innerHTML = `
            <button 
              class="action-button edit"  
              data-action="edit">
                 edit 
              </button>
            <button 
              class="action-button delete"
              data-action="delete">
                 delete
            </button>
            <button  
              class="action-button update"
              data-action="add">
                   add
            </button>
            `;
      }
    
      return eGui;
  }
 
  
  
  //sprawdzenia poprawnego formatowania wprowadzanych parametrów 
  
  function numberParser(params) {
    if(Number(params.newValue) >= 0) {
      return(Number(params.newValue))
    }else {
      alert("The value must be number (dot separated) or >= 0")
      return(Number(params.oldValue))
    }
  }
  

  
  var gridOptionsTransformerBaseDialog = {
    suppressClickEdit: true, //edit, delete, update, cancel
    editType: "fullRow",
    rowSelection: "single",
      
    rowData: rowDefsDataTransformerBaseDialog,
    columnDefs: columnDefsTransformerBaseDialog,
    defaultColDef: {
      editable: true    
    },
  
    //edit, delete, update, cancel
    onCellClicked: onCellClicked,   
    onRowEditingStarted: onRowEditingStarted, 
    onRowEditingStopped: onRowEditingStopped,
    
    onSelectionChanged: () => {
      const selectedData = gridOptionsTransformerBaseDialog.api.getSelectedRows();
      //console.log('Selection Changed', selectedData);
    },
    
    
  };
  */
  