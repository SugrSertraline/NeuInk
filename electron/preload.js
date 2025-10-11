const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的API到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 基础信息
  platform: process.platform,
  version: process.versions.electron,
  
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    setTitle: (title) => ipcRenderer.invoke('window:setTitle', title),
  },
  
  // 应用控制
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  
  // 文件系统操作
  fs: {
    readFile: (path) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path, data) => ipcRenderer.invoke('fs:writeFile', path, data),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
    mkdir: (path) => ipcRenderer.invoke('fs:mkdir', path),
    unlink: (path) => ipcRenderer.invoke('fs:unlink', path),
    readdir: (path) => ipcRenderer.invoke('fs:readdir', path),
    stat: (path) => ipcRenderer.invoke('fs:stat', path),
  },
  
  // 对话框
  dialog: {
    showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpenDialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSaveDialog', options),
    showMessageDialog: (options) => ipcRenderer.invoke('dialog:showMessageDialog', options),
    showErrorDialog: (options) => ipcRenderer.invoke('dialog:showErrorDialog', options),
  },
  
  // 通知
  notification: {
    show: (options) => ipcRenderer.invoke('notification:show', options),
    requestPermission: () => ipcRenderer.invoke('notification:requestPermission'),
  },
  
  // 系统信息
  system: {
    getOSInfo: () => ipcRenderer.invoke('system:getOSInfo'),
    getMemoryInfo: () => ipcRenderer.invoke('system:getMemoryInfo'),
    getCPUInfo: () => ipcRenderer.invoke('system:getCPUInfo'),
  },
  
  // 剪贴板
  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
    readHTML: () => ipcRenderer.invoke('clipboard:readHTML'),
    writeHTML: (html) => ipcRenderer.invoke('clipboard:writeHTML', html),
  },
  
  // 开发者工具（仅开发环境）
  dev: {
    openDevTools: () => ipcRenderer.invoke('dev:openDevTools'),
    closeDevTools: () => ipcRenderer.invoke('dev:closeDevTools'),
    reload: () => ipcRenderer.invoke('dev:reload'),
    toggleDevTools: () => ipcRenderer.invoke('dev:toggleDevTools'),
  },
  
  // 数据库操作（可选，如果需要在 Electron 中直接操作数据库）
  database: {
    query: (sql, params) => ipcRenderer.invoke('database:query', sql, params),
    backup: (path) => ipcRenderer.invoke('database:backup', path),
    restore: (path) => ipcRenderer.invoke('database:restore', path),
  },
  
  // 事件监听
  on: (channel, callback) => {
    const validChannels = [
      'app-update-available',
      'app-update-downloaded',
      'window-focus',
      'window-blur',
      'window-maximize',
      'window-unmaximize',
      'menu-click'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, callback);
    }
  },
  
  // 移除事件监听
  removeListener: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  }
});

// 开发环境下的额外功能
if (process.env.NODE_ENV === 'development') {
  contextBridge.exposeInMainWorld('devTools', {
    log: (...args) => console.log('[Renderer]', ...args),
    error: (...args) => console.error('[Renderer]', ...args),
    warn: (...args) => console.warn('[Renderer]', ...args),
    inspect: (element) => {
      if (element) {
        console.log('Inspecting element:', element);
      }
    }
  });
}