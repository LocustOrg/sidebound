/**
 * SDL asset loader. Reads files from disk using Deno.readFile.
 * In compiled executables, paths resolve relative to the embedded asset root.
 */

import { Surface } from '@sdl3/sdl3-deno'
import type { ImageAssetLoader, RendererImageSource } from '@sidebound/engine'

export type SdlAssetLoaderOptions = {
    readonly root: URL
}

function normalizeAssetPath(assetPath: string): string {
    if (/^[a-z][a-z0-9+.-]*:/i.test(assetPath)) {
        return assetPath
    }

    return assetPath.replace(/^\/+/, '')
}

function extensionFromPath(path: string): string | undefined {
    const cleanPath = path.split(/[?#]/, 1)[0]
    const match = /\.([a-z0-9]+)$/i.exec(cleanPath)
    return match?.[1].toUpperCase()
}

function imageTypeFromMimeType(mimeType: string): string | undefined {
    switch (mimeType.toLowerCase()) {
        case 'image/bmp':
            return 'BMP'
        case 'image/gif':
            return 'GIF'
        case 'image/jpeg':
        case 'image/jpg':
            return 'JPG'
        case 'image/png':
            return 'PNG'
        case 'image/webp':
            return 'WEBP'
        default:
            return undefined
    }
}

function imageTypeForSource(source: RendererImageSource): string | undefined {
    if (source.kind === 'file') {
        return source.fileExtension?.toUpperCase() ?? (source.mimeType ? imageTypeFromMimeType(source.mimeType) : undefined) ?? extensionFromPath(source.path)
    }

    if (source.kind === 'bytes') {
        return source.fileExtension?.toUpperCase() ?? (source.mimeType ? imageTypeFromMimeType(source.mimeType) : undefined)
    }

    return undefined
}

function describeSdlError(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

function imageSourceSize(surface: Surface): { readonly width: number; readonly height: number } {
    const detail = surface.detail
    return { width: detail.w, height: detail.h }
}

async function loadSdlSurfaceFromPath(path: string): Promise<Surface> {
    await Surface.enableImageLib()

    try {
        return Surface.load(path)
    } catch (error) {
        throw new Error(`Failed to decode SDL image from '${path}': ${describeSdlError(error)}`, { cause: error })
    }
}

async function loadSdlSurfaceFromBytes(bytes: Uint8Array<ArrayBuffer>, type?: string): Promise<Surface> {
    await Surface.enableImageLib()

    try {
        return type ? Surface.loadMemTyped(bytes, type) : Surface.loadMem(bytes)
    } catch (error) {
        throw new Error(`Failed to decode SDL image from ${bytes.byteLength} bytes${type ? ` as ${type}` : ''}: ${describeSdlError(error)}`, { cause: error })
    }
}

export async function loadSdlSurface(source: RendererImageSource): Promise<Surface> {
    if (source.kind === 'file') {
        return await loadSdlSurfaceFromPath(source.path)
    }

    if (source.kind === 'bytes') {
        return await loadSdlSurfaceFromBytes(source.bytes, imageTypeForSource(source))
    }

    throw new Error('SDL renderer cannot load an opaque platform image source')
}

export class SdlAssetLoader implements ImageAssetLoader {
    private readonly root: URL

    constructor(options: SdlAssetLoaderOptions) {
        this.root = options.root
    }

    async loadImage(assetPath: string): Promise<RendererImageSource> {
        const resolvedPath = this.resolvePath(assetPath)

        try {
            const surface = await loadSdlSurfaceFromPath(resolvedPath)
            try {
                const { width, height } = imageSourceSize(surface)
                return { kind: 'file', path: resolvedPath, width, height, fileExtension: extensionFromPath(resolvedPath) }
            } finally {
                surface.destroy()
            }
        } catch (pathError) {
            try {
                const bytes = await this.loadBytes(assetPath)
                const surface = await loadSdlSurfaceFromBytes(bytes, extensionFromPath(assetPath))

                try {
                    const { width, height } = imageSourceSize(surface)
                    return { kind: 'bytes', bytes, width, height, fileExtension: extensionFromPath(assetPath) }
                } finally {
                    surface.destroy()
                }
            } catch (bytesError) {
                throw new Error(
                    `Failed to load SDL image '${assetPath}' resolved to '${resolvedPath}': ${describeSdlError(bytesError)}; file path attempt: ${
                        describeSdlError(pathError)
                    }`,
                    { cause: bytesError },
                )
            }
        }
    }

    async loadBytes(relativePath: string): Promise<Uint8Array<ArrayBuffer>> {
        const url = this.resolveUrl(relativePath)
        return await Deno.readFile(url)
    }

    resolvePath(relativePath: string): string {
        const url = this.resolveUrl(relativePath)

        if (url.protocol !== 'file:') {
            return url.href
        }

        return decodeURIComponent(url.pathname)
    }

    private resolveUrl(relativePath: string): URL {
        return new URL(normalizeAssetPath(relativePath), this.root)
    }
}
