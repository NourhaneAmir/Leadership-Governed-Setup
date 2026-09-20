/* Tests the REAL helper text out of xenv.js -- extracted, not retyped, so
   this cannot pass against a copy that differs from what ships. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* Resolved from this file, not the working directory, so `node
   scripts/test-tobase64.mjs` works from anywhere in the repo. */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'services', 'xenv.js');
const src = fs.readFileSync(SRC, 'utf8');

function grab(name, kind = 'function') {
  const start = src.indexOf(`${kind} ${name}(`);
  if (start === -1) throw new Error(`could not find ${name}`);
  let i = src.indexOf('{', start), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
}

const code = [
  grab('bytesToBase64'),
  grab('toBase64', 'async function'),
  grab('describePayload'),
].join('\n\n');

const { toBase64, describePayload } = await import(
  'data:text/javascript,' + encodeURIComponent(code + '\nexport {toBase64, describePayload};')
);

const HELLO = Buffer.from('hello world');
const WANT = HELLO.toString('base64');           // aGVsbG8gd29ybGQ=
let fail = 0;

async function check(label, input, expected) {
  let got;
  try { got = await toBase64(input); }
  catch (e) { got = 'THREW: ' + e.message; }
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} -> ${JSON.stringify(got).slice(0, 46)}`);
}

console.log('--- shapes that must yield the file ---');
await check('bare base64 string', WANT, WANT);
await check('data: URI', `data:application/vnd.ms-excel;base64,${WANT}`, WANT);
await check('$content envelope', { '$content-type': 'x', $content: WANT }, WANT);
await check('value wrapper', { value: WANT }, WANT);
await check('body wrapper', { body: WANT }, WANT);
await check('fileContent wrapper', { fileContent: WANT }, WANT);
await check('documentBody wrapper', { documentBody: WANT }, WANT);
await check('ArrayBuffer', HELLO.buffer.slice(HELLO.byteOffset, HELLO.byteOffset + HELLO.length), WANT);
await check('Uint8Array', new Uint8Array(HELLO), WANT);
await check('Blob', new Blob([HELLO]), WANT);
await check('nested envelope', { $content: { value: WANT } }, WANT);

console.log('\n--- shapes that must yield nothing (so the caller reports) ---');
await check('null', null, '');
await check('undefined', undefined, '');
await check('empty string', '', '');
await check('unknown object', { foo: 1, bar: 2 }, '');

console.log('\n--- large payload must not overflow the stack ---');
const BIG = new Uint8Array(3 * 1024 * 1024).fill(65);
const big = await toBase64(BIG);
const bigOk = big === Buffer.from(BIG).toString('base64');
if (!bigOk) fail++;
console.log(`${bigOk ? 'PASS' : 'FAIL'}  3 MB Uint8Array                    -> ${big.length} base64 chars`);

console.log('\n--- describePayload names the shape ---');
for (const [l, v] of [['unknown object', { a: 1, b: 2 }], ['ArrayBuffer', new ArrayBuffer(11)],
                      ['string', 'abc'], ['undefined', undefined]]) {
  console.log(`      ${l.padEnd(20)} -> ${describePayload(v)}`);
}

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
