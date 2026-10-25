import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStoredUser, fetchRemoteWatchlist, pushWatchlist, resolveLoginSync } from '../src/auth.ts'

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
