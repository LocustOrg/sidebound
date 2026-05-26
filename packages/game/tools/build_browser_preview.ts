import { bundle } from '@deno/emit'

const packageRoot = new URL('../', import.meta.url)
const distDir = new URL('dist/', packageRoot)
const distAssetsDir = new URL('assets/', distDir)

async function removeIfExists(path: URL): Promise<void> {
    try {
        await Deno.remove(path, { recursive: true })
    } catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error
        }
    }
}

async function copyDirectory(from: URL, to: URL): Promise<void> {
    await Deno.mkdir(to, { recursive: true })

    for await (const entry of Deno.readDir(from)) {
        const source = new URL(entry.name, from)
        const target = new URL(entry.name, to)

        if (entry.isDirectory) {
            await copyDirectory(new URL(`${entry.name}/`, from), new URL(`${entry.name}/`, to))
            continue
        }

        if (entry.isFile) {
            await Deno.copyFile(source, target)
        }
    }
}

async function bundleGame(options: { readonly minify: boolean }): Promise<void> {
    const output = await bundle(new URL('src/main.ts', packageRoot), {
        importMap: {
            imports: {
                '@sidebound/engine': new URL('../engine/src/mod.ts', packageRoot).href,
                '@sidebound/platform-browser': new URL('../platform-browser/src/mod.ts', packageRoot).href,
            },
        },
        minify: options.minify,
        type: 'module',
    })
    const code = output.map ? `${output.code}\n//# sourceMappingURL=main.js.map\n` : output.code

    await Deno.writeTextFile(new URL('main.js', distAssetsDir), code)

    if (output.map) {
        await Deno.writeTextFile(new URL('main.js.map', distAssetsDir), output.map)
    }
}

const liveReloadScript = `
<script>
    const ws = new WebSocket(\`ws://\${location.host}\`)
    ws.onmessage = (e) => { if (e.data === 'reload') location.reload() }
    ws.onclose = () => setTimeout(() => location.reload(), 1000)
</script>
`

export async function buildPlatformBrowserPreview(options: { readonly minify?: boolean; readonly liveReload?: boolean } = {}): Promise<void> {
    await removeIfExists(distDir)
    await Deno.mkdir(distAssetsDir, { recursive: true })

    let html = await Deno.readTextFile(new URL('index.html', packageRoot))
    if (options.liveReload) {
        html = html.replace('</body>', `    ${liveReloadScript}\n    </body>`)
    }
    await Deno.writeTextFile(new URL('index.html', distDir), html)

    await Deno.copyFile(new URL('src/style.css', packageRoot), new URL('style.css', distAssetsDir))
    await copyDirectory(new URL('assets/', packageRoot), distAssetsDir)
    await bundleGame({ minify: options.minify ?? false })
}

if (import.meta.main) {
    await buildPlatformBrowserPreview({ minify: Deno.args.includes('--minify') })
}
