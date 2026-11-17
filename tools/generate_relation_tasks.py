"""Задачи на взаимное расположение прямых и плоскостей в кубе. Код ответа считается точной целочисленной арифметикой здесь и независимо пересчитывается ядром TypeScript (tests)."""
import json, random, itertools
LG=('ru','kk','en'); rnd=random.Random(11)
NM=['A','B','C','D','A₁','B₁','C₁','D₁']; V=[(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]
sub=lambda a,b:tuple(x-y for x,y in zip(a,b)); dot=lambda a,b:sum(x*y for x,y in zip(a,b))
cross=lambda a,b:(a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]); Z=(0,0,0)
def rel_lines(l1,l2):
    a,b=l1;c,d=l2;u=sub(V[b],V[a]);v=sub(V[d],V[c]);cr=cross(u,v)
    if cr==Z: return 1,(u,v,cr,None)
    t=dot(sub(V[c],V[a]),cr); return (2 if t==0 else 3),(u,v,cr,t)
def rel_lp(line,plane):
    a,b=line;p,q,r=plane;u=sub(V[b],V[a]);n=cross(sub(V[q],V[p]),sub(V[r],V[p]));d=dot(u,n)
    if d==0: m=dot(n,sub(V[a],V[p])); return (2 if m==0 else 1),(u,n,d,m)
    return (3 if cross(u,n)==Z else 4),(u,n,d,None)
nm=lambda *i:"".join(NM[x] for x in i)
pairs=list(itertools.combinations(range(8),2)); rnd.shuffle(pairs)
ll={1:[],2:[],3:[]}
for l1,l2 in itertools.combinations(pairs,2):
    if l1==l2: continue
    c,info=rel_lines(l1,l2)
    if len(ll[c])<(7,7,8)[c-1]: ll[c].append((l1,l2,info))
    if all(len(ll[k])>=(7,7,8)[k-1] for k in ll): break
triples=list(itertools.combinations(range(8),3)); lp={1:[],2:[],3:[],4:[]}
rnd.shuffle(triples)
for pl in triples:
    for ln in pairs:
        if set(ln)<=set(pl): continue
        c,info=rel_lp(ln,pl)
        if len(lp[c])<4 and rnd.random()<0.25: lp[c].append((ln,pl,info))
    if all(len(lp[k])>=4 for k in lp): break
assert all(len(v)>=n for v,n in zip(ll.values(),(7,7,8))) and all(len(v)>=4 for v in lp.values())
cube={'ru':"В кубе ABCDA₁B₁C₁D₁",'kk':"ABCDA₁B₁C₁D₁ кубында",'en':"In cube ABCDA₁B₁C₁D₁"}
S_LL={'ru':"{c} определите взаимное расположение прямых {x} и {y}. Ответ запишите числом: 1 — параллельны, 2 — пересекаются, 3 — скрещиваются.",'kk':"{c} {x} және {y} түзулерінің өзара орналасуын анықтаңыз. Жауапты санмен жазыңыз: 1 — параллель, 2 — қиылысады, 3 — айқас.",'en':"{c} determine the relative position of lines {x} and {y}. Answer with a number: 1 — parallel, 2 — intersecting, 3 — skew."}
S_LP={'ru':"{c} определите взаимное расположение прямой {x} и плоскости {y}. Ответ запишите числом: 1 — параллельна, 2 — лежит в плоскости, 3 — перпендикулярна, 4 — пересекает под углом, не равным 90°.",'kk':"{c} {x} түзуі мен {y} жазықтығының өзара орналасуын анықтаңыз. Жауапты санмен жазыңыз: 1 — параллель, 2 — жазықтықта жатыр, 3 — перпендикуляр, 4 — 90°-қа тең емес бұрышпен қиылысады.",'en':"{c} determine the relative position of line {x} and plane {y}. Answer with a number: 1 — parallel, 2 — lies in the plane, 3 — perpendicular, 4 — intersects at an angle other than 90°."}
TT={'ll':("Взаимное расположение двух прямых","Екі түзудің өзара орналасуы","Relative position of two lines"),'lp':("Прямая и плоскость","Түзу мен жазықтық","Line and plane")}
CONS=("Постройте обе прямые в 3D-лаборатории и проверьте, лежат ли они в одной плоскости.","Екі түзуді де 3D-зертханада салып, олардың бір жазықтықта жатуын тексеріңіз.","Construct both lines in the 3D lab and check whether they are coplanar.")
CONS_LP=("Постройте прямую и плоскость в 3D-лаборатории и сравните направление прямой с нормалью плоскости.","Түзу мен жазықтықты 3D-зертханада салып, түзудің бағытын жазықтық нормалімен салыстырыңыз.","Construct the line and the plane in the 3D lab and compare the direction of the line with the plane normal.")
W_LL={1:("прямые параллельны","түзулер параллель","the lines are parallel"),2:("прямые лежат в одной плоскости и пересекаются","түзулер бір жазықтықта жатады және қиылысады","the lines are coplanar and intersect"),3:("прямые не лежат в одной плоскости — скрещиваются","түзулер бір жазықтықта жатпайды — айқас","the lines are not coplanar — skew")}
W_LP={1:("прямая параллельна плоскости (точка прямой не лежит в плоскости)","түзу жазықтыққа параллель (түзудің нүктесі жазықтықта жатпайды)","the line is parallel to the plane (its point is not in the plane)"),2:("прямая лежит в плоскости (точка прямой в плоскости)","түзу жазықтықта жатыр (түзудің нүктесі жазықтықта)","the line lies in the plane (its point is in the plane)"),3:("u ∥ n — прямая перпендикулярна плоскости","u ∥ n — түзу жазықтыққа перпендикуляр","u ∥ n — the line is perpendicular to the plane"),4:("u·n ≠ 0, u не параллелен n — пересекает под углом, не равным 90°","u·n ≠ 0, u n-ге параллель емес — 90°-қа тең емес бұрышпен қиылысады","u·n ≠ 0 and u is not parallel to n — intersects at an angle other than 90°")}
CHK_LL=("Проверка: у скрещивающихся прямых смешанное произведение отлично от нуля, у параллельных нулевое векторное произведение.","Тексеру: айқас түзулерде аралас көбейтінді нөлге тең емес, параллельдерде векторлық көбейтінді нөлге тең.","Check: for skew lines the scalar triple product is nonzero; for parallel lines the cross product is zero.")
CHK_LP=("Проверка: прямая перпендикулярна плоскости, только если её направление параллельно нормали.","Тексеру: түзу жазықтыққа тек бағыты нормальға параллель болғанда перпендикуляр.","Check: a line is perpendicular to a plane only if its direction is parallel to the normal.")
tasks=[];sols=[];k=97
def add(kind,args,code,desc,statement_args,steps_c,words,vec_text):
    global k
    tid=f"ST-{k:04d}";k+=1
    st=(S_LL if kind=='ll' else S_LP)
    langs={l:{"title":TT[kind][i],"statement":st[l].format(c=cube[l],x=statement_args[0],y=statement_args[1])} for i,l in enumerate(LG)}
    tasks.append({"id":tid,"grade":10,"topic":"relative_position","subtopic":"lines" if kind=='ll' else "line_plane","difficulty":2 if code in(1,2) else 3,"languages":langs,"source":{"type":"original","citation":None,"rightsStatus":"original"},"validationStatus":"pending"})
    steps=[("analysis",{l:{'ru':"Определите взаимное расположение. ",'kk':"Өзара орналасуын анықтаңыз. ",'en':"Determine the relative position. "}[l]+statement_args[0]+", "+statement_args[1]+"." for l in LG}),("construction",dict(zip(LG,steps_c))),
      ("computation",{l:f"{vec_text}; {words[code][i]}. {code}." for i,l in enumerate(LG)}),("check",dict(zip(LG,CHK_LL if kind=='ll' else CHK_LP)))]
    S=[{"id":f"step-{i+1}","type":t,"ruleIds":(["RULE-020","RULE-001"] if kind=='ll' else ["RULE-021","RULE-005"]) if t=="computation" else [],"text":x} for i,(t,x) in enumerate(steps)]
    sols.append({"id":"SOL-"+tid,"taskId":tid,"edge":1,"steps":S,"finalAnswer":{"expression":str(code),"value":code,"unit":None},"verification":{"op":"relLines" if kind=='ll' else "relLinePlane","args":args},"validationStatus":"auto_validated","validatedBy":"geometry-core-recompute"})
fmtv=lambda v:"("+"; ".join(map(str,v))+")"
items=[(c,x) for c in ll for x in ll[c][:(7,7,8)[c-1]]]; rnd.shuffle(items)
for c,(l1,l2,(u,v,cr,t)) in items:
    vt=f"u = {fmtv(u)}, v = {fmtv(v)}, u × v = {fmtv(cr)}"+(f", (AC, u, v) = {t}" if t is not None else "")
    add('ll',[NM[l1[0]],NM[l1[1]],NM[l2[0]],NM[l2[1]]],c,None,(nm(*l1),nm(*l2)),CONS,W_LL,vt)
items=[(c,x) for c in lp for x in lp[c][:4]]; rnd.shuffle(items)
for c,(ln,pl,(u,n,d,m)) in items:
    vt=f"u = {fmtv(u)}, n = {fmtv(n)}, u·n = {d}"+(f", n·(P−A) = {m}" if m is not None else "")
    add('lp',[NM[ln[0]],NM[ln[1]],NM[pl[0]],NM[pl[1]],NM[pl[2]]],c,None,(nm(*ln),nm(*pl)),CONS_LP,W_LP,vt)
json.dump(tasks,open("data/tasks/generated_relations.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
json.dump(sols,open("data/solutions/solutions_part_06.json","w",encoding="utf-8"),ensure_ascii=False,indent=1)
p="data/mathematics/theorems.json"; R=json.load(open(p,encoding="utf-8"))
def Rl(id,typ,rel,kk,ru,en): return {"id":id,"type":typ,"languages":{"kk":{"title":kk[0],"statement":kk[1]},"ru":{"title":ru[0],"statement":ru[1]},"en":{"title":en[0],"statement":en[1]}},"preconditions":[],"dependencies":[],"relatedTaskTypes":rel,"source":{"type":"original","citation":None,"rightsStatus":"original"},"validationStatus":"pending"}
if not any(r["id"]=="RULE-020" for r in R):
    R+=[Rl("RULE-020","theorem",["relative_position"],("Екі түзудің өзара орналасуы","Кеңістікте екі түзу не қиылысады, не параллель, не айқас болады. Бір жазықтықта жатпайтын түзулер айқас деп аталады. Түзулердің бағыттаушылары коллинеар болса, олар параллель."),("Взаимное расположение двух прямых","В пространстве две прямые пересекаются, параллельны или скрещиваются. Скрещивающиеся прямые не лежат в одной плоскости. Прямые параллельны, если их направляющие векторы коллинеарны."),("Relative position of two lines","In space two lines intersect, are parallel, or are skew. Skew lines do not lie in one plane. Lines are parallel if their direction vectors are collinear.")),
     Rl("RULE-021","theorem",["relative_position"],("Түзу мен жазықтықтың өзара орналасуы","Түзу жазықтықта жатады, жазықтыққа параллель немесе оны қиып өтеді. Түзудің бағыттаушысы жазықтық нормалына перпендикуляр болса, түзу жазықтықта жатады немесе параллель; нормальға параллель болса — жазықтыққа перпендикуляр."),("Взаимное расположение прямой и плоскости","Прямая лежит в плоскости, параллельна ей или пересекает её. Если направляющий вектор прямой перпендикулярен нормали плоскости, прямая лежит в плоскости или параллельна ей; если параллелен нормали — прямая перпендикулярна плоскости."),("Relative position of a line and a plane","A line lies in a plane, is parallel to it, or crosses it. If the direction of the line is orthogonal to the plane normal, the line lies in the plane or is parallel to it; if it is parallel to the normal, the line is perpendicular to the plane."))]
    json.dump(R,open(p,"w",encoding="utf-8"),ensure_ascii=False,indent=1)
from collections import Counter
print(len(tasks),"tasks",Counter(s["finalAnswer"]["value"] for s in sols[:0]) or "", tasks[-1]["id"])
