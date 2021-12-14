const {
    app,
    BrowserWindow
} = require('electron')

const server = require('./app');

let mainWindow;

function createWindow() {

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true
        }
    })

    mainWindow.loadURL('http://localhost:5000')
    mainWindow.on('closed', function () {
        //        console.log("CLOSE mainwindow received...", server);
        mainWindow = null
    })

    // Open the DevTools.
    mainWindow.webContents.openDevTools()

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