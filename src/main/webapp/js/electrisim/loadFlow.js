
function loadFlowPandaPower(a, b, c) {

    //a - App
    //b - Graph
    //c - Editor

    var apka = a
    var grafka = b

    b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showLoadFlowDialogPandaPower("", "Calculate", function (a, c) {

        apka.spinner.spin(document.body, "Waiting for results...")


        //a - parametry obliczeń rozpływowych                
        //b = graph

        //jeśli parametry zostały wpisane policz rozpływ

        if (0 < a.length) {

            //liczba obiektów    
            let cellsArray = []
            cellsArray = b.getModel().getDescendants()


            var busbarNo = 0
            var externalGridNo = 0
            var generatorNo = 0
            var staticGeneratorNo = 0
            var asymmetricStaticGeneratorNo = 0


            var loadNo = 0
            var asymmetricLoadNo = 0
            var impedanceNo = 0
            var wardNo = 0
            var extendedWardNo = 0

            var transformerNo = 0
            var threeWindingTransformerNo = 0

            var shuntReactorNo = 0
            var capacitorNo = 0

            var motorNo = 0

            var lineNo = 0
            var dcLineNo = 0

            var SVCNo = 0
            var TCSCNo = 0
            var SSCNo = 0

            var storageNo = 0

            //Arrays
            var simulationParametersArray = [];

            var busbarArray = [];

            var externalGridArray = [];
            var generatorArray = [];
            var staticGeneratorArray = [];
            var asymmetricStaticGeneratorArray = [];

            var loadArray = [];
            var asymmetricLoadArray = [];
            var impedanceArray = [];
            var wardArray = [];
            var extendedWardArray = [];

            var transformerArray = [];
            var threeWindingTransformerArray = [];

            var shuntReactorArray = [];
            var capacitorArray = [];

            var motorArray = [];

            var lineArray = [];
            var dcLineArray = [];

            var SVCArray = [];
            var TCSCArray = [];
            var SSCArray = [];

            var storageArray = [];

            var dataToBackendArray = [];


            //***************SCZYTYWANIE PARAMETRÓW ROZPŁYWU****************
            var loadFlowParameters = new Object();
            loadFlowParameters.typ = "PowerFlowPandaPower Parameters" //używam PowerFlow zamiast LoadFlow, bo w pythonie występuje błąd
            loadFlowParameters.frequency = a[0]
            loadFlowParameters.algorithm = a[1]
            loadFlowParameters.calculate_voltage_angles = a[2]
            loadFlowParameters.initialization = a[3]
            //for(var i = 0; i < a.length; i++) {

            simulationParametersArray.push(loadFlowParameters)


            //*************** SCZYTYWANIE MODELU DO BACKEND ****************
            //trzeba rozpoznawać po style - styleELXXX = np. Transformer
            const regex = /^\d/g;
            for (var i = 0; i < cellsArray.length; i++) {

                //usun wyniki poprzednich obliczen
                if (typeof (cellsArray[i].getStyle()) != undefined && cellsArray[i].getStyle() != null && cellsArray[i].getStyle().includes("Result")) {

                    var celka = b.getModel().getCell(cellsArray[i].id)
                    b.getModel().remove(celka)
                }

                if (typeof (cellsArray[i].getStyle()) != undefined && cellsArray[i].getStyle() != null) {
                    

                    var key_value = cellsArray[i].getStyle().split(";").map(pair => pair.split("="));
                    const result = Object.fromEntries(key_value);
                    

                    //wybierz obiekty typu Ext_grid
                    if (result.shapeELXXX == "External Grid") {
                  
                        //zrób plik json i wyślij do backend
                        var externalGrid = new Object();
                        externalGrid.typ = "External Grid" + externalGridNo

                        externalGrid.name = cellsArray[i].mxObjectId.replace('#', '_')
                        externalGrid.id = cellsArray[i].id
         
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            externalGrid.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
 
                        }else{
                            externalGrid.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar

                        }
                       
                        //Load_flow_parameters 
                        externalGrid.vm_pu = cellsArray[i].value.attributes[2].nodeValue
                        externalGrid.va_degree = cellsArray[i].value.attributes[3].nodeValue
                        //externalGrid.in_service = cellsArray[i].value.attributes[3].nodeValue

                        //Short_circuit_parameters 
                        externalGrid.s_sc_max_mva = cellsArray[i].value.attributes[5].nodeValue
                        externalGrid.s_sc_min_mva = cellsArray[i].value.attributes[6].nodeValue
                        externalGrid.rx_max = cellsArray[i].value.attributes[7].nodeValue
                        externalGrid.rx_min = cellsArray[i].value.attributes[8].nodeValue
                        externalGrid.r0x0_max = cellsArray[i].value.attributes[9].nodeValue
                        externalGrid.x0x_max = cellsArray[i].value.attributes[10].nodeValue

                        externalGridNo++

                        //var externalGridToBackend = JSON.stringify(externalGrid) //{"name":"External Grid 0","vm_pu":"0", "bus":"mxCell#34"}      
                        externalGridArray.push(externalGrid);
                    }



                    //wybierz obiekty typu Generator
                    if (result.shapeELXXX == "Generator")//cellsArray[i].getStyle().match(/^Generator$/))//includes("Generator")) //(str1.match(/^abc$/))
                    {

                        //zrób plik json i wyślij do backend
                        var generator = new Object();
                        generator.typ = "Generator"

                        generator.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        generator.id = cellsArray[i].id
                        
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            generator.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                           
                        }else{
                            generator.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }
                       
                        //Load_flow_parameters 
                        generator.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        generator.vm_pu = cellsArray[i].value.attributes[3].nodeValue
                        generator.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        generator.scaling = cellsArray[i].value.attributes[5].nodeValue

                        //Short_circuit_parameters 
                        generator.vn_kv = cellsArray[i].value.attributes[7].nodeValue
                        generator.xdss_pu = cellsArray[i].value.attributes[8].nodeValue
                        generator.rdss_ohm = cellsArray[i].value.attributes[9].nodeValue
                        generator.cos_phi = cellsArray[i].value.attributes[10].nodeValue
                        generator.pg_percent = cellsArray[i].value.attributes[11].nodeValue
                        generator.power_station_trafo = cellsArray[i].value.attributes[12].nodeValue

                        generatorNo++

                        generatorArray.push(generator);
                    }

                    //wybierz obiekty typu Static Generator
                    if (result.shapeELXXX == "Static Generator") {


                        //zrób plik json i wyślij do backend
                        var staticGenerator = new Object();
                        staticGenerator.typ = "Static Generator"
                        staticGenerator.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        staticGenerator.id = cellsArray[i].id
                        //w busbar.number zapisz wartość pierwszej cyfry która znalazła się w mxObjectId. 
                                    

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.id != cellsArray[i].id){ 
                            staticGenerator.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }else{
                            staticGenerator.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar                     
                        }

                        //Load_flow_parameters
                        staticGenerator.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        staticGenerator.q_mvar = cellsArray[i].value.attributes[3].nodeValue
                        staticGenerator.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        staticGenerator.scaling = cellsArray[i].value.attributes[5].nodeValue
                        staticGenerator.type = cellsArray[i].value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        staticGenerator.k = cellsArray[i].value.attributes[8].nodeValue
                        staticGenerator.rx = cellsArray[i].value.attributes[9].nodeValue
                        staticGenerator.generator_type = cellsArray[i].value.attributes[10].nodeValue
                        staticGenerator.lrc_pu = cellsArray[i].value.attributes[11].nodeValue
                        staticGenerator.max_ik_ka = cellsArray[i].value.attributes[12].nodeValue
                        staticGenerator.kappa = cellsArray[i].value.attributes[13].nodeValue
                        staticGenerator.current_source = cellsArray[i].value.attributes[14].nodeValue

                        staticGeneratorNo++

                        staticGeneratorArray.push(staticGenerator);
                    }
                    //wybierz obiekty typu Asymmetric Static Generator
                    if (result.shapeELXXX == "Asymmetric Static Generator") {

                        //zrób plik json i wyślij do backend
                        var asymmetricStaticGenerator = new Object();
                        asymmetricStaticGenerator.typ = "Asymmetric Static Generator" + asymmetricStaticGeneratorNo
                        asymmetricStaticGenerator.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        asymmetricStaticGenerator.id = cellsArray[i].id

                                  
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.id != cellsArray[i].id){
                            asymmetricStaticGenerator.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }else{
                            asymmetricStaticGenerator.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }

                        //Load_flow_parameters
                        asymmetricStaticGenerator.p_a_mw = cellsArray[i].value.attributes[2].nodeValue
                        asymmetricStaticGenerator.p_b_mw = cellsArray[i].value.attributes[3].nodeValue
                        asymmetricStaticGenerator.p_c_mw = cellsArray[i].value.attributes[4].nodeValue

                        asymmetricStaticGenerator.q_a_mvar = cellsArray[i].value.attributes[5].nodeValue
                        asymmetricStaticGenerator.q_b_mvar = cellsArray[i].value.attributes[6].nodeValue
                        asymmetricStaticGenerator.q_c_mvar = cellsArray[i].value.attributes[7].nodeValue

                        asymmetricStaticGenerator.sn_mva = cellsArray[i].value.attributes[8].nodeValue
                        asymmetricStaticGenerator.scaling = cellsArray[i].value.attributes[9].nodeValue
                        asymmetricStaticGenerator.type = cellsArray[i].value.attributes[10].nodeValue

                        asymmetricStaticGeneratorNo++

                        asymmetricStaticGeneratorArray.push(asymmetricStaticGenerator);
                    }


                    //wybierz obiekty typu Bus 
                    if (result.shapeELXXX == "Bus") {

                        //zrób plik json i wyślij do backend
                        var busbar = new Object();
                        busbar.typ = "Bus" + busbarNo
                        busbar.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___') //mxObjectId.replace('#', '_')//cellsArray[i].id.replaceAll('-', '_') //zamień wszystkie - na _ żeby można byłoby w pythonie obrabiać  //cellsArray[i].mxObjectId.replace('#', '')
                        busbar.id = cellsArray[i].id    
        
                        //Load_flow_parameters
                        busbar.vn_kv = cellsArray[i].value.attributes[2].nodeValue
                        //busbar.type = cellsArray[i].value.attributes[3].nodeValue
                        //busbar.in_service = cellsArray[i].value.attributes[3].nodeValue
                        busbarNo++

                        busbarArray.push(busbar);
                    }

                    
                    //wybierz obiekty typu Transformer
                    if (result.shapeELXXX == "Transformer") {

                        //zrób plik json i wyślij do backend
                        var transformer = new Object();
                        transformer.typ = "Transformer" + transformerNo
                        transformer.name = cellsArray[i].mxObjectId.replace('#', '_')//cellsArray[i].id.replaceAll('-', '___')
                        transformer.id = cellsArray[i].id 

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){                             
                            transformer.hv_bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        } else{                            
                            transformer.hv_bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }
                        

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[1].target.mxObjectId != cellsArray[i].mxObjectId){                          
                            transformer.lv_bus = cellsArray[i].edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        } else{                            
                            transformer.lv_bus = cellsArray[i].edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters    
                        transformer.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        transformer.vn_hv_kv = cellsArray[i].value.attributes[5].nodeValue
                        transformer.vn_lv_kv = cellsArray[i].value.attributes[6].nodeValue

                        //transformer.in_service = cellsArray[i].value.attributes[15].nodeValue

                        //Short_circuit_parameters
                        transformer.vkr_percent = cellsArray[i].value.attributes[8].nodeValue
                        transformer.vk_percent = cellsArray[i].value.attributes[9].nodeValue
                        transformer.pfe_kw = cellsArray[i].value.attributes[10].nodeValue
                        transformer.i0_percent = cellsArray[i].value.attributes[11].nodeValue
                        transformer.vector_group = cellsArray[i].value.attributes[12].nodeValue
                        transformer.vk0_percent = cellsArray[i].value.attributes[13].nodeValue
                        transformer.vkr0_percent = cellsArray[i].value.attributes[14].nodeValue
                        transformer.mag0_percent = cellsArray[i].value.attributes[15].nodeValue
                        transformer.si0_hv_partial = cellsArray[i].value.attributes[16].nodeValue
                        //transformer.in_service = cellsArray[i].value.attributes[15].nodeValue

                        //Optional_parameters
                        transformer.parallel = cellsArray[i].value.attributes[18].nodeValue
                        transformer.shift_degree = cellsArray[i].value.attributes[19].nodeValue
                        transformer.tap_side = cellsArray[i].value.attributes[20].nodeValue
                        transformer.tap_pos = cellsArray[i].value.attributes[21].nodeValue
                        transformer.tap_neutral = cellsArray[i].value.attributes[22].nodeValue
                        transformer.tap_max = cellsArray[i].value.attributes[23].nodeValue
                        transformer.tap_min = cellsArray[i].value.attributes[24].nodeValue
                        transformer.tap_step_percent = cellsArray[i].value.attributes[25].nodeValue
                        transformer.tap_step_degree = cellsArray[i].value.attributes[26].nodeValue
                        transformer.tap_phase_shifter = cellsArray[i].value.attributes[27].nodeValue
                        /*
                        transformer.max_loading_percent = cellsArray[i].value.attributes[26].nodeValue
                        transformer.df = cellsArray[i].value.attributes[27].nodeValue
                        transformer.oltc = cellsArray[i].value.attributes[28].nodeValue
                        transformer.xn_ohm = cellsArray[i].value.attributes[29].nodeValue */

                        transformerNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        transformerArray.push(transformer);
                    }

                    //zamień w transformerArray kolejności busbar (hv, lv)
                    //porównaj dwa napięcia i dzięki temu określ który jest HV i LV dla danego transformatora
                    //var twoWindingBusbarArray = [];

                    /*for (var xx = 0; xx < transformerArray.length; i++) {

                        bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                        bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);
                        twoWindingBusbarArray.push(bus1)
                        twoWindingBusbarArray.push(bus2)


                        var busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                            (prev, current) => {

                                return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                            }
                        );
                        var busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                            (prev, current) => {
                                return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                            }
                        );

                        transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                        transformerArray[i].lv_bus = busbarWithLowestVoltage.name
                    } */

                    //wybierz obiekty typu Three Winding Transformer
                    if (result.shapeELXXX == "Three Winding Transformer") {

                        //zrób plik json i wyślij do backend
                        var threeWindingTransformer = new Object();
                        threeWindingTransformer.typ = "Three Winding Transformer" + threeWindingTransformerNo                    

                        threeWindingTransformer.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        threeWindingTransformer.id = cellsArray[i].id 

                             
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[2].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            threeWindingTransformer.hv_bus = cellsArray[i].edges[2].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }
                        else{
                            threeWindingTransformer.hv_bus = cellsArray[i].edges[2].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }    

                        if(cellsArray[i].edges[1].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            threeWindingTransformer.mv_bus = cellsArray[i].edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }else{
                            threeWindingTransformer.mv_bus = cellsArray[i].edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){
                            threeWindingTransformer.lv_bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }else{
                            threeWindingTransformer.lv_bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        threeWindingTransformer.sn_hv_mva = cellsArray[i].value.attributes[4].nodeValue
                        threeWindingTransformer.sn_mv_mva = cellsArray[i].value.attributes[5].nodeValue
                        threeWindingTransformer.sn_lv_mva = cellsArray[i].value.attributes[6].nodeValue
                        threeWindingTransformer.vn_hv_kv = cellsArray[i].value.attributes[7].nodeValue
                        threeWindingTransformer.vn_mv_kv = cellsArray[i].value.attributes[8].nodeValue
                        threeWindingTransformer.vn_lv_kv = cellsArray[i].value.attributes[9].nodeValue
                        threeWindingTransformer.vk_hv_percent = cellsArray[i].value.attributes[10].nodeValue
                        threeWindingTransformer.vk_mv_percent = cellsArray[i].value.attributes[11].nodeValue
                        threeWindingTransformer.vk_lv_percent = cellsArray[i].value.attributes[12].nodeValue

                        //Short_circuit_parameters [13]
                        threeWindingTransformer.vkr_hv_percent = cellsArray[i].value.attributes[14].nodeValue
                        threeWindingTransformer.vkr_mv_percent = cellsArray[i].value.attributes[15].nodeValue
                        threeWindingTransformer.vkr_lv_percent = cellsArray[i].value.attributes[16].nodeValue
                        threeWindingTransformer.pfe_kw = cellsArray[i].value.attributes[17].nodeValue
                        threeWindingTransformer.i0_percent = cellsArray[i].value.attributes[18].nodeValue
                        threeWindingTransformer.vk0_hv_percent = cellsArray[i].value.attributes[19].nodeValue
                        threeWindingTransformer.vk0_mv_percent = cellsArray[i].value.attributes[20].nodeValue
                        threeWindingTransformer.vk0_lv_percent = cellsArray[i].value.attributes[21].nodeValue
                        threeWindingTransformer.vkr0_hv_percent = cellsArray[i].value.attributes[22].nodeValue
                        threeWindingTransformer.vkr0_mv_percent = cellsArray[i].value.attributes[23].nodeValue
                        threeWindingTransformer.vkr0_lv_percent = cellsArray[i].value.attributes[24].nodeValue
                        threeWindingTransformer.vector_group = cellsArray[i].value.attributes[25].nodeValue

                        //Optional_parameters [26]
                        threeWindingTransformer.shift_mv_degree = cellsArray[i].value.attributes[27].nodeValue
                        threeWindingTransformer.shift_lv_degree = cellsArray[i].value.attributes[28].nodeValue
                        threeWindingTransformer.tap_step_percent = cellsArray[i].value.attributes[29].nodeValue
                        threeWindingTransformer.tap_side = cellsArray[i].value.attributes[30].nodeValue
                        threeWindingTransformer.tap_neutral = cellsArray[i].value.attributes[31].nodeValue
                        threeWindingTransformer.tap_min = cellsArray[i].value.attributes[32].nodeValue
                        threeWindingTransformer.tap_max = cellsArray[i].value.attributes[33].nodeValue
                        threeWindingTransformer.tap_pos = cellsArray[i].value.attributes[34].nodeValue
                        threeWindingTransformer.tap_at_star_point = cellsArray[i].value.attributes[35].nodeValue
                        threeWindingTransformerNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        threeWindingTransformerArray.push(threeWindingTransformer);
                    }

                    if (result.shapeELXXX == "Shunt Reactor") {

                        //zrób plik json i wyślij do backend
                        var shuntReactor = new Object();
                        shuntReactor.typ = "Shunt Reactor" + shuntReactorNo
                        shuntReactor.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                
                        shuntReactor.id = cellsArray[i].id   

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            shuntReactor.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            shuntReactor.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        shuntReactor.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        shuntReactor.q_mvar = cellsArray[i].value.attributes[3].nodeValue
                        shuntReactor.vn_kv = cellsArray[i].value.attributes[4].nodeValue

                        //Optional_parameters                        
                        shuntReactor.step = cellsArray[i].value.attributes[6].nodeValue
                        shuntReactor.max_step = cellsArray[i].value.attributes[7].nodeValue

                        shuntReactorNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        shuntReactorArray.push(shuntReactor);
                    }

                    if (result.shapeELXXX == "Capacitor") {

                        //zrób plik json i wyślij do backend
                        var capacitor = new Object();
                        capacitor.typ = "Capacitor" + capacitorNo
                        capacitor.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                                 
                        capacitor.id = cellsArray[i].id

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){                        
                            capacitor.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            capacitor.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        capacitor.q_mvar = cellsArray[i].value.attributes[2].nodeValue
                        capacitor.loss_factor = cellsArray[i].value.attributes[3].nodeValue
                        capacitor.vn_kv = cellsArray[i].value.attributes[4].nodeValue
                        //Optional_parameters
                        
                        capacitor.step = cellsArray[i].value.attributes[6].nodeValue
                        capacitor.max_step = cellsArray[i].value.attributes[7].nodeValue

                        capacitorNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        capacitorArray.push(capacitor);
                    }


                    //wybierz obiekty typu Load
                    if (result.shapeELXXX == "Load") {
                        
                        //zrób plik json i wyślij do backend
                        var load = new Object();
                        load.typ = "Load" + loadNo
                        load.name =  cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        load.id = cellsArray[i].id                            
                                               
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){                        
                            load.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
          
                        }
                        else{
                            load.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
           
                        }

                        //Load_flow_parameters
                        load.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        load.q_mvar = cellsArray[i].value.attributes[3].nodeValue
                        load.const_z_percent = cellsArray[i].value.attributes[4].nodeValue
                        load.const_i_percent = cellsArray[i].value.attributes[5].nodeValue
                        load.sn_mva = cellsArray[i].value.attributes[6].nodeValue
                        load.scaling = cellsArray[i].value.attributes[7].nodeValue
                        load.type = cellsArray[i].value.attributes[8].nodeValue

                        loadNo++                 

                        loadArray.push(load);
                    }


                    if (result.shapeELXXX == "Asymmetric Load") {
                        //zrób plik json i wyślij do backend
                        var asymmetricLoad = new Object();
                        asymmetricLoad.typ = "Asymmetric Load" + asymmetricLoadNo
                        asymmetricLoad.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        asymmetricLoad.id = cellsArray[i].id
                    
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){   
                            asymmetricLoad.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            asymmetricLoad.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }


                        //Load_flow_parameters
                        asymmetricLoad.p_a_mw = cellsArray[i].value.attributes[2].nodeValue
                        asymmetricLoad.p_b_mw = cellsArray[i].value.attributes[3].nodeValue
                        asymmetricLoad.p_c_mw = cellsArray[i].value.attributes[4].nodeValue
                        asymmetricLoad.q_a_mvar = cellsArray[i].value.attributes[5].nodeValue
                        asymmetricLoad.q_b_mvar = cellsArray[i].value.attributes[6].nodeValue
                        asymmetricLoad.q_c_mvar = cellsArray[i].value.attributes[7].nodeValue
                        asymmetricLoad.sn_mva = cellsArray[i].value.attributes[8].nodeValue
                        asymmetricLoad.scaling = cellsArray[i].value.attributes[9].nodeValue
                        asymmetricLoad.type = cellsArray[i].value.attributes[10].nodeValue

                        asymmetricLoadNo++

                        asymmetricLoadArray.push(asymmetricLoad);
                    }


                    if (result.shapeELXXX == "Impedance") {
                        //zrób plik json i wyślij do backend
                        var impedance = new Object();
                        impedance.typ = "Impedance" + impedanceNo
                        impedance.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        impedance.id = cellsArray[i].id 

                        try {
                            //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                            if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){
                                impedance.busFrom = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')
                           
                            }else{
                                impedance.busFrom = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')
                         
                            }

                            //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                            if(cellsArray[i].edges[1].target.mxObjectId != cellsArray[i].mxObjectId){
                                impedance.busTo = cellsArray[i].edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
                           
                            }else{
                                impedance.busTo = cellsArray[i].edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
              
                            }

                            //Load_flow_parameters
                            impedance.rft_pu = cellsArray[i].value.attributes[2].nodeValue
                            impedance.xft_pu = cellsArray[i].value.attributes[3].nodeValue
                            impedance.sn_mva = cellsArray[i].value.attributes[4].nodeValue

                            impedanceNo++

                            impedanceArray.push(impedance);
                        } catch { //impedancja musi mieć dwa połączenia
                            alert("Connect an impedance's 'in' and 'out' to other element in the model. The impedance has not been taken into account in the simulation.")
                        }

                    }

                    if (result.shapeELXXX == "Ward") {
                        //zrób plik json i wyślij do backend
                        var ward = new Object();
                        ward.typ = "Ward" + wardNo
                        ward.name = cellsArray[i].mxObjectId.replace('#', '_')
                        ward.id = cellsArray[i].id                       

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            ward.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        
                        }else{
                            ward.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                         
                        }


                        //Load_flow_parameters
                        ward.ps_mw = cellsArray[i].value.attributes[2].nodeValue
                        ward.qs_mvar = cellsArray[i].value.attributes[3].nodeValue
                        ward.pz_mw = cellsArray[i].value.attributes[4].nodeValue
                        ward.qz_mvar = cellsArray[i].value.attributes[5].nodeValue

                        wardNo++

                        wardArray.push(ward);
                    }

                    if (result.shapeELXXX == "Extended Ward") {
                        //zrób plik json i wyślij do backend
                        var extendedWard = new Object();
                        extendedWard.typ = "Extended Ward" + extendedWardNo
                        extendedWard.name = cellsArray[i].mxObjectId.replace('#', '_')
                        extendedWard.id = cellsArray[i].id                       

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            extendedWard.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                          
                        }
                        else{
                            extendedWard.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        extendedWard.ps_mw = cellsArray[i].value.attributes[2].nodeValue
                        extendedWard.qs_mvar = cellsArray[i].value.attributes[3].nodeValue
                        extendedWard.pz_mw = cellsArray[i].value.attributes[4].nodeValue
                        extendedWard.qz_mvar = cellsArray[i].value.attributes[5].nodeValue
                        extendedWard.r_ohm = cellsArray[i].value.attributes[6].nodeValue
                        extendedWard.x_ohm = cellsArray[i].value.attributes[7].nodeValue
                        extendedWard.vm_pu = cellsArray[i].value.attributes[8].nodeValue

                        extendedWardNo++

                        extendedWardArray.push(extendedWard);
                    }

                    if (result.shapeELXXX == "Motor") {
                        //zrób plik json i wyślij do backend
                        var motor = new Object();
                        motor.typ = "Motor" + motorNo
                        motor.name = cellsArray[i].mxObjectId.replace('#', '_')
                        motor.id = cellsArray[i].id 

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            motor.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            motor.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '                            
                        }

                        //Load_flow_parameters
                        motor.pn_mech_mw = cellsArray[i].value.attributes[2].nodeValue
                        motor.cos_phi = cellsArray[i].value.attributes[3].nodeValue
                        motor.efficiency_percent = cellsArray[i].value.attributes[4].nodeValue
                        motor.loading_percent = cellsArray[i].value.attributes[5].nodeValue
                        motor.scaling = cellsArray[i].value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        motor.cos_phi_n = cellsArray[i].value.attributes[8].nodeValue
                        motor.efficiency_n_percent = cellsArray[i].value.attributes[9].nodeValue
                        motor.Irc_pu = cellsArray[i].value.attributes[10].nodeValue
                        motor.rx = cellsArray[i].value.attributes[11].nodeValue
                        motor.vn_kv = cellsArray[i].value.attributes[12].nodeValue

                        //Optional_parameters
                        motor.efficiency_percent = cellsArray[i].value.attributes[14].nodeValue
                        motor.loading_percent = cellsArray[i].value.attributes[15].nodeValue
                        motor.scaling = cellsArray[i].value.attributes[16].nodeValue

                        motorNo++

                        motorArray.push(motor);
                    }

                    if (result.shapeELXXX == "Storage") {
                        //zrób plik json i wyślij do backend
                        var storage = new Object();
                        storage.typ = "Storage" + storageNo
                        storage.name = cellsArray[i].mxObjectId.replace('#', '_')
                        storage.id = cellsArray[i].id 
                     
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            storage.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            storage.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        storage.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        storage.max_e_mwh = cellsArray[i].value.attributes[3].nodeValue

                        //Optional_parameters
                        storage.q_mvar = cellsArray[i].value.attributes[4].nodeValue
                        storage.sn_mva = cellsArray[i].value.attributes[5].nodeValue
                        storage.soc_percent = cellsArray[i].value.attributes[6].nodeValue
                        storage.min_e_mwh = cellsArray[i].value.attributes[7].nodeValue
                        storage.scaling = cellsArray[i].value.attributes[8].nodeValue
                        storage.type = cellsArray[i].value.attributes[9].nodeValue

                        storageNo++

                        storageArray.push(storage);
                    }

                    //FACTS
                    if (result.shapeELXXX == "SVC") {
                        //zrób plik json i wyślij do backend
                        var SVC = new Object();
                        SVC.typ = "SVC" + SVCNo

                        SVC.name = cellsArray[i].mxObjectId.replace('#', '_')
                        SVC.id = cellsArray[i].id

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            SVC.bus = cellsArray[i].edges[0].mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            SVC.bus = cellsArray[i].edges[0].mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        SVC.x_l_ohm = cellsArray[i].value.attributes[1].nodeValue
                        SVC.x_cvar_ohm = cellsArray[i].value.attributes[2].nodeValue
                        SVC.set_vm_pu = cellsArray[i].value.attributes[3].nodeValue
                        SVC.thyristor_firing_angle_degree = cellsArray[i].value.attributes[4].nodeValue

                        //Optional_parameters
                        SVC.controllable = cellsArray[i].value.attributes[5].nodeValue
                        SVC.min_angle_degree = cellsArray[i].value.attributes[6].nodeValue
                        SVC.max_angle_degree = cellsArray[i].value.attributes[7].nodeValue
            
                        SVCNo++

                        SVCArray.push(SVC);
                    }

                    if (result.shapeELXXX == "TCSC") {
                        //zrób plik json i wyślij do backend
                        var TCSC = new Object();
                        TCSC.typ = "TCSC" + TCSCNo
                       
                        TCSC.name = cellsArray[i].mxObjectId.replace('#', '_')//id.replaceAll('-', '___')
                        TCSC.id = cellsArray[i].id

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            TCSC.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            TCSC.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        console.log('TCSC loadflow:')
                        console.log(cellsArray[i])

                        //Load_flow_parameters
                        TCSC.x_l_ohm = cellsArray[i].value.attributes[1].nodeValue
                        TCSC.x_cvar_ohm = cellsArray[i].value.attributes[2].nodeValue
                        TCSC.set_p_to_mw = cellsArray[i].value.attributes[3].nodeValue
                        TCSC.thyristor_firing_angle_degree = cellsArray[i].value.attributes[4].nodeValue

                        //Optional_parameters
                        TCSC.controllable = cellsArray[i].value.attributes[5].nodeValue
                        TCSC.min_angle_degree = cellsArray[i].value.attributes[6].nodeValue
                        TCSC.max_angle_degree = cellsArray[i].value.attributes[7].nodeValue
                       
                        TCSCNo++

                        TCSCArray.push(TCSC);
                    }
                    if (result.shapeELXXX == "SSC") {
                        //zrób plik json i wyślij do backend
                        var SSC = new Object();
                        SSC.typ = "SSC" + SSCNo

                        SSC.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        SSC.id = cellsArray[i].id

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            SSC.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            SSC.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        SSC.r_ohm = cellsArray[i].value.attributes[2].nodeValue
                        SSC.x_ohm = cellsArray[i].value.attributes[3].nodeValue
                        SSC.set_vm_pu = cellsArray[i].value.attributes[4].nodeValue
                        SSC.vm_internal_pu = cellsArray[i].value.attributes[5].nodeValue
                        SSC.va_internal_degree = cellsArray[i].value.attributes[6].nodeValue

                        //Optional_parameters
                        SSC.controllable = cellsArray[i].value.attributes[4].nodeValue
                        

                        SSCNo++

                        SSCArray.push(SSC);
                    }

                    //DC
                    if (result.shapeELXXX == "DC Line") {
                        //zrób plik json i wyślij do backend
                        var dcLine = new Object();
                        dcLine.typ = "DC Line" + dcLineNo
                    
                        dcLine.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        dcLine.id = cellsArray[i].id                

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            dcLine.busFrom = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')
                        }else{
                            dcLine.busFrom = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')
                        }
                        
                        if(cellsArray[i].edges[1].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            dcLine.busTo = cellsArray[i].edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
                        }else{
                            dcLine.busTo = cellsArray[i].edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
                        }


                        //Load_flow_parameters
                        dcLine.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        dcLine.loss_percent = cellsArray[i].value.attributes[3].nodeValue
                        dcLine.loss_mw = cellsArray[i].value.attributes[4].nodeValue
                        dcLine.vm_from_pu = cellsArray[i].value.attributes[5].nodeValue
                        dcLine.vm_to_pu = cellsArray[i].value.attributes[6].nodeValue

                        dcLineNo++

                        dcLineArray.push(dcLine);
                    }


                    //wybierz obiekty typu Line
                    if (result.shapeELXXX == "Line") {
                      

                        //zrób plik json i wyślij do backend
                        var line = new Object();
                        line.typ = "Line" + lineNo

                        line.name = cellsArray[i].mxObjectId.replace('#', '_')//id.replaceAll('-', '___')
                        line.id = cellsArray[i].id


                        //powiadom o błędzie jeśli linia nie będzie podłączona do bus i oznacz linię kolorem czerwonym 
                        try {

                            if (!cellsArray[i].source || !cellsArray[i].source.mxObjectId) {
                                throw new Error(`Error: cellsArray[${i}].source or its mxObjectId is null or undefined`);
                            }
                            if (!cellsArray[i].target || !cellsArray[i].target.mxObjectId) {
                                throw new Error(`Error: cellsArray[${i}].target or its mxObjectId is null or undefined`);
                            }

                            var style=b.getModel().getStyle(cellsArray[i]);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'black');
                            var cs= new Array();
                            cs[0]=cellsArray[i];
                            b.setCellStyle(newStyle,cs); 

                            line.busFrom = cellsArray[i].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')                        
                            line.busTo = cellsArray[i].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')
    
                            
                        }catch (error) {
                            console.error(error.message);                       
                            
                            var style=b.getModel().getStyle(cellsArray[i]);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                            var cs= new Array();
                            cs[0]=cellsArray[i];
                            b.setCellStyle(newStyle,cs); 

                            alert('The line is not connected to the bus. Please check the line highlighted in red and connect it to the appropriate bus.')

                        }
                       

                        line.length_km = cellsArray[i].value.attributes[2].nodeValue
                        line.parallel = cellsArray[i].value.attributes[3].nodeValue
                        line.df = cellsArray[i].value.attributes[4].nodeValue

                        //Load_flow_parameters
                        line.r_ohm_per_km = cellsArray[i].value.attributes[8].nodeValue
                        line.x_ohm_per_km = cellsArray[i].value.attributes[9].nodeValue
                        line.c_nf_per_km = cellsArray[i].value.attributes[10].nodeValue
                        line.g_us_per_km = cellsArray[i].value.attributes[11].nodeValue
                        line.max_i_ka = cellsArray[i].value.attributes[12].nodeValue
                        line.type = cellsArray[i].value.attributes[13].nodeValue

                        //line.in_service = cellsArray[i].value.attributes[13].nodeValue

                        //Short_circuit_parameters
                        line.r0_ohm_per_km = cellsArray[i].value.attributes[15].nodeValue ////w specyfikacji PandaPower jako nan
                        line.x0_ohm_per_km = cellsArray[i].value.attributes[16].nodeValue //w specyfikacji PandaPower jako nan
                        line.c0_nf_per_km = cellsArray[i].value.attributes[17].nodeValue //w specyfikacji PandaPower jako nan
                        line.endtemp_degree = cellsArray[i].value.attributes[18].nodeValue //w specyfikacji PandaPower jako nan

                        lineNo++

                        lineArray.push(line);
                    }

                }
            }
            
            //OKREŚLENIE HV BUSBAR
            for (var i = 0; i < transformerArray.length; i++) {
                var twoWindingBusbarArray = [];
              
                var transformerCell = b.getModel().getCell(transformerArray[i].id)
                var style=b.getModel().getStyle(transformerCell);                

                try{

                   var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'black');
                   var cs= new Array();
                   cs[0]=transformerCell;
                   b.setCellStyle(newStyle,cs); 
                   bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                   bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);

                    twoWindingBusbarArray.push(bus1)
                    twoWindingBusbarArray.push(bus2)

                    var busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                        (prev, current) => {
                            return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                        }
                    );
                    var busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                        }
                    );

                    transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                    transformerArray[i].lv_bus = busbarWithLowestVoltage.name

                }catch (error) {
                    console.error(error.message);
                    var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                    var cs= new Array();
                    cs[0]=transformerCell;
                    b.setCellStyle(newStyle,cs); 
                    alert('The transformer is not connected to the bus. Please check the transformer highlighted in red and connect it to the appropriate bus.')
                }            
            }
            //zamień w threeWindingTransformerArray kolejności busbar (hv, mv, lv)
            //porównaj trzy napięcia i dzięki temu określ który jest HV, MV i LV
           

            for (var i = 0; i < threeWindingTransformerArray.length; i++) {
                var threeWindingBusbarArray = [];   
                
                var threeWindingTransformerCell = b.getModel().getCell(threeWindingTransformerArray[i].id)
                var style=b.getModel().getStyle(threeWindingTransformerCell);  
                
                try{   
                    var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'black');
                    var cs= new Array();
                    cs[0]=threeWindingTransformerCell;
                    b.setCellStyle(newStyle,cs);

                    bus1 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].hv_bus);
                    bus2 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].mv_bus);
                    bus3 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].lv_bus);
                    threeWindingBusbarArray.push(bus1)
                    threeWindingBusbarArray.push(bus2)
                    threeWindingBusbarArray.push(bus3)
                    console.log(threeWindingBusbarArray)

                    var busbarWithHighestVoltage = threeWindingBusbarArray.reduce(
                        (prev, current) => {

                            return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                        }
                    );
                    var busbarWithLowestVoltage = threeWindingBusbarArray.reduce(
                        (prev, current) => {
                            return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                        }
                    );

                    var busbarWithMiddleVoltage = threeWindingBusbarArray.find(element => element.name != busbarWithHighestVoltage.name && element.name != busbarWithLowestVoltage.name);

                    threeWindingTransformerArray[i].hv_bus = busbarWithHighestVoltage.name
                    threeWindingTransformerArray[i].mv_bus = busbarWithMiddleVoltage.name
                    threeWindingTransformerArray[i].lv_bus = busbarWithLowestVoltage.name

                }catch (error) {
                    console.error(error.message);
                    var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                    var cs= new Array();
                    cs[0]=threeWindingTransformerCell;
                    b.setCellStyle(newStyle,cs); 
                    alert('The three-winding transformer is not connected to the bus. Please check the three-winding transformer highlighted in red and connect it to the appropriate bus.')
                    

                }

                
            }

            array = dataToBackendArray.concat(simulationParametersArray)
            array = array.concat(externalGridArray)
            array = array.concat(generatorArray)
            array = array.concat(staticGeneratorArray)
            array = array.concat(asymmetricStaticGeneratorArray)
            array = array.concat(busbarArray)

            array = array.concat(transformerArray)
            array = array.concat(threeWindingTransformerArray)
            array = array.concat(shuntReactorArray)
            array = array.concat(capacitorArray)

            array = array.concat(loadArray)
            array = array.concat(asymmetricLoadArray)
            array = array.concat(impedanceArray)
            array = array.concat(wardArray)
            array = array.concat(extendedWardArray)
            array = array.concat(motorArray)
            array = array.concat(storageArray)

            array = array.concat(SVCArray)
            array = array.concat(TCSCArray)
            array = array.concat(SSCArray)

            array = array.concat(dcLineArray)
            array = array.concat(lineArray)

            var obj = Object.assign({}, array);
            console.log(JSON.stringify(obj))


            var printArray = function (arr) {
                if (typeof (arr) == "object") {
                    for (var i = 0; i < arr.length; i++) {
                        printArray(arr[i]);
                    }
                }
                else document.write(arr);
            }

            /*function zamiana(match, offset, string) {
                console.log('zamiana')
                return '-';//return (offset > 0 ? '-' : '') + match.toLowerCase();
            } */

            //*************** KONIEC - SCZYTYWANIE MODELU DO BACKEND ****************

            //wysyłanie do backend i otrzymywanie wyników
            let dataReceived = "";

            // this.createVertexTemplateEntry("line;strokeWidth=2;html=1;shapeELXXX=Bus;", 160, 10, "", "Bus"),
           

            
            //bootstrap button with spinner 
            // this.ui.spinner.stop();
            fetch("https://03dht3kc-5000.euw.devtunnels.ms/",  { // http://54.159.5.204:80/  http://127.0.0.1:5000/ https://electrisim-0fe342b90b0c.herokuapp.com/
                mode: "cors", 
                method: "post",   
                
                headers: { 
                  "Content-Type": "application/json",   
                  //"Access-Control-Allow-Origin":"*",  //BYŁO NIEPRAWIDŁOWO, TEN PARAMETR TRZEBA NA SERWERZE UMIESZCZAĆ                                                 
                  
                },
                body: JSON.stringify(obj)
            }) 
                 
                .then(response => { 
                    apka.spinner.stop();
                    

                    if (response.status === 200) {
                        console.log("Przyszło 200")
                        console.log(response)
                        return response.json()
                    } else {
                        console.log("Nie przyszło 200")
                        console.log("Status: " + response.status)
                        return Promise.reject("server")
                    }
                })
                .then(dataJson => {
                    console.log("dataJson:")
                    console.log(dataJson)


                    //Obsługiwanie błędów
                    if (dataJson[0] != undefined) {
                        if (dataJson[0] == "line") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("Line" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "bus") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("Bus" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "ext_grid") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("External Grid" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0][0] == "trafo3w") {

                            alert("Three-winding transformer: nominal voltage does not match")
                            //rozpływ się nie udał, output z diagnostic_function
                            //for (var i = 1; i < dataJson.length; i++) {
                            //    console.log(dataJson[i])
                            //    alert("Three Winding Transformer"+dataJson[i][0]+" " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            //}
                        }
                        if (dataJson[0] == "overload") {
                            alert("One of the element is overloaded. The load flow did not converge.")

                        }
                    }


                    //*************** SHOWING RESULTS ON DIAGRAM ****************
           
                    var style = new Object();
                    style[mxConstants.STYLE_FONTSIZE] = '6';
                    //style[mxConstants.STYLE_SHAPE] = 'box';
                    //style[mxConstants.STYLE_STROKECOLOR] = '#000000';
                    //style[mxConstants.STYLE_FONTCOLOR] = '#000000';
                        
                    b.getStylesheet().putCellStyle('labelstyle', style);


                    var lineStyle = new Object();
                    lineStyle[mxConstants.STYLE_FONTSIZE] = '6';                   
                    lineStyle[mxConstants.STYLE_STROKE_OPACITY] = '0';
                    //lineStyle[mxConstants.STYLE_OVERFLOW] = 'hidden';
                        
                    b.getStylesheet().putCellStyle('lineStyle', lineStyle);


                    //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Busbar
                    let csvContent = "data:text/csv;charset=utf-8,Busbar Name,v_m, va_degree, p_mw, q_mvar, pf, q_p\n";
                                       
                    for (var i = 0; i < dataJson.busbars.length; i++) {
                        resultId = dataJson.busbars[i].id                                        
                       
                        dataJson.busbars[i].name = dataJson.busbars[i].name.replace('_', '#')

                        //for the csv file
                        let row = Object.values(dataJson.busbars[i]).join(",")
                        csvContent += row + "\r\n";

                        //create label
                        var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId                        
                        
                        var resultString  = 'Bus' +
                        "\n U[pu]: " + dataJson.busbars[i].vm_pu.toFixed(3) +
                        "\n U[degree]: " + dataJson.busbars[i].va_degree.toFixed(3)+  
                        "\n P[MW]: " + dataJson.busbars[i].p_mw.toFixed(3) +
                        "\n Q[MVar]: " + dataJson.busbars[i].q_mvar.toFixed(3) +
                        "\n PF: " + dataJson.busbars[i].pf.toFixed(3) +
                        "\n Q/P: "+ dataJson.busbars[i].q_p.toFixed(3)

                        var labelka = b.insertVertex(resultCell, null, resultString, 0, 2.7, 0, 0, 'shapeELXXX=Result', true)                        
                        b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])  
                        b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])       
                        
                        
                        //zmiana kolorów przy przekroczeniu obciążenia linii
                        if(dataJson.busbars[i].vm_pu.toFixed(2) >= 1.1 || dataJson.busbars[i].vm_pu.toFixed(2) <= 0.9 ){                                                   
                    
                            var style=grafka.getModel().getStyle(resultCell);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                            var cs= new Array();
                            cs[0]=resultCell;
                            grafka.setCellStyle(newStyle,cs);                              
                            
                        }                        
                        if((dataJson.busbars[i].vm_pu.toFixed(2) > 1.05 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1.1)||(dataJson.busbars[i].vm_pu.toFixed(2) > 0.9 && dataJson.busbars[i].vm_pu.toFixed(2) <= 0.95)){
                                                            
                            var style=grafka.getModel().getStyle(resultCell);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                            var cs= new Array();
                            cs[0]=resultCell;
                            grafka.setCellStyle(newStyle,cs); 
                        }
                        if((dataJson.busbars[i].vm_pu.toFixed(2) > 1 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1.05)||(dataJson.busbars[i].vm_pu.toFixed(2) > 0.95 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1)){
                
                                             
                            var style=grafka.getModel().getStyle(resultCell);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                            var cs= new Array();
                            cs[0]=resultCell;
                            grafka.setCellStyle(newStyle,cs); 
                        }
                        
                        /*
                        var x = 0.2
                        var y = 1
                        var ydelta = 0.8         
                        
                        b.insertVertex(resultCell, null, 'U[pu]: ' + dataJson.busbars[i].vm_pu.toFixed(3), x, y+ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'U[degree]: ' + dataJson.busbars[i].va_degree.toFixed(3), x, y+2*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.busbars[i].p_mw.toFixed(3), x, y+3*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.busbars[i].q_mvar.toFixed(3), x, y+4*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'PF: ' + dataJson.busbars[i].pf.toFixed(3), x, y+5*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  */

                    }

                    if(dataJson.lines != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Line
                        csvContent += "Line Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, i_from_ka, i_to_ka, loading_percent \n";
                        for (var i = 0; i < dataJson.lines.length; i++) {

                            resultId = dataJson.lines[i].id  //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId
                            dataJson.lines[i].name = dataJson.lines[i].name.replace('_', '#')
                         

                            //for the csv file
                            let row = Object.values(dataJson.lines[i]).join(",")
                            csvContent += row + "\r\n";

                          
                            var resultCell = b.getModel().getCell(resultId)
                            var linia = b.getModel().getCell(resultId)    
                        
                            
                            var resultString  = linia.value.attributes[6].nodeValue +
                            "\n P_from[MW]: " + dataJson.lines[i].p_from_mw.toFixed(3) +
                            "\n Q_from[MVar]: " + dataJson.lines[i].q_from_mvar.toFixed(3) +
                            "\n i_from[kA]: " + dataJson.lines[i].i_from_ka.toFixed(3) +
                            "\n"+
                            "\n Loading[%]: " + dataJson.lines[i].loading_percent.toFixed(1) +
                            "\n"+
                            "\n P_to[MW]: " + dataJson.lines[i].p_to_mw.toFixed(3) +
                            "\n Q_to[MVar]: " + dataJson.lines[i].q_to_mvar.toFixed(3) +
                            "\n i_to[kA]: " + dataJson.lines[i].i_to_ka.toFixed(3)                           
                                                                 
 
                            var labelka = b.insertEdge(resultCell, null, resultString, linia.source, linia.target, 'shapeELXXX=Result')
                            
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_STROKE_OPACITY, '0', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_STROKECOLOR, 'white', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_STROKEWIDTH, '0', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_OVERFLOW, 'hidden', [labelka])
                            b.orderCells(true, [labelka]); //edge wyświetla się 'pod' linią                 
                                                   

                            //zmiana kolorów przy przekroczeniu obciążenia linii
                            if(dataJson.lines[i].loading_percent.toFixed(1) > 100){                                       
                                var style=grafka.getModel().getStyle(linia);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                                var cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs);                              
                                
                            }
                            if(dataJson.lines[i].loading_percent.toFixed(1) > 80 && dataJson.lines[i].loading_percent.toFixed(1) <= 100){
                                              
                                var style=grafka.getModel().getStyle(linia);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                                var cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            if(dataJson.lines[i].loading_percent.toFixed(1) > 0 && dataJson.lines[i].loading_percent.toFixed(1) <= 80){
                    
                                                 
                                var style=grafka.getModel().getStyle(linia);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                                var cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs); 
                            }

                           /*
                            b.insertVertex(resultCell, null, 'Line', 0.6, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.lines[i].p_to_mw.toFixed(3), 0.7, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                          
                            b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.lines[i].q_to_mvar.toFixed(3), 0.8, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                          
                            b.insertVertex(resultCell, null, 'i[kA]: ' + dataJson.lines[i].i_to_ka.toFixed(3), 0.9, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            */
                            
                        }
                    }

                    if(dataJson.externalgrids != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy ExternalGrids
                        csvContent += "data:text/csv;charset=utf-8,ExternalGrid Name, p_mw, q_mvar, pf, q_p\n";

                        for (var i = 0; i < dataJson.externalgrids.length; i++) {
                            resultId = dataJson.externalgrids[i].id

                            //sprawdz na jakich pozycjach był znak '-'
                            //podmien w tyc pozycjach znaki
                            
                            dataJson.externalgrids[i].name = dataJson.externalgrids[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.externalgrids[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'External Grid' +
                            "\n P[MW]: " + dataJson.externalgrids[i].p_mw.toFixed(3) +
                            "\n Q[MVar]: " + dataJson.externalgrids[i].q_mvar.toFixed(3) +
                            "\n PF: " + dataJson.externalgrids[i].pf.toFixed(3) +
                            "\n Q/P: " + dataJson.externalgrids[i].q_p.toFixed(3)                      
    
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true)                           
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                        }
                    }
                    
                    if(dataJson.generators != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Generator
                        csvContent += "data:text/csv;charset=utf-8,Generator Name, p_mw, q_mvar, va_degree, vm_pu \n";

                        for (var i = 0; i < dataJson.generators.length; i++) {
                            resultId = dataJson.generators[i].id
                        
                            dataJson.generators[i].name = dataJson.generators[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.generators[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Generator' +
                            "\n P[MW]: " + dataJson.generators[i].p_mw.toFixed(3) +
                            "\n Q[MVar]: " + dataJson.generators[i].q_mvar.toFixed(3) +
                            "\n U[degree]: " + dataJson.generators[i].va_degree.toFixed(3) +
                            "\n Um[pu]: " + dataJson.generators[i].vm_pu.toFixed(3)                        
    
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true) 
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                    
                        }
                    }


                    if(dataJson.staticgenerators != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Static Generator
                        csvContent += "data:text/csv;charset=utf-8, Static Generator Name, p_mw, q_mvar \n";

                        for (var i = 0; i < dataJson.staticgenerators.length; i++) {
                            resultId = dataJson.staticgenerators[i].id
                    
                            dataJson.staticgenerators[i].name = dataJson.staticgenerators[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.staticgenerators[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Static Generator' +
                            "\n P[MW]: " + dataJson.staticgenerators[i].p_mw.toFixed(3) +
                            "\n Q[MVar]: " + dataJson.staticgenerators[i].q_mvar.toFixed(3)                                               
    
                            var labelka = b.insertVertex(resultCell, null, resultString, 0.5, 1.7, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                        }
                    }

                    
                    if(dataJson.asymmetricstaticgenerators != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Asymmetric Static Generator
                        csvContent += "data:text/csv;charset=utf-8, Asymmetric Static Generator Name, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar \n";

                        for (var i = 0; i < dataJson.asymmetricstaticgenerators.length; i++) {
                            resultId = dataJson.asymmetricstaticgenerators[i].id                     

                            dataJson.asymmetricstaticgenerators[i].name = dataJson.asymmetricstaticgenerators[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.asymmetricstaticgenerators[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Asymmetric Static Generator' +
                            "\n P_A[MW]: " + dataJson.asymmetricstaticgenerators[i].p_a_mw.toFixed(3) +
                            "\n Q_A[MVar]: " + dataJson.asymmetricstaticgenerators[i].q_a_mvar.toFixed(3) +
                            "\n P_B[MW]: " + dataJson.asymmetricstaticgenerators[i].p_b_mw.toFixed(3) +
                            "\n Q_B[MVar]: " + dataJson.asymmetricstaticgenerators[i].q_b_mvar.toFixed(3) + 
                            "\n P_C[MW]: " + dataJson.asymmetricstaticgenerators[i].p_c_mw.toFixed(3) +
                            "\n Q_C[MVar]: " + dataJson.asymmetricstaticgenerators[i].q_c_mvar.toFixed(3)                                                 
    
                            var labelka = b.insertVertex(resultCell, null, resultString, 0.5, 1.7, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                              
                        }
                    }

                    if(dataJson.transformers != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Transformer
                        csvContent += "data:text/csv;charset=utf-8, Transformer Name, p_hv_mw, q_hv_mvar, p_lv_mw, q_lv_mvar, pl_mw, ql_mvar, i_hv_ka, i_lv_ka, vm_hv_pu, vm_lv_pu, va_hv_degree, va_lv_degree, loading_percent \n";

                        for (var i = 0; i < dataJson.transformers.length; i++) {
                            resultId = dataJson.transformers[i].id
                  
                            dataJson.transformers[i].name = dataJson.transformers[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.transformers[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId
               
                            var resultString  = resultCell.value.attributes[2].nodeValue +
                            '\n i_HV[kA]: ' + dataJson.transformers[i].i_hv_ka.toFixed(3) +
                            '\n i_LV[kA]: ' + dataJson.transformers[i].i_lv_ka.toFixed(3) +
                            '\n loading[%]: ' + dataJson.transformers[i].loading_percent.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -1.2, 0.6, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  


                             //zmiana kolorów przy przekroczeniu obciążenia linii
                             if(dataJson.transformers[i].loading_percent.toFixed(1) > 100){                                                   
                    
                                var style=grafka.getModel().getStyle(resultCell);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                                var cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs);                              
                                
                            }
                            if(dataJson.transformers[i].loading_percent.toFixed(1) > 80 && dataJson.transformers[i].loading_percent.toFixed(1) <= 100){
                    
                                                 
                                var style=grafka.getModel().getStyle(resultCell);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                                var cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            if(dataJson.transformers[i].loading_percent.toFixed(1) > 0 && dataJson.transformers[i].loading_percent.toFixed(1) <= 80){
                    
                                                 
                                var style=grafka.getModel().getStyle(resultCell);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                                var cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs); 
                            }

                            /*
                            var x = -1.2
                            var y = 0.6
                            var ydelta = 0.15

                            b.insertVertex(resultCell, null, resultString, x, y, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');*/  

                         //   b.insertVertex(resultCell, null, 'P_HV[MW]: ' + dataJson.transformers[i].p_hv_mw.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //   b.insertVertex(resultCell, null, 'Q_HV[MVar]: ' + dataJson.transformers[i].q_hv_mvar.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //   b.insertVertex(resultCell, null, 'P_LV[MW]: ' + dataJson.transformers[i].p_lv_mw.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //  b.insertVertex(resultCell, null, 'Q_LV[MVar]: ' + dataJson.transformers[i].q_lv_mvar.toFixed(3), x, y+4*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');    
                         //   b.insertVertex(resultCell, null, 'Pl[MW]: ' + dataJson.transformers[i].pl_mw.toFixed(3), x, y+5*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //   b.insertVertex(resultCell, null, 'Ql[MVar]: ' + dataJson.transformers[i].ql_mvar.toFixed(3), x, y+6*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                           
                          //  b.insertVertex(resultCell, null, 'i_HV[kA]: ' + dataJson.transformers[i].i_hv_ka.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');          
                          //  b.insertVertex(resultCell, null, 'i_LV[kA]: ' + dataJson.transformers[i].i_lv_ka.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');        
                          //  b.insertVertex(resultCell, null, 'Um_HV[pu]: ' + dataJson.transformers[i].vm_hv_pu.toFixed(3), x, y+9*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                          //  b.insertVertex(resultCell, null, 'Um_LV[pu]: ' + dataJson.transformers[i].vm_lv_pu.toFixed(3), x, y+10*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                     
                          //  b.insertVertex(resultCell, null, 'Ua_HV[degree]: ' + dataJson.transformers[i].va_hv_degree.toFixed(3), x, y+11*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                          //  b.insertVertex(resultCell, null, 'Ua_LV[degree]: ' + dataJson.transformers[i].va_lv_degree.toFixed(3), x, y+12*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                          //  b.insertVertex(resultCell, null, 'loading[%]: ' + dataJson.transformers[i].loading_percent.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                  
                        }
                    }

                    if(dataJson.transformers3W != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Transformer3W
                        csvContent += "data:text/csv;charset=utf-8, Transformer3W Name, p_hv_mw, q_hv_mvar, p_mv_mw, q_mv_mvar, p_lv_mw, q_lv_mvar, pl_mw, ql_mvar, i_hv_ka, i_mv_ka, i_lv_ka, vm_hv_pu, vm_mv_pu, vm_lv_pu, va_hv_degree, va_mv_degree, va_lv_degree, loading_percent  \n";

                        for (var i = 0; i < dataJson.transformers3W.length; i++) {
                            resultId = dataJson.transformers3W[i].id     

                            dataJson.transformers3W[i].name = dataJson.transformers3W[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.transformers3W[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = '3WTransformer' +
                            '\n i_HV[kA]: ' + dataJson.transformers3W[i].i_hv_ka.toFixed(3) +
                            '\n i_MV[kA]: ' + dataJson.transformers3W[i].i_mv_ka.toFixed(3) +
                            '\n i_LV[kA]: ' + dataJson.transformers3W[i].i_lv_ka.toFixed(3) +
                            '\n loading[%]: ' + dataJson.transformers3W[i].loading_percent.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -1.4, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                            /*
                            var x = -1.4
                            var y = -1
                            var ydelta = 0.2
                            b.insertVertex(resultCell, null, 'Transformer3W', x, y, 0, 0, 'labelstyle', true);                        
                            b.insertVertex(resultCell, null, 'P_HV[MW]: ' + dataJson.transformers3W[i].p_hv_mw.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            b.insertVertex(resultCell, null, 'Q_HV[MVar]: ' + dataJson.transformers3W[i].q_hv_mvar.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'P_MV[MW]: ' + dataJson.transformers3W[i].p_mv_mw.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'Q_MV[MVar]: ' + dataJson.transformers3W[i].q_mv_mvar.toFixed(3), x, y+4*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'P_LV[MW]: ' + dataJson.transformers3W[i].p_lv_mw.toFixed(3), x, y+5*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                         
                            b.insertVertex(resultCell, null, 'Q_LV[MVar]: ' + dataJson.transformers3W[i].q_lv_mvar.toFixed(3), x, y+6*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                       
                            b.insertVertex(resultCell, null, 'Pl[MW]: ' + dataJson.transformers3W[i].pl_mw.toFixed(3), x, y+7*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                    
                            b.insertVertex(resultCell, null, 'Ql[MVar]: ' + dataJson.transformers3W[i].ql_mvar.toFixed(3), x, y+8*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'i_HV[kA]: ' + dataJson.transformers3W[i].i_hv_ka.toFixed(3), x, y+9*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'i_MV[kA]: ' + dataJson.transformers3W[i].i_mv_ka.toFixed(3), x, y+10*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'i_LV[kA]: ' + dataJson.transformers3W[i].i_lv_ka.toFixed(3), x, y+11*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_HV[pu]: ' + dataJson.transformers3W[i].vm_hv_pu.toFixed(3), x, y+12*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                           
                            b.insertVertex(resultCell, null, 'Um_MV[pu]: ' + dataJson.transformers3W[i].vm_mv_pu.toFixed(3), x, y+13*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_LV[pu]: ' + dataJson.transformers3W[i].vm_lv_pu.toFixed(3), x, y+14*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Ua_HV[degree]: ' + dataJson.transformers3W[i].va_hv_degree.toFixed(3), x, y+15*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                        
                            b.insertVertex(resultCell, null, 'Ua_MV[degree]: ' + dataJson.transformers3W[i].va_mv_degree.toFixed(3), x, y+16*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'Ua_LV[degree]: ' + dataJson.transformers3W[i].va_lv_degree.toFixed(3), x, y+17*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'loading[%]: ' + dataJson.transformers3W[i].loading_percent.toFixed(3), x, y+18*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            */
                        }
                    }

                    if(dataJson.shunts != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Shunts
                        csvContent += "data:text/csv;charset=utf-8,Shunt Reactor Name, p_mw, q_mvar, vm_pu\n";

                        for (var i = 0; i < dataJson.shunts.length; i++) {
                            resultId = dataJson.shunts[i].id      

                            dataJson.shunts[i].name = dataJson.shunts[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.shunts[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId


                            var resultString  = 'Shunt reactor' +
                            '\n P[MW]: ' + dataJson.shunts[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.shunts[i].q_mvar.toFixed(3) +
                            '\n Um[pu]: ' + dataJson.shunts[i].vm_pu.toFixed(3) 
                            

                            var labelka = b.insertVertex(resultCell, null, resultString, -1, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                            
                        }
                    }

                    if(dataJson.capacitors != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Capacitors
                        csvContent += "data:text/csv;charset=utf-8,Capacitor Name, p_mw, q_mvar, vm_pu\n";

                        for (var i = 0; i < dataJson.capacitors.length; i++) {
                            resultId = dataJson.capacitors[i].id
                            
                            dataJson.capacitors[i].name = dataJson.capacitors[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.capacitors[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Capacitor' +
                            '\n P[MW]: ' + dataJson.capacitors[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.capacitors[i].q_mvar.toFixed(3) +
                            '\n Um[pu]: ' + dataJson.capacitors[i].vm_pu.toFixed(3) 

                            var labelka = b.insertVertex(resultCell, null, resultString, -1, 1, 0, 0, 'shapeELXXX=Result', true);                       
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                        }
                    }    


                    if(dataJson.loads != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Loads
                        csvContent += "data:text/csv;charset=utf-8,Load Name, p_mw, q_mvar\n";

                        for (var i = 0; i < dataJson.loads.length; i++) {
                            resultId = dataJson.loads[i].id                       

                            dataJson.loads[i].name = dataJson.loads[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.loads[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Load' +
                            '\n P[MW]: ' + dataJson.loads[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.loads[i].q_mvar.toFixed(3)                          

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);   
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                                                  
                        }
                    }
                    
                    if(dataJson.asymmetricloads != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy AsymmetricLoads
                        csvContent += "data:text/csv;charset=utf-8,Asymmetric Load Name, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar \n";

                        for (var i = 0; i < dataJson.asymmetricloads.length; i++) {
                            resultId = dataJson.asymmetricloads[i].id
                   
                            dataJson.asymmetricloads[i].name = dataJson.asymmetricloads[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.asymmetricloads[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Asymmetric Load' +
                            '\n P_a[MW]: ' + dataJson.asymmetricloads[i].p_a_mw.toFixed(3) +
                            '\n Q_a[MVar]: ' + dataJson.asymmetricloads[i].q_a_mvar.toFixed(3) +  
                            '\n P_b[MW]: ' + dataJson.asymmetricloads[i].p_b_mw.toFixed(3) +
                            '\n Q_b[MVar]: ' + dataJson.asymmetricloads[i].q_b_mvar.toFixed(3) +  
                            '\n P_c[MW]: ' + dataJson.asymmetricloads[i].p_c_mw.toFixed(3) +
                            '\n Q_c[MVar]: ' + dataJson.asymmetricloads[i].q_c_mvar.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true); 
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                             
                        }
                    }

                    if(dataJson.impedances != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Impedances
                        csvContent += "data:text/csv;charset=utf-8,Impedance Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, pl_mw, ql_mvar, i_from_ka, i_to_ka \n";

                        for (var i = 0; i < dataJson.impedances.length; i++) {
                            resultId = dataJson.impedances[i].id      

                            dataJson.impedances[i].name = dataJson.impedances[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.impedances[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Impedance' +
                            '\n P_from[MW]: ' + dataJson.impedances[i].p_from_mw.toFixed(3) +
                            '\n Q_from[MVar]: ' + dataJson.impedances[i].q_from_mvar.toFixed(3) +  
                            '\n P_to[MW]: ' + dataJson.impedances[i].p_to_mw.toFixed(3) +
                            '\n Q_to[MVar]: ' + dataJson.impedances[i].q_to_mvar.toFixed(3) +  
                            '\n Pl[MW]: ' + dataJson.impedances[i].pl_mw.toFixed(3) +
                            '\n Ql[MVar]: ' + dataJson.impedances[i].ql_mvar.toFixed(3) +                            
                            '\n i_from[kA]: ' + dataJson.impedances[i].i_from_ka.toFixed(3) +
                            '\n i_to[kA]: ' + dataJson.impedances[i].i_to_ka.toFixed(3) 

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);  
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])   
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                          
                        }
                    }

                    if(dataJson.wards != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Wards
                        csvContent += "data:text/csv;charset=utf-8,Ward Name, p_mw, q_mvar, vm_pu \n";

                        for (var i = 0; i < dataJson.wards.length; i++) {
                            resultId = dataJson.wards[i].id   
                            dataJson.wards[i].name = dataJson.wards[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.wards[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Ward' +
                            '\n P[MW]: ' + dataJson.wards[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.wards[i].q_mvar.toFixed(3) +  
                            '\n Um[pu]: ' + dataJson.wards[i].vm_pu.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);    
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])         
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                   
                        }
                    }    

                    if(dataJson.extendedwards != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Extended Wards
                        csvContent += "data:text/csv;charset=utf-8,Extended Ward Name, p_mw, q_mvar, vm_pu \n";

                        for (var i = 0; i < dataJson.extendedwards.length; i++) {
                            resultId = dataJson.extendedwards[i].id   
                            dataJson.extendedwards[i].name = dataJson.extendedwards[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.extendedwards[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Extended Ward' +
                            '\n P[MW]: ' + dataJson.extendedwards[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.extendedwards[i].q_mvar.toFixed(3) +  
                            '\n Um[pu]: ' + dataJson.extendedwards[i].vm_pu.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                        }
                    }
                    
                    
                    if(dataJson.motors != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Motors
                        csvContent += "data:text/csv;charset=utf-8,Motor Name, p_mw, q_mvar \n";

                        for (var i = 0; i < dataJson.motors.length; i++) {
                            resultId = dataJson.motors[i].id   
                            dataJson.motors[i].name = dataJson.motors[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.motors[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Extended Ward' +
                            '\n P[MW]: ' + dataJson.motors[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.motors[i].q_mvar.toFixed(3)   
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                        }
                    }

                    if(dataJson.storages != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Storages
                        csvContent += "data:text/csv;charset=utf-8,Storage Name, p_mw, q_mvar \n";

                        for (var i = 0; i < dataJson.storages.length; i++) {
                            resultId = dataJson.storages[i].id   
                            dataJson.storages[i].name = dataJson.storages[i].name.replace('_', '#')
                       
                            //for the csv file
                            let row = Object.values(dataJson.storages[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Storage' +
                            '\n P[MW]: ' + dataJson.storages[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.storages[i].q_mvar.toFixed(3)   
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                        }
                    }


                    if(dataJson.SVC != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,SVC Name, thyristor_firing_angle_degree, x_ohm, q_mvar, vm_pu, va_degree \n";

                        for (var i = 0; i < dataJson.SVC.length; i++) {
                            resultId = dataJson.SVC[i].id   
                            dataJson.SVC[i].name = dataJson.SVC[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.SVC[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'SVC' +
                            '\n Firing angle[degree]: ' + dataJson.SVC[i].thyristor_firing_angle_degree.toFixed(3) +
                            '\n x[Ohm]: ' + dataJson.SVC[i].x_ohm.toFixed(3) + 
                            '\n q[MVar]: ' + dataJson.SVC[i].q_mvar.toFixed(3) +
                            '\n vm[pu]: ' + dataJson.SVC[i].vm_pu.toFixed(3) +  
                            '\n va[degree]: ' + dataJson.SVC[i].va_degree.toFixed(3)                 
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                                                   
                        }
                    }

                    if(dataJson.TCSC != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,TCSC Name, thyristor_firing_angle_degree, x_ohm, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, p_l_mw, q_l_mvar, vm_from_pu, va_from_degree, vm_to_pu, va_to_degree  \n";

                        for (var i = 0; i < dataJson.TCSC.length; i++) {
                            resultId = dataJson.TCSC[i].id   
                            dataJson.TCSC[i].name = dataJson.TCSC[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.TCSC[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'TCSC' +
                            '\n Firing angle[degree]: ' + dataJson.TCSC[i].thyristor_firing_angle_degree.toFixed(3) +
                            '\n x[Ohm ]: ' + dataJson.TCSC[i].x_ohm.toFixed(3) + 
                            '\n p_from[MW]: ' + dataJson.TCSC[i].p_from_mw.toFixed(3) +
                            '\n q_from[MVar]: ' + dataJson.TCSC[i].q_from_mvar.toFixed(3) +  
                            '\n p_to[MW]: ' + dataJson.TCSC[i].p_to_mw.toFixed(3) +
                            '\n q_to[MVar]: ' + dataJson.TCSC[i].q_to_mvar.toFixed(3) +
                            '\n p_l[MW]: ' + dataJson.TCSC[i].p_l_mw.toFixed(3) +
                            '\n q_l[MVar]: ' + dataJson.TCSC[i].q_l_mvar.toFixed(3) +
                            '\n vm_from[pu]: ' + dataJson.TCSC[i].vm_from_pu.toFixed(3) +
                            '\n va_from[degree]: ' + dataJson.TCSC[i].va_from_degree.toFixed(3) +
                            '\n vm_to[pu]: ' + dataJson.TCSC[i].vm_to_pu.toFixed(3) +
                            '\n va_to[degree]: ' + dataJson.TCSC[i].va_to_degree.toFixed(3)                  
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                                                
                        }
                    }

                    if(dataJson.SSC != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,SSC Name, thyristor_firing_angle_degree, q_mvar, vm_internal_pu, va_internal_degree, vm_pu, va_degree  \n";

                        for (var i = 0; i < dataJson.SSC.length; i++) {
                            resultId = dataJson.SSC[i].id   
                            dataJson.SSC[i].name = dataJson.SSC[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.SSC[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'SSC' +
                            '\n Firing angle[degree]: ' + dataJson.SSC[i].thyristor_firing_angle_degree.toFixed(3) +
                            '\n q[MVar]: ' + dataJson.SSC[i].q_mvar.toFixed(3) + 
                            '\n vm_internal[pu]: ' + dataJson.SSC[i].vm_internal_pu.toFixed(3) +
                            '\n va_internal[degree]: ' + dataJson.SSC[i].va_internal_degree.toFixed(3) +  
                            '\n vm[pu]: ' + dataJson.SSC[i].vm_pu.toFixed(3) +
                            '\n va[degree]: ' + dataJson.SSC[i].va_degree.toFixed(3) 

                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                                                    
                        }
                    }



                    if(dataJson.dclines != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,DCline Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, pl_mw, vm_from_pu, va_from_degree, vm_to_pu, va_to_degree \n";

                        for (var i = 0; i < dataJson.dclines.length; i++) {
                            resultId = dataJson.dclines[i].id   
                            dataJson.dclines[i].name = dataJson.dclines[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.dclines[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'DC line' +
                            '\n P_from[MW]: ' + dataJson.dclines[i].p_from_mw.toFixed(3) +
                            '\n Q_from[MVar]: ' + dataJson.dclines[i].q_from_mvar.toFixed(3) + 
                            '\n P_to[MW]: ' + dataJson.dclines[i].p_to_mw.toFixed(3) +
                            '\n Q_to[MVar]: ' + dataJson.dclines[i].q_to_mvar.toFixed(3) +  
                            '\n Pl[MW]: ' + dataJson.dclines[i].pl_mw.toFixed(3)                 
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                            /*
                            b.insertVertex(resultCell, null, 'U_from[pu]: ' + dataJson.dclines[i].vm_from_pu.toFixed(3), -0.15, 2.2, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            b.insertVertex(resultCell, null, 'Ua_from[degree]: ' + dataJson.dclines[i].va_from_degree.toFixed(3), -0.15, 2.4, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_to[pu]: ' + dataJson.dclines[i].vm_to_pu.toFixed(3), -0.15, 2.6, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');      
                            b.insertVertex(resultCell, null, 'Ua_to[degree]: ' + dataJson.dclines[i].va_to_degree.toFixed(3), -0.15, 2.8, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            */                            
                        }
                    }                     


                    //download to CSV
                    var encodedUri = encodeURI(csvContent);
                    var link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "Results.csv");
                    document.body.appendChild(link); // Required for FF
                    link.click();

                })
                .catch(err => {
                    if (err === "server") return
                    console.log(err)
                })

        }
    })

}

function loadFlowOpenDss(a, b, c) {
    
    //a - App
    //b - Graph
    //c - Editor

    var apka = a
    var grafka = b

    b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showLoadFlowDialogOpenDSS("", "Calculate", function (a, c) {

        apka.spinner.spin(document.body, "Waiting for results...")


        //a - parametry obliczeń rozpływowych                
        //b = graph

        //jeśli parametry zostały wpisane policz rozpływ

        if (0 < a.length) {

            //liczba obiektów    
            let cellsArray = []
            cellsArray = b.getModel().getDescendants()


            var busbarNo = 0
            var externalGridNo = 0
            var generatorNo = 0
            

            var loadNo = 0
        
            var transformerNo = 0
            var threeWindingTransformerNo = 0

            var shuntReactorNo = 0
            var capacitorNo = 0

            var motorNo = 0

            var lineNo = 0  

            var storageNo = 0

            //Arrays
            var simulationParametersArray = [];

            var busbarArray = [];

            var externalGridArray = [];
            var generatorArray = [];
       

            var loadArray = [];
      

            var transformerArray = [];
            var threeWindingTransformerArray = [];

            var shuntReactorArray = [];
            var capacitorArray = [];
            
            var motorArray = [];

            var lineArray = [];       


            var storageArray = [];

            var dataToBackendArray = [];


            //***************SCZYTYWANIE PARAMETRÓW ROZPŁYWU****************
            var loadFlowParameters = new Object();
            loadFlowParameters.typ = "PowerFlowOpenDss Parameters" //używam PowerFlow zamiast LoadFlow, bo w pythonie występuje błąd
            loadFlowParameters.frequency = a[0]
            loadFlowParameters.algorithm = a[1]
           
            //for(var i = 0; i < a.length; i++) {

            simulationParametersArray.push(loadFlowParameters)


            //*************** SCZYTYWANIE MODELU DO BACKEND ****************
            //trzeba rozpoznawać po style - styleELXXX = np. Transformer
            const regex = /^\d/g;
            for (var i = 0; i < cellsArray.length; i++) {

                //usun wyniki poprzednich obliczen
                if (typeof (cellsArray[i].getStyle()) != undefined && cellsArray[i].getStyle() != null && cellsArray[i].getStyle().includes("Result")) {

                    var celka = b.getModel().getCell(cellsArray[i].id)
                    b.getModel().remove(celka)
                }

                if (typeof (cellsArray[i].getStyle()) != undefined && cellsArray[i].getStyle() != null) {
                    

                    var key_value = cellsArray[i].getStyle().split(";").map(pair => pair.split("="));
                    const result = Object.fromEntries(key_value);
                    console.log(result.shapeELXXX)

                    
                    //currently the Open-DSS can work with Busbars, Lines, Loads, Transformers, Capacitors, Generators, Storages            
                    // Define the array of values to check against
                    let excludedValues = ["Result",undefined,"External Grid", "Bus", "Line", "Load", "Transformer", "Capacitor", "Generator", "Storage"];
                    // Check if the property value is not in the array of excluded values

                    console.log('result.shapeELXXX')
                    console.log(result.shapeELXXX)
                    if (!excludedValues.includes(result.shapeELXXX)) {
                        alert("currently the Open-DSS can work with External Grid, Busbars, Lines, Loads, Transformers, Capacitors, Generators, Storages. All other elements will be excluded from calculation")
                    }
                    //wybierz obiekty typu Ext_grid
                    if (result.shapeELXXX == "External Grid") {
                  
                        //zrób plik json i wyślij do backend
                        var externalGrid = new Object();
                        externalGrid.typ = "External Grid" + externalGridNo

                        externalGrid.name = cellsArray[i].mxObjectId.replace('#', '_')
                        externalGrid.id = cellsArray[i].id
                        
                       
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            externalGrid.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
 
                        }else{
                            externalGrid.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar

                        }           
                       
                        //Load_flow_parameters 
                        externalGrid.vm_pu = cellsArray[i].value.attributes[2].nodeValue
                        externalGrid.va_degree = cellsArray[i].value.attributes[3].nodeValue
                        //externalGrid.in_service = cellsArray[i].value.attributes[3].nodeValue

                        //Short_circuit_parameters 
                        externalGrid.s_sc_max_mva = cellsArray[i].value.attributes[5].nodeValue
                        externalGrid.s_sc_min_mva = cellsArray[i].value.attributes[6].nodeValue
                        externalGrid.rx_max = cellsArray[i].value.attributes[7].nodeValue
                        externalGrid.rx_min = cellsArray[i].value.attributes[8].nodeValue
                        externalGrid.r0x0_max = cellsArray[i].value.attributes[9].nodeValue
                        externalGrid.x0x_max = cellsArray[i].value.attributes[10].nodeValue

                        externalGridNo++

                        //var externalGridToBackend = JSON.stringify(externalGrid) //{"name":"External Grid 0","vm_pu":"0", "bus":"mxCell#34"}      
                        externalGridArray.push(externalGrid);
                    }

                    //wybierz obiekty typu Generator
                    if (result.shapeELXXX == "Generator")//cellsArray[i].getStyle().match(/^Generator$/))//includes("Generator")) //(str1.match(/^abc$/))
                    {
                        //zrób plik json i wyślij do backend
                        var generator = new Object();
                        generator.typ = "Generator"

                        generator.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        generator.id = cellsArray[i].id
                        
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            generator.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                           
                        }else{
                            generator.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }
                       
                        //Load_flow_parameters 
                        generator.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        generator.vm_pu = cellsArray[i].value.attributes[3].nodeValue
                        generator.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        generator.scaling = cellsArray[i].value.attributes[5].nodeValue

                        //Short_circuit_parameters 
                        generator.vn_kv = cellsArray[i].value.attributes[7].nodeValue
                        generator.xdss_pu = cellsArray[i].value.attributes[8].nodeValue
                        generator.rdss_ohm = cellsArray[i].value.attributes[9].nodeValue
                        generator.cos_phi = cellsArray[i].value.attributes[10].nodeValue
                        generator.pg_percent = cellsArray[i].value.attributes[11].nodeValue
                        generator.power_station_trafo = cellsArray[i].value.attributes[12].nodeValue

                        generatorNo++

                        generatorArray.push(generator);
                    }

                    //wybierz obiekty typu Bus 
                    if (result.shapeELXXX == "Bus") {

                        //zrób plik json i wyślij do backend
                        var busbar = new Object();
                        busbar.typ = "Bus" + busbarNo

                        busbar.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        busbar.id = cellsArray[i].id

                        //Load_flow_parameters
                        busbar.vn_kv = cellsArray[i].value.attributes[2].nodeValue
                        //busbar.type = cellsArray[i].value.attributes[3].nodeValue
                        //busbar.in_service = cellsArray[i].value.attributes[3].nodeValue
                        busbarNo++

                        busbarArray.push(busbar);
                    }

                    
                    //wybierz obiekty typu Transformer
                    if (result.shapeELXXX == "Transformer") {

                        //zrób plik json i wyślij do backend
                        var transformer = new Object();
                        transformer.typ = "Transformer" + transformerNo
                        transformer.name = cellsArray[i].mxObjectId.replace('#', '_')//cellsArray[i].id.replaceAll('-', '___')
                        transformer.id = cellsArray[i].id 

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){                             
                            transformer.hv_bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        } else{                            
                            transformer.hv_bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }                        

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[1].target.mxObjectId != cellsArray[i].mxObjectId){                          
                            transformer.lv_bus = cellsArray[i].edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        } else{                            
                            transformer.lv_bus = cellsArray[i].edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters    
                        transformer.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        transformer.vn_hv_kv = cellsArray[i].value.attributes[5].nodeValue
                        transformer.vn_lv_kv = cellsArray[i].value.attributes[6].nodeValue

                        //transformer.in_service = cellsArray[i].value.attributes[15].nodeValue

                        //Short_circuit_parameters
                        transformer.vkr_percent = cellsArray[i].value.attributes[8].nodeValue
                        transformer.vk_percent = cellsArray[i].value.attributes[9].nodeValue
                        transformer.pfe_kw = cellsArray[i].value.attributes[10].nodeValue
                        transformer.i0_percent = cellsArray[i].value.attributes[11].nodeValue
                        transformer.vector_group = cellsArray[i].value.attributes[12].nodeValue
                        transformer.vk0_percent = cellsArray[i].value.attributes[13].nodeValue
                        transformer.vkr0_percent = cellsArray[i].value.attributes[14].nodeValue
                        transformer.mag0_percent = cellsArray[i].value.attributes[15].nodeValue
                        transformer.si0_hv_partial = cellsArray[i].value.attributes[16].nodeValue
                        //transformer.in_service = cellsArray[i].value.attributes[15].nodeValue

                        //Optional_parameters
                        transformer.parallel = cellsArray[i].value.attributes[18].nodeValue
                        transformer.shift_degree = cellsArray[i].value.attributes[19].nodeValue
                        transformer.tap_side = cellsArray[i].value.attributes[20].nodeValue
                        transformer.tap_pos = cellsArray[i].value.attributes[21].nodeValue
                        transformer.tap_neutral = cellsArray[i].value.attributes[22].nodeValue
                        transformer.tap_max = cellsArray[i].value.attributes[23].nodeValue
                        transformer.tap_min = cellsArray[i].value.attributes[24].nodeValue
                        transformer.tap_step_percent = cellsArray[i].value.attributes[25].nodeValue
                        transformer.tap_step_degree = cellsArray[i].value.attributes[26].nodeValue
                        transformer.tap_phase_shifter = cellsArray[i].value.attributes[27].nodeValue
                        /*
                        transformer.max_loading_percent = cellsArray[i].value.attributes[26].nodeValue
                        transformer.df = cellsArray[i].value.attributes[27].nodeValue
                        transformer.oltc = cellsArray[i].value.attributes[28].nodeValue
                        transformer.xn_ohm = cellsArray[i].value.attributes[29].nodeValue */

                        transformerNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        transformerArray.push(transformer);
                    }

                    //zamień w transformerArray kolejności busbar (hv, lv)
                    //porównaj dwa napięcia i dzięki temu określ który jest HV i LV dla danego transformatora
                    //var twoWindingBusbarArray = [];

                    /*for (var xx = 0; xx < transformerArray.length; i++) {

                        bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                        bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);
                        twoWindingBusbarArray.push(bus1)
                        twoWindingBusbarArray.push(bus2)


                        var busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                            (prev, current) => {

                                return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                            }
                        );
                        var busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                            (prev, current) => {
                                return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                            }
                        );

                        transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                        transformerArray[i].lv_bus = busbarWithLowestVoltage.name
                    } */

                    //wybierz obiekty typu Three Winding Transformer
                    if (result.shapeELXXX == "Three Winding Transformer") {
                        //zrób plik json i wyślij do backend
                        var threeWindingTransformer = new Object();
                        threeWindingTransformer.typ = "Three Winding Transformer" + threeWindingTransformerNo                    

                        threeWindingTransformer.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        threeWindingTransformer.id = cellsArray[i].id 

                        console.log('cellsArray')
                        console.log(cellsArray[i])
     
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[2].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            threeWindingTransformer.hv_bus = cellsArray[i].edges[2].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }
                        else{
                            threeWindingTransformer.hv_bus = cellsArray[i].edges[2].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }    

                        if(cellsArray[i].edges[1].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            threeWindingTransformer.mv_bus = cellsArray[i].edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }else{
                            threeWindingTransformer.mv_bus = cellsArray[i].edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }

                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){
                            threeWindingTransformer.lv_bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }else{
                            threeWindingTransformer.lv_bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[1].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        threeWindingTransformer.sn_hv_mva = cellsArray[i].value.attributes[4].nodeValue
                        threeWindingTransformer.sn_mv_mva = cellsArray[i].value.attributes[5].nodeValue
                        threeWindingTransformer.sn_lv_mva = cellsArray[i].value.attributes[6].nodeValue
                        threeWindingTransformer.vn_hv_kv = cellsArray[i].value.attributes[7].nodeValue
                        threeWindingTransformer.vn_mv_kv = cellsArray[i].value.attributes[8].nodeValue
                        threeWindingTransformer.vn_lv_kv = cellsArray[i].value.attributes[9].nodeValue
                        threeWindingTransformer.vk_hv_percent = cellsArray[i].value.attributes[10].nodeValue
                        threeWindingTransformer.vk_mv_percent = cellsArray[i].value.attributes[11].nodeValue
                        threeWindingTransformer.vk_lv_percent = cellsArray[i].value.attributes[12].nodeValue

                        //Short_circuit_parameters [13]
                        threeWindingTransformer.vkr_hv_percent = cellsArray[i].value.attributes[14].nodeValue
                        threeWindingTransformer.vkr_mv_percent = cellsArray[i].value.attributes[15].nodeValue
                        threeWindingTransformer.vkr_lv_percent = cellsArray[i].value.attributes[16].nodeValue
                        threeWindingTransformer.pfe_kw = cellsArray[i].value.attributes[17].nodeValue
                        threeWindingTransformer.i0_percent = cellsArray[i].value.attributes[18].nodeValue
                        threeWindingTransformer.vk0_hv_percent = cellsArray[i].value.attributes[19].nodeValue
                        threeWindingTransformer.vk0_mv_percent = cellsArray[i].value.attributes[20].nodeValue
                        threeWindingTransformer.vk0_lv_percent = cellsArray[i].value.attributes[21].nodeValue
                        threeWindingTransformer.vkr0_hv_percent = cellsArray[i].value.attributes[22].nodeValue
                        threeWindingTransformer.vkr0_mv_percent = cellsArray[i].value.attributes[23].nodeValue
                        threeWindingTransformer.vkr0_lv_percent = cellsArray[i].value.attributes[24].nodeValue
                        threeWindingTransformer.vector_group = cellsArray[i].value.attributes[25].nodeValue

                        //Optional_parameters [26]
                        threeWindingTransformer.shift_mv_degree = cellsArray[i].value.attributes[27].nodeValue
                        threeWindingTransformer.shift_lv_degree = cellsArray[i].value.attributes[28].nodeValue
                        threeWindingTransformer.tap_step_percent = cellsArray[i].value.attributes[29].nodeValue
                        threeWindingTransformer.tap_side = cellsArray[i].value.attributes[30].nodeValue
                        threeWindingTransformer.tap_neutral = cellsArray[i].value.attributes[31].nodeValue
                        threeWindingTransformer.tap_min = cellsArray[i].value.attributes[32].nodeValue
                        threeWindingTransformer.tap_max = cellsArray[i].value.attributes[33].nodeValue
                        threeWindingTransformer.tap_pos = cellsArray[i].value.attributes[34].nodeValue
                        threeWindingTransformer.tap_at_star_point = cellsArray[i].value.attributes[35].nodeValue
                        threeWindingTransformerNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        threeWindingTransformerArray.push(threeWindingTransformer);
                    }

                    if (result.shapeELXXX == "Shunt Reactor") {

                        //zrób plik json i wyślij do backend
                        var shuntReactor = new Object();
                        shuntReactor.typ = "Shunt Reactor" + shuntReactorNo
                        shuntReactor.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                
                        shuntReactor.id = cellsArray[i].id        


                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            shuntReactor.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            shuntReactor.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        shuntReactor.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        shuntReactor.q_mvar = cellsArray[i].value.attributes[3].nodeValue
                        shuntReactor.vn_kv = cellsArray[i].value.attributes[4].nodeValue

                        //Optional_parameters                        
                        shuntReactor.step = cellsArray[i].value.attributes[6].nodeValue
                        shuntReactor.max_step = cellsArray[i].value.attributes[7].nodeValue

                        shuntReactorNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        shuntReactorArray.push(shuntReactor);
                    }

                    if (result.shapeELXXX == "Capacitor") {

                        //zrób plik json i wyślij do backend
                        var capacitor = new Object();
                        capacitor.typ = "Capacitor" + capacitorNo
                        capacitor.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                                 
                        capacitor.id = cellsArray[i].id

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){                        
                            capacitor.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            capacitor.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }

                        //Load_flow_parameters
                        capacitor.q_mvar = cellsArray[i].value.attributes[2].nodeValue
                        capacitor.loss_factor = cellsArray[i].value.attributes[3].nodeValue
                        capacitor.vn_kv = cellsArray[i].value.attributes[4].nodeValue
                        //Optional_parameters
                        
                        capacitor.step = cellsArray[i].value.attributes[6].nodeValue
                        capacitor.max_step = cellsArray[i].value.attributes[7].nodeValue

                        capacitorNo++

                        //var transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        capacitorArray.push(capacitor);
                    }


                    //wybierz obiekty typu Load
                    if (result.shapeELXXX == "Load") {
                        
                        //zrób plik json i wyślij do backend
                        var load = new Object();
                        load.typ = "Load" + loadNo
                        load.name =  cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        load.id = cellsArray[i].id                            
                                               
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){                        
                            load.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }
                        else{
                            load.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }        

                        //Load_flow_parameters
                        load.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        load.q_mvar = cellsArray[i].value.attributes[3].nodeValue
                        load.const_z_percent = cellsArray[i].value.attributes[4].nodeValue
                        load.const_i_percent = cellsArray[i].value.attributes[5].nodeValue
                        load.sn_mva = cellsArray[i].value.attributes[6].nodeValue
                        load.scaling = cellsArray[i].value.attributes[7].nodeValue
                        load.type = cellsArray[i].value.attributes[8].nodeValue

                        loadNo++                  

                        loadArray.push(load);
                    }


                    if (result.shapeELXXX == "Motor") {
                       //zrób plik json i wyślij do backend
                       var motor = new Object();
                       motor.typ = "Motor" + motorNo
                       motor.name = cellsArray[i].mxObjectId.replace('#', '_')
                       motor.id = cellsArray[i].id 

                       if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                       {
                           motor.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                       }else{
                           motor.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '                            
                       }

                        //Load_flow_parameters
                        motor.pn_mech_mw = cellsArray[i].value.attributes[2].nodeValue
                        motor.cos_phi = cellsArray[i].value.attributes[3].nodeValue
                        motor.efficiency_percent = cellsArray[i].value.attributes[4].nodeValue
                        motor.loading_percent = cellsArray[i].value.attributes[5].nodeValue
                        motor.scaling = cellsArray[i].value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        motor.cos_phi_n = cellsArray[i].value.attributes[8].nodeValue
                        motor.efficiency_n_percent = cellsArray[i].value.attributes[9].nodeValue
                        motor.Irc_pu = cellsArray[i].value.attributes[10].nodeValue
                        motor.rx = cellsArray[i].value.attributes[11].nodeValue
                        motor.vn_kv = cellsArray[i].value.attributes[12].nodeValue

                        //Optional_parameters
                        motor.efficiency_percent = cellsArray[i].value.attributes[14].nodeValue
                        motor.loading_percent = cellsArray[i].value.attributes[15].nodeValue
                        motor.scaling = cellsArray[i].value.attributes[16].nodeValue

                        motorNo++

                        motorArray.push(motor);
                    }

                    if (result.shapeELXXX == "Storage") {
                        //zrób plik json i wyślij do backend
                        var storage = new Object();
                        storage.typ = "Storage" + storageNo
                        storage.name = cellsArray[i].mxObjectId.replace('#', '_')
                        storage.id = cellsArray[i].id 
                     
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId)
                        {
                            storage.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            storage.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].edges[0].target.mxObjectId.replace('#', '')
                        }                        

                        //Load_flow_parameters
                        storage.p_mw = cellsArray[i].value.attributes[2].nodeValue
                        storage.max_e_mwh = cellsArray[i].value.attributes[3].nodeValue

                        //Optional_parameters
                        storage.q_mvar = cellsArray[i].value.attributes[4].nodeValue
                        storage.sn_mva = cellsArray[i].value.attributes[5].nodeValue
                        storage.soc_percent = cellsArray[i].value.attributes[6].nodeValue
                        storage.min_e_mwh = cellsArray[i].value.attributes[7].nodeValue
                        storage.scaling = cellsArray[i].value.attributes[8].nodeValue
                        storage.type = cellsArray[i].value.attributes[9].nodeValue

                        storageNo++

                        storageArray.push(storage);
                    }


                    //wybierz obiekty typu Line
                    if (result.shapeELXXX == "Line") {

                        //zrób plik json i wyślij do backend
                        var line = new Object();
                        line.typ = "Line" + lineNo

                        line.name = cellsArray[i].mxObjectId.replace('#', '_')//id.replaceAll('-', '___')
                        line.id = cellsArray[i].id
                       
                        line.busFrom = cellsArray[i].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].source.mxObjectId.replace('#', '')                        
                        line.busTo = cellsArray[i].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cellsArray[i].target.mxObjectId.replace('#', '')

                        line.length_km = cellsArray[i].value.attributes[2].nodeValue
                        line.parallel = cellsArray[i].value.attributes[3].nodeValue
                        line.df = cellsArray[i].value.attributes[4].nodeValue
                        
                        //Load_flow_parameters
                        line.r_ohm_per_km = cellsArray[i].value.attributes[8].nodeValue
                        line.x_ohm_per_km = cellsArray[i].value.attributes[9].nodeValue
                        line.c_nf_per_km = cellsArray[i].value.attributes[10].nodeValue
                        line.g_us_per_km = cellsArray[i].value.attributes[11].nodeValue
                        line.max_i_ka = cellsArray[i].value.attributes[12].nodeValue
                        line.type = cellsArray[i].value.attributes[13].nodeValue

                        //line.in_service = cellsArray[i].value.attributes[13].nodeValue

                        //Short_circuit_parameters
                        line.r0_ohm_per_km = cellsArray[i].value.attributes[15].nodeValue ////w specyfikacji PandaPower jako nan
                        line.x0_ohm_per_km = cellsArray[i].value.attributes[16].nodeValue //w specyfikacji PandaPower jako nan
                        line.c0_nf_per_km = cellsArray[i].value.attributes[17].nodeValue //w specyfikacji PandaPower jako nan
                        line.endtemp_degree = cellsArray[i].value.attributes[18].nodeValue //w specyfikacji PandaPower jako nan

                        lineNo++

                        lineArray.push(line);
                    }

                }
            }

            
            //OKREŚLENIE HV BUSBAR
            for (var i = 0; i < transformerArray.length; i++) {
                var twoWindingBusbarArray = [];
                

                bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);


                twoWindingBusbarArray.push(bus1)
                twoWindingBusbarArray.push(bus2)


                var busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {

                        return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                    }
                );
                var busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                    }
                );

                transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                transformerArray[i].lv_bus = busbarWithLowestVoltage.name 
            }            

            //zamień w threeWindingTransformerArray kolejności busbar (hv, mv, lv)
            //porównaj trzy napięcia i dzięki temu określ który jest HV, MV i LV
           

            for (var i = 0; i < threeWindingTransformerArray.length; i++) {
                var threeWindingBusbarArray = [];
                

                bus1 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].hv_bus);
                bus2 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].mv_bus);
                bus3 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].lv_bus);
                threeWindingBusbarArray.push(bus1)
                threeWindingBusbarArray.push(bus2)
                threeWindingBusbarArray.push(bus3)
                console.log(threeWindingBusbarArray)

                var busbarWithHighestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {

                        return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                    }
                );
                var busbarWithLowestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                    }
                );

                var busbarWithMiddleVoltage = threeWindingBusbarArray.find(element => element.name != busbarWithHighestVoltage.name && element.name != busbarWithLowestVoltage.name);

                threeWindingTransformerArray[i].hv_bus = busbarWithHighestVoltage.name
                threeWindingTransformerArray[i].mv_bus = busbarWithMiddleVoltage.name
                threeWindingTransformerArray[i].lv_bus = busbarWithLowestVoltage.name
            }

            array = dataToBackendArray.concat(simulationParametersArray)
            array = array.concat(externalGridArray)
            array = array.concat(generatorArray)
         
            array = array.concat(busbarArray)

            array = array.concat(transformerArray)
            array = array.concat(threeWindingTransformerArray)
            array = array.concat(shuntReactorArray)
            array = array.concat(capacitorArray)

            array = array.concat(loadArray)
         
      
            array = array.concat(motorArray)
            array = array.concat(storageArray)  

            array = array.concat(lineArray)

            var obj = Object.assign({}, array);
            console.log(JSON.stringify(obj))


            var printArray = function (arr) {
                if (typeof (arr) == "object") {
                    for (var i = 0; i < arr.length; i++) {
                        printArray(arr[i]);
                    }
                }
                else document.write(arr);
            }

            /*function zamiana(match, offset, string) {
                console.log('zamiana')
                return '-';//return (offset > 0 ? '-' : '') + match.toLowerCase();
            } */

            //*************** KONIEC - SCZYTYWANIE MODELU DO BACKEND ****************

            //wysyłanie do backend i otrzymywanie wyników
            let dataReceived = "";

            // this.createVertexTemplateEntry("line;strokeWidth=2;html=1;shapeELXXX=Bus;", 160, 10, "", "Bus"),
           

            
            //bootstrap button with spinner 
            // this.ui.spinner.stop();
            fetch("https://03dht3kc-5000.euw.devtunnels.ms/",  {  //http://54.159.5.204:5000///http://127.0.0.1:5000/ //  https://electrisim-0fe342b90b0c.herokuapp.com/
                mode: "cors", 
                method: "post",   
                
                headers: { 
                  "Content-Type": "application/json",   
                  //"Access-Control-Allow-Origin":"*",  //BYŁO NIEPRAWIDŁOWO, TEN PARAMETR TRZEBA NA SERWERZE UMIESZCZAĆ                                                 
                  
                },
                body: JSON.stringify(obj)
            }) 
                 
                .then(response => { 
                    apka.spinner.stop();
                    

                    if (response.status === 200) {
                        console.log("Przyszło 200")
                        console.log(response)
                        return response.json()
                    } else {
                        console.log("Nie przyszło 200")
                        console.log("Status: " + response.status)
                        return Promise.reject("server")
                    }
                })
                .then(dataJson => {
                    console.log("dataJson:")
                    console.log(dataJson)


                    //Obsługiwanie błędów
                    if (dataJson[0] != undefined) {
                        if (dataJson[0] == "line") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("Line" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "bus") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("Bus" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "ext_grid") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (var i = 1; i < dataJson.length; i++) {
                                console.log(dataJson[i])
                                alert("External Grid" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0][0] == "trafo3w") {

                            alert("Three-winding transformer: nominal voltage does not match")
                            //rozpływ się nie udał, output z diagnostic_function
                            //for (var i = 1; i < dataJson.length; i++) {
                            //    console.log(dataJson[i])
                            //    alert("Three Winding Transformer"+dataJson[i][0]+" " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            //}
                        }
                        if (dataJson[0] == "overload") {
                            alert("One of the element is overloaded. The load flow did not converge.")

                        }
                    }


                    //*************** WYŚWIETLANIE WYNIKÓW NA DIAGRAMIE ****************
           
                    var style = new Object();
                    style[mxConstants.STYLE_FONTSIZE] = '6';
                    //style[mxConstants.STYLE_SHAPE] = 'box';
                    //style[mxConstants.STYLE_STROKECOLOR] = '#000000';
                    //style[mxConstants.STYLE_FONTCOLOR] = '#000000';
                        
                    b.getStylesheet().putCellStyle('labelstyle', style);


                    var lineStyle = new Object();
                    lineStyle[mxConstants.STYLE_FONTSIZE] = '6';                   
                    lineStyle[mxConstants.STYLE_STROKE_OPACITY] = '0';
                    //lineStyle[mxConstants.STYLE_OVERFLOW] = 'hidden';
                        
                    b.getStylesheet().putCellStyle('lineStyle', lineStyle);


                    //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Busbar
                    let csvContent = "data:text/csv;charset=utf-8,Busbar Name,v_m, va_degree, p_mw, q_mvar, pf, q_p\n";
                                       
                    for (var i = 0; i < dataJson.busbars.length; i++) {
                        resultId = dataJson.busbars[i].id                                        
                       
                        dataJson.busbars[i].name = dataJson.busbars[i].name.replace('_', '#')

                        //for the csv file
                        let row = Object.values(dataJson.busbars[i]).join(",")
                        csvContent += row + "\r\n";

                        //create label
                        var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId                             
                        
                        var resultString  = 'Bus' +
                        "\n U[pu]: " + dataJson.busbars[i].vm_pu.toFixed(3) +
                        "\n U[degree]: " + dataJson.busbars[i].va_degree.toFixed(3) 

                        /*
                        "\n P[MW]: " + dataJson.busbars[i].p_mw.toFixed(3) +
                        "\n Q[MVar]: " + dataJson.busbars[i].q_mvar.toFixed(3) +
                        "\n PF: " + dataJson.busbars[i].pf.toFixed(3) +
                        "\n Q/P: "+ dataJson.busbars[i].q_p.toFixed(3)*/

                        var labelka = b.insertVertex(resultCell, null, resultString, 0, 2.7, 0, 0, 'shapeELXXX=Result', true)                        
                        b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])  
                        b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])       
                        
                        
                        //zmiana kolorów przy przekroczeniu obciążenia linii
                        if(dataJson.busbars[i].vm_pu.toFixed(2) >= 1.1 || dataJson.busbars[i].vm_pu.toFixed(2) <= 0.9 ){                                                   
                    
                            var style=grafka.getModel().getStyle(resultCell);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                            var cs= new Array();
                            cs[0]=resultCell;
                            grafka.setCellStyle(newStyle,cs);                              
                            
                        }                        
                        if((dataJson.busbars[i].vm_pu.toFixed(2) > 1.05 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1.1)||(dataJson.busbars[i].vm_pu.toFixed(2) > 0.9 && dataJson.busbars[i].vm_pu.toFixed(2) <= 0.95)){
                                                            
                            var style=grafka.getModel().getStyle(resultCell);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                            var cs= new Array();
                            cs[0]=resultCell;
                            grafka.setCellStyle(newStyle,cs); 
                        }
                        if((dataJson.busbars[i].vm_pu.toFixed(2) > 1 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1.05)||(dataJson.busbars[i].vm_pu.toFixed(2) > 0.95 && dataJson.busbars[i].vm_pu.toFixed(2) <= 1)){
                
                                             
                            var style=grafka.getModel().getStyle(resultCell);
                            var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                            var cs= new Array();
                            cs[0]=resultCell;
                            grafka.setCellStyle(newStyle,cs); 
                        }
                        
                        /*
                        var x = 0.2
                        var y = 1
                        var ydelta = 0.8         
                        
                        b.insertVertex(resultCell, null, 'U[pu]: ' + dataJson.busbars[i].vm_pu.toFixed(3), x, y+ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'U[degree]: ' + dataJson.busbars[i].va_degree.toFixed(3), x, y+2*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.busbars[i].p_mw.toFixed(3), x, y+3*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.busbars[i].q_mvar.toFixed(3), x, y+4*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                        b.insertVertex(resultCell, null, 'PF: ' + dataJson.busbars[i].pf.toFixed(3), x, y+5*ydelta, 20, 20, 'labelstyle', true).setStyle('shapeELXXX=Result');  */

                    }

                    if(dataJson.lines != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Line
                        csvContent += "Line Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, i_from_ka, i_to_ka, loading_percent \n";
                        for (var i = 0; i < dataJson.lines.length; i++) {

                            resultId = dataJson.lines[i].id                                        
                       
                            dataJson.lines[i].name = dataJson.lines[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.lines[i]).join(",")
                            csvContent += row + "\r\n";

                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId
                          
                            
                            var linia = b.getModel().getCell(resultId)  
                         

                            //było tu wcześniej
                            //linia.value.attributes[6].nodeValue +
                            var resultString  = "\n P_from[MW]: " + dataJson.lines[i].p_from_mw.toFixed(3) +
                            "\n Q_from[MVar]: " + dataJson.lines[i].q_from_mvar.toFixed(3) +
                            "\n i_from[kA]: " + dataJson.lines[i].i_from_ka.toFixed(3) +
                            /*"\n"+
                            "\n Loading[%]: " + dataJson.lines[i].loading_percent.toFixed(1) +
                            "\n"+*/
                            "\n P_to[MW]: " + dataJson.lines[i].p_to_mw.toFixed(3) +
                            "\n Q_to[MVar]: " + dataJson.lines[i].q_to_mvar.toFixed(3) +
                            "\n i_to[kA]: " + dataJson.lines[i].i_to_ka.toFixed(3)                           
                                                                 
 
                            var labelka = b.insertEdge(resultCell, null, resultString, linia.source, linia.target, 'shapeELXXX=Result')
                            
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_STROKE_OPACITY, '0', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_STROKECOLOR, 'white', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_STROKEWIDTH, '0', [labelka])  
                            b.setCellStyles(mxConstants.STYLE_OVERFLOW, 'hidden', [labelka])
                            b.orderCells(true, [labelka]); //edge wyświetla się 'pod' linią                 
                                                   

                            /*
                            b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.lines[i].p_from_mw.toFixed(3), -0.8, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                            b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.lines[i].q_from_mvar.toFixed(3), -0.7, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');  
                            b.insertVertex(resultCell, null, 'i[kA]: ' + dataJson.lines[i].i_from_ka.toFixed(3), -0.6, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');    
                            */                      

                            /*
                            if (dataJson.parameter[i] == 'i_ka') {
                                var label12 = b.insertVertex(resultCell, null, 'I[kA]: ' + dataJson.value[i].toFixed(3), -0.4, 43, 0, 0, 'labelstyle', true);
                            }
                            
                            if (dataJson.parameter[i] == 'pl_mw') {
                                var label12 = b.insertVertex(resultCell, null, 'Pl[MW]: ' + dataJson.value[i].toFixed(3), -0.2, 43, 0, 0, 'labelstyle', true);
                            }
                            if (dataJson.parameter[i] == 'ql_mvar') {
                                var label12 = b.insertVertex(resultCell, null, 'Ql[MVar]: ' + dataJson.value[i].toFixed(3), -0.1, 43, 0, 0, 'labelstyle', true);
                            } */

                            /*
                            var label12 = b.insertVertex(resultCell, null, 'Loading[%]: ' + dataJson.lines[i].loading_percent.toFixed(1), -0.3, 43, 0, 0, 'labelstyle', true);
                            label12.setStyle('shapeELXXX=Result')
                            label12.setAttribute('idELXXX', 'lineLoadingId')
                            */

                            //zmiana kolorów przy przekroczeniu obciążenia linii
                            /*
                            if(dataJson.lines[i].loading_percent.toFixed(1) > 100){
                    
                                
                    
                                var style=grafka.getModel().getStyle(linia);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                                var cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs);                              
                                
                            }
                            if(dataJson.lines[i].loading_percent.toFixed(1) > 80 && dataJson.lines[i].loading_percent.toFixed(1) <= 100){
                    
                                                 
                                var style=grafka.getModel().getStyle(linia);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                                var cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            if(dataJson.lines[i].loading_percent.toFixed(1) > 0 && dataJson.lines[i].loading_percent.toFixed(1) <= 80){
                    
                                                 
                                var style=grafka.getModel().getStyle(linia);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                                var cs= new Array();
                                cs[0]=linia;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            */

                           /*
                            b.insertVertex(resultCell, null, 'Line', 0.6, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'P[MW]: ' + dataJson.lines[i].p_to_mw.toFixed(3), 0.7, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                          
                            b.insertVertex(resultCell, null, 'Q[MVar]: ' + dataJson.lines[i].q_to_mvar.toFixed(3), 0.8, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                          
                            b.insertVertex(resultCell, null, 'i[kA]: ' + dataJson.lines[i].i_to_ka.toFixed(3), 0.9, 43, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            */
                            
                        }
                    }

                    if(dataJson.externalgrids != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy ExternalGrids
                        csvContent += "data:text/csv;charset=utf-8,ExternalGrid Name, p_mw, q_mvar, pf, q_p\n";

                        for (var i = 0; i < dataJson.externalgrids.length; i++) {
                            resultId = dataJson.externalgrids[i].id  //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId
                            dataJson.lines[i].name = dataJson.externalgrids[i].name.replace('_', '#')


                            //for the csv file
                            let row = Object.values(dataJson.externalgrids[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'External Grid' +
                            "\n P[MW]: " + dataJson.externalgrids[i].p_mw.toFixed(3) +
                            "\n Q[MVar]: " + dataJson.externalgrids[i].q_mvar.toFixed(3) +
                            "\n PF: " + dataJson.externalgrids[i].pf.toFixed(3) +
                            "\n Q/P: " + dataJson.externalgrids[i].q_p.toFixed(3)                      
    
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1.1, 0, 0, 'shapeELXXX=Result', true)                           
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                        }
                    }
                    
                    if(dataJson.generators != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Generator
                        csvContent += "data:text/csv;charset=utf-8,Generator Name, p_mw, q_mvar, va_degree, vm_pu \n";

                        for (var i = 0; i < dataJson.generators.length; i++) {
                            resultId = dataJson.generators[i].id
                        
                            dataJson.generators[i].name = dataJson.generators[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.generators[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Generator' +
                            "\n P[MW]: " + dataJson.generators[i].p_mw.toFixed(3) +
                            "\n Q[MVar]: " + dataJson.generators[i].q_mvar.toFixed(3) +
                            "\n U[degree]: " + dataJson.generators[i].va_degree.toFixed(3) +
                            "\n Um[pu]: " + dataJson.generators[i].vm_pu.toFixed(3)                        
    
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true) 
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                    
                        }
                    }


                    if(dataJson.staticgenerators != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Static Generator
                        csvContent += "data:text/csv;charset=utf-8, Static Generator Name, p_mw, q_mvar \n";

                        for (var i = 0; i < dataJson.staticgenerators.length; i++) {
                            resultId = dataJson.staticgenerators[i].id
                        
                            dataJson.staticgenerators[i].name = dataJson.staticgenerators[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.staticgenerators[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Static Generator' +
                            "\n P[MW]: " + dataJson.staticgenerators[i].p_mw.toFixed(3) +
                            "\n Q[MVar]: " + dataJson.staticgenerators[i].q_mvar.toFixed(3)                                               
    
                            var labelka = b.insertVertex(resultCell, null, resultString, 0.5, 1.7, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                        }
                    }

                    
                    if(dataJson.asymmetricstaticgenerators != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Asymmetric Static Generator
                        csvContent += "data:text/csv;charset=utf-8, Asymmetric Static Generator Name, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar \n";

                        for (var i = 0; i < dataJson.asymmetricstaticgenerators.length; i++) {
                            resultId = dataJson.asymmetricstaticgenerators[i].id
                        
                            dataJson.asymmetricstaticgenerators[i].name = dataJson.asymmetricstaticgenerators[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.asymmetricstaticgenerators[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Asymmetric Static Generator' +
                            "\n P_A[MW]: " + dataJson.asymmetricstaticgenerators[i].p_a_mw.toFixed(3) +
                            "\n Q_A[MVar]: " + dataJson.asymmetricstaticgenerators[i].q_a_mvar.toFixed(3) +
                            "\n P_B[MW]: " + dataJson.asymmetricstaticgenerators[i].p_b_mw.toFixed(3) +
                            "\n Q_B[MVar]: " + dataJson.asymmetricstaticgenerators[i].q_b_mvar.toFixed(3) + 
                            "\n P_C[MW]: " + dataJson.asymmetricstaticgenerators[i].p_c_mw.toFixed(3) +
                            "\n Q_C[MVar]: " + dataJson.asymmetricstaticgenerators[i].q_c_mvar.toFixed(3)                                                 
    
                            var labelka = b.insertVertex(resultCell, null, resultString, 0.5, 1.7, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                              
                        }
                    }

                    if(dataJson.transformers != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Transformer
                        csvContent += "data:text/csv;charset=utf-8, Transformer Name, p_hv_mw, q_hv_mvar, p_lv_mw, q_lv_mvar, pl_mw, ql_mvar, i_hv_ka, i_lv_ka, vm_hv_pu, vm_lv_pu, va_hv_degree, va_lv_degree, loading_percent \n";

                        for (var i = 0; i < dataJson.transformers.length; i++) {
                            resultId = dataJson.transformers[i].id
                        
                            dataJson.transformers[i].name = dataJson.transformers[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.transformers[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId
               
                            var resultString  = resultCell.value.attributes[2].nodeValue +
                            '\n i_HV[kA]: ' + dataJson.transformers[i].i_hv_ka.toFixed(3) +
                            '\n i_LV[kA]: ' + dataJson.transformers[i].i_lv_ka.toFixed(3) 
                            //'\n loading[%]: ' + dataJson.transformers[i].loading_percent.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -1.2, 0.6, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                            /*
                             //zmiana kolorów przy przekroczeniu obciążenia linii
                             if(dataJson.transformers[i].loading_percent.toFixed(1) > 100){                                                   
                    
                                var style=grafka.getModel().getStyle(resultCell);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                                var cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs);                              
                                
                            }
                            if(dataJson.transformers[i].loading_percent.toFixed(1) > 80 && dataJson.transformers[i].loading_percent.toFixed(1) <= 100){
                    
                                                 
                                var style=grafka.getModel().getStyle(resultCell);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'orange');
                                var cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs); 
                            }
                            if(dataJson.transformers[i].loading_percent.toFixed(1) > 0 && dataJson.transformers[i].loading_percent.toFixed(1) <= 80){
                    
                                                 
                                var style=grafka.getModel().getStyle(resultCell);
                                var newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'green');
                                var cs= new Array();
                                cs[0]=resultCell;
                                grafka.setCellStyle(newStyle,cs); 
                            }*/




                            /*
                            var x = -1.2
                            var y = 0.6
                            var ydelta = 0.15

                            b.insertVertex(resultCell, null, resultString, x, y, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');*/  

                         //   b.insertVertex(resultCell, null, 'P_HV[MW]: ' + dataJson.transformers[i].p_hv_mw.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //   b.insertVertex(resultCell, null, 'Q_HV[MVar]: ' + dataJson.transformers[i].q_hv_mvar.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //   b.insertVertex(resultCell, null, 'P_LV[MW]: ' + dataJson.transformers[i].p_lv_mw.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //  b.insertVertex(resultCell, null, 'Q_LV[MVar]: ' + dataJson.transformers[i].q_lv_mvar.toFixed(3), x, y+4*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');    
                         //   b.insertVertex(resultCell, null, 'Pl[MW]: ' + dataJson.transformers[i].pl_mw.toFixed(3), x, y+5*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                         //   b.insertVertex(resultCell, null, 'Ql[MVar]: ' + dataJson.transformers[i].ql_mvar.toFixed(3), x, y+6*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                           
                          //  b.insertVertex(resultCell, null, 'i_HV[kA]: ' + dataJson.transformers[i].i_hv_ka.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');          
                          //  b.insertVertex(resultCell, null, 'i_LV[kA]: ' + dataJson.transformers[i].i_lv_ka.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');        
                          //  b.insertVertex(resultCell, null, 'Um_HV[pu]: ' + dataJson.transformers[i].vm_hv_pu.toFixed(3), x, y+9*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                          //  b.insertVertex(resultCell, null, 'Um_LV[pu]: ' + dataJson.transformers[i].vm_lv_pu.toFixed(3), x, y+10*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                     
                          //  b.insertVertex(resultCell, null, 'Ua_HV[degree]: ' + dataJson.transformers[i].va_hv_degree.toFixed(3), x, y+11*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                          //  b.insertVertex(resultCell, null, 'Ua_LV[degree]: ' + dataJson.transformers[i].va_lv_degree.toFixed(3), x, y+12*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                          //  b.insertVertex(resultCell, null, 'loading[%]: ' + dataJson.transformers[i].loading_percent.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                  
                        }
                    }

                    if(dataJson.transformers3W != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Transformer3W
                        csvContent += "data:text/csv;charset=utf-8, Transformer3W Name, p_hv_mw, q_hv_mvar, p_mv_mw, q_mv_mvar, p_lv_mw, q_lv_mvar, pl_mw, ql_mvar, i_hv_ka, i_mv_ka, i_lv_ka, vm_hv_pu, vm_mv_pu, vm_lv_pu, va_hv_degree, va_mv_degree, va_lv_degree, loading_percent  \n";

                        for (var i = 0; i < dataJson.transformers3W.length; i++) {
                            resultId = dataJson.transformers3W[i].id
                        
                            dataJson.transformers3W[i].name = dataJson.transformers3W[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.transformers3W[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = '3WTransformer' +
                            '\n i_HV[kA]: ' + dataJson.transformers3W[i].i_hv_ka.toFixed(3) +
                            '\n i_MV[kA]: ' + dataJson.transformers3W[i].i_mv_ka.toFixed(3) +
                            '\n i_LV[kA]: ' + dataJson.transformers3W[i].i_lv_ka.toFixed(3) +
                            '\n loading[%]: ' + dataJson.transformers3W[i].loading_percent.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -1.4, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                            /*
                            var x = -1.4
                            var y = -1
                            var ydelta = 0.2
                            b.insertVertex(resultCell, null, 'Transformer3W', x, y, 0, 0, 'labelstyle', true);                        
                            b.insertVertex(resultCell, null, 'P_HV[MW]: ' + dataJson.transformers3W[i].p_hv_mw.toFixed(3), x, y+ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            b.insertVertex(resultCell, null, 'Q_HV[MVar]: ' + dataJson.transformers3W[i].q_hv_mvar.toFixed(3), x, y+2*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'P_MV[MW]: ' + dataJson.transformers3W[i].p_mv_mw.toFixed(3), x, y+3*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'Q_MV[MVar]: ' + dataJson.transformers3W[i].q_mv_mvar.toFixed(3), x, y+4*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'P_LV[MW]: ' + dataJson.transformers3W[i].p_lv_mw.toFixed(3), x, y+5*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                         
                            b.insertVertex(resultCell, null, 'Q_LV[MVar]: ' + dataJson.transformers3W[i].q_lv_mvar.toFixed(3), x, y+6*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                       
                            b.insertVertex(resultCell, null, 'Pl[MW]: ' + dataJson.transformers3W[i].pl_mw.toFixed(3), x, y+7*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                    
                            b.insertVertex(resultCell, null, 'Ql[MVar]: ' + dataJson.transformers3W[i].ql_mvar.toFixed(3), x, y+8*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'i_HV[kA]: ' + dataJson.transformers3W[i].i_hv_ka.toFixed(3), x, y+9*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'i_MV[kA]: ' + dataJson.transformers3W[i].i_mv_ka.toFixed(3), x, y+10*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'i_LV[kA]: ' + dataJson.transformers3W[i].i_lv_ka.toFixed(3), x, y+11*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_HV[pu]: ' + dataJson.transformers3W[i].vm_hv_pu.toFixed(3), x, y+12*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                           
                            b.insertVertex(resultCell, null, 'Um_MV[pu]: ' + dataJson.transformers3W[i].vm_mv_pu.toFixed(3), x, y+13*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_LV[pu]: ' + dataJson.transformers3W[i].vm_lv_pu.toFixed(3), x, y+14*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Ua_HV[degree]: ' + dataJson.transformers3W[i].va_hv_degree.toFixed(3), x, y+15*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                        
                            b.insertVertex(resultCell, null, 'Ua_MV[degree]: ' + dataJson.transformers3W[i].va_mv_degree.toFixed(3), x, y+16*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'Ua_LV[degree]: ' + dataJson.transformers3W[i].va_lv_degree.toFixed(3), x, y+17*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            b.insertVertex(resultCell, null, 'loading[%]: ' + dataJson.transformers3W[i].loading_percent.toFixed(3), x, y+18*ydelta, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');
                            */
                        }
                    }

                    if(dataJson.shunts != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Shunts
                        csvContent += "data:text/csv;charset=utf-8,Shunt Reactor Name, p_mw, q_mvar, vm_pu\n";

                        for (var i = 0; i < dataJson.shunts.length; i++) {
                            resultId = dataJson.shunts[i].id
                        
                            dataJson.shunts[i].name = dataJson.shunts[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.shunts[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId


                            var resultString  = 'Shunt reactor' +
                            '\n P[MW]: ' + dataJson.shunts[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.shunts[i].q_mvar.toFixed(3) +
                            '\n Um[pu]: ' + dataJson.shunts[i].vm_pu.toFixed(3) 
                            

                            var labelka = b.insertVertex(resultCell, null, resultString, -1, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                            
                        }
                    }

                    if(dataJson.capacitors != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Capacitors
                        csvContent += "data:text/csv;charset=utf-8,Capacitor Name, p_mw, q_mvar, vm_pu\n";

                        for (var i = 0; i < dataJson.capacitors.length; i++) {
                            
                            
                            resultId = dataJson.capacitors[i].id
                        
                            dataJson.capacitors[i].name = dataJson.capacitors[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.capacitors[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Capacitor' +
                            '\n P[MW]: ' + dataJson.capacitors[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.capacitors[i].q_mvar.toFixed(3)// +
                            //'\n Um[pu]: ' + dataJson.capacitors[i].vm_pu.toFixed(3) 

                            var labelka = b.insertVertex(resultCell, null, resultString, -1, 1, 0, 0, 'shapeELXXX=Result', true);                       
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                        }
                    }    


                    if(dataJson.loads != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Loads
                        csvContent += "data:text/csv;charset=utf-8,Load Name, p_mw, q_mvar\n";

                        for (var i = 0; i < dataJson.loads.length; i++) {
                            resultId = dataJson.loads[i].id                        
                            dataJson.loads[i].name = dataJson.loads[i].name.replace('_', '#')
                            
                            //for the csv file
                            let row = Object.values(dataJson.loads[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Load' +
                            '\n P[MW]: ' + dataJson.loads[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.loads[i].q_mvar.toFixed(3)                          

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);   
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                                                 
                        }
                    }
                    
                    if(dataJson.asymmetricloads != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy AsymmetricLoads
                        csvContent += "data:text/csv;charset=utf-8,Asymmetric Load Name, p_a_mw, q_a_mvar, p_b_mw, q_b_mvar, p_c_mw, q_c_mvar \n";

                        for (var i = 0; i < dataJson.asymmetricloads.length; i++) {
                            resultId = dataJson.asymmetricloads[i].id                        
                            dataJson.asymmetricloads[i].name = dataJson.asymmetricloads[i].name.replace('_', '#')

                            //sprawdz na jakich pozycjach był znak '-'
                            //podmien w tyc pozycjach znaki
                            resultId = resultId.replaceAll('___', '-')

                            dataJson.asymmetricloads[i].name = resultId

                            //for the csv file
                            let row = Object.values(dataJson.asymmetricloads[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Asymmetric Load' +
                            '\n P_a[MW]: ' + dataJson.asymmetricloads[i].p_a_mw.toFixed(3) +
                            '\n Q_a[MVar]: ' + dataJson.asymmetricloads[i].q_a_mvar.toFixed(3) +  
                            '\n P_b[MW]: ' + dataJson.asymmetricloads[i].p_b_mw.toFixed(3) +
                            '\n Q_b[MVar]: ' + dataJson.asymmetricloads[i].q_b_mvar.toFixed(3) +  
                            '\n P_c[MW]: ' + dataJson.asymmetricloads[i].p_c_mw.toFixed(3) +
                            '\n Q_c[MVar]: ' + dataJson.asymmetricloads[i].q_c_mvar.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true); 
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                             
                        }
                    }

                    if(dataJson.impedances != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Impedances
                        csvContent += "data:text/csv;charset=utf-8,Impedance Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, pl_mw, ql_mvar, i_from_ka, i_to_ka \n";

                        for (var i = 0; i < dataJson.impedances.length; i++) {
                            resultId = dataJson.impedances[i].id                        
                            dataJson.impedances[i].name = dataJson.impedances[i].name.replace('_', '#')
                            
                            //for the csv file
                            let row = Object.values(dataJson.impedances[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Impedance' +
                            '\n P_from[MW]: ' + dataJson.impedances[i].p_from_mw.toFixed(3) +
                            '\n Q_from[MVar]: ' + dataJson.impedances[i].q_from_mvar.toFixed(3) +  
                            '\n P_to[MW]: ' + dataJson.impedances[i].p_to_mw.toFixed(3) +
                            '\n Q_to[MVar]: ' + dataJson.impedances[i].q_to_mvar.toFixed(3) +  
                            '\n Pl[MW]: ' + dataJson.impedances[i].pl_mw.toFixed(3) +
                            '\n Ql[MVar]: ' + dataJson.impedances[i].ql_mvar.toFixed(3) +                            
                            '\n i_from[kA]: ' + dataJson.impedances[i].i_from_ka.toFixed(3) +
                            '\n i_to[kA]: ' + dataJson.impedances[i].i_to_ka.toFixed(3) 

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);  
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])   
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                          
                        }
                    }

                    if(dataJson.wards != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Wards
                        csvContent += "data:text/csv;charset=utf-8,Ward Name, p_mw, q_mvar, vm_pu \n";

                        for (var i = 0; i < dataJson.wards.length; i++) {
                            resultId = dataJson.wards[i].id                        
                            dataJson.wards[i].name = dataJson.wards[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.wards[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Ward' +
                            '\n P[MW]: ' + dataJson.wards[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.wards[i].q_mvar.toFixed(3) +  
                            '\n Um[pu]: ' + dataJson.wards[i].vm_pu.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);    
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])         
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                   
                        }
                    }    

                    if(dataJson.extendedwards != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Extended Wards
                        csvContent += "data:text/csv;charset=utf-8,Extended Ward Name, p_mw, q_mvar, vm_pu \n";

                        for (var i = 0; i < dataJson.extendedwards.length; i++) {
                            resultId = dataJson.extendedwards[i].id                        
                            dataJson.extendedwards[i].name = dataJson.extendedwards[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.extendedwards[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Extended Ward' +
                            '\n P[MW]: ' + dataJson.extendedwards[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.extendedwards[i].q_mvar.toFixed(3) +  
                            '\n Um[pu]: ' + dataJson.extendedwards[i].vm_pu.toFixed(3)

                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                        }
                    }
                    
                    
                    if(dataJson.motors != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Motors
                        csvContent += "data:text/csv;charset=utf-8,Motor Name, p_mw, q_mvar \n";

                        for (var i = 0; i < dataJson.motors.length; i++) {
                            resultId = dataJson.motors[i].id                        
                            dataJson.motors[i].name = dataJson.motors[i].name.replace('_', '#')

                            //sprawdz na jakich pozycjach był znak '-'
                            //podmien w tyc pozycjach znaki
                            resultId = resultId.replaceAll('___', '-')

                            dataJson.motors[i].name = resultId

                            //for the csv file
                            let row = Object.values(dataJson.motors[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Extended Ward' +
                            '\n P[MW]: ' + dataJson.motors[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.motors[i].q_mvar.toFixed(3)   
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                        }
                    }

                    if(dataJson.storages != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Storages
                        csvContent += "data:text/csv;charset=utf-8,Storage Name, p_mw, q_mvar \n";

                        for (var i = 0; i < dataJson.storages.length; i++) {
                            resultId = dataJson.storages[i].id                        
                            dataJson.storages[i].name = dataJson.storages[i].name.replace('_', '#')

                            //sprawdz na jakich pozycjach był znak '-'
                            //podmien w tyc pozycjach znaki
                            resultId = resultId.replaceAll('___', '-')

                            dataJson.storages[i].name = resultId

                            //for the csv file
                            let row = Object.values(dataJson.storages[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'Storage' +
                            '\n P[MW]: ' + dataJson.storages[i].p_mw.toFixed(3) +
                            '\n Q[MVar]: ' + dataJson.storages[i].q_mvar.toFixed(3)   
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true);
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  
                        }
                    }


                    if(dataJson.SVC != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,SVC Name, thyristor_firing_angle_degree, x_ohm, q_mvar, vm_pu, va_degree \n";

                        for (var i = 0; i < dataJson.SVC.length; i++) {
                            resultId = dataJson.SVC[i].id                        
                            dataJson.SVC[i].name = dataJson.SVC[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.SVC[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'SVC' +
                            '\n Firing angle[degree]: ' + dataJson.SVC[i].thyristor_firing_angle_degree.toFixed(3) +
                            '\n x[Ohm]: ' + dataJson.SVC[i].x_ohm.toFixed(3) + 
                            '\n q[MVar]: ' + dataJson.SVC[i].q_mvar.toFixed(3) +
                            '\n vm[pu]: ' + dataJson.SVC[i].vm_pu.toFixed(3) +  
                            '\n va[degree]: ' + dataJson.SVC[i].va_degree.toFixed(3)                 
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                                                   
                        }
                    }

                    if(dataJson.TCSC != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,TCSC Name, thyristor_firing_angle_degree, x_ohm, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, p_l_mw, q_l_mvar, vm_from_pu, va_from_degree, vm_to_pu, va_to_degree  \n";

                        for (var i = 0; i < dataJson.TCSC.length; i++) {
                            resultId = dataJson.TCSC[i].id                        
                            dataJson.TCSC[i].name = dataJson.TCSC[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.TCSC[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'TCSC' +
                            '\n Firing angle[degree]: ' + dataJson.TCSC[i].thyristor_firing_angle_degree.toFixed(3) +
                            '\n x[Ohm ]: ' + dataJson.TCSC[i].x_ohm.toFixed(3) + 
                            '\n p_from[MW]: ' + dataJson.TCSC[i].p_from_mw.toFixed(3) +
                            '\n q_from[MVar]: ' + dataJson.TCSC[i].q_from_mvar.toFixed(3) +  
                            '\n p_to[MW]: ' + dataJson.TCSC[i].p_to_mw.toFixed(3) +
                            '\n q_to[MVar]: ' + dataJson.TCSC[i].q_to_mvar.toFixed(3) +
                            '\n p_l[MW]: ' + dataJson.TCSC[i].p_l_mw.toFixed(3) +
                            '\n q_l[MVar]: ' + dataJson.TCSC[i].q_l_mvar.toFixed(3) +
                            '\n vm_from[pu]: ' + dataJson.TCSC[i].vm_from_pu.toFixed(3) +
                            '\n va_from[degree]: ' + dataJson.TCSC[i].va_from_degree.toFixed(3) +
                            '\n vm_to[pu]: ' + dataJson.TCSC[i].vm_to_pu.toFixed(3) +
                            '\n va_to[degree]: ' + dataJson.TCSC[i].va_to_degree.toFixed(3)                  
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                                                
                        }
                    }

                    if(dataJson.SSC != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,SSC Name, thyristor_firing_angle_degree, q_mvar, vm_internal_pu, va_internal_degree, vm_pu, va_degree  \n";

                        for (var i = 0; i < dataJson.SSC.length; i++) {
                            resultId = dataJson.SSC[i].id                        
                            dataJson.SSC[i].name = dataJson.SSC[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.SSC[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'SSC' +
                            '\n Firing angle[degree]: ' + dataJson.SSC[i].thyristor_firing_angle_degree.toFixed(3) +
                            '\n q[MVar]: ' + dataJson.SSC[i].q_mvar.toFixed(3) + 
                            '\n vm_internal[pu]: ' + dataJson.SSC[i].vm_internal_pu.toFixed(3) +
                            '\n va_internal[degree]: ' + dataJson.SSC[i].va_internal_degree.toFixed(3) +  
                            '\n vm[pu]: ' + dataJson.SSC[i].vm_pu.toFixed(3) +
                            '\n va[degree]: ' + dataJson.SSC[i].va_degree.toFixed(3) 

                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])                                                    
                        }
                    }



                    if(dataJson.dclines != undefined)
                    {
                        //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy DC lines
                        csvContent += "data:text/csv;charset=utf-8,DCline Name, p_from_mw, q_from_mvar, p_to_mw, q_to_mvar, pl_mw, vm_from_pu, va_from_degree, vm_to_pu, va_to_degree \n";

                        for (var i = 0; i < dataJson.dclines.length; i++) {
                            resultId = dataJson.dclinesSSC[i].id                        
                            dataJson.dclines[i].name = dataJson.dclines[i].name.replace('_', '#')

                            //for the csv file
                            let row = Object.values(dataJson.dclines[i]).join(",")
                            csvContent += row + "\r\n";

                            //create label
                            var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                            var resultString  = 'DC line' +
                            '\n P_from[MW]: ' + dataJson.dclines[i].p_from_mw.toFixed(3) +
                            '\n Q_from[MVar]: ' + dataJson.dclines[i].q_from_mvar.toFixed(3) + 
                            '\n P_to[MW]: ' + dataJson.dclines[i].p_to_mw.toFixed(3) +
                            '\n Q_to[MVar]: ' + dataJson.dclines[i].q_to_mvar.toFixed(3) +  
                            '\n Pl[MW]: ' + dataJson.dclines[i].pl_mw.toFixed(3)                 
                         
                            var labelka = b.insertVertex(resultCell, null, resultString, -0.15, 1, 0, 0, 'shapeELXXX=Result', true)
                            b.setCellStyles(mxConstants.STYLE_FONTSIZE, '6', [labelka])
                            b.setCellStyles(mxConstants.STYLE_ALIGN, 'ALIGN_LEFT', [labelka])  

                            /*
                            b.insertVertex(resultCell, null, 'U_from[pu]: ' + dataJson.dclines[i].vm_from_pu.toFixed(3), -0.15, 2.2, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            b.insertVertex(resultCell, null, 'Ua_from[degree]: ' + dataJson.dclines[i].va_from_degree.toFixed(3), -0.15, 2.4, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');                            
                            b.insertVertex(resultCell, null, 'Um_to[pu]: ' + dataJson.dclines[i].vm_to_pu.toFixed(3), -0.15, 2.6, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result');      
                            b.insertVertex(resultCell, null, 'Ua_to[degree]: ' + dataJson.dclines[i].va_to_degree.toFixed(3), -0.15, 2.8, 0, 0, 'labelstyle', true).setStyle('shapeELXXX=Result'); 
                            */                            
                        }
                    }                     


                    //download to CSV
                    var encodedUri = encodeURI(csvContent);
                    var link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "Results.csv");
                    document.body.appendChild(link); // Required for FF
                    link.click();

                })
                .catch(err => {
                    if (err === "server") return
                    console.log(err)
                })

        }
    })

}