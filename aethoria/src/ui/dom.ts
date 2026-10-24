/** Tiny DOM helper and the stylesheet. One look: dark glass panels with chunky pixel borders. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, unknown> = {}, ...kids: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else el.setAttribute(k, String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

export const CSS = `
:root { --bg: rgba(14,17,28,.88); --bg2: rgba(28,33,50,.92); --line: #3a4468; --line2: #5a6898; --text: #e8ecf8; --dim: #98a2c4; --gold: #ffd36a; --good: #5ad25a; --bad: #e0504a; }
* { box-sizing: border-box; }
#ui { position: fixed; inset: 0; pointer-events: none; font: 12px/1.35 ui-monospace, Menlo, Consolas, 'DejaVu Sans Mono', monospace; color: var(--text); user-select: none; }
#ui > * { pointer-events: auto; }
.panel { background: var(--bg); border: 2px solid var(--line); border-radius: 6px; box-shadow: 0 0 0 2px #0a0d16, 0 6px 18px #0008; backdrop-filter: blur(3px); }
.row { display: flex; gap: 6px; align-items: center; }
.btn { background: var(--bg2); border: 2px solid var(--line); border-radius: 5px; color: var(--text); padding: 4px 9px; cursor: pointer; font: inherit; }
.btn:hover { border-color: var(--line2); background: #323a58; }
.btn.on { border-color: var(--gold); color: var(--gold); background: #3a3420; }
.btn.small { padding: 2px 6px; }
.btn.danger:hover { border-color: var(--bad); }
#top { position: fixed; top: 8px; left: 8px; right: 8px; display: flex; justify-content: space-between; align-items: flex-start; pointer-events: none; }
#top > * { pointer-events: auto; }
.stats { display: flex; gap: 10px; padding: 6px 10px; align-items: center; }
.stat b { color: var(--gold); }
.speed { display: flex; gap: 3px; padding: 4px; }
.speed .btn { min-width: 34px; text-align: center; }
#bottom { position: fixed; left: 50%; bottom: 8px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; max-width: calc(100vw - 16px); }
.tabs { display: flex; gap: 4px; padding: 4px; }
.tab { padding: 5px 12px; border: 2px solid transparent; border-radius: 5px; cursor: pointer; color: var(--dim); font-weight: bold; }
.tab:hover { color: var(--text); }
.tab.on { border-color: var(--gold); color: var(--gold); background: #2a2a1c; }
.tools { display: flex; gap: 4px; padding: 6px; overflow-x: auto; max-width: calc(100vw - 24px); }
.tool { width: 46px; height: 46px; flex: none; border: 2px solid var(--line); border-radius: 6px; background: var(--bg2); cursor: pointer; display: flex; align-items: center; justify-content: center; position: relative; }
.tool canvas { width: 28px; height: 28px; image-rendering: pixelated; }
.tool:hover { border-color: var(--line2); }
.tool.on { border-color: var(--gold); background: #3a3420; box-shadow: 0 0 8px #ffd36a55; }
.tool .k { position: absolute; bottom: 0; right: 2px; font-size: 9px; color: var(--dim); }
.hint { padding: 4px 10px; color: var(--dim); min-height: 22px; }
.hint b { color: var(--gold); }
.brush { display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
.brush input { width: 110px; accent-color: #ffd36a; }
#inspector { position: fixed; top: 64px; right: 8px; width: 270px; max-height: calc(100vh - 230px); overflow: auto; padding: 10px; display: none; }
#inspector h3 { margin: 0 0 6px; font-size: 14px; color: var(--gold); display: flex; align-items: center; gap: 6px; }
#inspector .sub { color: var(--dim); margin-bottom: 8px; }
.kv { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; border-bottom: 1px dashed #2a3050; }
.kv span:first-child { color: var(--dim); }
.bar { height: 7px; background: #0a0d16; border: 1px solid #2a3050; border-radius: 3px; overflow: hidden; margin: 3px 0 6px; }
.bar i { display: block; height: 100%; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0; }
.chip { padding: 1px 6px; border: 1px solid var(--line); border-radius: 10px; background: #1a2038; cursor: default; }
.chip.link { cursor: pointer; } .chip.link:hover { border-color: var(--gold); }
.dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; border: 1px solid #0008; vertical-align: -1px; margin-right: 4px; }
#feed { position: fixed; left: 8px; top: 64px; width: 330px; display: flex; flex-direction: column; gap: 3px; pointer-events: none; }
#feed .msg { padding: 4px 8px; border-left: 3px solid var(--line2); background: rgba(14,17,28,.78); border-radius: 0 5px 5px 0; animation: fade 14s forwards; }
#feed .war { border-color: #e0504a; } #feed .peace { border-color: #5ad25a; } #feed .city { border-color: #5ab0ff; } #feed .death { border-color: #888; } #feed .disaster { border-color: #ff9a2a; }
@keyframes fade { 0%,85% { opacity: 1 } 100% { opacity: 0 } }
#minimap { position: fixed; right: 8px; bottom: 8px; padding: 4px; }
#minimap canvas { display: block; width: 168px; height: 168px; image-rendering: pixelated; cursor: pointer; }
.modal { position: fixed; inset: 0; background: rgba(4,6,12,.72); display: flex; align-items: center; justify-content: center; z-index: 10; }
.card { padding: 18px 22px; width: min(640px, 94vw); max-height: 92vh; overflow: auto; }
.card h2 { margin: 0 0 10px; color: var(--gold); letter-spacing: 2px; }
.field { display: flex; align-items: center; gap: 10px; margin: 7px 0; }
.field label { width: 110px; color: var(--dim); }
.field input[type=range] { flex: 1; accent-color: #ffd36a; }
.field input[type=text], .field select { background: #0a0d16; color: var(--text); border: 2px solid var(--line); border-radius: 4px; padding: 3px 6px; font: inherit; }
.presets { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0; }
.races { display: flex; gap: 6px; }
.race { width: 56px; height: 56px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px solid var(--line); border-radius: 6px; cursor: pointer; background: var(--bg2); font-size: 10px; }
.race canvas { width: 30px; height: 30px; image-rendering: pixelated; }
.race.on { border-color: var(--gold); background: #3a3420; }
#title { position: fixed; inset: 0; z-index: 9; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: radial-gradient(ellipse at center, rgba(4,8,20,.35), rgba(4,8,20,.8)); }
#title h1 { font-size: 64px; letter-spacing: 12px; margin: 0; color: var(--gold); text-shadow: 0 4px 0 #6a3a10, 0 0 24px #ffb02a88; font-family: ui-monospace, Menlo, Consolas, monospace; }
#title p { color: #cfd6f0; margin: 0 0 14px; letter-spacing: 3px; }
#title .btn { width: 240px; padding: 9px; font-size: 14px; text-align: center; }
.tip { position: fixed; padding: 4px 8px; background: #0a0d16; border: 1px solid var(--line2); border-radius: 4px; pointer-events: none; z-index: 20; }
`;
