// 화면(app.js)과 메인 프로세스 사이의 유일한 통로. 업데이트 관련 기능만 노출한다.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  check: () => ipcRenderer.invoke('upd-check'),
  install: () => ipcRenderer.invoke('upd-install'),
  onUpdate: cb => ipcRenderer.on('upd', (_e, payload) => cb(payload)),
});
