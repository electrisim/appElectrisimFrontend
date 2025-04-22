
//a - App
//b - Graph
//c - Editor

function shortCircuit(a, b, c) {


    let apka = a

    b.isEnabled() && !b.isCellLocked(b.getDefaultParent()) && a.showShortCircuitDialog("", "Calculate", function (a, c) {

        apka.spinner.spin(document.body, "Waiting for results...")


        //a - parametry obliczeń rozpływowych                
        //b = graph

        //jeśli parametry zostały wpisane policz rozpływ

        if (0 < a.length) {

            //liczba obiektów    
            let cellsArray = []
            cellsArray = b.getModel().getDescendants()


            let busbarNo = 0
            let externalGridNo = 0
            let generatorNo = 0
            let staticGeneratorNo = 0
            let asymmetricStaticGeneratorNo = 0


            let loadNo = 0
            let asymmetricLoadNo = 0
            let impedanceNo = 0
            let wardNo = 0
            let extendedWardNo = 0

            let transformerNo = 0
            let threeWindingTransformerNo = 0

            let shuntReactorNo = 0
            let capacitorNo = 0

            let motorNo = 0

            let lineNo = 0
            let dcLineNo = 0

            let storageNo = 0

            //Arrays
            let simulationParametersArray = [];

            let busbarArray = [];

            let externalGridArray = [];
            let generatorArray = [];
            let staticGeneratorArray = [];
            let asymmetricStaticGeneratorArray = [];

            let loadArray = [];
            let asymmetricLoadArray = [];
            let impedanceArray = [];
            let wardArray = [];
            let extendedWardArray = [];

            let transformerArray = [];
            let threeWindingTransformerArray = [];

            let shuntReactorArray = [];
            let capacitorArray = [];

            let motorArray = [];

            let lineArray = [];
            let dcLineArray = [];

            let storageArray = [];

            let dataToBackendArray = [];


            //***************SCZYTYWANIE PARAMETRÓW ZWARĆ****************
            let shorCircuitParameters = new Object();
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
        
            const regex = /^\d/g;
            
            for(let cell of cellsArray){

                //usun wyniki poprzednich obliczen
                if (typeof (cell.getStyle()) != undefined && cell.getStyle() != null && cell.getStyle().includes("Result")) {

                    let celka = b.getModel().getCell(cell.id)
                    b.getModel().remove(celka)
                }

                if (typeof (cell.getStyle()) != undefined && cell.getStyle() != null) {

                    let key_value = cell.getStyle().split(";").map(pair => pair.split("="));
                    const result = Object.fromEntries(key_value);
                 

                    //wybierz obiekty typu Ext_grid
                    if (result.shapeELXXX == "External Grid") {

                        //zrób plik json i wyślij do backend
                        let externalGrid = new Object();
                        externalGrid.typ = "External Grid" + externalGridNo
                        
                        externalGrid.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        externalGrid.id = cell.id                        
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){ 
                            externalGrid.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                           
                        }else{
                            externalGrid.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }

                        //Load_flow_parameters 
                        externalGrid.vm_pu = cell.value.attributes[2].nodeValue
                        externalGrid.va_degree = cell.value.attributes[3].nodeValue
                        //externalGrid.in_service = cell.value.attributes[3].nodeValue

                        //Short_circuit_parameters 
                        externalGrid.s_sc_max_mva = cell.value.attributes[5].nodeValue
                        externalGrid.s_sc_min_mva = cell.value.attributes[6].nodeValue
                        externalGrid.rx_max = cell.value.attributes[7].nodeValue
                        externalGrid.rx_min = cell.value.attributes[8].nodeValue
                        externalGrid.r0x0_max = cell.value.attributes[9].nodeValue
                        externalGrid.x0x_max = cell.value.attributes[10].nodeValue


                        //Optimal Power Flow
                        //externalGrid.max_p_mw = cell.value.attributes[8].nodeValue
                        //externalGrid.min_p_mw = cell.value.attributes[9].nodeValue
                        //externalGrid.max_q_mvar = cell.value.attributes[10].nodeValue
                        //externalGrid.min_q_mvar = cell.value.attributes[11].nodeValue

                        //externalGrid.slack_weight = cell.value.attributes[14].nodeValue
                        //externalGrid.controllable = cell.value.attributes[15].nodeValue

                        externalGridNo++

                        //let externalGridToBackend = JSON.stringify(externalGrid) //{"name":"External Grid 0","vm_pu":"0", "bus":"mxCell#34"}      
                        externalGridArray.push(externalGrid);
                    }
                  
                    if (result.shapeELXXX == "Generator")//cell.getStyle().match(/^Generator$/))//includes("Generator")) //(str1.match(/^abc$/))
                    {

                        //zrób plik json i wyślij do backend
                        let generator = new Object();
                        generator.typ = "Generator"
                       
                        generator.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        generator.id = cell.id                        
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){ 
                            generator.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                           
                        }else{
                            generator.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }

            
                        //Load_flow_parameters 
                        generator.p_mw = cell.value.attributes[2].nodeValue
                        generator.vm_pu = cell.value.attributes[3].nodeValue
                        generator.sn_mva = cell.value.attributes[4].nodeValue
                        generator.scaling = cell.value.attributes[5].nodeValue

                        //Short_circuit_parameters 
                        generator.vn_kv = cell.value.attributes[7].nodeValue
                        generator.xdss_pu = cell.value.attributes[8].nodeValue
                        generator.rdss_ohm = cell.value.attributes[9].nodeValue
                        generator.cos_phi = cell.value.attributes[10].nodeValue
                        generator.pg_percent = cell.value.attributes[11].nodeValue
                        generator.power_station_trafo = cell.value.attributes[12].nodeValue

                        generatorNo++

                        generatorArray.push(generator);
                    }

                    //wybierz obiekty typu Static Generator
                    if (result.shapeELXXX == "Static Generator") {


                        //zrób plik json i wyślij do backend
                        let staticGenerator = new Object();
                        staticGenerator.typ = "Static Generator"

                        staticGenerator.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        staticGenerator.id = cell.id                        
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){ 
                             staticGenerator.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                           
                        }else{
                            staticGenerator.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }                        

                        //Load_flow_parameters
                        staticGenerator.p_mw = cell.value.attributes[2].nodeValue
                        staticGenerator.q_mvar = cell.value.attributes[3].nodeValue
                        staticGenerator.sn_mva = cell.value.attributes[4].nodeValue
                        staticGenerator.scaling = cell.value.attributes[5].nodeValue
                        staticGenerator.type = cell.value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        staticGenerator.k = cell.value.attributes[8].nodeValue
                        staticGenerator.rx = cell.value.attributes[9].nodeValue
                        staticGenerator.generator_type = cell.value.attributes[10].nodeValue
                        staticGenerator.lrc_pu = cell.value.attributes[11].nodeValue
                        staticGenerator.max_ik_ka = cell.value.attributes[12].nodeValue
                        staticGenerator.kappa = cell.value.attributes[13].nodeValue
                        staticGenerator.current_source = cell.value.attributes[14].nodeValue

                        staticGeneratorNo++

                        staticGeneratorArray.push(staticGenerator);
                    }
                    //wybierz obiekty typu Asymmetric Static Generator
                    if (result.shapeELXXX == "Asymmetric Static Generator") {

                        //zrób plik json i wyślij do backend
                        let asymmetricStaticGenerator = new Object();
                        asymmetricStaticGenerator.typ = "Asymmetric Static Generator" + generatorNo
                        
                        asymmetricStaticGenerator.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        asymmetricStaticGenerator.id = cell.id                        
                      
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){ 
                            asymmetricStaticGenerator.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                           
                        }else{
                            asymmetricStaticGenerator.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //cell.edges[0].target.mxObjectId.replace('#', '') //id do ktorego jest dolaczony busbar
                        }    

                        console.log("Asymmetric Static Generator attributes")
                        console.log(cell.value.attributes)

                        //Load_flow_parameters
                        asymmetricStaticGenerator.p_a_mw = cell.value.attributes[2].nodeValue
                        asymmetricStaticGenerator.p_b_mw = cell.value.attributes[3].nodeValue
                        asymmetricStaticGenerator.p_c_mw = cell.value.attributes[4].nodeValue

                        asymmetricStaticGenerator.q_a_mvar = cell.value.attributes[5].nodeValue
                        asymmetricStaticGenerator.q_b_mvar = cell.value.attributes[6].nodeValue
                        asymmetricStaticGenerator.q_c_mvar = cell.value.attributes[7].nodeValue

                        asymmetricStaticGenerator.sn_mva = cell.value.attributes[8].nodeValue
                        asymmetricStaticGenerator.scaling = cell.value.attributes[9].nodeValue
                        asymmetricStaticGenerator.type = cell.value.attributes[10].nodeValue

                        asymmetricStaticGeneratorNo++

                        asymmetricStaticGeneratorArray.push(asymmetricStaticGenerator);
                    }


                    //wybierz obiekty typu Bus 
                    if (result.shapeELXXX == "Bus") {

                        //zrób plik json i wyślij do backend
                        let busbar = new Object();
                        busbar.typ = "Bus" + busbarNo
                        busbar.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___') //mxObjectId.replace('#', '_')//cell.id.replaceAll('-', '_') //zamień wszystkie - na _ żeby można byłoby w pythonie obrabiać  //cell.mxObjectId.replace('#', '')
                        busbar.id = cell.id    
        
                        //Load_flow_parameters
                        busbar.vn_kv = cell.value.attributes[2].nodeValue
                        //busbar.type = cell.value.attributes[3].nodeValue
                        //busbar.in_service = cell.value.attributes[3].nodeValue
                        busbarNo++

                        busbarArray.push(busbar);
                    }

                    //wybierz obiekty typu Transformer
                    if (result.shapeELXXX == "Transformer") {

                        //zrób plik json i wyślij do backend
                        let transformer = new Object();
                        transformer.typ = "Transformer" + transformerNo                        
                        transformer.name = cell.mxObjectId.replace('#', '_')//cell.id.replaceAll('-', '___')
                        transformer.id = cell.id 

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){                             
                            transformer.hv_bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        } else{                            
                            transformer.hv_bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }
                        

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[1].target.mxObjectId != cell.mxObjectId){                          
                            transformer.lv_bus = cell.edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        } else{                            
                            transformer.lv_bus = cell.edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }

             

                        //Load_flow_parameters    
                        transformer.sn_mva = cell.value.attributes[4].nodeValue
                        transformer.vn_hv_kv = cell.value.attributes[5].nodeValue
                        transformer.vn_lv_kv = cell.value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        transformer.vkr_percent = cell.value.attributes[8].nodeValue
                        transformer.vk_percent = cell.value.attributes[9].nodeValue
                        transformer.pfe_kw = cell.value.attributes[10].nodeValue
                        transformer.i0_percent = cell.value.attributes[11].nodeValue
                        transformer.vector_group = cell.value.attributes[12].nodeValue
                        transformer.vk0_percent = cell.value.attributes[13].nodeValue
                        transformer.vkr0_percent = cell.value.attributes[14].nodeValue
                        transformer.mag0_percent = cell.value.attributes[15].nodeValue
                        transformer.si0_hv_partial = cell.value.attributes[16].nodeValue
                        //transformer.in_service = cell.value.attributes[15].nodeValue

                        //Optional_parameters
                        transformer.parallel = cell.value.attributes[18].nodeValue
                        transformer.shift_degree = cell.value.attributes[19].nodeValue
                        transformer.tap_side = cell.value.attributes[20].nodeValue
                        transformer.tap_pos = cell.value.attributes[21].nodeValue
                        transformer.tap_neutral = cell.value.attributes[22].nodeValue
                        transformer.tap_max = cell.value.attributes[23].nodeValue
                        transformer.tap_min = cell.value.attributes[24].nodeValue
                        transformer.tap_step_percent = cell.value.attributes[25].nodeValue
                        transformer.tap_step_degree = cell.value.attributes[26].nodeValue
                        transformer.tap_phase_shifter = cell.value.attributes[27].nodeValue
                        /*
                        transformer.max_loading_percent = cell.value.attributes[26].nodeValue
                        transformer.df = cell.value.attributes[27].nodeValue
                        transformer.oltc = cell.value.attributes[28].nodeValue
                        transformer.xn_ohm = cell.value.attributes[29].nodeValue */

                        transformerNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        transformerArray.push(transformer);
                    }

                    //wybierz obiekty typu Three Winding Transformer
                    if (result.shapeELXXX == "Three Winding Transformer") {

                        //zrób plik json i wyślij do backend
                        let threeWindingTransformer = new Object();
                        threeWindingTransformer.typ = "Three Winding Transformer" + threeWindingTransformerNo
                    
                        threeWindingTransformer.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        threeWindingTransformer.id = cell.id 

                             
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[2].target.mxObjectId != cell.mxObjectId){ 
                            threeWindingTransformer.hv_bus = cell.edges[2].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }
                        else{
                            threeWindingTransformer.hv_bus = cell.edges[2].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }    

                        if(cell.edges[1].target.mxObjectId != cell.mxObjectId){ 
                            threeWindingTransformer.mv_bus = cell.edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }else{
                            threeWindingTransformer.mv_bus = cell.edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }

                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){
                            threeWindingTransformer.lv_bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }else{
                            threeWindingTransformer.lv_bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[1].target.mxObjectId.replace('#', '')
                        }

                        console.log("Three Winding Transformer attributes")
                       

                        //Load_flow_parameters
                        threeWindingTransformer.sn_hv_mva = cell.value.attributes[4].nodeValue
                        threeWindingTransformer.sn_mv_mva = cell.value.attributes[5].nodeValue
                        threeWindingTransformer.sn_lv_mva = cell.value.attributes[6].nodeValue
                        threeWindingTransformer.vn_hv_kv = cell.value.attributes[7].nodeValue
                        threeWindingTransformer.vn_mv_kv = cell.value.attributes[8].nodeValue
                        threeWindingTransformer.vn_lv_kv = cell.value.attributes[9].nodeValue
                        threeWindingTransformer.vk_hv_percent = cell.value.attributes[10].nodeValue
                        threeWindingTransformer.vk_mv_percent = cell.value.attributes[11].nodeValue
                        threeWindingTransformer.vk_lv_percent = cell.value.attributes[12].nodeValue

                        //Short_circuit_parameters [13]
                        threeWindingTransformer.vkr_hv_percent = cell.value.attributes[14].nodeValue
                        threeWindingTransformer.vkr_mv_percent = cell.value.attributes[15].nodeValue
                        threeWindingTransformer.vkr_lv_percent = cell.value.attributes[16].nodeValue
                        threeWindingTransformer.pfe_kw = cell.value.attributes[17].nodeValue
                        threeWindingTransformer.i0_percent = cell.value.attributes[18].nodeValue
                        threeWindingTransformer.vk0_hv_percent = cell.value.attributes[19].nodeValue
                        threeWindingTransformer.vk0_mv_percent = cell.value.attributes[20].nodeValue
                        threeWindingTransformer.vk0_lv_percent = cell.value.attributes[21].nodeValue
                        threeWindingTransformer.vkr0_hv_percent = cell.value.attributes[22].nodeValue
                        threeWindingTransformer.vkr0_mv_percent = cell.value.attributes[23].nodeValue
                        threeWindingTransformer.vkr0_lv_percent = cell.value.attributes[24].nodeValue
                        threeWindingTransformer.vector_group = cell.value.attributes[25].nodeValue

                        //Optional_parameters [26]
                        threeWindingTransformer.shift_mv_degree = cell.value.attributes[27].nodeValue
                        threeWindingTransformer.shift_lv_degree = cell.value.attributes[28].nodeValue
                        threeWindingTransformer.tap_step_percent = cell.value.attributes[29].nodeValue
                        threeWindingTransformer.tap_side = cell.value.attributes[30].nodeValue
                        threeWindingTransformer.tap_neutral = cell.value.attributes[31].nodeValue
                        threeWindingTransformer.tap_min = cell.value.attributes[32].nodeValue
                        threeWindingTransformer.tap_max = cell.value.attributes[33].nodeValue
                        threeWindingTransformer.tap_pos = cell.value.attributes[34].nodeValue
                        threeWindingTransformer.tap_at_star_point = cell.value.attributes[35].nodeValue

                        threeWindingTransformerNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        threeWindingTransformerArray.push(threeWindingTransformer);
                    }

                    if (result.shapeELXXX == "Shunt Reactor") {
                        //zrób plik json i wyślij do backend
                        let shuntReactor = new Object();
                        shuntReactor.typ = "Shunt Reactor" + shuntReactorNo

                        shuntReactor.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                
                        shuntReactor.id = cell.id   

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){ 
                            shuntReactor.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            shuntReactor.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }


                        //Load_flow_parameters
                        shuntReactor.p_mw = cell.value.attributes[2].nodeValue
                        shuntReactor.q_mvar = cell.value.attributes[3].nodeValue
                        shuntReactor.vn_kv = cell.value.attributes[4].nodeValue

                        //Optional_parameters
                        
                        shuntReactor.step = cell.value.attributes[6].nodeValue
                        shuntReactor.max_step = cell.value.attributes[7].nodeValue

                        shuntReactorNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        shuntReactorArray.push(shuntReactor);

                    }

                    if (result.shapeELXXX == "Capacitor") {

                        //zrób plik json i wyślij do backend
                        let capacitor = new Object();
                        capacitor.typ = "Capacitor" + capacitorNo

                        capacitor.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')                                                 
                        capacitor.id = cell.id

                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){                        
                            capacitor.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            capacitor.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }
           

                        //Load_flow_parameters
                        capacitor.q_mvar = cell.value.attributes[2].nodeValue
                        capacitor.loss_factor = cell.value.attributes[3].nodeValue
                        capacitor.vn_kv = cell.value.attributes[4].nodeValue
                        
                        //Optional_parameters                        
                        capacitor.step = cell.value.attributes[6].nodeValue
                        capacitor.max_step = cell.value.attributes[7].nodeValue

                        capacitorNo++

                        //let transformerToBackend = JSON.stringify(transformer) //{"name":"Transformer 0","p_mw":"0","busFrom":"mxCell#34","busTo":"mxCell#33"}                            
                        capacitorArray.push(capacitor);
                    }


                    //wybierz obiekty typu Load
                    if (result.shapeELXXX == "Load") {
                        //zrób plik json i wyślij do backend
                        let load = new Object();
                        load.typ = "Load" + loadNo
                        load.name =  cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        load.id = cell.id                            
                                               
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){                        
                            load.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
          
                        }
                        else{
                            load.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        console.log("cell.value.attributes: ")
                        console.log(cell.value.attributes)

                        console.log("Load attributes")
                        console.log(cell.value.attributes)

                        //Load_flow_parameters
                        load.p_mw = cell.value.attributes[2].nodeValue
                        load.q_mvar = cell.value.attributes[3].nodeValue
                        load.const_z_percent = cell.value.attributes[4].nodeValue
                        load.const_i_percent = cell.value.attributes[5].nodeValue
                        load.sn_mva = cell.value.attributes[6].nodeValue
                        load.scaling = cell.value.attributes[7].nodeValue
                        load.type = cell.value.attributes[8].nodeValue

                        loadNo++

                        loadArray.push(load);
                    }


                    if (result.shapeELXXX == "Asymmetric Load") {
                        //zrób plik json i wyślij do backend
                        let asymmetricLoad = new Object();
                        asymmetricLoad.typ = "Asymmetric Load" + asymmetricLoadNo
                        asymmetricLoad.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        asymmetricLoad.id = cell.id
                    
                        //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId){   
                            asymmetricLoad.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            asymmetricLoad.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                        console.log("Asymmetric Load attributes")
                        console.log(cell.value.attributes)

                        //Load_flow_parameters
                        asymmetricLoad.p_a_mw = cell.value.attributes[2].nodeValue
                        asymmetricLoad.p_b_mw = cell.value.attributes[3].nodeValue
                        asymmetricLoad.p_c_mw = cell.value.attributes[4].nodeValue
                        asymmetricLoad.q_a_mvar = cell.value.attributes[5].nodeValue
                        asymmetricLoad.q_b_mvar = cell.value.attributes[6].nodeValue
                        asymmetricLoad.q_c_mvar = cell.value.attributes[7].nodeValue
                        asymmetricLoad.sn_mva = cell.value.attributes[8].nodeValue
                        asymmetricLoad.scaling = cell.value.attributes[9].nodeValue
                        asymmetricLoad.type = cell.value.attributes[10].nodeValue

                        asymmetricLoadNo++

                        asymmetricLoadArray.push(asymmetricLoad);
                    }


                    if (result.shapeELXXX == "Impedance") {
                        //zrób plik json i wyślij do backend
                        let impedance = new Object();
                        impedance.typ = "Impedance" + impedanceNo
                        impedance.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        impedance.id = cell.id 

                        try {
                            //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                            if(cell.edges[0].target.mxObjectId != cell.mxObjectId){
                                impedance.busFrom = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.source.mxObjectId.replace('#', '')
                           
                            }else{
                                impedance.busFrom = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.source.mxObjectId.replace('#', '')
                         
                            }

                            //w zależności od kolejności przyłączenia odpowiednio ustalaj ID dla busbar do ktorego się przyłączamy
                            if(cell.edges[1].target.mxObjectId != cell.mxObjectId){
                                impedance.busTo = cell.edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.target.mxObjectId.replace('#', '')
                           
                            }else{
                                impedance.busTo = cell.edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.target.mxObjectId.replace('#', '')
              
                            }

                            //Load_flow_parameters
                            impedance.rft_pu = cell.value.attributes[2].nodeValue
                            impedance.xft_pu = cell.value.attributes[3].nodeValue
                            impedance.sn_mva = cell.value.attributes[4].nodeValue

                            impedanceNo++

                            impedanceArray.push(impedance);
                        } catch { //impedancja musi mieć dwa połączenia
                            alert("Connect an impedance's 'in' and 'out' to other element in the model. The impedance has not been taken into account in the simulation.")
                        }
                    }

                    if (result.shapeELXXX == "Ward") {
                        //zrób plik json i wyślij do backend
                        let ward = new Object();
                        ward.typ = "Ward" + wardNo
                        ward.name = cell.mxObjectId.replace('#', '_')
                        ward.id = cell.id                       

                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId)
                        {
                            ward.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        
                        }else{
                            ward.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                         
                        }

                        //Load_flow_parameters
                        ward.ps_mw = cell.value.attributes[2].nodeValue
                        ward.qs_mvar = cell.value.attributes[3].nodeValue
                        ward.pz_mw = cell.value.attributes[4].nodeValue
                        ward.qz_mvar = cell.value.attributes[5].nodeValue

                        wardNo++

                        wardArray.push(ward);
                    }

                    if (result.shapeELXXX == "Extended Ward") {
                        //zrób plik json i wyślij do backend
                        let extendedWard = new Object();
                        extendedWard.typ = "Extended Ward" + extendedWardNo

                        extendedWard.name = cell.mxObjectId.replace('#', '_')
                        extendedWard.id = cell.id                       

                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId)
                        {
                            extendedWard.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                          
                        }
                        else{
                            extendedWard.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

                     
                        //Load_flow_parameters
                        extendedWard.ps_mw = cell.value.attributes[2].nodeValue
                        extendedWard.qs_mvar = cell.value.attributes[3].nodeValue
                        extendedWard.pz_mw = cell.value.attributes[4].nodeValue
                        extendedWard.qz_mvar = cell.value.attributes[5].nodeValue
                        extendedWard.r_ohm = cell.value.attributes[6].nodeValue
                        extendedWard.x_ohm = cell.value.attributes[7].nodeValue
                        extendedWard.vm_pu = cell.value.attributes[8].nodeValue

                        extendedWardNo++

                        extendedWardArray.push(extendedWard);
                    }

                    if (result.shapeELXXX == "Motor") {
                        //zrób plik json i wyślij do backend
                        let motor = new Object();
                        motor.typ = "Motor" + motorNo
                        motor.name = cell.mxObjectId.replace('#', '_')
                        motor.id = cell.id 

                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId)
                        {
                            motor.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            motor.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '                            
                        }

                        console.log("Motor attributes")
                        console.log(cell.value.attributes)


                        //Load_flow_parameters
                        motor.pn_mech_mw = cell.value.attributes[2].nodeValue
                        motor.cos_phi = cell.value.attributes[3].nodeValue
                        motor.efficiency_percent = cell.value.attributes[4].nodeValue
                        motor.loading_percent = cell.value.attributes[5].nodeValue
                        motor.scaling = cell.value.attributes[6].nodeValue

                        //Short_circuit_parameters
                        motor.cos_phi_n = cell.value.attributes[8].nodeValue
                        motor.efficiency_n_percent = cell.value.attributes[9].nodeValue
                        motor.Irc_pu = cell.value.attributes[10].nodeValue
                        motor.rx = cell.value.attributes[11].nodeValue
                        motor.vn_kv = cell.value.attributes[12].nodeValue

                        //Optional_parameters
                        motor.efficiency_percent = cell.value.attributes[14].nodeValue
                        motor.loading_percent = cell.value.attributes[15].nodeValue
                        motor.scaling = cell.value.attributes[16].nodeValue

                        motorNo++

                        motorArray.push(motor);
                    }

                    if (result.shapeELXXX == "Storage") {
                        //zrób plik json i wyślij do backend
                        let storage = new Object();
                        storage.typ = "Storage" + storageNo
                        storage.name = cell.mxObjectId.replace('#', '_')
                        storage.id = cell.id 
                     
                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId)
                        {
                            storage.bus = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }else{
                            storage.bus = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.edges[0].target.mxObjectId.replace('#', '')
                        }

        
                        //Load_flow_parameters
                        storage.p_mw = cell.value.attributes[2].nodeValue
                        storage.max_e_mwh = cell.value.attributes[3].nodeValue

                        //Optional_parameters
                        storage.q_mvar = cell.value.attributes[4].nodeValue
                        storage.sn_mva = cell.value.attributes[5].nodeValue
                        storage.soc_percent = cell.value.attributes[6].nodeValue
                        storage.min_e_mwh = cell.value.attributes[7].nodeValue
                        storage.scaling = cell.value.attributes[8].nodeValue
                        storage.type = cell.value.attributes[9].nodeValue

                        storageNo++

                        storageArray.push(storage);
                    }

                    //NIE MA SVC 
                    //NIE MA TCSC
                    //NIE MA SSC

                    if (result.shapeELXXX == "DC Line") {
                        //zrób plik json i wyślij do backend
                        let dcLine = new Object();
                        dcLine.typ = "DC Line" + dcLineNo

                        dcLine.name = cell.mxObjectId.replace('#', '_')//.replaceAll('-', '___')
                        dcLine.id = cell.id                

                        if(cell.edges[0].target.mxObjectId != cell.mxObjectId)
                        {
                            dcLine.busFrom = cell.edges[0].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.source.mxObjectId.replace('#', '')
                        }else{
                            dcLine.busFrom = cell.edges[0].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.source.mxObjectId.replace('#', '')
                        }
                        
                        if(cell.edges[1].target.mxObjectId != cell.mxObjectId)
                        {
                            dcLine.busTo = cell.edges[1].target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.target.mxObjectId.replace('#', '')
                        }else{
                            dcLine.busTo = cell.edges[1].source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.target.mxObjectId.replace('#', '')
                        }

                        console.log("DC line attributes")
                        console.log(cell.value.attributes)

                        //Load_flow_parameters
                        dcLine.p_mw = cell.value.attributes[2].nodeValue
                        dcLine.loss_percent = cell.value.attributes[3].nodeValue
                        dcLine.loss_mw = cell.value.attributes[4].nodeValue
                        dcLine.vm_from_pu = cell.value.attributes[5].nodeValue
                        dcLine.vm_to_pu = cell.value.attributes[6].nodeValue

                        dcLineNo++

                        dcLineArray.push(dcLine);
                    }


                    //wybierz obiekty typu Line
                    if (result.shapeELXXX == "Line") {
                        //zrób plik json i wyślij do backend
                        let line = new Object();
                        line.typ = "Line" + lineNo
                        line.name = cell.mxObjectId.replace('#', '_')//id.replaceAll('-', '___')
                        line.id = cell.id
                       
                        line.busFrom = cell.source.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.source.mxObjectId.replace('#', '')                        
                        line.busTo = cell.target.mxObjectId.replace('#', '_')//.replaceAll('-', '___')//cell.target.mxObjectId.replace('#', '')

                        line.length_km = cell.value.attributes[2].nodeValue
                        line.parallel = cell.value.attributes[3].nodeValue
                        line.df = cell.value.attributes[4].nodeValue

                        //Load_flow_parameters
                        line.r_ohm_per_km = cell.value.attributes[8].nodeValue
                        line.x_ohm_per_km = cell.value.attributes[9].nodeValue
                        line.c_nf_per_km = cell.value.attributes[10].nodeValue
                        line.g_us_per_km = cell.value.attributes[11].nodeValue
                        line.max_i_ka = cell.value.attributes[12].nodeValue
                        line.type = cell.value.attributes[13].nodeValue

                        //line.in_service = cell.value.attributes[13].nodeValue

                        //Short_circuit_parameters
                        line.r0_ohm_per_km = cell.value.attributes[15].nodeValue ////w specyfikacji PandaPower jako nan
                        line.x0_ohm_per_km = cell.value.attributes[16].nodeValue //w specyfikacji PandaPower jako nan
                        line.c0_nf_per_km = cell.value.attributes[17].nodeValue //w specyfikacji PandaPower jako nan
                        line.endtemp_degree = cell.value.attributes[18].nodeValue //w specyfikacji PandaPower jako nan

                        lineNo++

                        lineArray.push(line);
                    }

                }
            }

            //zamień w transformerArray kolejności busbar (hv, lv)
            //porównaj dwa napięcia i dzięki temu określ który jest HV i LV            
            //OKREŚLENIE HV BUSBAR            
            for (let i = 0; i < transformerArray.length; i++) {
                let twoWindingBusbarArray = [];

                let transformerCell = b.getModel().getCell(transformerArray[i].id)
                let style=b.getModel().getStyle(transformerCell);                

                try{

                   let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'black');
                   let cs= new Array();
                   cs[0]=transformerCell;
                   b.setCellStyle(newStyle,cs); 
                   bus1 = busbarArray.find(element => element.name == transformerArray[i].hv_bus);
                   bus2 = busbarArray.find(element => element.name == transformerArray[i].lv_bus);

                    twoWindingBusbarArray.push(bus1)
                    twoWindingBusbarArray.push(bus2)

                    let busbarWithHighestVoltage = twoWindingBusbarArray.reduce(
                        (prev, current) => {
                            return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                        }
                    );
                    let busbarWithLowestVoltage = twoWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                        }
                    );

                    transformerArray[i].hv_bus = busbarWithHighestVoltage.name
                    transformerArray[i].lv_bus = busbarWithLowestVoltage.name

                }catch (error) {
                    console.error(error.message);
                    let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                    let cs= new Array();
                    cs[0]=transformerCell;
                    b.setCellStyle(newStyle,cs); 
                    alert('The transformer is not connected to the bus. Please check the transformer highlighted in red and connect it to the appropriate bus.')
                }            

        
            } 

            //zamień w threeWindingTransformerArray kolejności busbar (hv, mv, lv)
            //porównaj trzy napięcia i dzięki temu określ który jest HV, MV i LV       

            for (let i = 0; i < threeWindingTransformerArray.length; i++) {
                let threeWindingBusbarArray = [];   
                
                let threeWindingTransformerCell = b.getModel().getCell(threeWindingTransformerArray[i].id)
                let style=b.getModel().getStyle(threeWindingTransformerCell);  
                
                try{   
                    let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'black');
                    let cs= new Array();
                    cs[0]=threeWindingTransformerCell;
                    b.setCellStyle(newStyle,cs);

                    bus1 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].hv_bus);
                    bus2 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].mv_bus);
                    bus3 = busbarArray.find(element => element.name == threeWindingTransformerArray[i].lv_bus);
                    threeWindingBusbarArray.push(bus1)
                    threeWindingBusbarArray.push(bus2)
                    threeWindingBusbarArray.push(bus3)
                    console.log(threeWindingBusbarArray)

                    let busbarWithHighestVoltage = threeWindingBusbarArray.reduce(
                        (prev, current) => {

                            return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                        }
                    );
                    let busbarWithLowestVoltage = threeWindingBusbarArray.reduce(
                        (prev, current) => {
                            return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                        }
                    );

                    let busbarWithMiddleVoltage = threeWindingBusbarArray.find(element => element.name != busbarWithHighestVoltage.name && element.name != busbarWithLowestVoltage.name);

                    threeWindingTransformerArray[i].hv_bus = busbarWithHighestVoltage.name
                    threeWindingTransformerArray[i].mv_bus = busbarWithMiddleVoltage.name
                    threeWindingTransformerArray[i].lv_bus = busbarWithLowestVoltage.name

                }catch (error) {
                    console.error(error.message);
                    let newStyle=mxUtils.setStyle(style,mxConstants.STYLE_STROKECOLOR,'red');
                    let cs= new Array();
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

                let busbarWithHighestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {

                        return parseFloat(prev.vn_kv) > parseFloat(current.vn_kv) ? prev : current
                    }
                );
                let busbarWithLowestVoltage = threeWindingBusbarArray.reduce(
                    (prev, current) => {
                        return parseFloat(prev.vn_kv) < parseFloat(current.vn_kv) ? prev : current
                    }
                );

                let busbarWithMiddleVoltage = threeWindingBusbarArray.find(element => element.name != busbarWithHighestVoltage.name && element.name != busbarWithLowestVoltage.name);

                threeWindingTransformerArray[i].hv_bus = busbarWithHighestVoltage.name
                threeWindingTransformerArray[i].mv_bus = busbarWithMiddleVoltage.name
                threeWindingTransformerArray[i].lv_bus = busbarWithLowestVoltage.name
                */
            }


            array = [
                ...dataToBackendArray, 
                ...simulationParametersArray,
                ...externalGridArray,
                ...generatorArray,
                ...staticGeneratorArray,
                ...asymmetricStaticGeneratorArray,
                ...busbarArray,
                ...transformerArray,
                ...threeWindingTransformerArray,
                ...shuntReactorArray,
                ...capacitorArray,
                ...loadArray,
                ...asymmetricLoadArray,
                ...impedanceArray,
                ...wardArray,
                ...extendedWardArray,
                ...motorArray,
                ...storageArray,
                ...dcLineArray,
                ...lineArray
            ];

          

            let obj = Object.assign({}, array);
            console.log(JSON.stringify(obj))


            let printArray = function (arr) {
                if (typeof (arr) == "object") {
                    for (let i = 0; i < arr.length; i++) {
                        printArray(arr[i]);
                    }
                }
                else document.write(arr);
            }


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
                        return response.json()
                    } else {        
                        return Promise.reject("server")
                    }
                })
                .then(dataJson => {
         

                    if (dataJson[0] != undefined) {
                        if (dataJson[0] == "line") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (let i = 1; i < dataJson.length; i++) {
                             
                                alert("Line" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "bus") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (let i = 1; i < dataJson.length; i++) {
                      
                                alert("Bus" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0] == "ext_grid") {
                            //rozpływ się nie udał, output z diagnostic_function
                            for (let i = 1; i < dataJson.length; i++) {
                           
                                alert("External Grid" + dataJson[i][0] + " " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            }
                        }
                        if (dataJson[0][0] == "trafo3w") {

                            alert("Three-winding transformer: nominal voltage does not match")
                            //rozpływ się nie udał, output z diagnostic_function
                            //for (let i = 1; i < dataJson.length; i++) {
                            //    console.log(dataJson[i])
                            //    alert("Three Winding Transformer"+dataJson[i][0]+" " + dataJson[i][1] + " = " + dataJson[i][2] + " (restriction: " + dataJson[i][3] + ")\n Power Flow did not converge")
                            //}
                        }
                        if (dataJson[0] == "overload") {
                            alert("One of the element is overloaded. The load flow did not converge.")
                        }
                    }


                    //*************** SHOWING RESULTS ON DIAGRAM ****************
                    let csvArray = []
                    let oneBusbarArray = []

                    let style = new Object();
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
                    //let csvContent = "data:text/csv;charset=utf-8,Busbar Name,ikss_ka, ip_ka, ith_ka, rk_ohm, xk_ohm\n";


                    for (let i = 0; i < dataJson.busbars.length; i++) {

                        resultId = dataJson.busbars[i].id

                        dataJson.busbars[i].name = dataJson.busbars[i].name.replace('_', '#')


                        //for the csv file
                        //let row = Object.values(dataJson.busbars[i]).join(",")
                        //csvContent += row + "\r\n";

                        //create label
                        let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                        var label12 = b.insertVertex(resultCell, null, resultCell.value.attributes[0].nodeValue, 0.2, 1.4, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        var label12 = b.insertVertex(resultCell, null, 'ikss[kA]: ' + dataJson.busbars[i].ikss_ka.toFixed(3), 0.2, 2.6, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')


                        if (dataJson.busbars[i].ip_ka != "NaN") {

                            let label12 = b.insertVertex(resultCell, null, 'ip[kA]: ' + dataJson.busbars[i].ip_ka.toFixed(3), 0.2, 3.8, 0, 0, 'labelstyle', true);
                            label12.setStyle('shapeELXXX=Result')
                        }

                        if (dataJson.busbars[i].ith_ka != "NaN") {
                            let label12 = b.insertVertex(resultCell, null, 'ith[kA]: ' + dataJson.busbars[i].ith_ka.toFixed(3), 0.2, 5, 0, 0, 'labelstyle', true);
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
                    for (let i = 0; i < dataJson.lines.length; i++) {

                        resultId = dataJson.lines[i].name

                        resultId = resultId.replace('NUMBER', dataJson.lines[i].name)

                        //sprawdz na jakich pozycjach był znak '-'
                        //podmien w tyc pozycjach znaki
                        resultId = resultId.replaceAll('___', '-')

                        dataJson.lines[i].name = resultId

                        //for the csv file
                        let row = Object.values(dataJson.lines[i]).join(",")
                        csvContent += row + "\r\n";

                        let resultCell = b.getModel().getCell(resultId) //musisz używać id a nie mxObjectId bo nie ma metody GetCell dla mxObjectId

                        let label12 = b.insertVertex(resultCell, null, 'ikss[kA]: ' + dataJson.lines[i].ikss.toFixed(3), -0.3, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        let label12 = b.insertVertex(resultCell, null, 'ip[kA]: ' + dataJson.lines[i].ip.toFixed(3), -0.4, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        let label12 = b.insertVertex(resultCell, null, 'ith[kA]: ' + dataJson.lines[i].ith.toFixed(3), -0.5, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')

                        let label12 = b.insertVertex(resultCell, null, 'Loading[%]: ' + dataJson.lines[i].loading_percent.toFixed(1), -0.3, 43, 0, 0, 'labelstyle', true);
                        label12.setStyle('shapeELXXX=Result')


                    } */
                    //download to CSV
                    //let encodedUri = encodeURI(csvContent);
                    //let link = document.createElement("a");
                    //link.setAttribute("href", encodedUri);
                    //link.setAttribute("download", "Results.csv");
                    //document.body.appendChild(link); // Required for FF
                    //link.click();

                })
            
            .catch(err => {
                if (err === "server") return
                alert(err)
            })

        }
    })
}