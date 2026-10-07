import {defineConfig, type Plugin, type ViteDevServer} from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import qrcode from 'qrcode-terminal'
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {computeCoreHash, isCoreIntact} from './scripts/lib/core-hash.ts'

const root = process.cwd()

// Prints a QR code of the LAN URL so the dev server can be opened on a phone.
const lanQrCode = (): Plugin => ({
  name: 'ra-lan-qrcode',
  apply: 'serve',
  configureServer(server: ViteDevServer) {
    server.httpServer?.once('listening', () => {
      setTimeout(() => {
        const urls = server.resolvedUrls?.network ?? []
        if (!urls.length) return
        console.log('\n  Sur ton téléphone (même Wi-Fi), scanne :')
        qrcode.generate(urls[0], {small: true}, (code: string) => console.log(code))
        console.log(`  ${urls[0]}`)
        console.log('  Certificat auto-signé : accepte l\'avertissement (« Afficher les détails » › « visiter ce site »).\n')
      }, 200)
    })
  },
})

// experience/ is the public dir: Vite serves it but does not reload on change. Force a reload.
const reloadOnExperienceChange = (): Plugin => ({
  name: 'ra-experience-reload',
  apply: 'serve',
  configureServer(server) {
    const onChange = (file: string) => {
      if (/\/(experience|examples)\//.test(file.replace(/\\/g, '/'))) server.ws.send({type: 'full-reload'})
    }
    server.watcher.on('change', onChange)
    server.watcher.on('add', onChange)
    server.watcher.on('unlink', onChange)
  },
})

// virtual:core-integrity -> {ok, hash}: lets the app warn when core/ was edited.
const coreIntegrity = (): Plugin => {
  const id = 'virtual:core-integrity'
  const resolved = `\0${id}`
  return {
    name: 'ra-core-integrity',
    resolveId: (source) => (source === id ? resolved : null),
    load(loadId) {
      if (loadId !== resolved) return null
      const ok = isCoreIntact(root)
      return `export default ${JSON.stringify({ok, hash: computeCoreHash(root).slice(0, 12)})}`
    },
    handleHotUpdate({file, server}) {
      if (!file.replace(/\\/g, '/').includes('/core/')) return
      const mod = server.moduleGraph.getModuleById(resolved)
      if (mod) server.moduleGraph.invalidateModule(mod)
    },
  }
}

// examples/*/ (experience.json + behaviors) are served at /examples/ in dev and copied into the
// build, so the preview's example selector (?exemple=...) works everywhere.
const serveExamples = (): Plugin => {
  const dir = join(root, 'examples')
  const files = () =>
    existsSync(dir)
      ? (readdirSync(dir, {recursive: true}) as string[])
        .map((f) => f.replace(/\\/g, '/'))
        .filter((f) => /\.(json|js)$/.test(f))
      : []
  return {
    name: 'ra-examples',
    configureServer(server) {
      server.middlewares.use('/examples', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        if (!files().includes(rel)) return next()
        res.setHeader('Content-Type', rel.endsWith('.js') ? 'text/javascript' : 'application/json')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync(join(dir, rel)))
      })
    },
    generateBundle() {
      for (const f of files()) {
        this.emitFile({type: 'asset', fileName: `examples/${f}`, source: readFileSync(join(dir, f))})
      }
    },
  }
}

// `npm run dev:http` (mode "http") serves without TLS, for desktop-only previews.
export default defineConfig(({mode}) => ({
  // Relative base: works on GitHub Pages project sites (https://user.github.io/repo/).
  base: './',
  // The student zone is served as-is (fetched at runtime, never bundled).
  publicDir: 'experience',
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1500,
  },
  plugins: [mode === 'http' ? null : basicSsl(), lanQrCode(), reloadOnExperienceChange(), coreIntegrity(), serveExamples()],
}))
