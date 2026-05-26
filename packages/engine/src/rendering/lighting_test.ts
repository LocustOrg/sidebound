/**
 * Tests for LightingLayer render pipeline behavior using the fake renderer.
 * Validates: pass order, camera offset handling, light culling, debug data stability.
 */

import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts'
import { FakeRenderer } from './fake-renderer.ts'
import { LightingLayer } from './layers/lighting.ts'
import { PointLight, RayLighting } from '../lighting/ray-lighting.ts'
import type { Rect } from '../core/geometry.ts'

function createTestSetup(solids: Rect[] = []) {
    const lighting = new RayLighting(solids)
    const layer = new LightingLayer(lighting, 320, 240, {})
    const renderer = new FakeRenderer()
    return { lighting, layer, renderer }
}

Deno.test('LightingLayer - renders ambient fill when no lights', () => {
    const { layer, renderer } = createTestSetup()
    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }

    layer.update(0.016)
    layer.render({ renderer, camera })

    const commands = renderer.getCommands()
    const types = commands.map((c) => c.type)

    assertEquals(types.includes('createRenderTarget'), true)
    assertEquals(types.includes('setRenderTarget'), true)
    assertEquals(types.includes('clear'), true)
    assertEquals(types.includes('drawRenderTarget'), true)
})

Deno.test('LightingLayer - pass order: target → clear → lights → composite', () => {
    const { layer, renderer } = createTestSetup()
    const light = new PointLight({ position: { x: 160, y: 120 }, radius: 100 })
    layer.addLight(light)

    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }
    layer.update(0.016)
    layer.render({ renderer, camera })

    const commands = renderer.getCommands()
    const types = commands.map((c) => c.type)

    const setTargetIdx = types.indexOf('setRenderTarget')
    const clearIdx = types.indexOf('clear')
    const gradientFanIdx = types.indexOf('fillRadialGradientFan')
    const drawRTIdx = types.indexOf('drawRenderTarget')

    assert(clearIdx > setTargetIdx, 'clear should come after setRenderTarget')
    assert(gradientFanIdx > clearIdx, 'light drawing should come after clear')
    assert(drawRTIdx > gradientFanIdx, 'composite should come after light drawing')
})

Deno.test('LightingLayer - composites with multiply blend mode', () => {
    const { layer, renderer } = createTestSetup()
    const light = new PointLight({ position: { x: 160, y: 120 }, radius: 100 })
    layer.addLight(light)

    const camera: Rect = { x: 0, y: 0, width: 320, height: 240 }
    layer.update(0.016)
    layer.render({ renderer, camera })

    const drawRT = renderer.getCommandsByType('drawRenderTarget')
    assertEquals(drawRT.length, 1)
    assertEquals(drawRT[0].blendMode, 'multiply')
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
    // Light at (200,150), camera at (50,30) → screen position (150, 120)
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
    assertEquals(fans.length, 0)
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

