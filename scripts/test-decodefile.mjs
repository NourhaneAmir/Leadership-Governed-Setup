/* Tests decodeFile() from src/shared/FilePreview.jsx.

   Extracts the real source text rather than restating it, so it cannot pass
   against a copy that has drifted. Everything above decodeFile() in that
   file is pure helpers with no React in it, so the whole prefix is loaded.

   Run: node scripts/test-decodefile.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'src', 'shared', 'FilePreview.jsx');
const src = fs.readFileSync(SRC, 'utf8');

/* From after the imports to the end of decodeFile(). */
const from = src.indexOf('const MIME');
const marker = src.indexOf('function decodeFile');
if (from === -1 || marker === -1) throw new Error('could not locate the helper block');
let i = src.indexOf('{', marker), depth = 0, end = -1;
for (; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}' && --depth === 0) { end = i + 1; break; }
}
const code = src.slice(from, end) + '\nexport { decodeFile, matchesAny, EXPECTED };';

const { decodeFile } = await import(
  'data:text/javascript,' + encodeURIComponent(code));

/* A minimal but REAL zip: the four signature bytes plus filler. */
const XLSX_BYTES = Uint8Array.from([0x50, 0x4B, 0x03, 0x04, ...Array(60).fill(7)]);
const PDF_BYTES  = Uint8Array.from([0x25, 0x50, 0x44, 0x46, ...Array(60).fill(7)]);
const b64 = u8 => Buffer.from(u8).toString('base64');
const same = (a, b) => a.length === b.length && a.every((v, k) => v === b[k]);

let fail = 0;
function check(label, got, want) {
  const ok = same(got, want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(46)} ${got.length} bytes, ` +
              `starts ${[...got.slice(0, 4)].map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
}

console.log('--- single-encoded content is left alone ---');
check('xlsx, correctly encoded', decodeFile(b64(XLSX_BYTES), 'a.xlsx'), XLSX_BYTES);
check('pdf, correctly encoded', decodeFile(b64(PDF_BYTES), 'a.pdf'), PDF_BYTES);

console.log('\n--- double-encoded content is peeled (the live bug) ---');
const doubled = Buffer.from(b64(XLSX_BYTES), 'utf8');       // base64 TEXT as bytes
check('xlsx, double-encoded', decodeFile(b64(doubled), 'a.xlsx'), XLSX_BYTES);
const doubledPdf = Buffer.from(b64(PDF_BYTES), 'utf8');
check('pdf, double-encoded', decodeFile(b64(doubledPdf), 'a.pdf'), PDF_BYTES);

console.log('\n--- things that must NOT be peeled ---');
/* A .txt has no signature, so it is never second-guessed -- even though its
   content here is valid base64 and would "successfully" decode. */
const txt = Buffer.from(b64(XLSX_BYTES), 'utf8');
check('txt whose content happens to be base64', decodeFile(b64(txt), 'notes.txt'), txt);
/* A csv of base64-looking words must survive intact. */
const csv = Buffer.from('aGVsbG8,d29ybGQ\nQUJD,REVG\n', 'utf8');
check('csv of base64-looking words', decodeFile(b64(csv), 'x.csv'), csv);
/* Genuinely broken xlsx: not a zip, not base64 either -> passed through so
   the caller can report it rather than this silently inventing content. */
const junk = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
check('xlsx that is simply corrupt', decodeFile(b64(junk), 'a.xlsx'), junk);
/* Base64 text that decodes to something that is still not a zip. */
const notZip = Buffer.from(b64(Uint8Array.from([9, 9, 9, 9, 9, 9, 9, 9])), 'utf8');
check('xlsx, base64 of non-zip', decodeFile(b64(notZip), 'a.xlsx'), notZip);

console.log(fail === 0 ? '\nALL PASSED' : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
