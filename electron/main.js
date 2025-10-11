const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    frame: false, // 完全隐藏原生标题栏和边框
    transparent: false,
    autoHideMenuBar: true,
    show: false,
    backgroundColor: '#ffffff',
  });

  // 开发环境加载Next.js dev server
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../frontend/out/index.html'));
  }

  // 防止文本选择和其他默认行为
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.insertCSS(`
      * {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
      }
      
      input, textarea, [contenteditable="true"], .prose, .prose * {
        -webkit-user-select: text !important;
        -moz-user-select: text !important;
        -ms-user-select: text !important;
        user-select: text !important;
      }
      
      body {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
      }
      
      /* 自定义标题栏可拖动区域 */
      .electron-drag {
        -webkit-app-region: drag;
      }
      
      .electron-no-drag {
        -webkit-app-region: no-drag;
      }
    `);
    
    mainWindow.webContents.executeJavaScript(`
      window.getSelection()?.removeAllRanges();
      
      document.addEventListener('dblclick', function(e) {
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
        }
      });
      
      document.addEventListener('selectstart', function(e) {
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
          e.preventDefault();
        }
      });
      
      document.addEventListener('contextmenu', function(e) {
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
          window.getSelection()?.removeAllRanges();
        }
      });
    `);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.webContents.executeJavaScript('window.getSelection()?.removeAllRanges();');
  });

  // F12 开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // Ctrl+R 或 Cmd+R 刷新
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key === 'r') {
      mainWindow.webContents.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC 处理器 - 窗口控制
ipcMain.handle('window:minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.handle('window:isMaximized', () => {
  if (mainWindow) {
    return mainWindow.isMaximized();
  }
  return false;
});

// 应用控制
ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});