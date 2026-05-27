/**
 * Tests for LightingLayer render pipeline behavior using the fake renderer.
 * Validates: pass order, camera offset handling, light culling, debug data stability.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { FakeRenderer } from './fake-renderer.ts'
import { LightingLayer, type LightingLayerOptions } from './layers/lighting.ts'
import { PointLight, RayLighting } from '../lighting/ray-lighting.ts'
import type { Rect } from '../core/geometry.ts'

function createTestSetup(solids: Rect[] = [], options: LightingLayerOptions = {}) {
    const lighting = new RayLighting(solids)
    const layer = new LightingLayer(lighting, 320, 240, options)
    const renderer = new FakeRenderer()
    return { lighting, layer, renderer }
}

Deno.test('LightingLayer - renders ambient veil when no lights', () => {
    const { layer, renderer } = createTestSetup()
    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }

    layer.update(0.016)
    layer.render({ renderer, camera })

    const commands = renderer.getCommands()
    const types = commands.map((c) => c.type)

    assertEquals(types.includes('fillRect'), true)
    assertEquals(types.includes('fillTriangleFan'), false)
    assertEquals(types.includes('drawRenderTarget'), false)
})

Deno.test('LightingLayer - pass order: ambient veil -> light polygon -> local glow', () => {
    const { layer, renderer } = createTestSetup()
    const sun = new PointLight({ position: { x: 160, y: 120 }, radius: 220 })
    const local = new PointLight({ position: { x: 180, y: 130 }, radius: 90 })
    layer.addLight(sun)
    layer.addLight(local)

    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }
    layer.update(0.016)
    layer.render({ renderer, camera })

    const commands = renderer.getCommands()
    const types = commands.map((c) => c.type)

    const ambientIdx = types.indexOf('fillRect')
    const polygonIdx = types.indexOf('fillTriangleFan')
    const gradientFanIdx = types.indexOf('fillRadialGradientFan')

    assert(polygonIdx > ambientIdx, 'light polygon should come after ambient veil')
    assert(gradientFanIdx > polygonIdx, 'local glow should come after light polygon')
})

Deno.test('LightingLayer - draws light shafts as alpha polygons', () => {
    const { layer, renderer } = createTestSetup()
    const light = new PointLight({ position: { x: 160, y: 120 }, radius: 220 })
    layer.addLight(light)

    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }
    layer.update(0.016)
    layer.render({ renderer, camera })

    const polygons = renderer.getCommandsByType('fillTriangleFan')
    assertEquals(polygons.length, 1)
    assertEquals(polygons[0].color.r, 255)
    assertEquals(polygons[0].color.g, 240)
    assertEquals(polygons[0].color.b, 180)
    assert(Math.abs(polygons[0].color.a - 0.198) < 0.000001)
})

Deno.test('LightingLayer - local glow lights do not draw shaft polygons by default', () => {
    const { layer, renderer } = createTestSetup()
    const light = new PointLight({ position: { x: 160, y: 120 }, radius: 90 })
    layer.addLight(light)

    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }
    layer.update(0.016)
    layer.render({ renderer, camera })

    assertEquals(renderer.getCommandsByType('fillTriangleFan').length, 0)
    assertEquals(renderer.getCommandsByType('fillRadialGradientFan').length, 1)
})

Deno.test('LightingLayer - camera offset is applied to light positions', () => {
    const { layer, renderer } = createTestSetup()
    const light = new PointLight({ position: { x: 200, y: 150 }, radius: 80 })
    layer.addLight(light)

    const camera: Rect = { x: 50, y: 30, width: 320, height: 240 }
    layer.update(0.016)
    layer.render({ renderer, camera })

    const fans = renderer.getCommandsByType('fillRadialGradientFan')
    assert(fans.length > 0, 'should have at least one radial gradient fan')
    // Light at (200,150), camera at (50,30) -> screen position (150, 120)
    assertEquals(fans[0].center.x, 150)
    assertEquals(fans[0].center.y, 120)
})

Deno.test('LightingLayer - culls off-screen lights', () => {
    const { layer, renderer } = createTestSetup()
    const light = new PointLight({ position: { x: 5000, y: 5000 }, radius: 80 })
    layer.addLight(light)

    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }
    layer.update(0.016)
    layer.render({ renderer, camera })

    const fans = renderer.getCommandsByType('fillRadialGradientFan')
    const polygons = renderer.getCommandsByType('fillTriangleFan')
    assertEquals(fans.length, 0)
    assertEquals(polygons.length, 0)
    assertEquals(layer.activeSunCount, 0)
})

Deno.test('LightingLayer - debug data reflects active lights', () => {
    const { layer } = createTestSetup()
    const lightA = new PointLight({ position: { x: 100, y: 100 }, radius: 60 })
    const lightB = new PointLight({ position: { x: 200, y: 100 }, radius: 60 })
    layer.addLight(lightA)
    layer.addLight(lightB)
    layer.setCameraProvider(() => ({ x: 0, y: 0, width: 320, height: 240 }))

    layer.update(0.016)

    assertEquals(layer.activeSunCount, 2)
    assertEquals(layer.totalSunCount, 2)
    assertEquals(layer.activeSunData.length, 2)
    assert(layer.activeSunData[0].polygon.length > 0)
})

Deno.test('LightingLayer - inactive lights are skipped', () => {
    const { layer } = createTestSetup()
    const light = new PointLight({ position: { x: 100, y: 100 }, radius: 60, active: false })
    layer.addLight(light)
    layer.setCameraProvider(() => ({ x: 0, y: 0, width: 320, height: 240 }))

    layer.update(0.016)

    assertEquals(layer.activeSunCount, 0)
    assertEquals(layer.totalSunCount, 1)
})
