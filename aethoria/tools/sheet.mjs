// node tools/sheet.mjs out.png "query" [WxH]
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const [out, query = '', dims = '1600x900'] = process.argv.slice(2);
const [W, H] = dims.split('x').map(Number);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto('http://localhost:5200/sheet.html?' + query);
await p.waitForTimeout(1200);
await p.screenshot({ path: out, fullPage: true });
await b.close();
