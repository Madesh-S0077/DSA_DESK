const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DSA-Desk/0.1'

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function getJson<T>(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs)
  })
  if (!res.ok) throw new HttpError(`${new URL(url).host} responded ${res.status}`, res.status)
  return (await res.json()) as T
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Spaces out calls to one host (Codeforces allows ~1 request / 2 s, kenkoooo asks for ≥1 s). */
export function throttle(minGapMs: number): () => Promise<void> {
  let last = 0
  return async () => {
    const wait = last + minGapMs - Date.now()
    if (wait > 0) await sleep(wait)
    last = Date.now()
  }
}
