// node tools/shot2.mjs out.png "query" "async js run in page" [waitMs] [WxH]  — js may call window.aethoria
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const [out, query = '', js = '', wait = '1500', dims = '1600x900'] = process.argv.slice(2);
const [W, H] = dims.split('x').map(Number);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto('http://localhost:5200/?' + query);
await p.waitForTimeout(1200);
if (js) console.log(JSON.stringify(await p.evaluate(js)));
await p.waitForTimeout(+wait);
await p.screenshot({ path: out });
await b.close();
