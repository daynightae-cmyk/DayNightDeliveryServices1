const { app, BrowserWindow, Menu, dialog, net, session, shell } = require("electron");
const { createHash } = require("node:crypto");
const path = require("node:path");

const PRODUCT_APP_ID = "com.daynight.delivery.admin";
const PRODUCTION_ORIGIN = "https://daynightae.com";
const START_URL = `${PRODUCTION_ORIGIN}/`;
const UPDATE_INTERVAL_MS = 120000;
const ALLOWED_HOSTS = new Set(["daynightae.com", "www.daynightae.com"]);

let mainWindow = null;
let liveSignature = null;
let updateTimer = null;
let retryTimer = null;

app.setName("DAY NIGHT");
app.setAppUserModelId(PRODUCT_APP_ID);

function isAllowedUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function isExternalProtocol(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return ["mailto:", "tel:", "sms:", "whatsapp:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

async function fetchProductionSignature() {
  const response = await net.fetch(`${START_URL}?__dn_shell_check=${Date.now()}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      "X-DAY-NIGHT-SHELL": "windows-live",
    },
  });

  if (!response.ok) throw new Error(`Production health check failed: ${response.status}`);
  const html = await response.text();
  return createHash("sha256").update(html).digest("hex");
}

async function loadProduction({ force = false } = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const url = new URL(START_URL);
  if (force) url.searchParams.set("__dn_live", Date.now().toString());

  try {
    await mainWindow.loadURL(url.toString(), {
      extraHeaders: [
        "Cache-Control: no-cache, no-store, must-revalidate",
        "Pragma: no-cache",
      ].join("\r\n"),
    });
    liveSignature = await fetchProductionSignature().catch(() => liveSignature);
  } catch (error) {
    await loadOffline(error);
  }
}

async function loadOffline(error) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  await mainWindow.loadFile(path.join(__dirname, "offline.html"), {
    query: { message: String(error?.message || "offline") },
  });

  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => void loadProduction({ force: true }), 15000);
}

async function checkForLiveDeployment() {
  if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.isVisible()) return;

  try {
    const nextSignature = await fetchProductionSignature();
    if (!liveSignature) {
      liveSignature = nextSignature;
      return;
    }

    if (nextSignature !== liveSignature) {
      liveSignature = nextSignature;
      await mainWindow.webContents.session.clearCache();
      await loadProduction({ force: true });
    }
  } catch {
    // Keep the current working view. A later check retries automatically.
  }
}

function configureSession() {
  const liveSession = session.defaultSession;

  liveSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const allowedPermissions = new Set([
      "camera",
      "media",
      "geolocation",
      "notifications",
      "clipboard-read",
      "clipboard-sanitized-write",
    ]);
    callback(isAllowedUrl(details.requestingUrl || webContents.getURL()) && allowedPermissions.has(permission));
  });

  liveSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => {
    const allowedPermissions = new Set([
      "camera",
      "media",
      "geolocation",
      "notifications",
      "clipboard-read",
      "clipboard-sanitized-write",
    ]);
    return isAllowedUrl(requestingOrigin) && allowedPermissions.has(permission);
  });

  liveSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (isAllowedUrl(details.url) && details.resourceType === "mainFrame") {
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      headers.Pragma = "no-cache";
      headers["X-DAY-NIGHT-SHELL"] = "windows-live";
    }
    callback({ requestHeaders: headers });
  });
}

function createMenu() {
  const template = [
    {
      label: "DAY NIGHT",
      submenu: [
        {
          label: "الرئيسية / Home",
          accelerator: "CmdOrCtrl+H",
          click: () => void loadProduction({ force: true }),
        },
        {
          label: "رجوع / Back",
          accelerator: "Alt+Left",
          click: () => {
            if (mainWindow?.webContents.canGoBack()) mainWindow.webContents.goBack();
          },
        },
        {
          label: "تحديث مباشر / Live Reload",
          accelerator: "CmdOrCtrl+R",
          click: async () => {
            await mainWindow?.webContents.session.clearCache();
            await loadProduction({ force: true });
          },
        },
        { type: "separator" },
        { role: "quit", label: "خروج / Exit" },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    title: "DAY NIGHT | Delivery Services",
    width: 1500,
    height: 940,
    minWidth: 1040,
    minHeight: 700,
    show: false,
    backgroundColor: "#071A33",
    icon: path.join(__dirname, "build", "icon.png"),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setUserAgent(`${mainWindow.webContents.getUserAgent()} DAY-NIGHT-WINDOWS-LIVE/1.1.0`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      mainWindow.loadURL(url).catch(() => undefined);
    } else if (/^https?:/i.test(url) || isExternalProtocol(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isAllowedUrl(url)) return;
    event.preventDefault();
    if (/^https?:/i.test(url) || isExternalProtocol(url)) void shell.openExternal(url);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    void loadOffline(new Error(`${errorDescription}: ${validatedURL}`));
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason !== "clean-exit") void loadProduction({ force: true });
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  mainWindow.on("focus", () => void checkForLiveDeployment());
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await session.defaultSession.clearCache();
  await loadProduction({ force: true });
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    void checkForLiveDeployment();
  });

  app.whenReady().then(async () => {
    configureSession();
    createMenu();
    await createWindow();
    updateTimer = setInterval(() => void checkForLiveDeployment(), UPDATE_INTERVAL_MS);
  });
}

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) void createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  clearInterval(updateTimer);
  clearTimeout(retryTimer);
});

process.on("uncaughtException", (error) => {
  dialog.showErrorBox("DAY NIGHT", String(error?.stack || error));
});
