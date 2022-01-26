const {
    contextBridge,
    ipcRenderer
} = require("electron");

const config = require("./helpers/config");

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    "nodeStuff", {
        getFolder: function (title, message) {
            const robj = ipcRenderer.sendSync('select-dir', {
                title,
                message
            });
            return robj;
        },
        setSettingsDir: function (dir) {
            console.log("setSettingsDir");
            config.setSettingsDir(dir);
            console.log("DONE settingsdir...");

            // NOW setup default settings files AND close application!
        }
    }
);