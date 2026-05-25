import type { ImageSource } from '../platform/render-context'
import type { Canvas2DPreviewPlatform } from '../platform/adapter'

export type AssetId = string

export type AssetHandle<TKind extends string = string> = {
    readonly id: AssetId
    readonly kind: TKind
}

export type ImageAsset = {
    readonly id: AssetId
    readonly image: ImageSource
    readonly width: number
    readonly height: number
}

export type ImageAssetDefinition = {
    readonly id: AssetId
    readonly url: string
}

export function imageHandle(id: AssetId): AssetHandle<'image'> {
    return { id, kind: 'image' }
}

export class AssetStore {
    private readonly imageDefinitions = new Map<AssetId, ImageAssetDefinition>()
    private readonly images = new Map<AssetId, Promise<ImageAsset>>()
    private readonly platform: Canvas2DPreviewPlatform

    constructor(platform: Canvas2DPreviewPlatform) {
        this.platform = platform
    }

    registerImage(definition: ImageAssetDefinition): AssetHandle<'image'> {
        const existing = this.imageDefinitions.get(definition.id)

        if (existing && existing.url !== definition.url) {
            throw new Error(`Image asset '${definition.id}' is already registered with a different URL`)
        }

        this.imageDefinitions.set(definition.id, definition)
        return imageHandle(definition.id)
    }

    registerImages(definitions: readonly ImageAssetDefinition[]): void {
        for (const definition of definitions) {
            this.registerImage(definition)
        }
    }

    async loadImage(id: AssetId): Promise<ImageAsset> {
        const definition = this.imageDefinitions.get(id)

        if (!definition) {
            throw new Error(`Unknown image asset '${id}'`)
        }

        let image = this.images.get(id)
        if (!image) {
            image = this.platform.loadImage(definition.url).then((loaded) => ({
                id: definition.id,
                image: loaded,
                width: loaded.width,
                height: loaded.height,
            }))
            this.images.set(id, image)
        }

        return image
    }

    async preloadAll(): Promise<void> {
        await Promise.all([...this.imageDefinitions.keys()].map((id) => this.loadImage(id)))
    }
}
