const rowDefsDataLineDialog = [
  { name: "NAYY 4x50 SE", r_ohm_per_km: 0.642, x_ohm_per_km: 0.083, c_nf_per_km: 210.0, g_us_per_km: 0.0, max_i_ka: 0.142, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0},
  { name: "NAYY 4x120 SE", r_ohm_per_km: 0.225, x_ohm_per_km: 0.08, c_nf_per_km: 264.0, g_us_per_km: 0.0, max_i_ka: 0.242, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0},
  { name: "NAYY 4x150 SE", r_ohm_per_km: 0.208, x_ohm_per_km: 0.08, c_nf_per_km: 261.0, g_us_per_km: 0.0, max_i_ka: 0.27, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0},
  
  { name: "NA2XS2Y 1x70 RM/25 6/10 kV", r_ohm_per_km: 0.123, x_ohm_per_km: 0.123, c_nf_per_km: 280.0, g_us_per_km: 0.0, max_i_ka: 0.217, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x95 RM/25 6/10 kV", r_ohm_per_km: 0.313, x_ohm_per_km: 0.123, c_nf_per_km: 315.0, g_us_per_km: 0.0, max_i_ka: 0.249, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x120 RM/25 6/10 kV", r_ohm_per_km: 0.113, x_ohm_per_km: 0.113, c_nf_per_km: 340.0, g_us_per_km: 0.0, max_i_ka: 0.28, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x150 RM/25 6/10 kV", r_ohm_per_km: 0.11, x_ohm_per_km: 0.11, c_nf_per_km: 360.0, g_us_per_km: 0.0, max_i_ka: 0.315, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },  
  { name: "NA2XS2Y 1x185 RM/25 6/10 kV", r_ohm_per_km: 0.161, x_ohm_per_km: 0.11, c_nf_per_km: 406.0, g_us_per_km: 0.0, max_i_ka: 0.358, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x240 RM/25 6/10 kV", r_ohm_per_km: 0.122, x_ohm_per_km: 0.105, c_nf_per_km: 456.0, g_us_per_km: 0.0, max_i_ka: 0.416, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },  
  
  { name: "NA2XS2Y 1x70 RM/25 12/20 kV", r_ohm_per_km: 0.132, x_ohm_per_km: 0.132, c_nf_per_km: 190.0, g_us_per_km: 0.0, max_i_ka: 0.22, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x95 RM/25 12/20 kV", r_ohm_per_km: 0.313, x_ohm_per_km: 0.132, c_nf_per_km: 216.0, g_us_per_km: 0.0, max_i_ka: 0.252, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x120 RM/25 12/20 kV", r_ohm_per_km: 0.253, x_ohm_per_km: 0.119, c_nf_per_km: 230.0, g_us_per_km: 0.0, max_i_ka: 0.283, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x150 RM/25 12/20 kV", r_ohm_per_km: 0.206, x_ohm_per_km: 0.116, c_nf_per_km: 250.0, g_us_per_km: 0.0, max_i_ka: 0.319, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x185 RM/25 12/20 kV", r_ohm_per_km: 0.161, x_ohm_per_km: 0.117, c_nf_per_km: 273.0, g_us_per_km: 0.0, max_i_ka: 0.362, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x240 RM/25 12/20 kV", r_ohm_per_km: 0.122, x_ohm_per_km: 0.112, c_nf_per_km: 304.0, g_us_per_km: 0.0, max_i_ka: 0.421, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  
  { name: "NA2XS2Y 1x70 RM/16 18/30 kV flat", r_ohm_per_km: 0.571, x_ohm_per_km: 0.201, c_nf_per_km: 150.0, g_us_per_km: 0.0, max_i_ka: 0.235, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x95 RM/16 18/30 kV flat", r_ohm_per_km: 0.413, x_ohm_per_km: 0.195, c_nf_per_km: 170.0, g_us_per_km: 0.0, max_i_ka: 0.280, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x120 RM/16 18/30 kV flat", r_ohm_per_km: 0.328, x_ohm_per_km: 0.188, c_nf_per_km: 180.0, g_us_per_km: 0.0, max_i_ka: 0.320, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x150 RM/25 18/30 kV flat", r_ohm_per_km: 0.268, x_ohm_per_km: 0.182, c_nf_per_km: 190.0, g_us_per_km: 0.0, max_i_ka: 0.355, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x185 RM/25 18/30 kV flat", r_ohm_per_km: 0.215, x_ohm_per_km: 0.182, c_nf_per_km: 200.0, g_us_per_km: 0.0, max_i_ka: 0.395, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x240 RM/25 18/30 kV flat", r_ohm_per_km: 0.165, x_ohm_per_km: 0.176, c_nf_per_km: 220.0, g_us_per_km: 0.0, max_i_ka: 0.455, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x300 RM/25 18/30 kV flat", r_ohm_per_km: 0.133, x_ohm_per_km: 0.173, c_nf_per_km: 240.0, g_us_per_km: 0.0, max_i_ka: 0.510, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x400 RM/35 18/30 kV flat", r_ohm_per_km: 0.107, x_ohm_per_km: 0.163, c_nf_per_km: 270.0, g_us_per_km: 0.0, max_i_ka: 0.565, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "NA2XS2Y 1x500 RM/35 18/30 kV flat", r_ohm_per_km: 0.085, x_ohm_per_km: 0.163, c_nf_per_km: 290.0, g_us_per_km: 0.0, max_i_ka: 0.630, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },

  { name: "N2XS(FL)2Y 1x120 RM/35 64/110 kV", r_ohm_per_km: 0.153, x_ohm_per_km: 0.166, c_nf_per_km: 112.0, g_us_per_km: 0.0, max_i_ka: 0.366, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "N2XS(FL)2Y 1x150 RM/95 64/110 kV ", r_ohm_per_km: 0.124, x_ohm_per_km: 0.215, c_nf_per_km: 120.0, g_us_per_km: 0.0, max_i_ka: 0.399, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "N2XS(FL)2Y 1x185 RM/35 64/110 kV", r_ohm_per_km: 0.099, x_ohm_per_km: 0.156, c_nf_per_km: 125.0, g_us_per_km: 0.0, max_i_ka: 0.457, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "N2XS(FL)2Y 1x240 RM/35 64/110 kV", r_ohm_per_km: 0.075, x_ohm_per_km: 0.149, c_nf_per_km: 135.0, g_us_per_km: 0.0, max_i_ka: 0.526, type:"cs", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "N2XS(FL)2Y 1x300 RM/35 64/110 kV", r_ohm_per_km: 0.06, x_ohm_per_km: 0.144, c_nf_per_km: 144.0, g_us_per_km: 0.0, max_i_ka: 0.588, type:"cs", r0_ohm_per_km:0.1, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  
  { name: "15-AL1/3-ST1A 0.4", r_ohm_per_km: 1.8769, x_ohm_per_km: 0.35, c_nf_per_km: 11.0, g_us_per_km: 0.0, max_i_ka: 0.105, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "24-AL1/4-ST1A 0.4", r_ohm_per_km: 1.2012, x_ohm_per_km: 0.335, c_nf_per_km: 11.25, g_us_per_km: 0.0, max_i_ka: 0.14, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "48-AL1/8-ST1A 0.4", r_ohm_per_km: 0.5939, x_ohm_per_km: 0.3, c_nf_per_km: 12.2, g_us_per_km: 0.0, max_i_ka: 0.21, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "94-AL1/15-ST1A 0.4", r_ohm_per_km: 0.306, x_ohm_per_km: 0.29, c_nf_per_km: 13.2, g_us_per_km: 0.0, max_i_ka: 0.35, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "34-AL1/6-ST1A 10.0", r_ohm_per_km: 0.8342, x_ohm_per_km: 0.36, c_nf_per_km: 9.7, g_us_per_km: 0.0, max_i_ka: 0.17, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "48-AL1/8-ST1A 10.0", r_ohm_per_km: 0.5939, x_ohm_per_km: 0.35, c_nf_per_km: 10.1, g_us_per_km: 0.0, max_i_ka: 0.21, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "70-AL1/11-ST1A 10.0", r_ohm_per_km: 0.4132, x_ohm_per_km: 0.339, c_nf_per_km: 10.4, g_us_per_km: 0.0, max_i_ka: 0.29, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "94-AL1/15-ST1A 10.0", r_ohm_per_km: 0.306, x_ohm_per_km: 0.33, c_nf_per_km: 10.75, g_us_per_km: 0.0, max_i_ka: 0.35, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "122-AL1/20-ST1A 10.0", r_ohm_per_km: 0.2376, x_ohm_per_km: 0.323, c_nf_per_km: 11.1, g_us_per_km: 0.0, max_i_ka: 0.41, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "149-AL1/24-ST1A 10.0", r_ohm_per_km: 0.194, x_ohm_per_km: 0.315, c_nf_per_km: 11.25, g_us_per_km: 0.0, max_i_ka: 0.47, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "34-AL1/6-ST1A 20.0", r_ohm_per_km: 0.8342, x_ohm_per_km: 0.382, c_nf_per_km: 9.15, g_us_per_km: 0.0, max_i_ka: 0.17, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "48-AL1/8-ST1A 20.0", r_ohm_per_km: 0.5939, x_ohm_per_km: 0.372, c_nf_per_km: 9.5, g_us_per_km: 0.0, max_i_ka: 0.21, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "70-AL1/11-ST1A 20.0", r_ohm_per_km: 0.4132, x_ohm_per_km: 0.36, c_nf_per_km: 9.7, g_us_per_km: 0.0, max_i_ka: 0.29, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "94-AL1/15-ST1A 20.0", r_ohm_per_km: 0.306, x_ohm_per_km: 0.35, c_nf_per_km: 10.0, g_us_per_km: 0.0, max_i_ka: 0.35, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "122-AL1/20-ST1A 20.0", r_ohm_per_km: 0.2376, x_ohm_per_km: 0.344, c_nf_per_km: 10.3, g_us_per_km: 0.0, max_i_ka: 0.41, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "149-AL1/24-ST1A 20.0", r_ohm_per_km: 0.194, x_ohm_per_km: 0.337, c_nf_per_km: 10.5, g_us_per_km: 0.0, max_i_ka: 0.47, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "184-AL1/30-ST1A 20.0", r_ohm_per_km: 0.1571, x_ohm_per_km: 0.33, c_nf_per_km: 10.75, g_us_per_km: 0.0, max_i_ka: 0.535, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "243-AL1/39-ST1A 20.0", r_ohm_per_km: 0.1188, x_ohm_per_km: 0.32, c_nf_per_km: 11.0, g_us_per_km: 0.0, max_i_ka: 0.645, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "48-AL1/8-ST1A 110.0", r_ohm_per_km: 0.5939, x_ohm_per_km: 0.46, c_nf_per_km: 8.0, g_us_per_km: 0.0, max_i_ka: 0.21, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "70-AL1/11-ST1A 110.0", r_ohm_per_km: 0.4132, x_ohm_per_km: 0.45, c_nf_per_km: 8.4, g_us_per_km: 0.0, max_i_ka: 0.29, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "94-AL1/15-ST1A 110.0", r_ohm_per_km: 0.306, x_ohm_per_km: 0.44, c_nf_per_km: 8.65, g_us_per_km: 0.0, max_i_ka: 0.35, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "122-AL1/20-ST1A 110.0", r_ohm_per_km: 0.2376, x_ohm_per_km: 0.43, c_nf_per_km: 8.5, g_us_per_km: 0.0, max_i_ka: 0.41, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "149-AL1/24-ST1A 110.0", r_ohm_per_km: 0.194, x_ohm_per_km: 0.41, c_nf_per_km: 8.75, g_us_per_km: 0.0, max_i_ka: 0.47, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "184-AL1/30-ST1A 110.0", r_ohm_per_km: 0.1571, x_ohm_per_km: 0.4, c_nf_per_km: 8.8, g_us_per_km: 0.0, max_i_ka: 0.535, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "243-AL1/39-ST1A 110.0", r_ohm_per_km: 0.1188, x_ohm_per_km: 0.39, c_nf_per_km: 9.0, g_us_per_km: 0.0, max_i_ka: 0.645, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "305-AL1/39-ST1A 110.0", r_ohm_per_km: 0.0949, x_ohm_per_km: 0.38, c_nf_per_km: 9.2, g_us_per_km: 0.0, max_i_ka: 0.74, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "490-AL1/64-ST1A 110.0", r_ohm_per_km: 0.059, x_ohm_per_km: 0.37, c_nf_per_km: 9.75, g_us_per_km: 0.0, max_i_ka: 0.96, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "679-AL1/86-ST1A 110.0", r_ohm_per_km: 0.042, x_ohm_per_km: 0.36, c_nf_per_km: 9.95, g_us_per_km: 0.0, max_i_ka: 1.15, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 }, 
  { name: "490-AL1/64-ST1A 220.0", r_ohm_per_km: 0.059, x_ohm_per_km: 0.285, c_nf_per_km: 10.0, g_us_per_km: 0.0, max_i_ka: 0.96, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "679-AL1/86-ST1A 220.0", r_ohm_per_km: 0.042, x_ohm_per_km: 0.275, c_nf_per_km: 11.7, g_us_per_km: 0.0, max_i_ka: 1.15, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 }, 
  { name: "490-AL1/64-ST1A 380.0", r_ohm_per_km: 0.059, x_ohm_per_km: 0.253, c_nf_per_km: 11.0, g_us_per_km: 0.0, max_i_ka: 0.96, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 },
  { name: "679-AL1/86-ST1A 380.0", r_ohm_per_km: 0.042, x_ohm_per_km: 0.25, c_nf_per_km: 14.6, g_us_per_km: 0.0, max_i_ka: 1.15, type:"ol", r0_ohm_per_km:0.0, x0_ohm_per_km:0.0, c0_nf_per_km:0.0, endtemp_degree:250.0 }
];     

const columnDefsLineDialog = [
    {
      headerName: "Action",
      minWidth: 100,
      cellRenderer: actionCellRenderer,      
      editable: false,
      colId: "action",
      //suppressSizeToFit: true, //nie zmieniaj szerokości tej kolumny
    },
    { field: "name", minWidth: 300 },
    { field: "r_ohm_per_km",
      headerTooltip: "line resistance in ohm per km",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { field: "x_ohm_per_km",
      headerTooltip: "line reactance in ohm per km",
      maxWidth: 140,
      valueParser: numberParser,
    },
    { field: "c_nf_per_km",
      headerTooltip: "line capacitance (line-to-earth) in nano Farad per km",
      maxWidth: 130,
      valueParser: numberParser,
    },
    { field: "g_us_per_km",
      headerTooltip: "dielectric conductance in micro Siemens per km",
      maxWidth: 130,
      valueParser: numberParser,
    },
    { field: "max_i_ka",
      headerTooltip: "maximum thermal current in kilo Ampere",
      maxWidth: 100,
      valueParser: numberParser,
    },
    { field: "type",
      headerTooltip: "type of line (“ol” for overhead line or “cs” for cable system)",
      maxWidth: 100,
    },
    { field: "r0_ohm_per_km",
      headerTooltip: "zero sequence line resistance in ohm per km",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { field: "x0_ohm_per_km",
      headerTooltip: "zero sequence line reactance in ohm per km",
      maxWidth: 150,
      valueParser: numberParser,
    },
    { field: "c0_nf_per_km",
      headerTooltip: "zero sequence line capacitance in nano Farad per km",
      maxWidth: 130,
      valueParser: numberParser,
    },
    { field: "endtemp_degree",
      headerTooltip: "Short-Circuit end temperature of the line",
      maxWidth: 150,
      valueParser: numberParser,
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
      rowDefsDataLineDialog.splice(removeRowIndex, 1); //usun jeden element z indexu
      
      //rowDefsDataLineDialog.push(newRow)
      /*let newRowData = rowDefsDataLineDialog.filter(row => {
        return row !== removeRow;
      });*/
      //gridOptionsLineDialog.api.setRowData(newRowData);
      

      params.api.applyTransaction({
        remove: [params.node.data]
      });
    }

    if (action === "update") {
      
      var rowNode = gridOptionsLineDialog.api.getRowNode(params.node.rowIndex);      
      rowNode.setData(params.node.data);  
     

      params.api.stopEditing(false);
    }

    if (action === "cancel") {
      params.api.stopEditing(true);
    }
    if (action === "add") {   
      
      rowDefsDataLineDialog.push(params.node.data)

      params.api.applyTransaction({
        add: [{}],
      });
    }
  }
}
function onRowEditingStarted(params) {

  rowDefsDataLineDialog.push(params.node.data)

  params.api.refreshCells({
    columns: ["action"],
    rowNodes: [params.node],
    force: true
  });
}
function onRowEditingStopped(params) { 
 console.log(params)  
 // let newRow = params.data;   
 // rowDefsDataLineDialog.push(newRow)
 // gridOptionsLineDialog.api.setRowData(rowDefsDataLineDialog);

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
    alert("The value must be number (dot separated) or >= 0")
    return(Number(params.oldValue))
  }
}
/*********************************************** */

/* wczytywanie pliku CSV */
function setLineCsvData(keys, values) {

  console.log("jestem w setCsvData")
  
  var result = {}; 
  keys.forEach((key, index) => {
    if (key != "Action"  && index != 0 ){
        result[key.toLowerCase()] = values[index];
    }                    
   });
   console.log("result")
   console.log(result)

   rowDefsDataLineDialog.push(result)

 // gridOptionsLineDialog.api.setRowData([...rowDefsDataLineDialog, params]);
    gridOptionsLineDialog.api.setRowData(rowDefsDataLineDialog);
  
  /*
  params.api.refreshCells({
    columns: ["action"],
    rowNodes: [params.node],
    force: true
  });*/
  
}

function onFirstDataRendered(params) {
  params.api.sizeColumnsToFit();
}

var gridOptionsLineDialog = {
  suppressClickEdit: true, //edit, delete, update, cancel
  editType: "fullRow",
  rowSelection: "single",
    
  rowData: rowDefsDataLineDialog,
  columnDefs: columnDefsLineDialog,
  defaultColDef: {
    editable: true    
  },

  //dopasuj kolumny do wyświetlanego dialogu
  //onFirstDataRendered: onFirstDataRendered,

  //edit, delete, update, cancel*****************
  onCellClicked: onCellClicked,   
  onRowEditingStarted: onRowEditingStarted, 
  onRowEditingStopped: onRowEditingStopped,
  onSelectionChanged: () => {
    const selectedData = gridOptionsLineDialog.api.getSelectedRows();
    //console.log('Selection Changed', selectedData);
  },
  //*********************************************
  
};




