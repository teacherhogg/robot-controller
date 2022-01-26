const {
    app,
    BrowserWindow,
    dialog,
    ipcMain
} = require('electron');

const path = require('path');
const server = require('./app');

let mainWindow;

function createWindow() {

    //                preload: path.join(app.getAppPath(), 'preload.js')
    //             preload: path.resolve(__dirname, 'preload.js')

    const path1 = path.resolve(__dirname, 'preload.js');
    //    const path2 = path.join(app.getAppPath(), 'preload.js');
    console.log("path1:" + path1);
    //    console.log("path2:" + path2);

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            preload: path1
        }
    })

    // Open the DevTools.
    mainWindow.webContents.openDevTools()

    mainWindow.loadURL('http://localhost:5000')
    mainWindow.on('closed', function () {
        //        console.log("CLOSE mainwindow received...", server);
        mainWindow = null
    })


    //    console.log("HERE is server", server);
}

app.on('ready', createWindow)

app.on('resize', function (e, x, y) {
    mainWindow.setSize(x, y);
});

app.on('window-all-closed', function () {
    console.log("ALL WINDOW CLOSED...")
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow()
    }
})

ipcMain.on('select-dir', (event, arg) => {

    var dret = dialog.showOpenDialogSync({
        properties: ['openDirectory'],
        title: arg.title,
        message: arg.message
    })
    if (!dret || dret.length < 1) {
        event.returnValue = '';
    } else {
        event.returnValue = dret[0];
    }
})