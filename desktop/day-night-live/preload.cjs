const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("DAY_NIGHT_DESKTOP", Object.freeze({
  platform: "windows",
  liveShell: true,
  version: "1.1.0",
  product: "DAY NIGHT",
}));
