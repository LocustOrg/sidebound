import type { Renderer2D, RenderFrame, RenderLayer } from '@sidebound/engine'
import { clamp } from '@sidebound/engine'
import type { RenderContext } from '@sidebound/platform-browser'
import type { Mob } from '../../entities/mob.ts'
import type { PickupItemEntity } from '../../entities/item-entity.ts'

type BrowserPreviewFrame = RenderFrame & {
    readonly context?: RenderContext
}

/**
 * Draws all mob entities with shadow and aura effects.
 * In the future this should accept an entity list; for now it takes a single mob reference.
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
        const { context } = frame as BrowserPreviewFrame
        if (!context) return

        for (const item of this.itemProvider()) {
            this.drawItem(frame.renderer, item)
        }

        for (const mob of this.mobs) {
            this.drawMob(frame.renderer, context, mob)
        }
    }

    private drawItem(renderer: Renderer2D, item: PickupItemEntity): void {
        item.spriteSheet.drawFrame(renderer, item.frameIndex ?? 0, Math.round(item.x), Math.round(item.y), item.flipX ?? false)
    }

    private drawMob(renderer: Renderer2D, context: RenderContext, mob: Mob): void {
        const centerX = mob.x + mob.width / 2

        this.drawGroundShadow(context, mob)

        // Sprite
        mob.draw(renderer)

        // Subtle aura
        context.save()
        context.globalCompositeOperation = 'screen'
        const aura = context.createRadialGradient(centerX, mob.y + mob.height * 0.35, 0, centerX, mob.y + mob.height * 0.35, 12)
        aura.addColorStop(0, 'rgba(168, 226, 255, 0.08)')
        aura.addColorStop(1, 'rgba(168, 226, 255, 0)')
        context.fillStyle = aura
        context.beginPath()
        context.arc(centerX, mob.y + mob.height * 0.35, 12, 0, Math.PI * 2)
        context.fill()
        context.restore()
    }

    private drawGroundShadow(context: RenderContext, mob: Mob): void {
        const projection = mob.getShadowProjection()
        if (projection === null) return

        const heightFactor = clamp(projection.distance / 80, 0, 1)
        const radiusX = mob.width * 1.9 * (1 - heightFactor * 0.45)
        const alpha = 0.28 * (1 - heightFactor * 0.72)

        context.save()
        context.fillStyle = `rgba(8, 6, 14, ${alpha})`
        context.beginPath()
        context.arc(projection.x, projection.y + 1, radiusX, 0, Math.PI * 2)
        context.fill()
        context.restore()
    }
}
