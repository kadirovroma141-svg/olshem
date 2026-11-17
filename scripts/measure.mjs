// Размер начальной загрузки: gzip-размер JS/CSS/HTML после `vite build`. Не заменяет замеры на устройстве.
import { readdirSync, readFileSync } from 'node:fs'; import { gzipSync } from 'node:zlib'; import { join } from 'node:path';
const gz = f => gzipSync(readFileSync(f)).length, rows = [];
for (const d of ['dist', 'dist/assets']) for (const f of readdirSync(d)) if (/\.(js|css|html)$/.test(f)) rows.push([join(d, f), readFileSync(join(d, f)).length, gz(join(d, f))]);
const html = readFileSync('dist/index.html', 'utf8'), initial = rows.filter(([n]) => n.endsWith('index.html') || [...html.matchAll(/assets\/([^"']+)/g)].some(m => n.endsWith(m[1])));
const kb = n => (n / 1024).toFixed(2);
console.log('file\traw KB\tgzip KB'); for (const [n, r, z] of rows) console.log(`${n}\t${kb(r)}\t${kb(z)}`);
console.log(`INITIAL (html+css+js referenced from index.html) gzip KB: ${kb(initial.reduce((s, [, , z]) => s + z, 0))}; all chunks gzip KB: ${kb(rows.reduce((s, [, , z]) => s + z, 0))}`);
