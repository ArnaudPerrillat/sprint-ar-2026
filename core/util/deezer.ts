// ctx.deezer: read-only access to Deezer's public API for behaviors (RULES.md § 4 bis).
// api.deezer.com sends no Access-Control-Allow-Origin header, so fetch() is blocked by the
// browser: the call goes through JSONP (a <script> tag), which the API supports natively.
// Only public read endpoints are allowed: no login, no write, no token.

const API = 'https://api.deezer.com'
const TIMEOUT_MS = 8000

// Paths a behavior may read. Pagination links returned by the API ("next") match them too.
const ALLOWED = [
  /^\/search(\/(track|album|artist|playlist))?$/,
  /^\/track\/\d+$/,
  /^\/album\/\d+(\/tracks)?$/,
  /^\/artist\/\d+(\/top|\/albums)?$/,
  /^\/playlist\/\d+(\/tracks)?$/,
]

// Parameters that would turn a read into a write or an authenticated call.
const FORBIDDEN_PARAMS = ['access_token', 'request_method']
// Set by deezer() itself; the "next" link of a JSONP answer carries the previous ones.
const JSONP_PARAMS = ['output', 'callback']

let calls = 0

export type DeezerParams = Record<string, string | number | boolean>

export const deezerUrl = (path: string, params: DeezerParams = {}): string => {
  if (typeof path !== 'string' || !path.trim()) {
    throw new Error('ctx.deezer : donne un chemin, ex. ctx.deezer(\'/playlist/1234567/tracks\').')
  }
  // Full URLs (the "next" field of a paginated answer) are accepted.
  const url = new URL(path.startsWith('http') ? path : `${API}${path.startsWith('/') ? '' : '/'}${path}`)
  if (url.origin !== API) throw new Error(`ctx.deezer : seul ${API} est autorisé.`)
  if (!ALLOWED.some((re) => re.test(url.pathname))) {
    throw new Error(`ctx.deezer : « ${url.pathname} » n'est pas autorisé (lecture seule : /search, /track/{id}, /album/{id}, /artist/{id}, /playlist/{id}, /playlist/{id}/tracks).`)
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  for (const key of JSONP_PARAMS) url.searchParams.delete(key)
  for (const key of FORBIDDEN_PARAMS) {
    if (url.searchParams.has(key)) throw new Error(`ctx.deezer : le paramètre « ${key} » est interdit (lecture seule, sans connexion).`)
  }
  return url.href
}

export const deezer = (path: string, params?: DeezerParams): Promise<unknown> => {
  let href: string
  try {
    href = deezerUrl(path, params)
  } catch (err) {
    return Promise.reject(err)
  }
  return new Promise((resolve, reject) => {
    const name = `__raDeezer${Date.now()}_${calls++}`
    const script = document.createElement('script')
    const w = window as unknown as Record<string, unknown>
    const done = () => {
      clearTimeout(timer)
      script.remove()
      // A late answer after a timeout must not throw "is not a function".
      w[name] = () => delete w[name]
    }
    const timer = setTimeout(() => {
      done()
      reject(new Error('Deezer ne répond pas (connexion lente ou coupée).'))
    }, TIMEOUT_MS)
    w[name] = (data: {error?: {message?: string}} | undefined) => {
      done()
      delete w[name]
      if (data && data.error) reject(new Error(`Deezer : ${data.error.message ?? 'erreur'}`))
      else resolve(data)
    }
    script.onerror = () => {
      done()
      reject(new Error('Deezer est injoignable (pas de réseau ?).'))
    }
    const url = new URL(href)
    url.searchParams.set('output', 'jsonp')
    url.searchParams.set('callback', name)
    script.src = url.href
    document.head.appendChild(script)
  })
}
