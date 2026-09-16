import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getStoredUser, fetchRemoteWatchlist, pushWatchlist } from '../src/auth.ts'

test('cloud sync sends an empty watchlist and reports failures without treating them as empty data', async () => {
  const originalFetch = globalThis.fetch
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const token = `e30.${Buffer.from(JSON.stringify({ exp: Date.now() / 1000 + 3600 })).toString('base64url')}.test`
  const data = new Map([['anicount-auth-token', token], ['anicount-auth-user', JSON.stringify({ id: 'test' })]])
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => data.get(key) ?? null, removeItem: key => data.delete(key) } })
  try {
    let sent
    globalThis.fetch = async (_url, options) => { sent = options; return new Response('{}', { status: 200 }) }
    assert.equal(await pushWatchlist([]), true)
    assert.deepEqual(JSON.parse(sent.body), { items: [] })
    assert.equal(sent.headers.Authorization, `Bearer ${token}`)
    globalThis.fetch = async () => new Response('{}', { status: 503 })
    await assert.rejects(fetchRemoteWatchlist, /Unable to load/)
    assert.equal(await pushWatchlist([]), false)
    data.set('anicount-auth-token', 'expired')
    assert.equal(getStoredUser(), null)
    assert.equal(data.has('anicount-auth-user'), false)
  } finally {
    globalThis.fetch = originalFetch
    if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor)
    else delete globalThis.localStorage
  }
})
