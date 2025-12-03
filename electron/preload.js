const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
    // Only the Electron window can call this
    getServerToken: () => ipcRenderer.invoke("get-server-token"),
    isDev: () => ipcRenderer.invoke("is-dev"),
});
