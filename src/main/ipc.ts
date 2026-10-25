import { app, BrowserWindow, ipcMain, safeStorage, shell } from 'electron'
import { writeFileSync } from 'fs'
import { join } from 'path'
import type { Api } from '@shared/api'
import { PLATFORMS, type Platform, type Settings } from '@shared/types'
import { dateKey } from '@shared/dates'
import { contestIcs, googleCalendarUrl } from '@shared/calendar'
import type { Service } from './service'
import { syncPlatform } from './sync'

const AI_KEY = 'geminiKey'

// Encrypted with the OS keychain when available; base64 with a marker otherwise (e.g. Linux without a keyring).
function encrypt(text: string): string {
  return safeStorage.isEncryptionAvailable() ? `enc:${safeStorage.encryptString(text).toString('base64')}` : `raw:${Buffer.from(text).toString('base64')}`
}

function decrypt(stored: string): string {
  const data = Buffer.from(stored.slice(4), 'base64')
  return stored.startsWith('enc:') ? safeStorage.decryptString(data) : data.toString('utf-8')
}

export function broadcast(channel: string, ...args: unknown[]): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, ...args)
}

export async function syncAll(service: Service, only?: Platform): Promise<Awaited<ReturnType<Api['sync']>>> {
  const usernames = service.store.getSettings().usernames
  const targets = only ? [only] : PLATFORMS.filter((p) => usernames[p].trim())
  const results = await Promise.all(targets.map((p) => syncPlatform(service.syncContext, p)))
  broadcast('data-changed')
  return results
}

export function registerIpc(service: Service, onSettingsChanged: (s: Settings) => void): void {
  const { store } = service
  const handlers: Api = {
    getGuide: async () => service.guide,
    getSettings: async () => store.getSettings(),
    setSettings: async (patch) => {
      const before = store.getSettings()
      const after = store.setSettings(patch)
      // A changed username means previously synced data belongs to someone else.
      const changed = PLATFORMS.filter((p) => patch.usernames && before.usernames[p].trim() !== after.usernames[p].trim())
      for (const p of changed) store.resetPlatform(p)
      // A new track, roadmap or company focus invalidates today's sheet pick.
      if (patch.track || patch.roadmapStart || patch.targetCompanies) store.cacheSet(`sheet-potd:${dateKey()}`, null)
      onSettingsChanged(after)
      if (changed.length) void Promise.all(changed.filter((p) => after.usernames[p].trim()).map((p) => syncAll(service, p)))
      broadcast('data-changed')
      return after
    },
    getSheetStatus: async () => service.sheetStatus(),
    getToday: async () => service.today(),
    getPicks: () => service.picks(),
    getRevisions: async () => service.revisions(),
    getDashboard: async () => service.dashboard(),
    getStats: async () => service.stats(),
    getPlatforms: async () => service.platformSummaries(),
    getCompanies: async () => service.companies(),
    getContests: (force) => service.contests(force),
    addToCalendar: async (contest, target) => {
      if (target === 'google') {
        await shell.openExternal(googleCalendarUrl(contest))
        return
      }
      const file = join(app.getPath('temp'), `dsa-desk-${contest.id.replace(/[^\w-]/g, '_')}.ics`)
      writeFileSync(file, contestIcs(contest), 'utf-8')
      const err = await shell.openPath(file)
      if (err) throw new Error(err)
    },
    markSolved: async (input) => {
      service.markSolved(input)
      broadcast('data-changed')
    },
    unmarkSolved: async (key) => {
      service.unmarkSolved(key)
      broadcast('data-changed')
    },
    reviewDone: async (key, confidence) => {
      service.reviewDone(key, confidence)
      broadcast('data-changed')
    },
    listMistakes: async () => store.listMistakes(),
    addMistake: async (m) => {
      store.addMistake(m)
      broadcast('data-changed')
    },
    deleteMistake: async (id) => {
      store.deleteMistake(id)
      broadcast('data-changed')
    },
    sync: (platform) => syncAll(service, platform),
    openExternal: async (url) => {
      if (/^https:\/\//.test(url)) await shell.openExternal(url)
    },
    hasAiKey: async () => !!store.getSecret(AI_KEY),
    setAiKey: async (key) => {
      const k = key.trim()
      store.setSecret(AI_KEY, k ? encrypt(k) : null)
    },
    aiHelp: (problem, kind, fresh) => {
      const enc = store.getSecret(AI_KEY)
      if (!enc) throw new Error('Add a Gemini key in Settings → AI help first.')
      return service.aiHelp(problem, kind, decrypt(enc), fresh)
    }
  }
  for (const [name, fn] of Object.entries(handlers)) {
    ipcMain.handle(name, (_e, ...args) => (fn as (...a: unknown[]) => unknown)(...args))
  }
}
