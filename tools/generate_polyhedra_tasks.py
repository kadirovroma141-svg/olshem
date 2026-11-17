import json, math
SUB='₁'; NMS='ABCDEFGH'
G={'ru':{3:"правильной треугольной",4:"правильной четырёхугольной",6:"правильной шестиугольной"},'kk':{3:"дұрыс үшбұрышты",4:"дұрыс төртбұрышты",6:"дұрыс алтыбұрышты"},'en':{3:"regular triangular",4:"regular square",6:"regular hexagonal"}}
KIND={'prism':{'ru':"призмы",'kk':"призманың",'en':"prism"},'pyramid':{'ru':"пирамиды",'kk':"пирамиданың",'en':"pyramid"}}
Sb={3:lambda a:f"sqrt(3)/4*{a}^2",4:lambda a:f"{a}^2",6:lambda a:f"3*sqrt(3)/2*{a}^2"}
r2={3:lambda a:f"{a}^2/12",4:lambda a:f"{a}^2/4",6:lambda a:f"3*{a}^2/4"}
R2={3:lambda a:f"{a}^2/3",4:lambda a:f"{a}^2/2",6:lambda a:f"{a}^2"}
Q={'tanE':{'ru':"тангенс угла между боковым ребром и плоскостью основания",'kk':"бүйір қыры мен табан жазықтығы арасындағы бұрыштың тангенсін",'en':"the tangent of the angle between a lateral edge and the base plane"},'tanF':{'ru':"тангенс угла между боковой гранью и плоскостью основания",'kk':"бүйір жағы мен табан жазықтығы арасындағы бұрыштың тангенсін",'en':"the tangent of the angle between a lateral face and the base plane"},'vol':{'ru':"объём",'kk':"көлемін",'en':"the volume"},'surf':{'ru':"площадь полной поверхности",'kk':"толық бетінің ауданын",'en':"the total surface area"},'edge':{'ru':"длину бокового ребра",'kk':"бүйір қырының ұзындығын",'en':"the length of a lateral edge"},'diag':{'ru':"длину диагонали {d}",'kk':"{d} диагоналінің ұзындығын",'en':"the length of diagonal {d}"}}
FORM={'tan_edge':("tg φ = h/R, R — радиус описанной окружности основания (проекция ребра на основание — отрезок длиной R)","tg φ = h/R, R — табанның сырттай сызылған шеңбер радиусы (қырдың табандағы проекциясы — ұзындығы R кесінді)","tg φ = h/R, R is the circumradius of the base (the projection of the edge onto the base has length R)"),'tan_face':("tg φ = h/r, r — апофема основания; угол SMO — линейный угол двугранного угла","tg φ = h/r, r — табан апофемасы; SMO бұрышы — екіжақты бұрыштың сызықтық бұрышы","tg φ = h/r, r is the base apothem; angle SMO is the linear angle of the dihedral angle"),'vol_prism':("V = S·h","V = S·h","V = S·h"),'vol_pyr':("V = S·h/3","V = S·h/3","V = S·h/3"),
'surf_prism':("S = 2·S_осн + P·h, P — периметр основания","S = 2·S_табан + P·h, P — табан периметрі","S = 2·S_base + P·h, P is the base perimeter"),
'surf_pyr':("S = S_осн + P·l/2, l = √(h² + r²), r — апофема основания","S = S_табан + P·l/2, l = √(h² + r²), r — табан апофемасы","S = S_base + P·l/2, l = √(h² + r²), r is the base apothem"),
'edge':("b = √(h² + R²), R — радиус описанной окружности основания","b = √(h² + R²), R — табанның сырттай сызылған шеңбер радиусы","b = √(h² + R²), R is the circumradius of the base"),
'diag':("d² = (диагональ основания)² + h²","d² = (табан диагоналі)² + h²","d² = (base diagonal)² + h²")}
CHK={'tan_edge':("Проверка: угол острый, tg φ > 0; при h → 0 угол стремится к нулю.","Тексеру: бұрыш сүйір, tg φ > 0; h → 0 болғанда бұрыш нөлге ұмтылады.","Check: the angle is acute, tg φ > 0; as h → 0 the angle tends to zero."),'tan_face':("Проверка: апофема основания короче радиуса описанной окружности, поэтому tg φ здесь больше, чем для бокового ребра.","Тексеру: табан апофемасы сырттай сызылған шеңбер радиусынан қысқа, сондықтан мұндағы tg φ қырға қарағандағы мәннен үлкен.","Check: the apothem is shorter than the circumradius, so tg φ here exceeds the value for the lateral edge."),'vol_pyr':("Проверка: объём втрое меньше объёма призмы с тем же основанием и высотой.","Тексеру: көлем сол табаны мен биіктігі бар призма көлемінен үш есе кіші.","Check: the volume is one third of the prism with the same base and height."),
'edge':("Проверка: ребро длиннее высоты.","Тексеру: қыр биіктіктен ұзын.","Check: the edge is longer than the height."),
'diag':("Проверка: диагональ длиннее высоты и диагонали основания.","Тексеру: диагональ биіктіктен және табан диагоналінен ұзын.","Check: the diagonal exceeds both the height and the base diagonal.")}
DEF=("Проверка: результат положителен и согласуется с размерами фигуры.","Тексеру: нәтиже оң және фигура өлшемдеріне сәйкес.","Check: the result is positive and consistent with the solid's dimensions.")
def val(e):
    import re
    return eval(e.replace('^','**').replace('sqrt','math.sqrt'),{'math':math})
tasks=[];sols=[];k=5
def add(fam,kind,n,a,h,q,expr,op,args,rules,grade,topic,dname=None):
    global k
    tid=f"ST-{k:04d}";k+=1;v=val(expr)
    qd=lambda l:Q[q][l].replace('{d}',dname or '')
    langs={}
    for l in('ru','kk','en'):
        who=f"{G[l][n]} {KIND[kind][l]}"
        if l=='ru': st=f"Сторона основания {who} равна {a}, высота равна {h}. Найдите {qd(l)}."
        elif l=='kk': st=f"{who[0].upper()+who[1:]} табанының қабырғасы — {a}, биіктігі — {h}. {qd(l)[0].upper()+qd(l)[1:]} табыңыз."
        else: st=f"The base side of a {who} is {a} and its height is {h}. Find {qd(l)}."
        ttl={'ru':f"{Q[q]['ru'].replace('{d}',dname or '').capitalize()}: {KIND[kind]['ru']} (n={n})",'kk':f"{KIND[kind]['kk'].capitalize()} (n={n}): {qd('kk')}",'en':f"{qd('en').capitalize()}: {KIND[kind]['en']} (n={n})"}[l]
        langs[l]={"title":ttl,"statement":st}
    tasks.append({"id":tid,"grade":grade,"topic":topic,"subtopic":fam,"difficulty":2 if n!=6 else 3,"languages":langs,"source":{"type":"original","citation":None,"rightsStatus":"original"},"validationStatus":"pending"})
    fm=FORM[fam.split(':')[0]] if fam.split(':')[0] in FORM else FORM[fam]; ck=CHK.get(fam,DEF)
    steps=[]
    for i,(typ,tx) in enumerate([("analysis",{'ru':f"Дано: сторона основания {a}, высота {h}, n = {n}. Найти: {qd('ru')}.",'kk':f"Берілгені: табан қабырғасы {a}, биіктігі {h}, n = {n}. Табу керек: {qd('kk')}.",'en':f"Given: base side {a}, height {h}, n = {n}. Find: {qd('en')}."}),
        ("construction",{'ru':"Постройте фигуру в 3D-лаборатории и отметьте нужные элементы.",'kk':"3D-зертханада фигураны салып, қажетті элементтерді белгілеңіз.",'en':"Construct the solid in the 3D lab and mark the needed elements."}),
        ("computation",{l:f"{fm[j]}. {expr} ≈ {v:.4f}." for j,l in enumerate(('ru','kk','en'))}),
        ("check",{l:ck[j] for j,l in enumerate(('ru','kk','en'))})]):
        steps.append({"id":f"step-{i+1}","type":typ,"ruleIds":rules if typ=="computation" else [],"text":tx})
    sol={"id":"SOL-"+tid,"taskId":tid,"steps":steps,"finalAnswer":{"expression":expr,"value":v,"unit":None},"verification":{"op":op,"args":args,"solid":{"kind":kind,"n":n,"side":a,"h":h}},"validationStatus":"auto_validated","validatedBy":"geometry-core-recompute"}
    sols.append(sol)
P=[(3,4,5),(4,6,3),(6,2,7),(3,6,4),(4,5,8),(6,4,3)]
for n,a,h in P:
    add('vol_prism','prism',n,a,h,'vol',f"({Sb[n](a)})*{h}",'solidVolume',[],["RULE-007","RULE-008"],11,'volumes')
    add('vol_pyr','pyramid',n,a,h,'vol',f"({Sb[n](a)})*{h}/3",'solidVolume',[],["RULE-004","RULE-008"],11,'volumes')
    add('surf_prism','prism',n,a,h,'surf',f"2*({Sb[n](a)})+{n}*{a}*{h}",'solidSurface',[],["RULE-009","RULE-008"],11,'surface_areas')
    add('surf_pyr','pyramid',n,a,h,'surf',f"({Sb[n](a)})+{n}*{a}*sqrt({h}^2+{r2[n](a)})/2",'solidSurface',[],["RULE-009","RULE-008","RULE-002"],11,'surface_areas')
    add('edge','pyramid',n,a,h,'edge',f"sqrt({h}^2+{R2[n](a)})",'solidEdge',['A','S'],["RULE-002","RULE-008"],10,'distances')
for a,h in [(3,4),(5,2)]:
    add('diag','prism',4,a,h,'diag',f"sqrt(2*{a}^2+{h}^2)",'solidEdge',['A','C'+SUB],["RULE-002"],10,'distances',dname="AC"+SUB)
for a,h in [(2,5),(3,3)]:
    add('diag','prism',6,a,h,'diag',f"sqrt(4*{a}^2+{h}^2)",'solidEdge',['A','D'+SUB],["RULE-002","RULE-008"],10,'distances',dname="AD"+SUB)
json.dump(tasks,open("data/tasks/generated_polyhedra.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
json.dump(sols,open("data/solutions/solutions_part_02.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
# rules
p="data/mathematics/theorems.json"; R=json.load(open(p,encoding="utf-8"))
def Rl(id,typ,rel,dep,kk,ru,en): return {"id":id,"type":typ,"languages":{"kk":{"title":kk[0],"statement":kk[1]},"ru":{"title":ru[0],"statement":ru[1]},"en":{"title":en[0],"statement":en[1]}},"preconditions":[],"dependencies":dep,"relatedTaskTypes":rel,"source":{"type":"original","citation":None,"rightsStatus":"original"},"validationStatus":"pending"}
if not any(r["id"]=="RULE-007" for r in R):
    R+= [Rl("RULE-007","formula",["volumes"],[],("Призма көлемі","Призманың көлемі V = S·h, мұндағы S — табан ауданы, h — биіктік."),("Объём призмы","Объём призмы V = S·h, где S — площадь основания, h — высота."),("Volume of a prism","The volume of a prism is V = S·h, where S is the base area and h is the height.")),
     Rl("RULE-008","formula",["volumes","surface_areas","distances"],[],("Дұрыс көпбұрыштың элементтері","Қабырғасы a дұрыс үшбұрыштың ауданы a²√3/4, шаршының ауданы a², дұрыс алтыбұрыштың ауданы 3a²√3/2."),("Элементы правильного многоугольника","Площадь правильного треугольника со стороной a равна a²√3/4, квадрата — a², правильного шестиугольника — 3a²√3/2."),("Regular polygon elements","For side a the area of a regular triangle is a²√3/4, of a square a², of a regular hexagon 3a²√3/2.")),
     Rl("RULE-009","formula",["surface_areas"],[],("Толық беттің ауданы","Көпжақтың толық бетінің ауданы — барлық жақтары аудандарының қосындысы."),("Площадь полной поверхности","Площадь полной поверхности многогранника равна сумме площадей всех его граней."),("Total surface area","The total surface area of a polyhedron is the sum of the areas of all its faces."))]
    json.dump(R,open(p,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(len(tasks),"tasks")

tasks=[];sols=[]
for n,a,h in [(3,6,4),(4,4,3),(6,2,5),(4,6,5)]:
    add('tan_edge','pyramid',n,a,h,'tanE',f"{h}/sqrt({R2[n](a)})",'solidTanEdgeBase',['A','S'],["RULE-010","RULE-008"],11,'angles')
    add('tan_face','pyramid',n,a,h,'tanF',f"{h}/sqrt({r2[n](a)})",'solidTanFaceBase',['A','B','S'],["RULE-011","RULE-008"],11,'angles')
json.dump(tasks,open("data/tasks/generated_angles.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
json.dump(sols,open("data/solutions/solutions_part_03.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
R=json.load(open("data/mathematics/theorems.json",encoding="utf-8"))
if not any(r["id"]=="RULE-010" for r in R):
    R+=[Rl("RULE-010","definition",["angles"],[],("Түзу мен жазықтық арасындағы бұрыш","Түзу мен жазықтық арасындағы бұрыш — түзу мен оның жазықтыққа проекциясы арасындағы бұрыш."),("Угол между прямой и плоскостью","Угол между прямой и плоскостью — угол между этой прямой и её проекцией на плоскость."),("Angle between a line and a plane","The angle between a line and a plane is the angle between the line and its projection onto the plane.")),
     Rl("RULE-011","definition",["angles"],[],("Екі жазықтық арасындағы бұрыш","Екіжақты бұрыштың өлшемі — оның сызықтық бұрышының өлшемі: қырға перпендикуляр түзулер арасындағы бұрыш."),("Угол между плоскостями","Мера двугранного угла равна мере его линейного угла — угла между перпендикулярами к ребру, проведёнными в гранях."),("Angle between planes","The measure of a dihedral angle equals that of its linear angle: the angle between perpendiculars to the edge drawn in each face."))]
    json.dump(R,open("data/mathematics/theorems.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(len(tasks),"angle tasks")
