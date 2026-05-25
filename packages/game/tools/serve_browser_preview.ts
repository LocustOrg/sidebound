import { serveDir } from '@std/http/file-server'

const packageRoot = new URL('../', import.meta.url)
const distDir = new URL('dist/', packageRoot)
let rebuildTimeout: ReturnType<typeof setTimeout> | undefined
let buildBrowserPreview: ((options?: { readonly minify?: boolean; readonly liveReload?: boolean }) => Promise<void>) | undefined

const liveReloadClients = new Set<WebSocket>()

function parsePort(): number {
    const rawPort = Deno.env.get('PORT') ?? '5173'
    const port = Number(rawPort)

    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid PORT value '${rawPort}'`)
    }

    return port
}

async function rebuildBrowserPreview(): Promise<void> {
    buildBrowserPreview ??= (await import('./build_browser_preview.ts')).buildBrowserPreview
    await buildBrowserPreview({ liveReload: Deno.args.includes('--watch') })
}

function notifyClients(): void {
    for (const client of liveReloadClients) {
        if (client.readyState === WebSocket.OPEN) {
            client.send('reload')
        }
    }
}

function scheduleBuild(): void {
    clearTimeout(rebuildTimeout)
    rebuildTimeout = setTimeout(async () => {
        try {
            await rebuildBrowserPreview()
            console.log('Rebuilt browser preview')
            notifyClients()
        } catch (error) {
            console.error(error)
        }
    }, 75)
}

function watchBrowserPreviewSources(): void {
    const watcher = Deno.watchFs([
        decodeURIComponent(new URL('index.html', packageRoot).pathname),
        decodeURIComponent(new URL('src/', packageRoot).pathname),
        decodeURIComponent(new URL('../engine/src/', packageRoot).pathname),
        decodeURIComponent(new URL('../platform-browser/src/', packageRoot).pathname),
    ])

    void (async () => {
        for await (const event of watcher) {
            if (event.kind !== 'access') {
                scheduleBuild()
            }
        }
    })()
}

function handleRequest(request: Request): Response | Promise<Response> {
    if (request.headers.get('upgrade') === 'websocket') {
        const { socket, response } = Deno.upgradeWebSocket(request)
        liveReloadClients.add(socket)
        socket.onclose = () => liveReloadClients.delete(socket)
        return response
    }

    return serveDir(request, {
        fsRoot: decodeURIComponent(distDir.pathname),
        quiet: true,
    })
}

if (!Deno.args.includes('--skip-build')) {
    await rebuildBrowserPreview()
}

if (Deno.args.includes('--watch')) {
    watchBrowserPreviewSources()
}

const port = parsePort()
console.log(`Serving Sidebound browser preview at http://localhost:${port}/`)
Deno.serve({ hostname: '0.0.0.0', port }, handleRequest)
