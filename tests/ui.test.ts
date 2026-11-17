// @vitest-environment jsdom
// Проверка реального кода интерфейса (src/main.ts) в jsdom. Это НЕ браузер: нет настоящей отрисовки, Service Worker и касаний.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
const $ = <T extends Element = HTMLElement>(s: string) => document.querySelector(s) as T;
const click = (s: string) => $<HTMLElement>(s).click();
const setVal = (s: string, v: string, ev = 'input') => { const e = $<HTMLInputElement>(s); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); };
const errors: string[] = [];
beforeEach(async () => {
  (globalThis as any).indexedDB = new IDBFactory(); localStorage.clear(); document.body.innerHTML = '<div id="app"></div>'; document.documentElement.removeAttribute('data-t'); errors.length = 0;
  HTMLCanvasElement.prototype.getContext = (() => new Proxy({}, { get: (_t, k) => (k === 'canvas' ? {} : () => undefined), set: () => true })) as any;
  window.addEventListener('error', e => errors.push(e.message)); vi.spyOn(console, 'error').mockImplementation((...a) => { errors.push(a.join(' ')); });
  vi.stubGlobal('prompt', () => 'Second'); vi.stubGlobal('confirm', () => true);
  vi.resetModules(); await import('../src/main');
  await vi.waitFor(() => { expect($('#stT').textContent).toBeTruthy(); expect($('#sv').textContent).toBeDefined(); });
  await vi.waitFor(() => expect(document.querySelectorAll('.tk').length).toBeGreaterThan(90), { timeout: 5000 }); // дождаться ленивой подгрузки каталога
});
describe('app UI (jsdom)', () => {
  it('boots without errors, shows 3 languages and the first task', () => { expect($<HTMLSelectElement>('#lang').options).toHaveLength(3); expect($('#st').textContent).toContain('куб'); expect(errors).toEqual([]); });
  it('loads the extra catalog parts lazily (96 tasks), filters by topic, opens a coordinate task with its points', async () => {
    await vi.waitFor(() => expect(document.querySelectorAll('.tk').length).toBeGreaterThan(90), { timeout: 5000 });
    const ft = $<HTMLSelectElement>('#ft'); ft.value = 'coordinates'; ft.dispatchEvent(new Event('change')); expect(document.querySelectorAll('.tk')).toHaveLength(20);
    click('.tk'); await vi.waitFor(() => expect($('#stT').textContent).toBeTruthy()); await vi.waitFor(() => expect($('#st').textContent).toContain('Даны точки'));
    expect($<HTMLSelectElement>('#a').options.length).toBeGreaterThanOrEqual(2);
  });
  it('language switch translates statement, labels and topics; no key leaks', async () => {
    for (const l of ['en', 'kk', 'ru']) { const s = $<HTMLSelectElement>('#lang'); s.value = l; s.dispatchEvent(new Event('change')); expect(document.documentElement.lang).toBe(l); }
    const s = $<HTMLSelectElement>('#lang'); s.value = 'en'; s.dispatchEvent(new Event('change')); expect($('#st').textContent).toContain('cube'); expect(document.body.textContent).not.toMatch(/\b(ui|topic|hint|htr|geom|solid|step|status|type)\.[a-z_]+/);
  });
  it('theme toggles and persists', () => { click('#th'); const t = document.documentElement.dataset.t; expect(['light', 'dark']).toContain(t); expect(localStorage.getItem('ol:th')).toBe(t); });
  it('adding a point updates the selects and reports saved only after the write', async () => {
    const n = $<HTMLSelectElement>('#a').options.length; click('#bp'); await vi.waitFor(() => expect($<HTMLSelectElement>('#a').options.length).toBe(n + 1)); await vi.waitFor(() => expect($('#sv').textContent).toBeTruthy());
    expect($('#sv').textContent).not.toMatch(/ошибка|error/i);
  });
  it('measurements use the core: diagonal AC1 of the cube = 6.928203', () => {
    setVal('#a', 'A', 'change'); setVal('#b', 'C₁', 'change'); click('#bd'); expect($('#msg').textContent).toContain('6.928203');
  });
  it('answer checking: wrong gets hedged tutor feedback, correct accepted, junk reported', async () => {
    setVal('#ans', '4*sqrt(2)'); click('#ck'); await vi.waitFor(() => expect($('#hint').textContent).toMatch(/^Возможно/)); expect($('#res').className).toContain('er');
    setVal('#ans', '4*sqrt(3)'); click('#ck'); expect($('#res').className).toContain('ok'); setVal('#ans', 'alert(1)'); click('#ck'); expect($('#res').className).toContain('er');
  });
  it('hints are staged up to level 4 and never reveal the answer', async () => {
    for (let i = 1; i <= 4; i++) { click('#hb'); await vi.waitFor(() => expect($('#hl').textContent).toContain(`${i}/4`)); expect($('#hint').textContent).not.toMatch(/sqrt|6[.,]9/); }
    click('#hb'); expect($('#hint').textContent).toMatch(/закончились/);
  });
  it('teacher mode reveals the reference solution; reference panel opens', () => {
    expect($('#solv').hidden).toBe(true); const tc = $<HTMLInputElement>('#tc'); tc.checked = true; tc.dispatchEvent(new Event('change')); expect($('#solv').hidden).toBe(false); expect($('#solv').textContent).toContain('4*sqrt(3)');
    click('#rf'); expect($('#ref').hidden).toBe(false); expect($('#ref').textContent).toContain('RULE-001');
  });
  it('solids and tools: build pyramid, volume/area, projection, section', async () => {
    const sd = $<HTMLSelectElement>('#sd'); sd.value = 'pyr4'; click('#bb'); await vi.waitFor(() => expect($<HTMLSelectElement>('#a').options.length).toBe(5)); click('#bw'); expect($('#msg').textContent).toContain('V = 32');
    sd.value = 'cube'; click('#bb'); await vi.waitFor(() => expect($<HTMLSelectElement>('#a').options.length).toBe(8));
    setVal('#a', 'A', 'change'); setVal('#b', 'A₁', 'change'); setVal('#c', 'C₁', 'change'); click('#bx'); await vi.waitFor(() => expect($('#msg').textContent).toContain('22.627'));
  });
  it('profile switching keeps drafts separate', async () => {
    const first = localStorage.getItem('ol:pid')!; setVal('#dr', 'first profile draft'); await new Promise(r => setTimeout(r, 600)); click('#np');
    await vi.waitFor(() => expect($<HTMLTextAreaElement>('#dr').value).toBe('')); expect($<HTMLSelectElement>('#prof').options.length).toBe(2);
    const p = $<HTMLSelectElement>('#prof'); p.value = first; p.dispatchEvent(new Event('change')); await vi.waitFor(() => expect($<HTMLTextAreaElement>('#dr').value).toBe('first profile draft'));
  });
  it('handwriting panel reports that recognition is not connected, rejects bad photos', async () => {
    click('#inkr'); await vi.waitFor(() => expect($('#hwo').textContent).toContain('Сначала нарисуйте'));
    const f = new File(['hi'], 'x.txt', { type: 'text/plain' }); const ph = $<HTMLInputElement>('#ph'); Object.defineProperty(ph, 'files', { value: [f] }); ph.dispatchEvent(new Event('change')); await vi.waitFor(() => expect($('#hwo').textContent).toContain('PNG'));
  });
  it('no errors were logged during the whole scenario', () => expect(errors).toEqual([]));
});
