/** Локальный dev-сервер: `OLSHEM_DEV_TOKENS='{"tok1":"profile-id"}' npx tsx server/index.ts`. Хранение в памяти, не для продакшена. */
import { createServer } from 'node:http';
import { handle, newServerState } from './handler';
const state = newServerState(JSON.parse(process.env.OLSHEM_DEV_TOKENS ?? '{}'));
createServer((rq, rs) => {
  const chunks: Buffer[] = []; let size = 0;
  rq.on('data', c => { size += c.length; if (size > 1_000_000) { rs.writeHead(413).end(); rq.destroy(); } else chunks.push(c); });
  rq.on('end', () => {
    let body: unknown; try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined; } catch { rs.writeHead(400).end(); return; }
    const auth = rq.headers.authorization, r = handle({ method: rq.method ?? 'GET', path: new URL(rq.url ?? '/', 'http://x').pathname, token: auth?.startsWith('Bearer ') ? auth.slice(7) : null, body }, state);
    rs.writeHead(r.status, { 'content-type': 'application/json' }).end(JSON.stringify(r.body));
  });
}).listen(Number(process.env.PORT ?? 8787));
