import { createProceduralSheet, type SpriteSheet } from './sprite-sheet'

const ITEM_FRAME_W = 16
const ITEM_FRAME_H = 16
const TAU = Math.PI * 2

const colors = {
    outline: '#120f17',
    capeDark: '#2b1820',
    capeMid: '#4a2735',
    capeLight: '#764258',
    leather: '#594433',
    gold: '#b6975e',
    blade: '#d7dce7',
    bladeEdge: '#f8fbff',
}

export function createCapeItemSpriteSheet(): SpriteSheet {
    return createProceduralSheet(ITEM_FRAME_W, ITEM_FRAME_H, 1, 1, (context) => {
        context.save()
        context.lineJoin = 'round'
        context.lineCap = 'round'

        context.fillStyle = colors.outline
        context.beginPath()
        context.moveTo(5, 3)
        context.quadraticCurveTo(2, 7, 3, 13)
        context.quadraticCurveTo(8, 15, 12, 12)
        context.quadraticCurveTo(11, 7, 9, 3)
        context.closePath()
        context.fill()

        context.fillStyle = colors.capeMid
        context.beginPath()
        context.moveTo(5.5, 3.6)
        context.quadraticCurveTo(3.2, 7.5, 4, 12.2)
        context.quadraticCurveTo(8, 13.8, 11, 11.3)
        context.quadraticCurveTo(10.2, 7.1, 8.6, 3.6)
        context.closePath()
        context.fill()

        context.strokeStyle = colors.capeLight
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(6.2, 4.3)
        context.quadraticCurveTo(5.5, 8.2, 6.1, 12.1)
        context.stroke()

        context.fillStyle = colors.capeDark
        context.beginPath()
        context.ellipse(7, 3.2, 3.1, 1.1, 0, 0, TAU)
        context.fill()
        context.restore()
    })
}

export function createSwordItemSpriteSheet(): SpriteSheet {
    return createProceduralSheet(ITEM_FRAME_W, ITEM_FRAME_H, 1, 1, (context) => {
        context.save()
        context.lineJoin = 'round'
        context.lineCap = 'round'

        context.strokeStyle = colors.outline
        context.lineWidth = 2.6
        context.beginPath()
        context.moveTo(4.2, 12.2)
        context.lineTo(11.8, 3.2)
        context.stroke()

        context.strokeStyle = colors.blade
        context.lineWidth = 1.5
        context.beginPath()
        context.moveTo(5.1, 11.4)
        context.lineTo(11.2, 4.1)
        context.stroke()

        context.strokeStyle = colors.bladeEdge
        context.lineWidth = 0.55
        context.beginPath()
        context.moveTo(5.7, 10.7)
        context.lineTo(11.5, 3.8)
        context.stroke()

        context.strokeStyle = colors.outline
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(3.6, 9.4)
        context.lineTo(6.8, 12.1)
        context.stroke()

        context.strokeStyle = colors.gold
        context.lineWidth = 1
        context.beginPath()
        context.moveTo(4.1, 9.7)
        context.lineTo(6.4, 11.6)
        context.stroke()

        context.strokeStyle = colors.leather
        context.lineWidth = 1.4
        context.beginPath()
        context.moveTo(3.4, 12.8)
        context.lineTo(5, 11)
        context.stroke()
        context.restore()
    })
}
