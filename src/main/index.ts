import { app, BrowserWindow, Menu, nativeImage, nativeTheme, Notification, shell, Tray } from 'electron'
import { join } from 'path'
import type { Settings } from '@shared/types'
import { dateKey } from '@shared/dates'
import guide from '@data/guide.json'
import type { Guide } from '@shared/types'
import { Store } from './db'
import { Service } from './service'
import { broadcast, registerIpc, syncAll } from './ipc'
import iconPath from '../../resources/icon.png?asset'
import trayPath from '../../resources/tray.png?asset'

const SYNC_EVERY_MS = 3 * 60 * 60 * 1000

let win: BrowserWindow | null = null
let tray: Tray | null = null
let quitting = false

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    title: 'DSA Desk',
    icon: iconPath,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1E1C19' : '#F7F3EA',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      // Screenshot mode renders offscreen so it works without a visible desktop.
      offscreen: !app.isPackaged && !!process.env.DSA_DESK_SHOT
    }
  })
  w.once('ready-to-show', () => w.show())
  // Closing hides to tray so reminders keep working; "Quit" from the tray really exits.
  w.on('close', (e) => {
    if (!quitting && tray) {
      e.preventDefault()
      w.hide()
    }
  })
  w.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void w.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void w.loadFile(join(__dirname, '../renderer/index.html'))
  return w
}

function showWindow(path?: string): void {
  if (!win || win.isDestroyed()) win = createWindow()
  win.show()
  win.focus()
  if (path) win.webContents.send('navigate', path)
}

function createTray(service: Service): void {
  tray = new Tray(nativeImage.createFromPath(trayPath))
  tray.setToolTip('DSA Desk')
  const menu = (): Menu =>
    Menu.buildFromTemplate([
      { label: "Today's problems", click: () => showWindow('/today') },
      { label: 'Dashboard', click: () => showWindow('/') },
      { label: 'Sync now', click: () => void syncAll(service) },
      { type: 'separator' },
      { label: 'Quit DSA Desk', click: () => { quitting = true; app.quit() } }
    ])
  tray.setContextMenu(menu())
  tray.on('click', () => showWindow())
}

/** Checks once a minute: goal reminder at the chosen time, streak-at-risk nudge at 22:00. */
function startReminders(service: Service): void {
  const fired = new Set<string>()
  const notify = (id: string, title: string, body: string): void => {
    const key = `${dateKey()}:${id}`
    if (fired.has(key) || !Notification.isSupported()) return
    fired.add(key)
    const n = new Notification({ title, body, icon: iconPath, silent: false })
    n.on('click', () => showWindow('/today'))
    n.show()
  }
  setInterval(() => {
    const s = service.store.getSettings()
    if (!s.reminders) return
    const now = new Date()
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const d = service.dashboard()
    if (hhmm >= s.reminderTime && d.solvedToday < d.dailyGoal) {
      const left = d.dailyGoal - d.solvedToday
      notify('goal', '☕ Study time', `${left} problem${left > 1 ? 's' : ''} left for today's goal. Your problem of the day is waiting.`)
    }
    if (hhmm >= '22:00' && d.streak > 0 && d.solvedToday === 0) {
      notify('streak', `🔥 Keep your ${d.streak}-day streak`, 'One quick problem before midnight keeps it alive.')
    }
  }, 60_000)
}

function applyStartup(s: Settings): void {
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: s.launchAtStartup, args: ['--hidden'] })
  nativeTheme.themeSource = s.theme
}

// Dev-only hooks: a throwaway data folder, and page screenshots for checking the UI.
if (!app.isPackaged && process.env.DSA_DESK_DATA) app.setPath('userData', process.env.DSA_DESK_DATA)

async function captureScreens(w: BrowserWindow, dir: string): Promise<void> {
  const { mkdirSync, writeFileSync } = await import('fs')
  mkdirSync(dir, { recursive: true })
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
  await wait(4000)
  for (const route of (process.env.DSA_DESK_ROUTES ?? '/,/today,/sheet,/revision,/mistakes,/stats,/settings').split(',')) {
    w.webContents.send('navigate', route)
    await wait(Number(process.env.DSA_DESK_WAIT ?? 3500))
    if (process.env.DSA_DESK_EVAL) {
      await w.webContents.executeJavaScript(process.env.DSA_DESK_EVAL).catch(() => undefined)
      await wait(1500)
    }
    const img = await w.webContents.capturePage()
    writeFileSync(join(dir, `${route.replace(/\//g, '') || 'dashboard'}.png`), img.toPNG())
  }
  quitting = true
  app.quit()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => showWindow())

  app.whenReady().then(() => {
    app.setAppUserModelId('com.dsadesk.app')
    const store = new Store(join(app.getPath('userData'), 'dsa-desk.db'))
    const service = new Service(store, guide as Guide)
    registerIpc(service, applyStartup)
    applyStartup(store.getSettings())

    createTray(service)
    if (!process.argv.includes('--hidden')) showWindow()
    if (!app.isPackaged && process.env.DSA_DESK_SHOT && win) void captureScreens(win, process.env.DSA_DESK_SHOT)
    startReminders(service)

    const sync = (): void => void syncAll(service).catch(() => broadcast('data-changed'))
    setTimeout(sync, 3_000)
    setInterval(sync, SYNC_EVERY_MS)
  })

  app.on('before-quit', () => {
    quitting = true
  })
  app.on('window-all-closed', () => {
    if (!tray) app.quit()
  })
}
