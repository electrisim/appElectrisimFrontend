
//a - App
//b - Graph
//c - Editor

function shortCircuit(a, b, c) {


    var apka = a

    b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showShortCircuitDialog("", "Calculate", function (a, c) {

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

            var storageArray = [];

            var dataToBackendArray = [];


            //***************SCZYTYWANIE PARAMETRÓW ZWARĆ****************
            var shorCircuitParameters = new Object();
            shorCircuitParameters.typ = "ShortCircuitPandaPower Parameters"
            shorCircuitParameters.fault = a[0]
            shorCircuitParameters.case = a[1]
            shorCircuitParameters.lv_tol_percent = a[2]
            //shorCircuitParameters.ip = a[3]
            //shorCircuitParameters.ith = a[4]
            shorCircuitParameters.topology = a[3]
            shorCircuitParameters.tk_s = a[4]
            shorCircuitParameters.r_fault_ohm = a[5]
            shorCircuitParameters.x_fault_ohm = a[6]
            shorCircuitParameters.inverse_y = a[7]

            simulationParametersArray.push(shorCircuitParameters)


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

                    //wybierz obiekty typu Ext_grid
                    if (result.shapeELXXX == "External Grid") {

                        //zrób plik json i wyślij do backend
                        var externalGrid = new Object();
                        externalGrid.typ = "External Grid" + externalGridNo
                        
                        externalGrid.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
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


                        //Optimal Power Flow
                        //externalGrid.max_p_mw = cellsArray[i].value.attributes[8].nodeValue
                        //externalGrid.min_p_mw = cellsArray[i].value.attributes[9].nodeValue
                        //externalGrid.max_q_mvar = cellsArray[i].value.attributes[10].nodeValue
                        //externalGrid.min_q_mvar = cellsArray[i].value.attributes[11].nodeValue

                        //externalGrid.slack_weight = cellsArray[i].value.attributes[14].nodeValue
                        //externalGrid.controllable = cellsArray[i].value.attributes[15].nodeValue

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
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
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
                        asymmetricStaticGenerator.typ = "Asymmetric Static Generator" + generatorNo
                        
                        asymmetricStaticGenerator.name = cellsArray[i].mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        asymmetricStaticGenerator.id = cellsArray[i].id                        
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cellsArray[i].edges[0].target.mxObjectId != cellsArray[i].mxObjectId){ 
                            asymmetricStaticGenerator.bus = cellsArray[i].edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                           
                        }else{
                            asymmetricStaticGenerator.bus = cellsArray[i].edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cellsArray[i].edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }    

                        console.log("Asymmetric Static Generator attributes")
                        console.log(cellsArray[i].value.attributes)

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

                        console.log("Transformer")
                        console.log(cellsArray[i].value.attributes)

                        //Load_flow_parameters    
                        transformer.sn_mva = cellsArray[i].value.attributes[4].nodeValue
                        transformer.vn_hv_kv = cellsArray[i].value.attributes[5].nodeValue
                        transformer.vn_lv_kv = cellsArray[i].value.attributes[6].nodeValue

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

                        console.log("Three Winding Transformer attributes")
                        console.log(cellsArray[i].value.attributes)

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

                        console.log("Shunt reactor attributes")
                        console.log(cellsArray[i].value.attributes)


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


                        console.log("Capacitor attributes")
                        console.log(cellsArray[i].value.attributes)

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

                        console.log("cellsArray[i].value.attributes: ")
                        console.log(cellsArray[i].value.attributes)

                        console.log("Load attributes")
                        console.log(cellsArray[i].value.attributes)

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

                        console.log("Asymmetric Load attributes")
                        console.log(cellsArray[i].value.attributes)

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

                        console.log("Motor attributes")
                        console.log(cellsArray[i].value.attributes)


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

                    //NIE MA SVC 
                    //NIE MA TCSC
                    //NIE MA SSC

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

                        console.log("DC line attributes")
                        console.log(cellsArray[i].value.attributes)

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

            //zamień w transformerArray kolejności busbar (hv, lv)
            //porównaj dwa napięcia i dzięki temu określ który jest HV i LV
            

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

                /*

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
                */
            }

            //zamień w threeWindingTransformerArray kolejności busbar (hv, mv, lv)
            //porównaj trzy napięcia i dzięki temu określ który jest HV, MV i LV
            var threeWindingBusbarArray = [];

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


                /*

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
                */
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
            fetch("https://03dht3kc-5000.euw.devtunnels.ms/", { //  http://127.0.0.1:5000/ https://electrisim-0fe342b90b0c.herokuapp.com/
                mode: "cors", 
                method: "post",
                headers: {
                    "Content-Type": "application/json",
                                                    
                },
                body: JSON.stringify(obj)
            })

                //.then(response => console.log(response))


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
                    var csvArray = []
                    var oneBusbarArray = []

                    var style = new Object();
                    style[mxConstants.STYLE_FONTSIZE] = '8';
                    //style[mxConstants.STYLE_SHAPE] = 'box';
                    //style[mxConstants.STYLE_STROKECOLOR] = '#000000';
                    //style[mxConstants.STYLE_FONTCOLOR] = '#000000';                        
                    b.getStylesheet().putCellStyle('labelstyle', style);

                    /*dataJson.lines.forEach(function(arrayTen) {
                        let row = dataJson.lines.join(",");
                        csvContent += row + "\r\n";
                    });*/

                    //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Line
                    let csvContent = "data:text/csv;charset=utf-8,Busbar Name,ikss_ka, ip_ka, ith_ka, rk_ohm, xk_ohm\n";


                    for (var i = 0; i < dataJson.busbars.length; i++) {

                        resultId = dataJson.busbars[i].id

                        dataJson.busbars[i].name = dataJson.busbars[i].name.replace('_', '#')


                        //for the csv file
                        let row = Object.values(dataJson.busbars[i]).join(",")
                        csvContent += row + "\r\n";

                        //create label
                        var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                        var label12 = b.insertVertex(resultCell, null, 'Bus', 0.2, 1.4, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'ikss[kA]: ' + dataJson.busbars[i].ikss_ka.toFixed(3), 0.2, 2.6, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')


                        if (dataJson.busbars[i].ip_ka != "NaN") {

                            var label12 = b.insertVertex(resultCell, null, 'ip[kA]: ' + dataJson.busbars[i].ip_ka.toFixed(3), 0.2, 3.8, 0, 0, 'labelstyle', true);
                            label12.setStyle('shapeELXXX=Result')
                        }

                        if (dataJson.busbars[i].ith_ka != "NaN") {
                            var label12 = b.insertVertex(resultCell, null, 'ith[kA]: ' + dataJson.busbars[i].ith_ka.toFixed(3), 0.2, 5, 0, 0, 'labelstyle', true);
                            label12.setStyle('shapeELXXX=Result')
                        }

                        var label12 = b.insertVertex(resultCell, null, 'rk[ohm]: ' + dataJson.busbars[i].rk_ohm.toFixed(3), 0.2, 6.2, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'xk[ohm]: ' + dataJson.busbars[i].xk_ohm.toFixed(3), 0.2, 7.4, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                    }

                    /*

                    //kolejność zgodnie z kolejnością w python przy tworzeniu Klasy Line
                    csvContent += "Line Name, ikss_ka, ip_ka, ith_ka\n";
                    for (var i = 0; i < dataJson.lines.length; i++) {

                        resultId = dataJson.lines[i].name

                        resultId = resultId.replace('NUMBER', dataJson.lines[i].name)

                        //sprawdz na jakich pozycjach był znak '-'
                        //podmien w tyc pozycjach znaki
                        resultId = resultId.replaceAll('___', '-')

                        dataJson.lines[i].name = resultId

                        //for the csv file
                        let row = Object.values(dataJson.lines[i]).join(",")
                        csvContent += row + "\r\n";

                        var resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                        var label12 = b.insertVertex(resultCell, null, 'ikss[kA]: ' + dataJson.lines[i].ikss.toFixed(3), -0.3, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'ip[kA]: ' + dataJson.lines[i].ip.toFixed(3), -0.4, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'ith[kA]: ' + dataJson.lines[i].ith.toFixed(3), -0.5, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'Loading[%]: ' + dataJson.lines[i].loading_percent.toFixed(1), -0.3, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')


                    } */
                    //download to CSV
                    var encodedUri = encodeURI(csvContent);
                    var link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", "Results.csv");
                    document.body.appendChild(link); // Required for FF
                    link.click();

                })
            /*
            .catch(err => {
                if (err === "server") return
                console.log(err)
            })*/

        }
    })
}