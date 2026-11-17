import './style.css';
import { t, LANGS, type Lang } from './i18n/i18n';
import * as g from './core/geometry';
import { evaluate, approxEqual } from './core/expr';
import tasks1 from '../data/tasks/solid_geometry.json';
import { loadExtraParts } from './data/loader';
import { openDb, Store } from './storage/db';
import { recognize, validateImage, type Pt as InkPt } from './htr/provider';
import { axialSection } from './core/revolution';
import { regularPrism, regularPyramid, volume, surfaceArea, edgesOf, type Poly } from './core/polyhedron';
import { filterTasks, topicsOf, type Filter, type CatalogTask } from './data/catalog';
import sols1 from '../data/solutions/solutions_part_01.json';
import rulesData from '../data/mathematics/theorems.json';
import { ruleViews, solutionView } from './data/view';
import { buildSolid, type Solution } from './data/verify';
import patterns from '../data/tutoring/error_patterns.json';
import { LocalRuleProvider, safeRespond, type AIContext, type ErrorPattern } from './ai/provider';

let tasks = tasks1 as unknown as CatalogTask[];
let sols = sols1 as unknown as Solution[];
type Pt = { n: string; p: g.V3 };
type State = { pts: Pt[]; segs: [string, string][]; pls: string[][]; dr: string; ans: string; solid?: { names: string[]; faces: number[][] } };
const CUBE_FACES = [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
const NM = ['A', 'B', 'C', 'D', 'A₁', 'B₁', 'C₁', 'D₁'];
const V: g.V3[] = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const ED = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];
const edge = (id: string) => (id === 'ST-0003' ? 2 : 4);
const ls = (k: string, v?: string) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* квота/приватный режим */ } return null; };

let lang = ((ls('ol:lang') as Lang) || 'ru'), theme = ls('ol:th') || 'light', ti = 0, hl = 0, yaw = .7, pit = .45, zoom = 1;
let S: State, hist: string[] = [];
let flt: Filter = {};
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
const T = (k: string) => t(lang, k);

$('#app').innerHTML = `<header><h1>Olshem</h1><span id="net" class="mu"></span><span id="sv" class="mu"></span>
<button id="rf" type="button" aria-expanded="false"></button><label class="mu"><input id="tc" type="checkbox"> <span id="tcl"></span></label><select id="prof" aria-label="Profile"></select><button id="np" type="button"></button><select id="lang" aria-label="Language">${LANGS.map(l => `<option value="${l}">${{ kk: 'Қазақша', ru: 'Русский', en: 'English' }[l]}</option>`).join('')}</select><button id="th" type="button"></button></header>
<main><section><h2 id="h-t"></h2><div class="row"><input id="q" type="search" style="flex:1;min-width:90px" aria-label="search"><select id="ft" aria-label="topic"></select><select id="fd" aria-label="difficulty"></select></div><div id="list"></div><h2 id="stT"></h2><p id="st"></p><p class="mu" id="vs"></p></section>
<section><h2 id="h-l"></h2><canvas id="cv" aria-label="3D"></canvas>
<div class="row"><input id="x" type="number" value="1" aria-label="x"><input id="y" type="number" value="1" aria-label="y"><input id="z" type="number" value="1" aria-label="z"><button id="bp" type="button"></button></div>
<div class="row">${['a','b','c','d'].map(i => `<select id="${i}" aria-label="${i.toUpperCase()}"></select>`).join('')}</div>
<div class="row"><button id="bs" type="button"></button><button id="bl" type="button"></button><button id="bd" type="button"></button><button id="bh" type="button"></button><button id="bv" type="button"></button></div>
<div class="row"><select id="sd" aria-label="solid"></select><button id="bb" type="button"></button><button id="bw" type="button"></button></div>
<div class="row"><button id="bj" type="button"></button><button id="bf" type="button"></button><button id="bx" type="button"></button></div>
<div class="row"><button id="un" type="button"></button><button id="rs" type="button"></button><span class="mu" id="dg"></span></div><div id="msg" class="out" role="status"></div></section>
<section><h2 id="h-s"></h2><textarea id="dr" aria-label="draft"></textarea><div class="row"><input id="ans" aria-label="answer" style="flex:1"><button id="ck" class="p" type="button"></button></div>
<details id="hw"><summary id="hwl"></summary><canvas id="ink" style="height:160px;min-height:160px" aria-label="handwriting"></canvas><div class="row"><button id="inkc" type="button"></button><button id="inkr" type="button"></button></div><div class="row"><input id="ph" type="file" accept="image/png,image/jpeg,image/webp" aria-label="photo"></div><label class="mu"><input id="phc" type="checkbox"> <span id="phcl"></span></label><div id="hwo" class="out" role="status"></div></details>
<div class="row"><button id="hb" type="button"></button><span class="mu" id="hl"></span></div><div id="hint" class="out" role="status"></div><div id="res" class="out" role="status"></div><div id="solv" hidden></div></section></main><section id="ref" hidden style="margin:0 10px 10px"></section>`;

const rulesByTask: Record<string, string[]> = {};
const fillRules = () => { for (const x of sols) rulesByTask[x.taskId] = [...new Set(x.steps.flatMap(st => st.ruleIds))]; };
fillRules();
const tutor = new LocalRuleProvider(patterns as unknown as ErrorPattern[], rulesByTask);
async function tutorSays(level: number) {
  const sol = sols.find(x => x.taskId === tasks[ti].id)!;
  const ctx: AIContext = { taskId: sol.taskId, language: lang, currentStep: 1, studentExpression: S.ans, recentActions: [], detectedErrors: [], relevantRules: rulesByTask[sol.taskId] ?? [], hintLevel: Math.max(1, Math.min(5, level)) as AIContext['hintLevel'] };
  const { response } = await safeRespond(null, tutor, ctx, sol.finalAnswer);
  const h = $('#hint'); h.textContent = response.message + (response.nextQuestion ? ' ' + response.nextQuestion : ''); h.className = 'out';
}
const SOLIDS = ['cube', 'prism3', 'prism6', 'pyr4', 'pyr3'];
/** Текущая фигура как выпуклый многогранник (куб по умолчанию). */
const polyOf = (): Poly => { const so = S.solid ?? { names: NM, faces: CUBE_FACES }; return { names: so.names, verts: so.names.map(n => P(n)), faces: so.faces }; };
const sel = () => ['a', 'b', 'c', 'd'].map(i => $<HTMLSelectElement>('#' + i).value);
const P = (n: string) => S.pts.find(p => p.n === n)!.p;
const say = (m: string, c = '') => { const e = $('#msg'); e.textContent = m; e.className = 'out ' + c; };
const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);
let store: Store | null = null, profileId = '';
const save = async () => {
  const sv = $('#sv');
  if (!store) { sv.textContent = T('save.error'); return; }
  const r = await store.saveSession(profileId, tasks[ti].id, S);
  sv.textContent = T(r.ok ? 'save.saved' : 'save.error');
};
let timer: number; const later = () => { clearTimeout(timer); timer = window.setTimeout(save, 400); };
const snap = () => hist.push(JSON.stringify(S));
const geomErr = (r: { ok: false; reason: string }) => say(T('geom.error.' + r.reason), 'er');

async function init(reset = false) {
  const id = tasks[ti].id, e = edge(id); let s: State | null = null;
  if (!reset && store) { try { s = ((await store.loadSession(profileId, id))?.data as State) ?? null; } catch { s = null; } }
  const sd = sols.find(x => x.taskId === id)?.verification.solid;
  if (!s && sd) { const pl = buildSolid(sd); s = { pts: pl.verts.map((p, i) => ({ n: pl.names[i], p })), segs: edgesOf(pl).map(([a, b]) => [pl.names[a], pl.names[b]] as [string, string]), pls: [], dr: '', ans: '', solid: { names: pl.names, faces: pl.faces } }; }
  const vf = sols.find(x => x.taskId === id)?.verification;
  if (!s && vf?.coords) { s = { pts: Object.entries(vf.coords).map(([n, p]) => ({ n, p })), segs: vf.segs ?? [], pls: vf.planes ?? [], dr: '', ans: '', solid: { names: [], faces: [] } }; }
  const rv = vf?.rev;
  if (!s && rv) { const ax = axialSection(rv); s = { pts: ax.pts, segs: ax.segs, pls: [], dr: '', ans: '', solid: { names: [], faces: [] } }; }
  S = s ?? { pts: V.map((v, i) => ({ n: NM[i], p: v.map(c => c * e) as g.V3 })), segs: ED.map(x => [NM[x[0]], NM[x[1]]]), pls: [], dr: '', ans: '' };
  hist = []; hl = 0; fill(); ui();
}
function fill() {
  ['a', 'b', 'c', 'd'].forEach((id, j) => { $<HTMLSelectElement>('#' + id).innerHTML = S.pts.map((p, i) => `<option${i === j ? ' selected' : ''}>${p.n}</option>`).join(''); });
  $<HTMLTextAreaElement>('#dr').value = S.dr; $<HTMLInputElement>('#ans').value = S.ans;
}
function draw() {
  const c = $<HTMLCanvasElement>('#cv'), d = devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight; c.width = w * d; c.height = h * d;
  const x = c.getContext('2d')!; x.scale(d, d); const cs = getComputedStyle(document.documentElement), v = (k: string) => cs.getPropertyValue(k);
  const lo = [0, 1, 2].map(k => Math.min(...S.pts.map(q => q.p[k]))), hi = [0, 1, 2].map(k => Math.max(...S.pts.map(q => q.p[k]))), ctr = lo.map((l, k) => (l + hi[k]) / 2), ext = Math.max(...hi.map((u, k) => u - lo[k]), 1e-6), sc = Math.min(w, h) / (ext * 2.6) * zoom, cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  const pr = (p: g.V3) => { const a = p[0] - ctr[0], b = p[1] - ctr[1], z = p[2] - ctr[2], x1 = a * cy - b * sy, y1 = a * sy + b * cy; return [w / 2 + x1 * sc, h / 2 - (z * cp + y1 * sp) * sc]; };
  x.font = '14px system-ui'; x.lineWidth = 1.6;
  S.pls.forEach(q => { const a = q.map(n => pr(P(n))); x.fillStyle = v('--pl'); x.beginPath(); a.forEach((p, i) => i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.fill(); });
  S.segs.forEach(s => { const a = pr(P(s[0])), b = pr(P(s[1])); x.strokeStyle = v('--tx'); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); });
  S.pts.forEach(q => { const a = pr(q.p); x.fillStyle = v('--ac'); x.beginPath(); x.arc(a[0], a[1], 4, 0, 7); x.fill(); x.fillStyle = v('--tx'); x.fillText(q.n, a[0] + 6, a[1] - 6); });
}
function ui() {
  const r = document.documentElement; r.lang = lang; r.dataset.t = theme; $<HTMLSelectElement>('#lang').value = lang; $('#th').textContent = theme === 'dark' ? '☀' : '☾';
  const set = (id: string, k: string) => { $(id).textContent = T(k); };
  set('#h-t', 'ui.tasks'); set('#h-l', 'ui.lab'); set('#h-s', 'ui.sol'); set('#bp', 'ui.add'); set('#bs', 'ui.seg'); set('#bl', 'ui.plane'); set('#bd', 'ui.dist'); set('#bh', 'ui.pd'); set('#bv', 'ui.vol');
  set('#un', 'ui.undo'); set('#rs', 'ui.reset'); set('#ck', 'ui.check'); set('#hb', 'ui.hint'); set('#dg', 'ui.drag'); $<HTMLInputElement>('#ans').placeholder = T('ui.ans');
  const L = tasks[ti].languages[lang]; $('#stT').textContent = L.title; $('#st').textContent = L.statement; $('#vs').textContent = `${tasks[ti].id}: ${T('ui.pending')}`; $('#hl').textContent = `${T('ui.level')}: ${hl}/4`;
  $('#net').textContent = navigator.onLine ? '' : T('status.offline');
  set('#np', 'ui.newProfile'); set('#hwl', 'ui.handwriting'); set('#inkc', 'ui.inkClear'); set('#inkr', 'ui.recognize'); set('#phcl', 'ui.keepPhoto'); set('#bb', 'ui.build'); set('#bw', 'ui.volarea'); { const sd = $<HTMLSelectElement>('#sd'), cur = sd.value || 'cube'; sd.innerHTML = SOLIDS.map(k => `<option value="${k}"${k === cur ? ' selected' : ''}>${T('solid.' + k)}</option>`).join(''); } set('#bj', 'ui.proj'); set('#bf', 'ui.foot'); set('#bx', 'ui.section'); set('#rf', 'nav.reference'); set('#tcl', 'ui.teacher'); $('#tc').title = T('ui.teacherNote'); renderRef(); renderSolution(); $<HTMLInputElement>('#q').placeholder = T('ui.search');
  $<HTMLSelectElement>('#ft').innerHTML = `<option value="">${T('ui.allTopics')}</option>` + topicsOf(tasks).map(x => `<option value="${x}"${flt.topic === x ? ' selected' : ''}>${T('topic.' + x)}</option>`).join('');
  $<HTMLSelectElement>('#fd').innerHTML = `<option value="">${T('ui.allLevels')}</option>` + [1, 2, 3, 4, 5].map(x => `<option value="${x}"${flt.difficulty === x ? ' selected' : ''}>${T('ui.level.n')} ${x}</option>`).join('');
  const list = $('#list'); list.innerHTML = ''; const shown = filterTasks(tasks, flt, lang);
  if (!shown.length) list.textContent = T('ui.noTasks');
  shown.forEach(k => { const b = document.createElement('button'); b.className = 'tk'; b.type = 'button'; b.textContent = `${k.id} · ${k.languages[lang].title}`; if (k.id === tasks[ti].id) b.setAttribute('aria-current', 'true'); b.onclick = async () => { await save(); ti = tasks.findIndex(x => x.id === k.id); await init(); }; list.append(b); });
  draw();
}
$('#q').oninput = e => { flt = { ...flt, query: (e.target as HTMLInputElement).value }; ui(); };
$('#ft').onchange = e => { flt = { ...flt, topic: (e.target as HTMLSelectElement).value || undefined }; ui(); };
$('#fd').onchange = e => { const v = (e.target as HTMLSelectElement).value; flt = { ...flt, difficulty: v ? Number(v) : undefined }; ui(); };
const el = (tag: string, text = '', cls = '') => { const e = document.createElement(tag); e.textContent = text; if (cls) e.className = cls; return e; };
function renderRef() {
  const box = $('#ref'); box.replaceChildren(el('h2', T('nav.reference')));
  for (const v of ruleViews(rulesData as any, lang)) { const d = el('div'); d.style.margin = '8px 0'; d.append(el('b', `${v.id} · ${v.title}`), el('span', ` (${T('type.' + v.type)}; ${T('status.' + v.status)})`, 'mu'), el('div', v.statement)); box.append(d); }
}
/** Эталонное решение видно только при включённом режиме учителя; по умолчанию скрыто от ученика. */
function renderSolution() {
  const box = $('#solv'), on = $<HTMLInputElement>('#tc').checked; box.hidden = !on; box.replaceChildren(); if (!on) return;
  const sol = sols.find(x => x.taskId === tasks[ti].id) as unknown as Solution | undefined; if (!sol) return; const v = solutionView(sol, lang);
  box.append(el('h2', T('ui.refSol')), el('p', `${T('ui.statusLbl')}: ${T('status.' + v.status)}`, 'mu'));
  for (const st of v.steps) { const d = el('div'); d.style.margin = '6px 0'; d.append(el('b', `${st.n}. ${T('step.' + st.type)}: `), el('span', st.text), el('span', st.rules.length ? ` [${st.rules.join(', ')}]` : '', 'mu')); box.append(d); }
  box.append(el('p', `${T('ui.answerLbl')}: ${v.answer}`));
}
$('#rf').onclick = () => { const b = $('#ref'); b.hidden = !b.hidden; $('#rf').setAttribute('aria-expanded', String(!b.hidden)); };
$('#tc').onchange = renderSolution;
async function refreshProfiles() {
  if (!store) return; const sel = $<HTMLSelectElement>('#prof');
  sel.innerHTML = (await store.listProfiles()).map((p, i) => `<option value="${p.id}"${p.id === profileId ? ' selected' : ''}>${p.guest ? T('ui.guest') : p.displayName}${p.guest && i ? ' ' + (i + 1) : ''}</option>`).join('');
}
/** Переключение: сохранить текущего, очистить интерфейс от чужих данных, загрузить данные выбранного профиля. */
async function switchProfile(id: string) {
  await save(); profileId = id; ls('ol:pid', id);
  for (const k of ['#hint', '#res', '#msg']) { $(k).textContent = ''; $(k).className = 'out'; }
  hist = []; await init(); await refreshProfiles();
}
$('#prof').onchange = e => { void switchProfile((e.target as HTMLSelectElement).value); };
$('#np').onclick = async () => { if (!store) return; const n = prompt(T('ui.namePrompt'))?.trim().slice(0, 40); if (!n) return; await switchProfile((await store.createProfile(n)).id); };
$('#lang').onchange = e => { lang = (e.target as HTMLSelectElement).value as Lang; ls('ol:lang', lang); $('#hint').textContent = ''; ui(); };
$('#th').onclick = () => { theme = theme === 'dark' ? 'light' : 'dark'; ls('ol:th', theme); ui(); };
$('#bp').onclick = () => { const p = ['#x', '#y', '#z'].map(i => parseFloat($<HTMLInputElement>(i).value)); if (p.some(isNaN)) return; snap(); const n = ['P','Q','R','S','T','U','W'].find(k => !S.pts.some(q => q.n === k)) ?? 'X' + S.pts.length; S.pts.push({ n, p: p as g.V3 }); save(); fill(); say(`${n}(${p.join('; ')})`, 'ok'); draw(); };
$('#bs').onclick = () => { const [a, b] = sel(); if (a === b) return geomErr({ ok: false, reason: 'coincident' }); snap(); S.segs.push([a, b]); save(); draw(); };
$('#bl').onclick = () => { const n = sel().slice(0, 3); if (new Set(n).size < 3) return say(T('ui.pick'), 'er'); const r = g.planeFrom3(P(n[0]), P(n[1]), P(n[2])); if (!r.ok) return geomErr(r); snap(); S.pls.push(n); save(); draw(); };
$('#bd').onclick = () => { const [a, b] = sel(); say(`|${a}${b}| = ${fmt(g.distance(P(a), P(b)))}`); };
$('#bh').onclick = () => { const n = sel(); if (new Set(n).size < 4) return say(T('ui.pick'), 'er'); const r = g.planeFrom3(P(n[1]), P(n[2]), P(n[3])); if (!r.ok) return geomErr(r); say(`d(${n[0]}, ${n[1]}${n[2]}${n[3]}) = ${fmt(g.pointPlaneDistance(P(n[0]), r.value))}`); };
$('#bv').onclick = () => { const n = sel(); if (new Set(n).size < 4) return say(T('ui.pick'), 'er'); const v = g.tetraVolume(P(n[0]), P(n[1]), P(n[2]), P(n[3])); if (v < g.EPS) return geomErr({ ok: false, reason: 'coplanar' }); say(`V(${n.join('')}) = ${fmt(v)}`); };
const freeName = (pool: string[]) => pool.find(k => !S.pts.some(q => q.n === k)) ?? 'X' + S.pts.length;
/** Добавляет вычисленную точку в сцену и сохраняет её. */
const addPoint = (n: string, p: g.V3) => { S.pts.push({ n, p }); };
/** Рукописный ввод: штрихи на холсте. Распознавание пока не подключено (провайдер null): интерфейс честно сообщает об этом. */
let ink: InkPt[][] = [];
const inkCv = $<HTMLCanvasElement>('#ink'); let inkDown = false;
const inkDraw = () => { const d = devicePixelRatio || 1, w = inkCv.clientWidth, h = inkCv.clientHeight; inkCv.width = w * d; inkCv.height = h * d; const x = inkCv.getContext('2d')!; x.scale(d, d); x.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--tx'); x.lineWidth = 2; x.lineCap = 'round'; for (const st of ink) { x.beginPath(); st.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.stroke(); } };
inkCv.onpointerdown = e => { inkDown = true; inkCv.setPointerCapture(e.pointerId); const r = inkCv.getBoundingClientRect(); ink.push([{ x: e.clientX - r.left, y: e.clientY - r.top }]); inkDraw(); };
inkCv.onpointermove = e => { if (!inkDown || ink.length > 200) return; const r = inkCv.getBoundingClientRect(); ink[ink.length - 1].push({ x: e.clientX - r.left, y: e.clientY - r.top }); inkDraw(); };
inkCv.onpointerup = () => { inkDown = false; };
const hwSay = (m: string, c = '') => { const e = $('#hwo'); e.textContent = m; e.className = 'out ' + c; };
const handle = async (input: Parameters<typeof recognize>[1]) => {
  const r = await recognize(null, input, { online: navigator.onLine });
  if (r.status === 'unavailable') return hwSay(T('htr.reason.' + r.reason), 'er');
  if (confirm(`${T('htr.confirm')}\n${r.text}`)) { S.ans = r.text; $<HTMLInputElement>('#ans').value = r.text; later(); }
};
$('#inkc').onclick = () => { ink = []; inkDraw(); hwSay(''); };
$('#inkr').onclick = () => { void handle({ kind: 'strokes', strokes: ink }); };
$('#ph').onchange = async e => {
  const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return; const c = validateImage({ type: f.type, size: f.size }); if (!c.ok) return hwSay(T('htr.reason.' + c.reason), 'er');
  const bytes = new Uint8Array(await f.arrayBuffer()); let msg = T('htr.photoNotSaved');
  if ($<HTMLInputElement>('#phc').checked && store) { const q = await store.queueImage(profileId, tasks[ti].id, bytes, f.type, true); msg = q.ok ? T('htr.photoSaved') : T('htr.saveError'); }
  await handle({ kind: 'image', bytes, mime: f.type }); const o = $('#hwo'); o.textContent = `${msg} ${o.textContent}`.trim();
};
$('#bj').onclick = async () => {
  const n = sel(); if (new Set(n.slice(0, 4)).size < 4) return say(T('ui.pick'), 'er'); const r = g.planeFrom3(P(n[1]), P(n[2]), P(n[3])); if (!r.ok) return geomErr(r);
  snap(); const h = freeName(['H', 'K', 'M']); addPoint(h, g.projectToPlane(P(n[0]), r.value)); S.segs.push([n[0], h]); await save(); fill(); say(`${h} = (${g.projectToPlane(P(n[0]), r.value).map(fmt).join('; ')})`, 'ok'); draw();
};
$('#bf').onclick = async () => {
  const n = sel(); if (new Set(n.slice(0, 3)).size < 3) return say(T('ui.pick'), 'er'); const r = g.projectToLine(P(n[0]), P(n[1]), P(n[2])); if (!r.ok) return geomErr(r);
  snap(); const h = freeName(['H', 'K', 'M']); addPoint(h, r.value); S.segs.push([n[0], h]); await save(); fill(); say(`${h} = (${r.value.map(fmt).join('; ')})`, 'ok'); draw();
};
$('#bx').onclick = async () => {
  const n = sel().slice(0, 3); if (new Set(n).size < 3) return say(T('ui.pick'), 'er'); const r = g.planeFrom3(P(n[0]), P(n[1]), P(n[2])); if (!r.ok) return geomErr(r);
  const pl = polyOf(); if (!pl.faces.length) return say(T('ui.noPoly'), 'er'); const poly = g.sectionPolygon(edgesOf(pl).map(([i, j]) => [pl.verts[i], pl.verts[j]] as [g.V3, g.V3]), r.value);
  if (poly.length < 3) return say(T('ui.sectionNone'), 'er');
  snap(); const names = poly.map((p, i) => { const ex = S.pts.find(q => g.distance(q.p, p) < 1e-7); if (ex) return ex.n; const nm = 'X' + (S.pts.length + i); addPoint(nm, p); return nm; });
  S.pls.push(names); names.forEach((a, i) => S.segs.push([a, names[(i + 1) % names.length]])); await save(); fill(); say(`${T('ui.sectionDone')}: S = ${fmt(g.polygonArea(poly))}`, 'ok'); draw();
};
$('#bb').onclick = async () => {
  const k = $<HTMLSelectElement>('#sd').value; snap();
  if (k === 'cube') { const h = hist; await init(true); hist = h; await save(); return; }
  const poly = { prism3: () => regularPrism(3, 4, 5), prism6: () => regularPrism(6, 3, 5), pyr4: () => regularPyramid(4, 4, 6), pyr3: () => regularPyramid(3, 4, 6) }[k]!();
  S.pts = poly.verts.map((p, i) => ({ n: poly.names[i], p })); S.segs = edgesOf(poly).map(([a, b]) => [poly.names[a], poly.names[b]] as [string, string]); S.pls = []; S.solid = { names: poly.names, faces: poly.faces };
  await save(); fill(); say(T('solid.' + k), 'ok'); draw();
};
$('#bw').onclick = () => { const pl = polyOf(); if (!pl.faces.length) return say(T('ui.noPoly'), 'er'); say(`V = ${fmt(volume(pl))}; S = ${fmt(surfaceArea(pl))}`); };
$('#un').onclick = () => { const h = hist.pop(); if (h) { S = JSON.parse(h); save(); fill(); draw(); } };
$('#rs').onclick = async () => { await init(true); await save(); };
$('#dr').oninput = e => { S.dr = (e.target as HTMLTextAreaElement).value; later(); };
$('#ans').oninput = e => { S.ans = (e.target as HTMLInputElement).value; later(); };
$('#ck').onclick = () => { const r = $('#res'); try { const ok = approxEqual(evaluate(S.ans), sols.find(s => s.taskId === tasks[ti].id)!.finalAnswer.value); r.textContent = T(ok ? 'ui.ok' : 'ui.bad'); r.className = 'out ' + (ok ? 'ok' : 'er'); if (!ok) void tutorSays(Math.max(hl, 1)); } catch { r.textContent = T('ui.parse'); r.className = 'out er'; } };
$('#hb').onclick = async () => { if (hl >= 4) { $('#hint').textContent = T('ui.nohint'); return; } hl++; $('#hl').textContent = `${T('ui.level')}: ${hl}/4`; await tutorSays(hl); };
const cv = $<HTMLCanvasElement>('#cv'); let dg: [number, number] | null = null;
cv.onpointerdown = e => { dg = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); };
cv.onpointermove = e => { if (!dg) return; yaw += (e.clientX - dg[0]) * .01; pit = Math.max(-1.5, Math.min(1.5, pit + (e.clientY - dg[1]) * .01)); dg = [e.clientX, e.clientY]; draw(); };
cv.onpointerup = () => { dg = null; };
cv.onwheel = e => { e.preventDefault(); zoom = Math.max(.4, Math.min(3, zoom * (e.deltaY < 0 ? 1.1 : .9))); draw(); };
addEventListener('resize', draw); addEventListener('online', ui); addEventListener('offline', ui);
(async () => {
  try {
    store = new Store(await openDb());
    const pid = ls('ol:pid'), known = pid ? (await store.listProfiles()).find(p => p.id === pid) : undefined;
    profileId = known?.id ?? (await store.createProfile('guest', true)).id; ls('ol:pid', profileId);
  } catch { store = null; }
  await init(); await refreshProfiles();
  try { const extra = await loadExtraParts(); tasks = [...tasks, ...extra.tasks]; sols = [...sols, ...extra.sols]; fillRules(); ui(); } catch { say(T('ui.partialCatalog'), 'er'); }
  if (!store) $('#sv').textContent = T('save.error');
})();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {}));
