import { sheet, dismiss } from './sheet.js';
import { esc } from './util.js';
import { T } from './copy.js';
import { showTutorial } from './tutorial.js';

export const isSample = (o) => String(o.uid ?? '').startsWith('demo-');

export async function loadSampleCount(api, S) {
  S.sampleCount = (await api('/sample')).count;
  return S.sampleCount;
}

export function extraSettingsHtml(S) {
  const n = S.sampleCount ?? 0;
  return `<div class="box"><div class="setrow"><div><h3>${esc(T.sampleTitle)}</h3><p>${esc(T.sampleNote)}</p></div>
    <span class="pill${n ? ' warn' : ''}">${n} orders</span></div>
    <div class="row mt-3">
      <button class="btn" data-sample-load ${n ? 'disabled' : ''}>${esc(T.sampleLoad)}</button>
      <button class="btn" data-sample-clear ${n ? '' : 'disabled'}>${esc(T.sampleClear)}</button>
      <button class="btn" data-tutorial-replay>${esc(T.replayTutorial)}</button></div></div>`;
}

const confirmSheet = (title, body, yes) => new Promise((res) => {
  let ok = false;
  const s = sheet(`<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="row mt-4">
    <button class="btn" data-close>${esc(T.cancel ?? 'Cancel')}</button><button class="btn primary" data-yes>${esc(yes)}</button></div>`, () => res(ok));
  s.querySelector('[data-yes]').addEventListener('click', () => { ok = true; dismiss(s, () => res(true)); });
});

export async function extraSettingsClick(t, ctx) {
  const { api, S, load, renderSettings, renderQueue, renderBar, toast } = ctx;
  const refresh = async () => { await load(); await loadSampleCount(api, S); renderSettings(); renderQueue(); renderBar(); };
  if (t.closest('[data-tutorial-replay]')) { showTutorial(); return true; }
  if (t.closest('[data-sample-load]')) {
    if (!(await confirmSheet(T.sampleTitle, T.sampleConfirmLoad, T.sampleLoad))) return true;
    const btn = t.closest('[data-sample-load]');
    document.querySelectorAll('[data-sample-load], [data-sample-clear]').forEach((b) => { b.disabled = true; });
    btn.textContent = T.sampleLoading ?? 'Loading…';
    try { const r = await api('/sample', { method: 'POST' }); await refresh(); toast(T.sampleAdded(r.count)); } catch (e) { await refresh(); toast(e.message, true); }
    return true;
  }
  if (t.closest('[data-sample-clear]')) {
    if (!(await confirmSheet(T.sampleTitle, T.sampleConfirmClear, T.sampleClear))) return true;
    try { const r = await api('/sample', { method: 'DELETE' }); await refresh(); toast(T.sampleRemoved(r.removed)); } catch (e) { toast(e.message, true); }
    return true;
  }
  return false;
}
