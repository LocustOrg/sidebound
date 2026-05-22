import type { Level } from '../world/demo-map'
import type { Rect, Vec2 } from '../core/geometry'
import type { RayHit } from '../systems/lighting'
import type { PlayerState } from '../systems/player'

export class DemoRenderer {
    private readonly world: Level

    constructor(world: Level) {
        this.world = world
    }

    drawArea(context: CanvasRenderingContext2D): void {
        context.fillStyle = '#111019'
        context.fillRect(0, 0, this.world.width, this.world.height)

        const backgroundGradient = context.createLinearGradient(0, 0, 0, this.world.height)
        backgroundGradient.addColorStop(0, '#15121c')
        backgroundGradient.addColorStop(1, '#0d0c12')
        context.fillStyle = backgroundGradient
        context.fillRect(0, 0, this.world.width, this.world.height)

        context.fillStyle = '#191621'

        for (let x = 0; x < this.world.width; x += 16) {
            context.fillRect(x, 0, 2, this.world.height)
        }

        context.fillStyle = '#211b28'

        for (let x = 8; x < this.world.width; x += 32) {
            context.fillRect(x, 24, 8, 106)
        }

        for (const solid of this.world.solids) {
            this.drawSolid(context, solid)
        }
    }

    drawPlayer(context: CanvasRenderingContext2D, player: PlayerState): void {
        const x = Math.round(player.x)
        const y = Math.round(player.y)
        const eyeX = player.facing > 0 ? x + 3 : x + 1

        context.fillStyle = '#c89143'
        context.fillRect(x + 1, y + 8, 1, 2)
        context.fillRect(x + 3, y + 8, 1, 2)
        context.fillStyle = '#f4c45f'
        context.fillRect(x, y + 2, player.width, 7)
        context.fillStyle = '#fff4b5'
        context.fillRect(eyeX, y + 4, 1, 1)
        context.fillStyle = '#8f5d34'
        context.fillRect(x + (player.facing > 0 ? 1 : 3), y + 6, 1, 2)
    }

    drawLighting(context: CanvasRenderingContext2D, lightPolygon: RayHit[], origin: Vec2, cameraRect: Rect, lightRadius: number): void {
        if (lightPolygon.length === 0) {
            return
        }

        context.save()
        context.fillStyle = 'rgba(4, 4, 9, 0.86)'
        context.fillRect(cameraRect.x, cameraRect.y, cameraRect.width, cameraRect.height)
        context.globalCompositeOperation = 'destination-out'

        const gradient = context.createRadialGradient(origin.x, origin.y, 3, origin.x, origin.y, lightRadius)
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
        gradient.addColorStop(0.62, 'rgba(255, 255, 255, 0.42)')
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
        context.fillStyle = gradient
        this.drawLightWedges(context, lightPolygon, origin)
        context.restore()

        context.save()
        context.globalCompositeOperation = 'lighter'

        const glow = context.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, lightRadius)
        glow.addColorStop(0, 'rgba(244, 196, 95, 0.22)')
        glow.addColorStop(1, 'rgba(244, 196, 95, 0)')
        context.fillStyle = glow
        this.drawLightWedges(context, lightPolygon, origin)
        context.restore()
    }

    drawLightingDebug(context: CanvasRenderingContext2D, lightPolygon: RayHit[], origin: Vec2, lightRadius: number): void {
        context.save()
        context.strokeStyle = 'rgba(97, 210, 255, 0.28)'
        context.lineWidth = 1

        for (const hit of lightPolygon) {
            context.beginPath()
            context.moveTo(origin.x, origin.y)
            context.lineTo(hit.x, hit.y)
            context.stroke()
        }

        context.strokeStyle = 'rgba(244, 196, 95, 0.65)'
        context.beginPath()
        context.arc(origin.x, origin.y, lightRadius, 0, Math.PI * 2)
        context.stroke()
        context.restore()
    }

    drawCollisionDebug(context: CanvasRenderingContext2D, playerRect: Rect): void {
        context.save()
        context.strokeStyle = 'rgba(255, 106, 106, 0.9)'
        context.lineWidth = 1

        for (const solid of this.world.solids) {
            context.strokeRect(solid.x + 0.5, solid.y + 0.5, solid.width - 1, solid.height - 1)
        }

        context.strokeStyle = 'rgba(115, 255, 153, 0.9)'
        context.strokeRect(playerRect.x + 0.5, playerRect.y + 0.5, playerRect.width - 1, playerRect.height - 1)
        context.restore()
    }

    private drawSolid(context: CanvasRenderingContext2D, solid: Rect): void {
        context.fillStyle = '#393340'
        context.fillRect(solid.x, solid.y, solid.width, solid.height)
        context.fillStyle = '#5a5160'
        context.fillRect(solid.x, solid.y, solid.width, 1)
        context.fillStyle = '#241f2a'
        context.fillRect(solid.x, solid.y + solid.height - 1, solid.width, 1)
    }

    private drawLightWedges(context: CanvasRenderingContext2D, lightPolygon: RayHit[], origin: Vec2): void {
        if (lightPolygon.length < 2) {
            return
        }

        for (let index = 0; index < lightPolygon.length; index += 1) {
            const nextIndex = (index + 1) % lightPolygon.length
            const current = lightPolygon[index]
            const next = lightPolygon[nextIndex]

            context.beginPath()
            context.moveTo(origin.x, origin.y)
            context.lineTo(current.x, current.y)
            context.lineTo(next.x, next.y)
            context.closePath()
            context.fill()
        }
    }
}
