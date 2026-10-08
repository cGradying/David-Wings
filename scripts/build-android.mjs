// Assembles www/ for Capacitor: the same UI as public/, plus the in-app database boot script.
import { build } from 'esbuild';
import { cpSync, rmSync, readFileSync, writeFileSync } from 'node:fs';

rmSync('www', { recursive: true, force: true });
cpSync('public', 'www', { recursive: true });
rmSync('www/sw.js'); // the app is already on the device; no service worker needed
await build({ entryPoints: ['android-app/local-boot.js'], bundle: true, format: 'esm', target: 'es2020', minify: true, outfile: 'www/local-boot.js' });
const html = readFileSync('www/index.html', 'utf8').replace('<script src="/app.js" type="module"></script>',
  '<script src="/local-boot.js" type="module"></script>\n<script src="/app.js" type="module"></script>');
writeFileSync('www/index.html', html);
console.log('www/ ready');
