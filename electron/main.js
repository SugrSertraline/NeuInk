const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    titleBarStyle: 'hidden', // 隐藏原生标题栏
    titleBarOverlay: false, // 不使用标题栏覆盖
    autoHideMenuBar: true,  // 隐藏菜单栏
    frame: true, // 保留窗口边框
    transparent: false, // 不透明
    // 防止窗口标题栏文本被选中
    show: false,
  });

  // 开发环境加载Next.js dev server
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // 移除自动打开开发者工具
    // mainWindow.webContents.openDevTools();
  } else {
    // 生产环境加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../../frontend/out/index.html'));
  }

  // 防止文本选择和其他默认行为
  mainWindow.webContents.on('did-finish-load', () => {
    // 注入样式来防止文本选择
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
      
      /* 防止拖拽选择 */
      body {
        -webkit-user-drag: none;
        -khtml-user-drag: none;
        -moz-user-drag: none;
        -o-user-drag: none;
        user-drag: none;
      }
    `);
    
    // 注入脚本来清除选择
    mainWindow.webContents.executeJavaScript(`
      // 清除任何现有选择
      window.getSelection()?.removeAllRanges();
      
      // 防止双击选择文本
      document.addEventListener('dblclick', function(e) {
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
        }
      });
      
      // 防止拖拽选择
      document.addEventListener('selectstart', function(e) {
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
          e.preventDefault();
        }
      });
      
      // 防右键菜单选择
      document.addEventListener('contextmenu', function(e) {
        if (!e.target.matches('input, textarea, [contenteditable="true"], .prose, .prose *')) {
          window.getSelection()?.removeAllRanges();
        }
      });
    `);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // 清除窗口加载后的任何文本选择
    mainWindow.webContents.executeJavaScript('window.getSelection()?.removeAllRanges();');
  });

  // 监听 F12 按键，手动打开/关闭开发者工具
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // 监听 Ctrl+R 或 Cmd+R 刷新页面
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key === 'r') {
      mainWindow.webContents.reload();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

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