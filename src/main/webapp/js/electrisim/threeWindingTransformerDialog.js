const rowDefsDataThreeWindingTransformer = [
    { name: "63/25/38 MVA 110/20/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 20, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_pos:0, tap_min:-10, tap_max:10},//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
    { name: "63/25/38 MVA 110/10/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 10, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_pos:0, tap_min:-10, tap_max:10},//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
  ];     
  
  const columnDefsThreeWindingTransformer = [
      {
        headerName: "Action",
        minWidth: 100,
        cellRenderer: actionCellRenderer,      
        editable: false,
        colId: "action"
      },
      { field: "name", minWidth: 300 },
      { field: "sn_hv_mva",
        headerTooltip: "rated apparent power on high voltage side",
        maxWidth: 110,
        valueParser: numberParser,
      },
      { field: "sn_mv_mva",
        headerTooltip: "rated apparent power on medium voltage side",
        maxWidth: 110,
        valueParser: numberParser,
      },
      { field: "sn_lv_mva",
        headerTooltip: "rated apparent power on low voltage side",
        maxWidth: 110,
        valueParser: numberParser,
      },
      { field: "vn_hv_kv",
        headerTooltip: "rated voltage on high voltage side",
        maxWidth: 100,
        valueParser: numberParser,
      },
      { 
        field: "vn_mv_kv",
        headerTooltip: "rated voltage on medium voltage side",
        maxWidth: 100,
        valueParser: numberParser,
      },
      { field: "vn_lv_kv",
        headerTooltip: "rated voltage on low voltage side",
        maxWidth: 100,
        valueParser: numberParser,
      },      
      { field: "vk_hv_percent",
        headerTooltip: "short circuit voltage from high to medium voltage",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "vk_mv_percent",
        headerTooltip: "short circuit voltage from medium to low voltage",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "vk_lv_percent",
        headerTooltip: "short circuit voltage from high to low voltage",
        maxWidth: 140,
        valueParser: numberParser,
      },
      { field: "vkr_hv_percent",
      headerTooltip: "real part of short circuit voltage from high to medium voltage",
      maxWidth: 140,
      valueParser: numberParser,
      },
      { field: "vkr_mv_percent",
      headerTooltip: "real part of short circuit voltage from medium to low voltage",
      maxWidth: 140,
      valueParser: numberParser,
      },
      { field: "vkr_lv_percent",
      headerTooltip: "real part of short circuit voltage from high to low voltage",
      maxWidth: 140,
      valueParser: numberParser,
      },
      { field: "pfe_kw",
      headerTooltip: "iron losses in kW",
      maxWidth: 100,      
      valueParser: numberParser,
      },
      { field: "i0_percent",
      headerTooltip: "open loop losses",
      maxWidth: 110,
      valueParser: numberParser,
      },
      { field: "shift_mv_degree",
      headerTooltip: "angle shift to medium voltage side",
      maxWidth: 150,
      valueParser: numberParser,
      },
      { field: "shift_lv_degree",
      headerTooltip: "angle shift to low voltage side",
      maxWidth: 150,
      valueParser: numberParser,
      },
      { field: "tap_step_percent",
      headerTooltip: "Tap step in percent",
      maxWidth: 150,
      valueParser: numberParser,
      },
      { field: "tap_pos",   
      headerTooltip: "current tap position of the transformer. Defaults to the medium position (tap_neutral)",
      maxWidth: 110,   
      },
      { field: "tap_min",   
      headerTooltip: "Minimum tap position",
      maxWidth: 110,   
      },
      { field: "tap_max",
      headerTooltip: "Maximum tap position",
      maxWidth: 110,
      valueParser: numberParser,
      }
      /*
      { field: "vk0_hv_percent",
      valueParser: numberParser,
      },
      { field: "vk0_mv_percent",
      valueParser: numberParser,
      },
      { field: "vk0_lv_percent",
      valueParser: numberParser,
      },
      { field: "vkr0_hv_percent",
      valueParser: numberParser,
      },
      { field: "vkr0_mv_percent",
      valueParser: numberParser,
      },
      { field: "vkr0_lv_percent",
      valueParser: numberParser,
      },
      { field: "vector_group",
      valueParser: numberParser,
      }*/

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
        rowDefsDataThreeWindingTransformer.splice(removeRowIndex, 1); //usun jeden element z indexu
        
          params.api.applyTransaction({
          remove: [params.node.data]
        });
      }
  
      if (action === "update") {
        var rowNode = gridOptionsThreeWindingTransformer.api.getRowNode(params.node.rowIndex);      
        rowNode.setData(params.node.data);  
        rowDefsDataThreeWindingTransformer.push(params.node.data)

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
  //**************************************
  
  

  
  /* wczytywanie pliku CSV */
  function setThreeWindingTransformerCsvData(keys, values) {
  
        
    var result = {}; 
    keys.forEach((key, index) => {
      if (key != "Action"  && index != 0 ){
          result[key.toLowerCase()] = values[index];
      }                    
     });
     console.log("result")
     console.log(result)
  
     rowDefsDataThreeWindingTransformer.push(result)
  
  
     gridOptionsThreeWindingTransformer.api.setRowData(rowDefsDataThreeWindingTransformer);

    
  }
  
  var gridOptionsThreeWindingTransformer = {
    suppressClickEdit: true, //edit, delete, update, cancel
    editType: "fullRow",
    rowSelection: "single",
      
    rowData: rowDefsDataThreeWindingTransformer,
    columnDefs: columnDefsThreeWindingTransformer,
    defaultColDef: {
      editable: true    
    },
  
    //edit, delete, update, cancel*****************
    onCellClicked: onCellClicked,   
    onRowEditingStarted: onRowEditingStarted, 
    onRowEditingStopped: onRowEditingStopped,
    onSelectionChanged: () => {
      const selectedData = gridOptionsThreeWindingTransformer.api.getSelectedRows();
      //console.log('Selection Changed', selectedData);
    },
    //*********************************************
    
  };
  