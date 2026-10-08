// Runs inside the Android WebView before the UI: opens the on-device database and
// answers the UI's /api calls in-process, so no server is involved.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { capacitorAdapter } from '../adapters/capacitor.js';
import { migrate } from '../core/core.js';
import { seed } from '../core/seed.js';
import { handleApi } from '../core/routes.js';

const ready = (async () => {
  const db = await capacitorAdapter();
  await migrate(db);
  await seed(db);
  return db;
})();

window.__transport = async (method, url, body) => {
  const db = await ready;
  const r = await handleApi(db, method, url.pathname, url.searchParams, body ?? {});
  return { status: r.status, body: r.body };
};

window.__native = {
  async saveFile(name, text) {
    const f = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: f.uri, dialogTitle: 'Save or send the file' });
  },
};
window.__native.platform = Capacitor.getPlatform();
ready.catch((e) => { document.body.insertAdjacentHTML('beforeend', `<pre style="padding:24px;color:#b3261e;white-space:pre-wrap">Database failed to open: ${e?.message ?? e}</pre>`); });
