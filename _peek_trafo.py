p = r"src\main\webapp\js\electrisim\supportingFunctions.js"
text = open(p, encoding="utf-8").read()
keys = ["pp_hv_bus", "if(!e||!T.geometry)", "if(r||!e||!T.geometry)", "shapeELXXX=Transformer"]
for k in keys:
    i = 0
    n = 0
    while True:
        j = text.find(k, i)
        if j < 0:
            break
        n += 1
        print("\n====", k, "at", j, "====")
        print(text[max(0, j-400): j+700])
        i = j + len(k)
        if n >= 2:
            break
    if n == 0:
        print("MISSING", k)
