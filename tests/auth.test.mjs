import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStoredUser, fetchRemoteWatchlist, pushWatchlist, resolveLoginSync, consumeRedirectLogin } from '../src/auth.ts'

function memoryStorage(entries = []) {
  const data = new Map(entries)
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) }
}

function withBrowser(hash, sessionEntries, run) {
  const names = ['location', 'history', 'localStorage', 'sessionStorage']
  const saved = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  const local = memoryStorage()
  const session = memoryStorage(sessionEntries)
  const replaced = []
  const values = {
    location: { hash, pathname: '/', search: '', origin: 'https://anicount.vercel.app' },
    history: { replaceState: (_s, _t, url) => replaced.push(url) },
    localStorage: local,
    sessionStorage: session,
  }
  for (const name of names) Object.defineProperty(globalThis, name, { configurable: true, value: values[name] })
  try {
    run({ local, session, replaced })
  } finally {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  }
}

test('redirect login stores the session only when the nonce matches this tab', () => {
  const user = { id: 'u1', email: 'a@b.c', name: 'A', avatarUrl: '' }
  const nonce = 'abc.https%3A%2F%2Fanicount.vercel.app'
  const hashFor = n => `#${new URLSearchParams({ auth: JSON.stringify({ token: 't', user, nonce: n }) })}`

  withBrowser(hashFor(nonce), [['anicount-login-nonce', nonce]], ({ local, session, replaced }) => {
    assert.deepEqual(consumeRedirectLogin(), { user })
    assert.equal(local.data.get('anicount-auth-token'), 't')
    assert.equal(session.data.has('anicount-login-nonce'), false)
    assert.deepEqual(replaced, ['/'])
  })

  // A session planted by another site (login CSRF) carries a different nonce.
  withBrowser(hashFor('attacker.x'), [['anicount-login-nonce', nonce]], ({ local }) => {
    assert.deepEqual(consumeRedirectLogin(), { error: 'nonce_mismatch' })
    assert.equal(local.data.has('anicount-auth-token'), false)
  })

  withBrowser('#auth_error=invalid_google_token', [], () => {
    assert.deepEqual(consumeRedirectLogin(), { error: 'invalid_google_token' })
  })

  withBrowser('#section', [], ({ replaced }) => {
    assert.equal(consumeRedirectLogin(), null)
    assert.deepEqual(replaced, [])
  })
})

test('cloud sync sends an empty watchlist and reports failures without treating them as empty data', async () => {
  const originalFetch = globalThis.fetch
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const token = `e30.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString('base64url')}.test`
  const data = new Map([['anicount-auth-token', token], ['anicount-auth-user', JSON.stringify({ id: 'test' })]])
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) } })
  try {
    let sent
    globalThis.fetch = async (_url, options) => { sent = options; return new Response(JSON.stringify({ updatedAt: '2026-10-25T00:00:00.000Z' }), { status: 200 }) }
    assert.deepEqual(await pushWatchlist([]), { updatedAt: '2026-10-25T00:00:00.000Z' })
    assert.deepEqual(JSON.parse(sent.body), { items: [] })
    assert.equal(sent.headers.Authorization, `Bearer ${token}`)
    globalThis.fetch = async () => new Response('{}', { status: 503 })
    await assert.rejects(fetchRemoteWatchlist, /Unable to load/)
    assert.equal(await pushWatchlist([]), null)
    data.set('anicount-auth-token', 'expired')
    assert.equal(getStoredUser(), null)
    assert.equal(data.has('anicount-auth-user'), false)
  } finally {
    globalThis.fetch = originalFetch
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else delete globalThis.localStorage
  }
})

test('the token payload decodes non-Latin names', () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const token = `e30.${Buffer.from(JSON.stringify({ name: 'アズアン', exp: Date.now() / 1000 + 3600 })).toString('base64url')}.test`
  const data = new Map([['anicount-auth-token', token], ['anicount-auth-user', JSON.stringify({ id: 'test', name: 'アズアン' })]])
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) } })
  try {
    assert.equal(getStoredUser()?.name, 'アズアン')
  } finally {
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else delete globalThis.localStorage
  }
})

test('login sync only merges when it cannot tell which side changed', () => {
  const synced = { userId: 'u1', syncedAt: 't1', syncedRevision: 3 }
  // First sync on this device, or a different account: merge.
  assert.equal(resolveLoginSync(null, 'u1', 0, 't1'), 'merge')
  assert.equal(resolveLoginSync(synced, 'u2', 3, 't1'), 'merge')
  // No local edits: take the server copy, so deletions made elsewhere stick.
  assert.equal(resolveLoginSync(synced, 'u1', 3, 't2'), 'remote')
  // Only local edits: keep this device's list, so local deletions stick.
  assert.equal(resolveLoginSync(synced, 'u1', 5, 't1'), 'local')
  // Both changed: merge.
  assert.equal(resolveLoginSync(synced, 'u1', 5, 't2'), 'merge')
})
