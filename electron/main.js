// 윈도우용 껍데기. app/index.html 을 창에 띄우고, 자동 업데이트(electron-updater)를 연결한다.
const { app, BrowserWindow, shell, ipcMain, session } = require('electron');
const path = require('path');

let win = null;
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* 개발 실행에서는 없어도 된다 */ }

const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };

function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 380, minHeight: 520, backgroundColor: '#0f1418', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
  // 바깥 링크는 앱 창이 아니라 기본 브라우저로 연다.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (/^https?:/.test(url)) { e.preventDefault(); shell.openExternal(url); } });
}

function allowApiCors() {
  // 화면이 file:// 에서 열리므로, Gemini·GitHub API 응답에 CORS 허용 헤더를 보장해 둔다.
  const urls = ['https://generativelanguage.googleapis.com/*', 'https://api.github.com/*'];
  session.defaultSession.webRequest.onHeadersReceived({ urls }, (details, cb) => {
    const h = details.responseHeaders || {};
    for (const k of Object.keys(h)) if (/^access-control-allow-(origin|headers|methods)$/i.test(k)) delete h[k];
    h['Access-Control-Allow-Origin'] = ['*'];
    h['Access-Control-Allow-Headers'] = ['*'];
    h['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS'];
    cb({ responseHeaders: h });
  });
}

function setupUpdater() {
  if (!autoUpdater || !app.isPackaged) return;
  autoUpdater.autoDownload = true;           // 새 버전이 있으면 뒤에서 내려받는다
  autoUpdater.autoInstallOnAppQuit = true;   // 사용자가 앱을 끄면 그때 설치한다
  autoUpdater.on('update-available', i => send('upd', { state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', p => send('upd', { state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', i => send('upd', { state: 'ready', version: i.version }));
  autoUpdater.on('update-not-available', () => send('upd', { state: 'latest' }));
  autoUpdater.on('error', e => send('upd', { state: 'error', message: String((e && e.message) || e).slice(0, 300) }));
}

ipcMain.handle('upd-check', () => {
  if (!autoUpdater || !app.isPackaged) return false;
  autoUpdater.checkForUpdates().catch(() => {});
  return true;
});
ipcMain.handle('upd-install', () => { if (autoUpdater) autoUpdater.quitAndInstall(); });

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { allowApiCors(); setupUpdater(); createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
