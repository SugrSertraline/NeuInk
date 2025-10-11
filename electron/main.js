const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let apiProxyProcess = null;
let backendProcess = null;

// 启动API代理服务器
function startApiProxyServer() {
  const isDev = process.env.NODE_ENV === 'development';
  
  console.log('启动API代理服务器...');
  
  // 在生产环境中，我们需要使用Node.js运行API代理
  // 在开发环境中，我们假设开发服务器已经运行
  if (!isDev) {
    apiProxyProcess = spawn('node', [path.join(__dirname, 'api-proxy.js')], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    
    apiProxyProcess.stdout.on('data', (data) => {
      console.log(`API代理输出: ${data}`);
    });
    
    apiProxyProcess.stderr.on('data', (data) => {
      console.error(`API代理错误: ${data}`);
    });
    
    apiProxyProcess.on('close', (code) => {
      console.log(`API代理进程退出，代码: ${code}`);
    });
  }
}

// 启动后端服务器
function startBackendServer() {
  const isDev = process.env.NODE_ENV === 'development';
  
  console.log('启动后端服务器...');
  
  // 在生产环境中，我们需要启动后端服务器
  if (!isDev) {
    const backendPath = path.join(__dirname, '..', 'backend', 'dist', 'index.js');
    backendProcess = spawn('node', [backendPath], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production'
      }
    });
    
    backendProcess.stdout.on('data', (data) => {
      console.log(`后端输出: ${data}`);
    });
    
    backendProcess.stderr.on('data', (data) => {
      console.error(`后端错误: ${data}`);
    });
    
    backendProcess.on('close', (code) => {
      console.log(`后端进程退出，代码: ${code}`);
    });
  }
}

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
    // 生产环境加载API代理服务器
    mainWindow.loadURL('http://localhost:3000');
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
      
      /* 扩展可编辑元素的选择范围，包括SimpleMDE编辑器相关元素 */
      input, textarea, [contenteditable="true"], .prose, .prose *,
      .CodeMirror, .CodeMirror *, .editor-toolbar, .editor-toolbar *,
      .EasyMDEContainer, .EasyMDEContainer *, .cm-editor, .cm-editor *,
      .cm-content, .cm-content *, .cm-line, .cm-line *,
      .react-simplemde-editor, .react-simplemde-editor * {
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
        // 扩展可编辑元素的检测范围
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *, ' +
                           '.CodeMirror, .CodeMirror *, .editor-toolbar, .editor-toolbar *, ' +
                           '.EasyMDEContainer, .EasyMDEContainer *, .cm-editor, .cm-editor *, ' +
                           '.cm-content, .cm-content *, .cm-line, .cm-line *, ' +
                           '.react-simplemde-editor, .react-simplemde-editor *')) {
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
        }
      });
      
      document.addEventListener('selectstart', function(e) {
        // 扩展可编辑元素的检测范围
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *, ' +
                           '.CodeMirror, .CodeMirror *, .editor-toolbar, .editor-toolbar *, ' +
                           '.EasyMDEContainer, .EasyMDEContainer *, .cm-editor, .cm-editor *, ' +
                           '.cm-content, .cm-content *, .cm-line, .cm-line *, ' +
                           '.react-simplemde-editor, .react-simplemde-editor *')) {
          e.preventDefault();
        }
      });
      
      document.addEventListener('contextmenu', function(e) {
        // 扩展可编辑元素的检测范围
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *, ' +
                           '.CodeMirror, .CodeMirror *, .editor-toolbar, .editor-toolbar *, ' +
                           '.EasyMDEContainer, .EasyMDEContainer *, .cm-editor, .cm-editor *, ' +
                           '.cm-content, .cm-content *, .cm-line, .cm-line *, ' +
                           '.react-simplemde-editor, .react-simplemde-editor *')) {
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
  // 先启动后端服务
  startBackendServer();
  
  // 等待一段时间让后端服务启动
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // 关闭后端进程
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // 应用退出前关闭后端进程
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});