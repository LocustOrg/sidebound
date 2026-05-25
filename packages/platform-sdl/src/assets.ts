/**
 * SDL asset loader. Reads files from disk using Deno.readFile.
 * In compiled executables, paths resolve relative to the embedded asset root.
 */

export type SdlAssetLoaderOptions = {
    readonly root: URL
}

export class SdlAssetLoader {
    private readonly root: URL

    constructor(options: SdlAssetLoaderOptions) {
        this.root = options.root
    }

    async loadBytes(relativePath: string): Promise<Uint8Array> {
        const url = new URL(relativePath, this.root)
        return await Deno.readFile(url)
    }

    resolvePath(relativePath: string): string {
        const url = new URL(relativePath, this.root)
        return url.pathname
    }
}
