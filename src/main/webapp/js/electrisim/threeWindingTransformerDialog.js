const rowDefsDataThreeWindingTransformerDialog = [
    { name: "63/25/38 MVA 110/20/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 20, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_min:-10, tap_max:10},//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
    { name: "63/25/38 MVA 110/10/10 kV", sn_hv_mva: 63, sn_mv_mva: 25, sn_lv_mva: 38, vn_hv_kv: 110, vn_mv_kv: 10, vn_lv_kv:10, vk_hv_percent:10.4, vk_mv_percent:10.4, vk_lv_percent:10.4, vkr_hv_percent:0.28, vkr_mv_percent:0.32, vkr_lv_percent:0.35, pfe_kw:35, i0_percent:0.89, shift_mv_degree:0, shift_lv_degree:0, tap_step_percent:1.2, tap_min:-10, tap_max:10},//, vk0_hv_percent:1.0,vk0_mv_percent:1.0,vk0_lv_percent:1.0,vkr0_hv_percent:1.0,vkr0_mv_percent:1.0,vkr0_lv_percent:1.0,vector_group:1.0 },
  ];     
  
  const columnDefsThreeWindingTransformerDialog = [
      {
        headerName: "Action",
        minWidth: 100,
        cellRenderer: actionCellRenderer,      
        editable: false,
        colId: "action"
      },
      { field: "name" },
      { field: "sn_hv_mva",
        valueParser: numberParser,
      },
      { field: "sn_mv_mva",
      valueParser: numberParser,
      },
      { field: "sn_lv_mva",
      valueParser: numberParser,
      },
      { field: "vn_hv_kv",
      valueParser: numberParser,
      },
      { field: "vn_mv_kv",
      valueParser: numberParser,
      },
      { field: "vn_lv_kv",
      valueParser: numberParser,
      },      
      { field: "vk_hv_percent",
      valueParser: numberParser,
      },
      { field: "vk_mv_percent",
      valueParser: numberParser,
      },
      { field: "vk_lv_percent",
      valueParser: numberParser,
      },
      { field: "vkr_hv_percent",
      valueParser: numberParser,
      },
      { field: "vkr_mv_percent",
      valueParser: numberParser,
      },
      { field: "vkr_lv_percent",
      valueParser: numberParser,
      },
      { field: "pfe_kw",
      valueParser: numberParser,
      },
      { field: "i0_percent",
      valueParser: numberParser,
      },
      { field: "shift_mv_degree",
      valueParser: numberParser,
      },
      { field: "shift_lv_degree",
      valueParser: numberParser,
      },
      { field: "tap_step_percent",
      valueParser: numberParser,
      },
      { field: "tap_min",      
      },
      { field: "tap_max",
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
        rowDefsDataThreeWindingTransformerDialog.splice(removeRowIndex, 1); //usun jeden element z indexu
        
          
        params.api.applyTransaction({
          remove: [params.node.data]
        });
      }
  
      if (action === "update") {
        var rowNode = gridOptionsThreeWindingTransformerDialog.api.getRowNode(params.node.rowIndex);      
        rowNode.setData(params.node.data);  

        params.api.stopEditing(false);
      }
  
      if (action === "cancel") {
        params.api.stopEditing(true);
      }
      if (action === "add") {
        rowDefsDataThreeWindingTransformerDialog.push(params.node.data)

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
  
  
  //***********sprawdzenia poprawnego formatowania wprowadzanych parametrów */
  
  function numberParser(params) {
    if(Number(params.newValue) >= 0) {
      return(Number(params.newValue))
    }else {
      alert("The value "+ params +" must be number (comma separated) or >= 0")
      return(Number(params.oldValue))
    }
  }
  /*********************************************** */
  
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
  
     rowDefsDataThreeWindingTransformerDialog.push(result)
  
  
     gridOptionsThreeWindingTransformerDialog.api.setRowData(rowDefsDataThreeWindingTransformerDialog);
    
    /*
    params.api.refreshCells({
      columns: ["action"],
      rowNodes: [params.node],
      force: true
    });*/
    
  }
  
  var gridOptionsThreeWindingTransformerDialog = {
    suppressClickEdit: true, //edit, delete, update, cancel
    editType: "fullRow",
    rowSelection: "single",
      
    rowData: rowDefsDataThreeWindingTransformerDialog,
    columnDefs: columnDefsThreeWindingTransformerDialog,
    defaultColDef: {
      editable: true    
    },
  
    //edit, delete, update, cancel*****************
    onCellClicked: onCellClicked,   
    onRowEditingStarted: onRowEditingStarted, 
    onRowEditingStopped: onRowEditingStopped,
    onSelectionChanged: () => {
      const selectedData = gridOptionsThreeWindingTransformerDialog.api.getSelectedRows();
      //console.log('Selection Changed', selectedData);
    },
    //*********************************************
    
  };
  