// 윈도우용 껍데기. app/index.html 을 창에 띄우고, 자동 업데이트(electron-updater)를 연결한다.
const { app, BrowserWindow, shell, ipcMain, session, nativeTheme } = require('electron');
const path = require('path');

let win = null;
let autoUpdater = null;
try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { /* 개발 실행에서는 없어도 된다 */ }

const send = (ch, payload) => { if (win && !win.isDestroyed()) win.webContents.send(ch, payload); };

// 일체형 창: 운영체제의 제목 표시줄을 숨기고, 앱의 상단 바가 그 자리를 겸한다.
// 최소화·최대화·닫기 버튼은 윈도우가 그리는 진짜 버튼을 상단 바 오른쪽 끝에 투명하게 겹쳐 놓는다(창 맞춤 기능 유지).
// TOP_H 는 app/style.css 의 --top-h(데스크톱 값)와 같아야 한다.
const TOP_H = 46;
const overlay = dark => ({ color: '#00000000', symbolColor: dark ? '#e4eaee' : '#17212b', height: TOP_H });
const bgOf = dark => (dark ? '#0f1418' : '#f3f5f6');

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1400, height: 900, minWidth: 560, minHeight: 520, backgroundColor: bgOf(dark), show: false,
    titleBarStyle: 'hidden', titleBarOverlay: overlay(dark),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false },
  });
  // 화면이 그려진 뒤에 창을 보여 준다(흰 화면이 번쩍이는 것을 막음). 혹시 신호가 안 와도 2초 뒤에는 무조건 보여 준다.
  win.once('ready-to-show', () => win.show());
  setTimeout(() => { if (win && !win.isDestroyed() && !win.isVisible()) win.show(); }, 2000);
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

// 화면 테마(밝게/어둡게)가 바뀌면 창 버튼 색과 창 바탕색을 맞춘다.
ipcMain.on('win-theme', (_e, dark) => {
  if (!win || win.isDestroyed()) return;
  try { win.setTitleBarOverlay(overlay(!!dark)); win.setBackgroundColor(bgOf(!!dark)); } catch (e) { /* 지원하지 않는 환경에서는 무시 */ }
});

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
