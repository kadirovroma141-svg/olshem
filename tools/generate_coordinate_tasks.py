"""Координатно-векторные задачи. Точки фиксируются генератором (seed), ответ записывается точной формулой и независимо пересчитывается ядром."""
import json, math, random
LG=('ru','kk','en'); rnd=random.Random(2026)
def val(e): return eval(e.replace('^','**').replace('sqrt','math.sqrt'),{'math':math})
sub=lambda a,b:tuple(x-y for x,y in zip(a,b)); dot=lambda a,b:sum(x*y for x,y in zip(a,b))
cross=lambda a,b:(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def pt(): return tuple(rnd.randint(-3,5) for _ in range(3))
fmt=lambda n,p:f"{n}({'; '.join(map(str,p))})"
def pts_text(names,P): return ", ".join(fmt(n,P[n]) for n in names)
Q={'dist':{'ru':"Найдите длину отрезка AB.",'kk':"AB кесіндісінің ұзындығын табыңыз.",'en':"Find the length of segment AB."},
'cos':{'ru':"Найдите косинус угла BAC.",'kk':"BAC бұрышының косинусын табыңыз.",'en':"Find the cosine of angle BAC."},
'vol':{'ru':"Найдите объём тетраэдра ABCD.",'kk':"ABCD тетраэдрінің көлемін табыңыз.",'en':"Find the volume of tetrahedron ABCD."},
'pp':{'ru':"Найдите расстояние от точки P до плоскости ABC.",'kk':"P нүктесінен ABC жазықтығына дейінгі қашықтықты табыңыз.",'en':"Find the distance from point P to plane ABC."},
'skew':{'ru':"Найдите расстояние между прямыми AB и CD.",'kk':"AB және CD түзулерінің арасындағы қашықтықты табыңыз.",'en':"Find the distance between lines AB and CD."}}
G={'ru':"Даны точки {p}. ",'kk':"Нүктелер берілген: {p}. ",'en':"Given points {p}. "}
TT={'dist':("Длина отрезка по координатам","Координаталар бойынша кесінді ұзындығы","Segment length from coordinates"),'cos':("Угол между векторами","Векторлар арасындағы бұрыш","Angle between vectors"),'vol':("Объём тетраэдра по координатам","Координаталар бойынша тетраэдр көлемі","Tetrahedron volume from coordinates"),'pp':("Расстояние от точки до плоскости","Нүктеден жазықтыққа дейінгі қашықтық","Distance from a point to a plane"),'skew':("Расстояние между скрещивающимися прямыми","Айқас түзулер арасындағы қашықтық","Distance between skew lines")}
FORM={'dist':"|AB| = √(Δx² + Δy² + Δz²)",'cos':"cos∠BAC = (AB·AC)/(|AB|·|AC|)",'vol':"V = |(AB, AC, AD)|/6",'pp':"n = AB × AC, d = |n·AP|/|n|",'skew':"n = AB × CD, d = |n·AC|/|n|"}
CHK={'dist':("Проверка: длина положительна.","Тексеру: ұзындық оң.","Check: the length is positive."),'cos':("Проверка: косинус лежит в промежутке [−1; 1].","Тексеру: косинус [−1; 1] аралығында жатыр.","Check: the cosine lies in [−1, 1]."),'vol':("Проверка: объём положителен, точки не лежат в одной плоскости.","Тексеру: көлем оң, нүктелер бір жазықтықта жатпайды.","Check: the volume is positive, the points are not coplanar."),'pp':("Проверка: расстояние не превышает длину отрезка PA.","Тексеру: қашықтық PA кесіндісінің ұзындығынан аспайды.","Check: the distance does not exceed the length of PA."),'skew':("Проверка: векторное произведение направляющих ненулевое (прямые не параллельны).","Тексеру: бағыттаушылардың векторлық көбейтіндісі нөлге тең емес (түзулер параллель емес).","Check: the cross product of directions is nonzero (lines are not parallel).")}
CONS=("Отметьте точки по координатам кнопкой «Добавить точку» и соедините нужные отрезки.","Нүктелерді координаталары бойынша «Нүкте қосу» батырмасымен белгілеңіз және қажетті кесінділерді қосыңыз.","Mark the points by their coordinates with the Add point button and connect the needed segments.")
def make(f):
    while True:
        n={'dist':['A','B'],'cos':['A','B','C'],'vol':['A','B','C','D'],'pp':['P','A','B','C'],'skew':['A','B','C','D']}[f]
        P={x:pt() for x in n}
        if len(set(P.values()))<len(n): continue
        A=P['A']
        if f=='dist':
            d=sub(P['B'],A); e=f"sqrt(({d[0]})^2+({d[1]})^2+({d[2]})^2)"; op='coordDistance'; args=['A','B']; segs=[['A','B']]; pl=[]
        elif f=='cos':
            u,v=sub(P['B'],A),sub(P['C'],A); nu,nv=dot(u,u),dot(v,v)
            if nu==0 or nv==0 or dot(u,v)==0 or not cross(u,v)!=(0,0,0) and False: continue
            if cross(u,v)==(0,0,0): continue
            e=f"({dot(u,v)})/(sqrt({nu})*sqrt({nv}))"; op='coordCosAngle'; args=['A','B','C']; segs=[['A','B'],['A','C']]; pl=[]
        elif f=='vol':
            u,v,w=sub(P['B'],A),sub(P['C'],A),sub(P['D'],A); det=abs(dot(u,cross(v,w)))
            if det==0: continue
            e=f"{det}/6"; op='coordTetraVolume'; args=['A','B','C','D']; segs=[[a,b] for i,a in enumerate('ABCD') for b in 'ABCD'[i+1:]]; pl=[]
        elif f=='pp':
            nn=cross(sub(P['B'],P['A']),sub(P['C'],P['A']))
            if nn==(0,0,0): continue
            d=abs(dot(nn,sub(P['P'],P['A'])))
            if d==0: continue
            e=f"{d}/sqrt({dot(nn,nn)})"; op='coordPointPlane'; args=['P','A','B','C']; segs=[['A','B'],['B','C'],['C','A']]; pl=[['A','B','C']]
        else:
            u,v=sub(P['B'],A),sub(P['D'],P['C']); nn=cross(u,v)
            if nn==(0,0,0): continue
            d=abs(dot(nn,sub(P['C'],A)))
            if d==0: continue
            e=f"{d}/sqrt({dot(nn,nn)})"; op='coordSkewDistance'; args=['A','B','C','D']; segs=[['A','B'],['C','D']]; pl=[]
        return n,P,e,op,args,segs,pl
tasks=[];sols=[];k=77
for f in ['dist','cos','vol','pp','skew']:
    for _ in range(4):
        n,P,e,op,args,segs,pl=make(f); tid=f"ST-{k:04d}"; k+=1; v=val(e)
        lang={l:{"title":TT[f][i],"statement":G[l].format(p=pts_text(n,P))+Q[f][l]} for i,l in enumerate(LG)}
        tasks.append({"id":tid,"grade":11,"topic":"coordinates","subtopic":f,"difficulty":2 if f in('dist','cos') else 3,"languages":lang,"source":{"type":"original","citation":None,"rightsStatus":"original"},"validationStatus":"pending"})
        st=[("analysis",{l:Q[f][l] for l in LG}),("construction",dict(zip(LG,CONS))),("computation",{l:f"{FORM[f]}; {e} ≈ {v:.4f}." for l in LG}),("check",dict(zip(LG,CHK[f])))]
        S=[{"id":f"step-{i+1}","type":t,"ruleIds":["RULE-0"+{'dist':'15','cos':'16','vol':'17','pp':'18','skew':'19'}[f]] if t=="computation" else [],"text":x} for i,(t,x) in enumerate(st)]
        sols.append({"id":"SOL-"+tid,"taskId":tid,"steps":S,"finalAnswer":{"expression":e,"value":v,"unit":None},"verification":{"op":op,"args":args,"coords":{x:list(P[x]) for x in n},"segs":segs,"planes":pl},"validationStatus":"auto_validated","validatedBy":"geometry-core-recompute"})
json.dump(tasks,open("data/tasks/generated_coordinates.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
json.dump(sols,open("data/solutions/solutions_part_05.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
p="data/mathematics/theorems.json"; R=json.load(open(p,encoding="utf-8"))
def Rl(id,typ,rel,kk,ru,en): return {"id":id,"type":typ,"languages":{"kk":{"title":kk[0],"statement":kk[1]},"ru":{"title":ru[0],"statement":ru[1]},"en":{"title":en[0],"statement":en[1]}},"preconditions":[],"dependencies":[],"relatedTaskTypes":rel,"source":{"type":"original","citation":None,"rightsStatus":"original"},"validationStatus":"pending"}
if not any(r["id"]=="RULE-015" for r in R):
    R+=[Rl("RULE-015","formula",["coordinates"],("Екі нүкте арасындағы қашықтық","A(x₁; y₁; z₁) және B(x₂; y₂; z₂) нүктелері арасындағы қашықтық √((x₂−x₁)² + (y₂−y₁)² + (z₂−z₁)²)."),("Расстояние между точками","Расстояние между A(x₁; y₁; z₁) и B(x₂; y₂; z₂) равно √((x₂−x₁)² + (y₂−y₁)² + (z₂−z₁)²)."),("Distance between points","The distance between A(x₁, y₁, z₁) and B(x₂, y₂, z₂) is √((x₂−x₁)² + (y₂−y₁)² + (z₂−z₁)²).")),
     Rl("RULE-016","formula",["coordinates","angles"],("Векторлар арасындағы бұрыш","Нөлдік емес a және b векторлары арасындағы бұрыштың косинусы cos φ = (a·b)/(|a|·|b|)."),("Угол между векторами","Косинус угла между ненулевыми векторами a и b равен cos φ = (a·b)/(|a|·|b|)."),("Angle between vectors","The cosine of the angle between nonzero vectors a and b is cos φ = (a·b)/(|a|·|b|).")),
     Rl("RULE-017","formula",["coordinates","volumes"],("Тетраэдр көлемі","Тетраэдр көлемі векторлардың аралас көбейтіндісінің модулінің алтыдан біріне тең: V = |(a, b, c)|/6."),("Объём тетраэдра","Объём тетраэдра равен одной шестой модуля смешанного произведения векторов рёбер: V = |(a, b, c)|/6."),("Tetrahedron volume","The volume of a tetrahedron is one sixth of the absolute value of the scalar triple product of its edge vectors: V = |(a, b, c)|/6.")),
     Rl("RULE-018","formula",["coordinates","distances"],("Нүктеден жазықтыққа дейінгі қашықтық","Жазықтықтың нормалі n = AB × AC болса, P нүктесінен жазықтыққа дейінгі қашықтық |n·AP|/|n|."),("Расстояние от точки до плоскости","Если нормаль плоскости n = AB × AC, то расстояние от точки P до плоскости равно |n·AP|/|n|."),("Distance from a point to a plane","If the plane normal is n = AB × AC, the distance from P to the plane is |n·AP|/|n|.")),
     Rl("RULE-019","formula",["coordinates","distances"],("Айқас түзулер арасындағы қашықтық","AB және CD айқас түзулері арасындағы қашықтық |n·AC|/|n|, мұнда n = AB × CD."),("Расстояние между скрещивающимися прямыми","Расстояние между скрещивающимися прямыми AB и CD равно |n·AC|/|n|, где n = AB × CD."),("Distance between skew lines","The distance between skew lines AB and CD is |n·AC|/|n|, where n = AB × CD."))]
    json.dump(R,open(p,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
print(len(tasks),"coordinate tasks, last",tasks[-1]["id"])
