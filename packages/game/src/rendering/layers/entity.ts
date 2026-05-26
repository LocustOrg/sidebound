import type { ColorRgba, Renderer2D, RenderFrame, RenderLayer } from '@sidebound/engine'
import { clamp } from '@sidebound/engine'
import type { Mob } from '../../entities/mob.ts'
import type { PickupItemEntity } from '../../entities/item-entity.ts'

const shadowColor: ColorRgba = { r: 8, g: 6, b: 14, a: 0.25 }

/**
 * Draws all mob entities with a simple ground shadow.
 * Aura and gradient shadow are temporarily omitted for SDL3 parity.
 */
export class EntityLayer implements RenderLayer {
    readonly order = 20
    private mobs: Mob[] = []
    private itemProvider: () => readonly PickupItemEntity[] = () => []

    addMob(mob: Mob): void {
        this.mobs.push(mob)
    }

    setItemProvider(provider: () => readonly PickupItemEntity[]): void {
        this.itemProvider = provider
    }

    removeMob(mob: Mob): void {
        const index = this.mobs.indexOf(mob)
        if (index !== -1) this.mobs.splice(index, 1)
    }

    render(frame: RenderFrame): void {
        const { renderer } = frame

        for (const item of this.itemProvider()) {
            this.drawItem(renderer, item)
        }

        for (const mob of this.mobs) {
            this.drawMob(renderer, mob)
        }
    }

    private drawItem(renderer: Renderer2D, item: PickupItemEntity): void {
        item.spriteSheet.drawFrame(renderer, item.frameIndex ?? 0, Math.round(item.x), Math.round(item.y), item.flipX ?? false)
    }

    private drawMob(renderer: Renderer2D, mob: Mob): void {
        this.drawGroundShadow(renderer, mob)
        mob.draw(renderer)
    }

    private drawGroundShadow(renderer: Renderer2D, mob: Mob): void {
        const projection = mob.getShadowProjection()
        if (projection === null) return

        const heightFactor = clamp(projection.distance / 80, 0, 1)
        const radiusX = Math.round(mob.width * 1.9 * (1 - heightFactor * 0.45))
        const alpha = 0.28 * (1 - heightFactor * 0.72)
        const centerX = projection.x

        renderer.fillRect(
            { x: Math.round(centerX - radiusX / 2), y: projection.y, width: radiusX, height: 2 },
            { ...shadowColor, a: alpha },
        )
    }
}
