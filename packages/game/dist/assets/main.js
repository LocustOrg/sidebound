function rect(bounds) {
    return {
        x: bounds[0],
        y: bounds[1],
        width: bounds[2],
        height: bounds[3]
    };
}
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}
function approach(current, target, amount) {
    if (current < target) {
        return Math.min(current + amount, target);
    }
    return Math.max(current - amount, target);
}
function smooth(current, next, strength) {
    if (current === 0) {
        return next;
    }
    return current + (next - current) * strength;
}
function smoothDamp(current, target, velocity, smoothTime, maxSpeed, deltaSeconds) {
    const safeSmoothTime = Math.max(0.0001, smoothTime);
    const omega = 2 / safeSmoothTime;
    const x = omega * deltaSeconds;
    const exponential = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const originalTarget = target;
    const maxChange = maxSpeed * safeSmoothTime;
    const change = clamp(current - target, -maxChange, maxChange);
    const adjustedTarget = current - change;
    const temporaryVelocity = (velocity + omega * change) * deltaSeconds;
    let nextVelocity = (velocity - omega * temporaryVelocity) * exponential;
    let nextValue = adjustedTarget + (change + temporaryVelocity) * exponential;
    if (originalTarget - current > 0 === nextValue > originalTarget) {
        nextValue = originalTarget;
        nextVelocity = 0;
    }
    return {
        value: nextValue,
        velocity: nextVelocity
    };
}
function cross(left, right) {
    return left.x * right.y - left.y * right.x;
}
function rectsIntersect(left, right) {
    return left.x < right.x + right.width && left.x + left.width > right.x && left.y < right.y + right.height && left.y + left.height > right.y;
}
class EngineLoop {
    clock;
    updateFrame;
    renderFrame;
    maxDeltaSeconds;
    frameId;
    lastFrameTime = 0;
    disposed = false;
    constructor(options){
        this.clock = options.clock;
        this.updateFrame = options.update;
        this.renderFrame = options.render;
        this.maxDeltaSeconds = options.maxDeltaSeconds ?? 0.25;
    }
    get running() {
        return this.frameId !== undefined;
    }
    start() {
        if (this.disposed) {
            throw new Error('Cannot start a disposed EngineLoop');
        }
        if (this.frameId !== undefined) {
            return;
        }
        this.lastFrameTime = this.clock.now();
        this.frameId = this.clock.requestFrame(this.tick);
    }
    stop() {
        if (this.frameId === undefined) {
            return;
        }
        this.clock.cancelFrame(this.frameId);
        this.frameId = undefined;
    }
    dispose() {
        this.stop();
        this.disposed = true;
    }
    tick = (now)=>{
        if (this.frameId === undefined) {
            return;
        }
        const deltaSeconds = Math.min((now - this.lastFrameTime) / 1000, this.maxDeltaSeconds);
        const frame = {
            now,
            deltaSeconds
        };
        this.lastFrameTime = now;
        this.updateFrame(frame);
        this.renderFrame?.(frame);
        this.frameId = this.clock.requestFrame(this.tick);
    };
}
class RenderPipeline {
    layers = [];
    sorted = true;
    addLayer(layer) {
        this.layers.push(layer);
        this.sorted = false;
        return this;
    }
    removeLayer(layer) {
        const index = this.layers.indexOf(layer);
        if (index !== -1) {
            this.layers.splice(index, 1);
        }
    }
    clear() {
        this.layers.length = 0;
        this.sorted = true;
    }
    getLayers() {
        this.ensureSorted();
        return this.layers;
    }
    update(deltaSeconds) {
        this.ensureSorted();
        for (const layer of this.layers){
            layer.update?.(deltaSeconds);
        }
    }
    render(frame) {
        this.ensureSorted();
        for (const layer of this.layers){
            layer.render(frame);
        }
    }
    ensureSorted() {
        if (this.sorted) {
            return;
        }
        this.layers.sort((left, right)=>left.order - right.order);
        this.sorted = true;
    }
}
class LightingLayer {
    order = 30;
    lighting;
    viewportWidth;
    viewportHeight;
    ambientColor;
    cullPadding;
    sources = [];
    cachedLights = [];
    lastCamera = {
        x: 0,
        y: 0,
        width: 0,
        height: 0
    };
    cameraProvider = null;
    cachedPolygon = [];
    cachedOrigin = {
        x: 0,
        y: 0
    };
    cachedRadius = 0;
    lastRayMs = 0;
    lastRays = 0;
    lastRayChecks = 0;
    constructor(lighting, viewportWidth, viewportHeight, options){
        this.lighting = lighting;
        this.viewportWidth = viewportWidth;
        this.viewportHeight = viewportHeight;
        this.ambientColor = options.ambientColor ?? {
            r: 8,
            g: 6,
            b: 18,
            a: 0.82
        };
        this.cullPadding = options.cullPadding ?? 300;
    }
    addLight(source) {
        this.sources.push(source);
    }
    removeLight(source) {
        const index = this.sources.indexOf(source);
        if (index !== -1) {
            this.sources.splice(index, 1);
        }
    }
    setCameraProvider(provider) {
        this.cameraProvider = provider;
    }
    get activeSunCount() {
        return this.cachedLights.length;
    }
    get totalSunCount() {
        return this.sources.length;
    }
    get activeSunData() {
        return this.cachedLights;
    }
    update(_deltaSeconds) {
        if (this.cameraProvider) {
            this.lastCamera = this.cameraProvider();
        }
        const camera = this.lastCamera;
        const start = performance.now();
        let totalRays = 0;
        let totalChecks = 0;
        this.cachedLights = [];
        for (const source of this.sources){
            if (!source.isLightActive()) continue;
            const pos = source.getPosition();
            const radius = source.getLightRadius();
            if (pos.x + radius < camera.x - this.cullPadding || pos.x - radius > camera.x + camera.width + this.cullPadding || pos.y + radius < camera.y - this.cullPadding || pos.y - radius > camera.y + camera.height + this.cullPadding) {
                continue;
            }
            const result = this.lighting.cast(pos, radius);
            totalRays += result.rays;
            totalChecks += result.rayChecks;
            this.cachedLights.push({
                polygon: result.polygon,
                origin: pos,
                radius,
                color: source.getLightColor(),
                intensity: source.getLightIntensity()
            });
        }
        this.lastRayMs = performance.now() - start;
        this.lastRays = totalRays;
        this.lastRayChecks = totalChecks;
        if (this.cachedLights.length > 0) {
            this.cachedPolygon = this.cachedLights[0].polygon;
            this.cachedOrigin = this.cachedLights[0].origin;
            this.cachedRadius = this.cachedLights[0].radius;
        }
    }
    render(frame) {
        const { camera } = frame;
        this.lastCamera = camera;
        const viewRect = {
            x: camera.x,
            y: camera.y,
            width: this.viewportWidth,
            height: this.viewportHeight
        };
        if (this.cachedLights.length === 0) {
            frame.renderer.fillRect(viewRect, this.ambientColor);
            return;
        }
        frame.renderer.fillRect(viewRect, this.ambientColor);
        for (const light of this.cachedLights){
            frame.renderer.drawPolygon(light.polygon, {
                r: light.color.r,
                g: light.color.g,
                b: light.color.b,
                a: light.intensity * 0.16
            });
        }
    }
}
const defaultSideViewCameraSettings = {
    horizontalDeadZone: 36,
    verticalDeadZone: 20,
    idleLookAheadDistance: 12,
    movingLookAheadDistance: 34,
    lookAheadResponse: 6.5,
    focusHeightRatio: 0.34,
    anchorHeightRatio: 0.64,
    smoothTimeX: 0.22,
    smoothTimeY: 0.32,
    maxSpeed: 420,
    recoilMovingSpeed: 42,
    recoilStoppedSpeed: 8,
    recoilImpulse: 130,
    recoilSpring: 72,
    recoilDamping: 12,
    maxRecoil: 14
};
function createCameraState() {
    return {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        lookAhead: 0,
        recoilX: 0,
        recoilVelocityX: 0,
        lastMoveDirection: 1,
        wasMovingFast: false
    };
}
class SideViewCamera {
    state = createCameraState();
    world;
    viewport;
    settings;
    constructor(world, viewport, settings = {}){
        this.world = world;
        this.viewport = viewport;
        this.settings = {
            ...defaultSideViewCameraSettings,
            ...settings
        };
    }
    snapToTarget(target) {
        this.state.lookAhead = target.facing * this.settings.idleLookAheadDistance;
        const next = this.getTarget(target);
        this.state.x = next.x;
        this.state.y = next.y;
        this.state.vx = 0;
        this.state.vy = 0;
        this.state.recoilX = 0;
        this.state.recoilVelocityX = 0;
        this.state.lastMoveDirection = target.facing;
        this.state.wasMovingFast = false;
    }
    snapToPlayer(player) {
        this.snapToTarget(player);
    }
    update(deltaSeconds, target) {
        const speedRatio = clamp(Math.abs(target.vx) / 72, 0, 1);
        const lookAheadDistance = this.settings.idleLookAheadDistance + (this.settings.movingLookAheadDistance - this.settings.idleLookAheadDistance) * speedRatio;
        const targetLookAhead = target.facing * lookAheadDistance;
        const lookAheadSmoothing = 1 - Math.exp(-deltaSeconds * this.settings.lookAheadResponse);
        this.state.lookAhead += (targetLookAhead - this.state.lookAhead) * lookAheadSmoothing;
        this.updateRecoil(deltaSeconds, target);
        const nextTarget = this.getTarget(target);
        const recoiledTargetX = clamp(nextTarget.x + this.state.recoilX, 0, Math.max(0, this.world.width - this.viewport.width));
        const nextX = smoothDamp(this.state.x, recoiledTargetX, this.state.vx, this.settings.smoothTimeX, this.settings.maxSpeed, deltaSeconds);
        const nextY = smoothDamp(this.state.y, nextTarget.y, this.state.vy, this.settings.smoothTimeY, this.settings.maxSpeed, deltaSeconds);
        this.state.x = nextX.value;
        this.state.y = nextY.value;
        this.state.vx = nextX.velocity;
        this.state.vy = nextY.velocity;
    }
    getRect() {
        return {
            x: Math.round(this.state.x),
            y: Math.round(this.state.y),
            width: this.viewport.width,
            height: this.viewport.height
        };
    }
    worldToViewport(point) {
        const camera = this.getRect();
        return {
            x: point.x - camera.x,
            y: point.y - camera.y
        };
    }
    viewportToWorld(point) {
        const camera = this.getRect();
        return {
            x: point.x + camera.x,
            y: point.y + camera.y
        };
    }
    updateRecoil(deltaSeconds, target) {
        const speed = Math.abs(target.vx);
        if (speed > this.settings.recoilMovingSpeed) {
            this.state.lastMoveDirection = Math.sign(target.vx);
            this.state.wasMovingFast = true;
        } else if (this.state.wasMovingFast && speed < this.settings.recoilStoppedSpeed) {
            this.state.recoilVelocityX += this.state.lastMoveDirection * this.settings.recoilImpulse;
            this.state.wasMovingFast = false;
        }
        const recoilAcceleration = -this.state.recoilX * this.settings.recoilSpring - this.state.recoilVelocityX * this.settings.recoilDamping;
        this.state.recoilVelocityX += recoilAcceleration * deltaSeconds;
        this.state.recoilX = clamp(this.state.recoilX + this.state.recoilVelocityX * deltaSeconds, -this.settings.maxRecoil, this.settings.maxRecoil);
    }
    getTarget(target) {
        const focusX = target.x + target.width / 2 + this.state.lookAhead;
        const focusY = target.y + target.height * this.settings.focusHeightRatio;
        const cameraCenterX = this.state.x + this.viewport.width / 2;
        const cameraAnchorY = this.state.y + this.viewport.height * this.settings.anchorHeightRatio;
        let targetX = this.state.x;
        let targetY = this.state.y;
        if (focusX < cameraCenterX - this.settings.horizontalDeadZone) {
            targetX = focusX + this.settings.horizontalDeadZone - this.viewport.width / 2;
        } else if (focusX > cameraCenterX + this.settings.horizontalDeadZone) {
            targetX = focusX - this.settings.horizontalDeadZone - this.viewport.width / 2;
        }
        if (focusY < cameraAnchorY - this.settings.verticalDeadZone) {
            targetY = focusY + this.settings.verticalDeadZone - this.viewport.height * this.settings.anchorHeightRatio;
        } else if (focusY > cameraAnchorY + this.settings.verticalDeadZone) {
            targetY = focusY - this.settings.verticalDeadZone - this.viewport.height * this.settings.anchorHeightRatio;
        }
        return {
            x: clamp(targetX, 0, Math.max(0, this.world.width - this.viewport.width)),
            y: clamp(targetY, 0, Math.max(0, this.world.height - this.viewport.height))
        };
    }
}
const defaultMovementKeys = new Set([
    'arrowup',
    'arrowdown',
    'arrowleft',
    'arrowright',
    'w',
    'a',
    's',
    'd',
    ' '
]);
const defaultJumpKeys = new Set([
    'arrowup',
    'w',
    ' '
]);
class InputManager {
    source;
    blockedBy;
    movementKeys;
    jumpKeys;
    pressedKeys = new Set();
    jumpQueued = false;
    active = false;
    constructor(options){
        this.source = options.source;
        this.blockedBy = options.blockedBy;
        this.movementKeys = options.movementKeys ?? defaultMovementKeys;
        this.jumpKeys = options.jumpKeys ?? defaultJumpKeys;
    }
    start() {
        if (this.active) {
            return;
        }
        this.source.addEventListener('keydown', this.handleKeyDown);
        this.source.addEventListener('keyup', this.handleKeyUp);
        this.active = true;
    }
    stop() {
        if (!this.active) {
            return;
        }
        this.source.removeEventListener('keydown', this.handleKeyDown);
        this.source.removeEventListener('keyup', this.handleKeyUp);
        this.pressedKeys.clear();
        this.jumpQueued = false;
        this.active = false;
    }
    readPlayerFrame() {
        const horizontal = Number(this.pressedKeys.has('arrowright') || this.pressedKeys.has('d')) - Number(this.pressedKeys.has('arrowleft') || this.pressedKeys.has('a'));
        const jumpQueued = this.jumpQueued;
        const jumpHeld = this.pressedKeys.has('arrowup') || this.pressedKeys.has('w') || this.pressedKeys.has(' ');
        const downHeld = this.pressedKeys.has('arrowdown') || this.pressedKeys.has('s');
        this.jumpQueued = false;
        return {
            horizontal,
            jumpQueued,
            jumpHeld,
            downHeld
        };
    }
    isPressed(key) {
        return this.pressedKeys.has(key.toLowerCase());
    }
    handleKeyDown = (event)=>{
        if (!this.shouldUseGameInput(event)) {
            return;
        }
        const key = event.key.toLowerCase();
        if (this.movementKeys.has(key)) {
            event.preventDefault?.();
        }
        this.pressedKeys.add(key);
        if (this.jumpKeys.has(key) && !event.repeat) {
            this.jumpQueued = true;
        }
    };
    handleKeyUp = (event)=>{
        this.pressedKeys.delete(event.key.toLowerCase());
    };
    shouldUseGameInput(event) {
        return !this.blockedBy?.contains(event.target);
    }
}
new Set([
    'arrowup',
    'w',
    ' '
]);
const fullCircleRadians = Math.PI * 2;
function normalizeAngle(angle) {
    return (angle % fullCircleRadians + fullCircleRadians) % fullCircleRadians;
}
function addRayAngle(angles, angleKeys, angle) {
    const normalizedAngle = normalizeAngle(angle);
    const key = Math.round(normalizedAngle * 100_000);
    if (angleKeys.has(key)) {
        return;
    }
    angleKeys.add(key);
    angles.push(normalizedAngle);
}
function addEndpointAngles(angles, angleKeys, origin, x, y) {
    const angle = Math.atan2(y - origin.y, x - origin.x);
    addRayAngle(angles, angleKeys, angle - 0.00045);
    addRayAngle(angles, angleKeys, angle);
    addRayAngle(angles, angleKeys, angle + 0.00045);
}
function distanceSquaredToSegment(point, segment) {
    const segmentX = segment.x2 - segment.x1;
    const segmentY = segment.y2 - segment.y1;
    const lengthSquared = segmentX * segmentX + segmentY * segmentY;
    if (lengthSquared === 0) {
        const dx = point.x - segment.x1;
        const dy = point.y - segment.y1;
        return dx * dx + dy * dy;
    }
    const t = clamp(((point.x - segment.x1) * segmentX + (point.y - segment.y1) * segmentY) / lengthSquared, 0, 1);
    const closestX = segment.x1 + t * segmentX;
    const closestY = segment.y1 + t * segmentY;
    const dx = point.x - closestX;
    const dy = point.y - closestY;
    return dx * dx + dy * dy;
}
function segmentTouchesCircle(segment, origin, radius) {
    return distanceSquaredToSegment(origin, segment) <= radius * radius;
}
function intersectRaySegment(origin, angle, segment) {
    const rayDirection = {
        x: Math.cos(angle),
        y: Math.sin(angle)
    };
    const segmentDirection = {
        x: segment.x2 - segment.x1,
        y: segment.y2 - segment.y1
    };
    const denominator = cross(rayDirection, segmentDirection);
    if (Math.abs(denominator) < 0.000001) {
        return undefined;
    }
    const originToSegment = {
        x: segment.x1 - origin.x,
        y: segment.y1 - origin.y
    };
    const rayDistance = cross(originToSegment, segmentDirection) / denominator;
    const segmentDistance = cross(originToSegment, rayDirection) / denominator;
    if (rayDistance < 0 || segmentDistance < 0 || segmentDistance > 1) {
        return undefined;
    }
    return {
        x: origin.x + rayDirection.x * rayDistance,
        y: origin.y + rayDirection.y * rayDistance,
        angle,
        distance: rayDistance
    };
}
function buildOccluderSegments(rects) {
    return rects.flatMap((rect)=>[
            {
                x1: rect.x,
                y1: rect.y,
                x2: rect.x + rect.width,
                y2: rect.y
            },
            {
                x1: rect.x + rect.width,
                y1: rect.y,
                x2: rect.x + rect.width,
                y2: rect.y + rect.height
            },
            {
                x1: rect.x + rect.width,
                y1: rect.y + rect.height,
                x2: rect.x,
                y2: rect.y + rect.height
            },
            {
                x1: rect.x,
                y1: rect.y + rect.height,
                x2: rect.x,
                y2: rect.y
            }
        ]);
}
class OccluderSegmentIndex {
    segments;
    constructor(segments){
        this.segments = segments;
    }
    queryCircle(origin, radius) {
        return this.segments.filter((segment)=>segmentTouchesCircle(segment, origin, radius));
    }
}
class RayLighting {
    occluders;
    constructor(solids){
        this.occluders = new OccluderSegmentIndex(buildOccluderSegments(solids));
    }
    cast(origin, radius) {
        const activeSegments = this.occluders.queryCircle(origin, radius);
        const angleKeys = new Set();
        const angles = [];
        for(let index = 0; index < 128; index += 1){
            addRayAngle(angles, angleKeys, index / 128 * fullCircleRadians);
        }
        for (const segment of activeSegments){
            addEndpointAngles(angles, angleKeys, origin, segment.x1, segment.y1);
            addEndpointAngles(angles, angleKeys, origin, segment.x2, segment.y2);
        }
        const hits = [];
        let rayChecks = 0;
        for (const angle of angles){
            let closestHit;
            for (const segment of activeSegments){
                rayChecks += 1;
                const hit = intersectRaySegment(origin, angle, segment);
                if (!hit || hit.distance > radius) {
                    continue;
                }
                if (!closestHit || hit.distance < closestHit.distance) {
                    closestHit = hit;
                }
            }
            if (closestHit) {
                hits.push(closestHit);
            } else {
                hits.push({
                    x: origin.x + Math.cos(angle) * radius,
                    y: origin.y + Math.sin(angle) * radius,
                    angle,
                    distance: radius
                });
            }
        }
        return {
            polygon: hits.sort((left, right)=>left.angle - right.angle),
            rays: angles.length,
            rayChecks
        };
    }
}
class PointLight {
    position;
    radius;
    color;
    intensity;
    active;
    constructor(options){
        this.position = {
            ...options.position
        };
        this.radius = options.radius;
        this.color = options.color ?? {
            r: 255,
            g: 240,
            b: 180
        };
        this.intensity = options.intensity ?? 0.9;
        this.active = options.active ?? true;
    }
    getPosition() {
        return this.position;
    }
    getLightRadius() {
        return this.radius;
    }
    getLightColor() {
        return this.color;
    }
    getLightIntensity() {
        return this.intensity;
    }
    isLightActive() {
        return this.active;
    }
    setPosition(position) {
        this.position = position;
    }
    setRadius(radius) {
        this.radius = radius;
    }
    setColor(color) {
        this.color = color;
    }
    setIntensity(intensity) {
        this.intensity = intensity;
    }
    setActive(active) {
        this.active = active;
    }
}
class AttachedLight {
    positionProvider;
    radius;
    color;
    intensity;
    active;
    constructor(options){
        this.positionProvider = options.positionProvider;
        this.radius = options.radius;
        this.color = options.color ?? {
            r: 200,
            g: 220,
            b: 255
        };
        this.intensity = options.intensity ?? 0.9;
        this.active = options.active ?? true;
    }
    getPosition() {
        return this.positionProvider();
    }
    getLightRadius() {
        return this.radius;
    }
    getLightColor() {
        return this.color;
    }
    getLightIntensity() {
        return this.intensity;
    }
    isLightActive() {
        return this.active;
    }
    setRadius(radius) {
        this.radius = radius;
    }
    setColor(color) {
        this.color = color;
    }
    setIntensity(intensity) {
        this.intensity = intensity;
    }
    setActive(active) {
        this.active = active;
    }
}
function defineWorld(definition) {
    return definition;
}
function defineRegion(definition) {
    return definition;
}
function defineLocation(definition) {
    return definition;
}
function chunkedTilemap(path, options) {
    return {
        kind: 'chunked',
        path,
        ...options
    };
}
function edgeConnection(side, options) {
    return {
        kind: 'edge',
        edge: side,
        ...options
    };
}
function getSpawnPoint(location, spawnId) {
    return location.spawnPoints[spawnId];
}
function pointFromSpawn(spawn) {
    if ('x' in spawn) {
        return spawn;
    }
    return {
        x: spawn[0],
        y: spawn[1]
    };
}
function pointInsideRect(point, bounds) {
    return point.x >= bounds.x && point.x <= bounds.x + bounds.width && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}
function rectInsideRect(inner, outer) {
    return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}
function validateWorldDefinition(world) {
    const errors = [];
    const regionIds = new Set();
    const locations = new Map();
    for (const regionDef of world.regions){
        if (regionIds.has(regionDef.id)) {
            errors.push(`Duplicate region id '${regionDef.id}'`);
        }
        regionIds.add(regionDef.id);
        for (const location of regionDef.locations){
            if (locations.has(location.id)) {
                errors.push(`Duplicate location id '${location.id}'`);
            }
            if (location.region !== regionDef.id) {
                errors.push(`Location '${location.id}' declares region '${location.region}' but is registered under region '${regionDef.id}'`);
            }
            locations.set(location.id, location);
        }
    }
    const startLocation = locations.get(world.start.location);
    if (!startLocation) {
        errors.push(`World start references unknown location '${world.start.location}'`);
    } else if (!getSpawnPoint(startLocation, world.start.spawn)) {
        errors.push(`World start references unknown spawn '${world.start.spawn}' in location '${world.start.location}'`);
    }
    for (const location of locations.values()){
        const connectionIds = new Set();
        for (const [spawnId, spawn] of Object.entries(location.spawnPoints)){
            if (!pointInsideRect(pointFromSpawn(spawn), location.bounds)) {
                errors.push(`Location '${location.id}' spawn '${spawnId}' is outside location bounds`);
            }
        }
        for (const locationConnection of location.connections ?? []){
            if (connectionIds.has(locationConnection.id)) {
                errors.push(`Location '${location.id}' has duplicate connection id '${locationConnection.id}'`);
            }
            connectionIds.add(locationConnection.id);
            const targetLocation = locations.get(locationConnection.to.location);
            if (!targetLocation) {
                errors.push(`Location '${location.id}' connection '${locationConnection.id}' targets unknown location '${locationConnection.to.location}'`);
            } else if (!getSpawnPoint(targetLocation, locationConnection.to.spawn)) {
                errors.push(`Location '${location.id}' connection '${locationConnection.id}' targets unknown spawn '${locationConnection.to.spawn}' in location '${locationConnection.to.location}'`);
            }
            if (locationConnection.trigger && !rectInsideRect(locationConnection.trigger, location.bounds)) {
                errors.push(`Location '${location.id}' connection '${locationConnection.id}' trigger is outside location bounds`);
            }
        }
    }
    return errors;
}
function assertValidWorldDefinition(world) {
    const errors = validateWorldDefinition(world);
    if (errors.length > 0) {
        throw new Error(`World validation failed:\n${errors.map((error)=>`- ${error}`).join('\n')}`);
    }
}
class TileRegistry {
    tiles = new Map();
    register(definition) {
        if (definition.glyph.length !== 1) {
            throw new Error(`Glyph must be a single character, got "${definition.glyph}"`);
        }
        if (!definition.spawn && !definition.material) {
            throw new Error(`Tile "${definition.glyph}" must define a material or mark itself as spawn.`);
        }
        this.tiles.set(definition.glyph, definition);
        return this;
    }
    get(glyph) {
        return this.tiles.get(glyph);
    }
    has(glyph) {
        return this.tiles.has(glyph);
    }
    glyphs() {
        return [
            ...this.tiles.keys()
        ];
    }
}
const emptyGlyph = ' ';
function toWorldRect(area, tileSize) {
    return {
        x: area.x * tileSize,
        y: area.y * tileSize,
        width: area.width * tileSize,
        height: area.height * tileSize
    };
}
function toTileRect(x, y, tileSize) {
    return {
        x: x * tileSize,
        y: y * tileSize,
        width: tileSize,
        height: tileSize
    };
}
function createVerticalBarLightOccluders(x, y, tileSize) {
    const left = x * tileSize;
    const top = y * tileSize;
    const bar = Math.max(2, Math.round(tileSize * 0.12));
    const center = left + Math.floor((tileSize - bar) / 2);
    return [
        {
            x: center,
            y: top,
            width: bar,
            height: tileSize
        }
    ];
}
function mergeGrid(grid) {
    const height = grid.length;
    if (height === 0) return [];
    const width = grid[0].length;
    const areas = [];
    let active = new Map();
    for(let y = 0; y < height; y++){
        const next = new Map();
        let x = 0;
        while(x < width){
            if (!grid[y][x]) {
                x++;
                continue;
            }
            const start = x;
            while(x < width && grid[y][x])x++;
            const key = `${start}:${x - start}`;
            const prev = active.get(key);
            if (prev && prev.y + prev.height === y) {
                prev.height++;
                next.set(key, prev);
            } else {
                next.set(key, {
                    x: start,
                    y,
                    width: x - start,
                    height: 1
                });
            }
        }
        for (const [key, area] of active){
            if (!next.has(key)) areas.push(area);
        }
        active = next;
    }
    for (const area of active.values())areas.push(area);
    return areas;
}
class TileMapBuilder {
    rows;
    _tileSize = 28;
    constructor(rows){
        this.rows = rows;
    }
    static from(rows) {
        return new TileMapBuilder(rows);
    }
    static fromSketch(sketch) {
        const rows = sketch.split('\n').filter((r)=>r.trimEnd().length > 0);
        return new TileMapBuilder(rows);
    }
    withTileSize(size) {
        this._tileSize = size;
        return this;
    }
    build(registry) {
        const trimmed = this.rows.map((r)=>r.trimEnd());
        const maxWidth = trimmed.reduce((max, r)=>Math.max(max, r.length), 0);
        if (maxWidth === 0) {
            throw new Error('Map has no content');
        }
        const padded = trimmed.map((r)=>r.padEnd(maxWidth, emptyGlyph));
        const height = padded.length;
        const width = maxWidth;
        const solidGrid = Array.from({
            length: height
        }, ()=>Array(width).fill(false));
        const opaqueLightGrid = Array.from({
            length: height
        }, ()=>Array(width).fill(false));
        const tiles = [];
        const verticalBarLightOccluders = [];
        let spawn;
        for(let y = 0; y < height; y++){
            for(let x = 0; x < width; x++){
                const glyph = padded[y][x];
                if (glyph === emptyGlyph) {
                    continue;
                }
                const definition = registry.get(glyph);
                if (!definition) {
                    throw new Error(`Unknown glyph "${glyph}" at (${x}, ${y}). Register it in TileRegistry first.`);
                }
                if (definition.spawn) {
                    if (spawn) {
                        throw new Error('Map must have exactly one spawn tile.');
                    }
                    spawn = {
                        x: (x + 0.5) * this._tileSize,
                        y: (y + 1) * this._tileSize
                    };
                }
                if (definition.material) {
                    tiles.push({
                        ...toTileRect(x, y, this._tileSize),
                        glyph,
                        material: definition.material
                    });
                }
                if (definition.collision === 'solid') {
                    solidGrid[y][x] = true;
                }
                switch(definition.light ?? 'none'){
                    case 'opaque':
                        opaqueLightGrid[y][x] = true;
                        break;
                    case 'vertical-bar':
                        verticalBarLightOccluders.push(...createVerticalBarLightOccluders(x, y, this._tileSize));
                        break;
                    case 'none':
                        break;
                }
            }
        }
        if (!spawn) {
            throw new Error('Map must have exactly one spawn tile.');
        }
        const spawnTileX = Math.floor(spawn.x / this._tileSize);
        for(let checkY = Math.floor(spawn.y / this._tileSize); checkY < height; checkY++){
            if (solidGrid[checkY][spawnTileX]) {
                spawn = {
                    x: spawn.x,
                    y: checkY * this._tileSize
                };
                break;
            }
        }
        return {
            width: width * this._tileSize,
            height: height * this._tileSize,
            spawn,
            solids: mergeGrid(solidGrid).map((a)=>toWorldRect(a, this._tileSize)),
            lightOccluders: [
                ...mergeGrid(opaqueLightGrid).map((a)=>toWorldRect(a, this._tileSize)),
                ...verticalBarLightOccluders
            ],
            tiles,
            sunY: this._tileSize
        };
    }
}
function createFrameDiagnostics() {
    return {
        fps: 0,
        frameMs: 0,
        updateMs: 0,
        renderMs: 0
    };
}
function updateFrameDiagnostics(diagnostics, deltaSeconds, strength = 0.12) {
    diagnostics.frameMs = smooth(diagnostics.frameMs, deltaSeconds * 1000, strength);
    diagnostics.fps = smooth(diagnostics.fps, 1 / Math.max(deltaSeconds, 0.0001), strength);
}
function imageHandle(id) {
    return {
        id,
        kind: 'image'
    };
}
class AssetStore {
    imageDefinitions = new Map();
    images = new Map();
    loader;
    constructor(loader){
        this.loader = loader;
    }
    registerImage(definition) {
        const existing = this.imageDefinitions.get(definition.id);
        if (existing && existing.url !== definition.url) {
            throw new Error(`Image asset '${definition.id}' is already registered with a different URL`);
        }
        this.imageDefinitions.set(definition.id, definition);
        return imageHandle(definition.id);
    }
    registerImages(definitions) {
        for (const definition of definitions){
            this.registerImage(definition);
        }
    }
    loadImage(id) {
        const definition = this.imageDefinitions.get(id);
        if (!definition) {
            throw new Error(`Unknown image asset '${id}'`);
        }
        let image = this.images.get(id);
        if (!image) {
            image = this.loader.loadImage(definition.url).then((loaded)=>({
                    id: definition.id,
                    image: loaded,
                    width: loaded.width,
                    height: loaded.height
                })).catch((error)=>{
                throw new Error(`Failed to load image asset '${definition.id}' from '${definition.url}': ${error instanceof Error ? error.message : String(error)}`, {
                    cause: error
                });
            });
            this.images.set(id, image);
        }
        return image;
    }
    async preloadAll() {
        await Promise.all([
            ...this.imageDefinitions.keys()
        ].map((id)=>this.loadImage(id)));
    }
}
function defineCharacter(definition) {
    return definition;
}
function defineEquipment(definition) {
    return definition;
}
function defineItem(definition) {
    return definition;
}
function registerUnique(map, id, value, label) {
    if (map.has(id)) {
        throw new Error(`Duplicate ${label} id '${id}'`);
    }
    map.set(id, value);
}
function getRequired(map, id, label) {
    const value = map.get(id);
    if (!value) {
        throw new Error(`Unknown ${label} '${id}'`);
    }
    return value;
}
function validateAssetReference(assets, assetId, label, errors) {
    if (!assets.has(assetId)) {
        errors.push(`${label} references unknown image asset '${assetId}'`);
    }
}
function validateSize(size, label, errors) {
    if (!Number.isInteger(size.width) || size.width <= 0) {
        errors.push(`${label} width must be a positive integer`);
    }
    if (!Number.isInteger(size.height) || size.height <= 0) {
        errors.push(`${label} height must be a positive integer`);
    }
}
function validateGrid(grid, label, errors) {
    validateSize(grid, label, errors);
    if (!Number.isInteger(grid.columns) || grid.columns <= 0) {
        errors.push(`${label} frame columns must be a positive integer`);
    }
    if (!Number.isInteger(grid.rows) || grid.rows <= 0) {
        errors.push(`${label} frame rows must be a positive integer`);
    }
}
function validateCharacterClips(character, errors) {
    const frameCount = character.frame.columns * character.frame.rows;
    for (const [clipName, clip] of Object.entries(character.clips)){
        if (clip.frames.length === 0) {
            errors.push(`character '${character.id}' clip '${clipName}' must include at least one frame`);
        }
        if (clip.fps === undefined && clip.frameDuration === undefined) {
            errors.push(`character '${character.id}' clip '${clipName}' must define fps or frameDuration`);
        }
        for (const frame of clip.frames){
            if (!Number.isInteger(frame) || frame < 0 || frame >= frameCount) {
                errors.push(`character '${character.id}' clip '${clipName}' references frame ${frame}, outside 0..${frameCount - 1}`);
            }
        }
    }
}
class ContentRegistry {
    imageAssets = new Map();
    characters = new Map();
    equipment = new Map();
    items = new Map();
    registerImageAsset(definition) {
        registerUnique(this.imageAssets, definition.id, definition, 'image asset');
        return this;
    }
    registerImageAssets(definitions) {
        for (const definition of definitions){
            this.registerImageAsset(definition);
        }
        return this;
    }
    registerCharacter(definition) {
        registerUnique(this.characters, definition.id, definition, 'character');
        return this;
    }
    registerEquipment(definition) {
        registerUnique(this.equipment, definition.id, definition, 'equipment');
        return this;
    }
    registerItem(definition) {
        registerUnique(this.items, definition.id, definition, 'item');
        return this;
    }
    getImageAssets() {
        return [
            ...this.imageAssets.values()
        ];
    }
    getCharacters() {
        return [
            ...this.characters.values()
        ];
    }
    getEquipmentDefinitions() {
        return [
            ...this.equipment.values()
        ];
    }
    getItems() {
        return [
            ...this.items.values()
        ];
    }
    getCharacter(id) {
        return getRequired(this.characters, id, 'character');
    }
    getEquipment(id) {
        return getRequired(this.equipment, id, 'equipment');
    }
    getItem(id) {
        return getRequired(this.items, id, 'item');
    }
    validate() {
        const errors = [];
        for (const character of this.characters.values()){
            validateAssetReference(this.imageAssets, character.atlas, `character '${character.id}' atlas`, errors);
            validateGrid(character.frame, `character '${character.id}'`, errors);
            validateCharacterClips(character, errors);
        }
        for (const equipment of this.equipment.values()){
            if (equipment.layers.length === 0) {
                errors.push(`equipment '${equipment.id}' must define at least one visual layer`);
            }
            for (const layer of equipment.layers){
                validateAssetReference(this.imageAssets, layer.atlas, `equipment '${equipment.id}' layer '${layer.id}'`, errors);
            }
        }
        for (const item of this.items.values()){
            validateAssetReference(this.imageAssets, item.icon, `item '${item.id}' icon`, errors);
            validateSize(item.pickup.size, `item '${item.id}' pickup`, errors);
            for (const effect of item.effects){
                if (!this.equipment.has(effect.equipment)) {
                    errors.push(`item '${item.id}' references unknown equipment '${effect.equipment}'`);
                }
            }
        }
        return errors;
    }
    assertValid() {
        const errors = this.validate();
        if (errors.length > 0) {
            throw new Error(`Content registry validation failed:\n${errors.map((error)=>`- ${error}`).join('\n')}`);
        }
    }
}
function resolveEquipmentLayerOrder(order) {
    switch(order){
        case 'behindBody':
            return 10;
        case 'heldItem':
            return 30;
        case 'frontAccessory':
            return 40;
        default:
            return order;
    }
}
function assertPositiveInteger(name, value) {
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
}
class TextureAtlasLayout {
    frameWidth;
    frameHeight;
    columns;
    rows;
    constructor(options){
        assertPositiveInteger('frameWidth', options.frameWidth);
        assertPositiveInteger('frameHeight', options.frameHeight);
        assertPositiveInteger('columns', options.columns);
        assertPositiveInteger('rows', options.rows);
        this.frameWidth = options.frameWidth;
        this.frameHeight = options.frameHeight;
        this.columns = options.columns;
        this.rows = options.rows;
    }
    get frameCount() {
        return this.columns * this.rows;
    }
    get width() {
        return this.frameWidth * this.columns;
    }
    get height() {
        return this.frameHeight * this.rows;
    }
    frameAt(frameIndex) {
        this.assertFrame(frameIndex);
        return {
            col: frameIndex % this.columns,
            row: Math.floor(frameIndex / this.columns)
        };
    }
    assertFrame(frameIndex) {
        if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= this.frameCount) {
            throw new Error(`Frame ${frameIndex} is outside atlas layout bounds 0..${this.frameCount - 1}`);
        }
    }
}
class SpriteSheet {
    texture;
    layout;
    constructor(options){
        this.texture = options.texture;
        this.layout = new TextureAtlasLayout(options);
    }
    get frameWidth() {
        return this.layout.frameWidth;
    }
    get frameHeight() {
        return this.layout.frameHeight;
    }
    get columns() {
        return this.layout.columns;
    }
    get rows() {
        return this.layout.rows;
    }
    get frameCount() {
        return this.layout.frameCount;
    }
    drawFrame(renderer, frameIndex, x, y, flipX = false) {
        const frame = this.layout.frameAt(frameIndex);
        this.drawFrameAt(renderer, frame.col, frame.row, x, y, flipX);
    }
    drawFrameAt(renderer, col, row, x, y, flipX = false) {
        renderer.drawTexture(this.texture, {
            x: col * this.frameWidth,
            y: row * this.frameHeight,
            width: this.frameWidth,
            height: this.frameHeight
        }, {
            x,
            y,
            width: this.frameWidth,
            height: this.frameHeight
        }, {
            flipX
        });
    }
}
async function loadSpriteSheet(renderer, assetStore, assetId, frameWidth, frameHeight, columns, rows) {
    const image = await assetStore.loadImage(assetId);
    const texture = await renderer.loadTexture(assetId, image.image);
    const layout = new TextureAtlasLayout({
        frameWidth,
        frameHeight,
        columns,
        rows
    });
    if (texture.width !== layout.width || texture.height !== layout.height) {
        throw new Error(`Image asset '${assetId}' is ${texture.width}x${texture.height}, expected ${layout.width}x${layout.height} for ${columns}x${rows} ${frameWidth}x${frameHeight} frames`);
    }
    return new SpriteSheet({
        texture,
        frameWidth,
        frameHeight,
        columns,
        rows
    });
}
function resolveSpriteClipFrameDuration(clip) {
    if (clip.frameDuration !== undefined) {
        return clip.frameDuration;
    }
    if (clip.fps !== undefined && clip.fps > 0) {
        return 1 / clip.fps;
    }
    throw new Error('Animation clip must define a positive fps or frameDuration');
}
function createAnimationClip(name, clip) {
    return {
        name,
        frames: clip.frames,
        frameDuration: resolveSpriteClipFrameDuration(clip),
        loop: clip.loop
    };
}
function createAnimationClips(clips) {
    return Object.entries(clips).map(([name, clip])=>createAnimationClip(name, clip));
}
function registerSpriteAnimationClips(animator, clips, initialClip = 'idle') {
    for (const clip of createAnimationClips(clips)){
        animator.addClip(clip);
    }
    animator.play(initialClip);
}
class SpriteAnimator {
    clips = new Map();
    currentClip = null;
    timer = 0;
    frameIndex = 0;
    finishedClip = false;
    currentPlaybackRate = 1;
    sheet;
    constructor(sheet){
        this.sheet = sheet;
    }
    addClip(clip) {
        for (const frame of clip.frames){
            this.sheet.layout.assertFrame(frame);
        }
        this.clips.set(clip.name, clip);
        return this;
    }
    play(name, force = false) {
        const clip = this.clips.get(name);
        if (!clip) return;
        if (this.currentClip === clip && !force && !this.finishedClip) return;
        this.currentClip = clip;
        this.timer = 0;
        this.frameIndex = 0;
        this.finishedClip = false;
    }
    update(deltaSeconds) {
        if (!this.currentClip || this.finishedClip) return;
        const clip = this.currentClip;
        const scaledDeltaSeconds = deltaSeconds * this.currentPlaybackRate;
        if (scaledDeltaSeconds <= 0 || clip.frameDuration <= 0) {
            return;
        }
        this.timer += scaledDeltaSeconds;
        while(this.timer >= clip.frameDuration){
            this.timer -= clip.frameDuration;
            this.frameIndex += 1;
            if (this.frameIndex < clip.frames.length) continue;
            if (clip.loop) {
                this.frameIndex = 0;
            } else {
                this.frameIndex = clip.frames.length - 1;
                this.finishedClip = true;
                break;
            }
        }
    }
    get currentFrame() {
        if (!this.currentClip) return 0;
        return this.currentClip.frames[this.frameIndex] ?? 0;
    }
    get currentClipName() {
        return this.currentClip?.name ?? '';
    }
    get finished() {
        return this.finishedClip;
    }
    get playbackRate() {
        return this.currentPlaybackRate;
    }
    set playbackRate(value) {
        this.currentPlaybackRate = Number.isFinite(value) ? Math.max(0, value) : 1;
    }
    draw(renderer, x, y, flipX = false) {
        this.sheet.drawFrame(renderer, this.currentFrame, x, y, flipX);
    }
}
class CharacterRenderer {
    draw(options) {
        const layers = this.collectLayers(options.appearance, options.equipment);
        for (const layer of layers){
            if (layer.order >= 20) continue;
            layer.spriteSheet.drawFrame(options.renderer, options.frame, options.x, options.y, options.flipX);
        }
        options.appearance.base.drawFrame(options.renderer, options.frame, options.x, options.y, options.flipX);
        for (const layer of layers){
            if (layer.order < 20) continue;
            layer.spriteSheet.drawFrame(options.renderer, options.frame, options.x, options.y, options.flipX);
        }
    }
    collectLayers(appearance, equipment) {
        const layers = [];
        for (const equipmentId of Object.values(equipment)){
            if (!equipmentId) continue;
            const definition = appearance.equipment[equipmentId];
            layers.push(...definition.visualLayers);
        }
        layers.sort((left, right)=>left.order - right.order || left.id.localeCompare(right.id));
        return layers;
    }
}
function createLoadedEquipmentDefinition(definition, visualLayers) {
    return {
        id: definition.id,
        slot: definition.slot,
        visualLayers: visualLayers.map((layer)=>({
                id: layer.id,
                order: resolveEquipmentLayerOrder(layer.order),
                spriteSheet: layer.spriteSheet
            }))
    };
}
class BrowserAnimationFrameClock {
    now() {
        return performance.now();
    }
    requestFrame(callback) {
        return requestAnimationFrame(callback);
    }
    cancelFrame(frameId) {
        cancelAnimationFrame(frameId);
    }
}
function toCssRgba(color) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
}
class Canvas2DPreviewRenderer {
    context;
    width;
    height;
    textures = new Map();
    constructor(context, width, height){
        this.context = context;
        this.width = width;
        this.height = height;
    }
    beginFrame(clearColor) {
        this.context.save();
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.fillStyle = toCssRgba(clearColor);
        this.context.fillRect(0, 0, this.width, this.height);
        this.context.restore();
    }
    endFrame() {
        return undefined;
    }
    createRenderTarget(id, width, height) {
        return {
            id,
            width,
            height
        };
    }
    setRenderTarget(target) {
        if (target) {
            throw new Error('Canvas preview render targets are not implemented yet');
        }
    }
    loadTexture(id, source) {
        const texture = {
            id,
            width: source.width,
            height: source.height,
            source
        };
        this.textures.set(id, texture);
        return Promise.resolve(texture);
    }
    drawTexture(texture, source, dest, options = {}) {
        const textureSource = this.resolveTextureSource(texture);
        this.context.save();
        this.context.globalAlpha = options.alpha ?? 1;
        if (options.flipX) {
            this.context.translate(dest.x + dest.width, dest.y);
            this.context.scale(-1, 1);
            this.context.drawImage(textureSource, source.x, source.y, source.width, source.height, 0, 0, dest.width, dest.height);
        } else {
            this.context.drawImage(textureSource, source.x, source.y, source.width, source.height, dest.x, dest.y, dest.width, dest.height);
        }
        this.context.restore();
    }
    fillRect(rect, color) {
        this.context.save();
        this.context.fillStyle = toCssRgba(color);
        this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
        this.context.restore();
    }
    strokeRect(rect, color) {
        this.context.save();
        this.context.strokeStyle = toCssRgba(color);
        this.context.strokeRect(rect.x, rect.y, rect.width, rect.height);
        this.context.restore();
    }
    drawLine(from, to, color) {
        this.context.save();
        this.context.strokeStyle = toCssRgba(color);
        this.context.beginPath();
        this.context.moveTo(from.x, from.y);
        this.context.lineTo(to.x, to.y);
        this.context.stroke();
        this.context.restore();
    }
    drawPolygon(points, color) {
        if (points.length < 2) {
            return;
        }
        this.context.save();
        this.context.fillStyle = toCssRgba(color);
        this.context.beginPath();
        this.context.moveTo(points[0].x, points[0].y);
        for(let index = 1; index < points.length; index += 1){
            this.context.lineTo(points[index].x, points[index].y);
        }
        this.context.closePath();
        this.context.fill();
        this.context.restore();
    }
    resolveTextureSource(texture) {
        const loaded = this.textures.get(texture.id);
        if (loaded) {
            if (loaded.source.kind !== 'platform') {
                throw new Error(`Texture '${texture.id}' is not backed by a browser image source`);
            }
            return loaded.source.source;
        }
        throw new Error(`Texture '${texture.id}' has not been loaded`);
    }
}
function toRenderContext(context) {
    return context;
}
function configurePixelCanvas(canvas, width, height, scale = 4, platformScale = 1) {
    const safePlatformScale = Math.max(1, Math.floor(platformScale));
    canvas.width = width * safePlatformScale;
    canvas.height = height * safePlatformScale;
    if (scale !== 'css') {
        canvas.style.width = `${width * scale}px`;
        canvas.style.height = `${height * scale}px`;
    }
    canvas.style.imageRendering = 'pixelated';
}
function createPixelCanvasSurface(options) {
    const { canvas, width, height, scale = 4, background = '#101018' } = options;
    const platformScale = Math.max(1, Math.floor(options.platformScale ?? 1));
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Pixel canvas surface requires a 2D canvas context');
    }
    configurePixelCanvas(canvas, width, height, scale, platformScale);
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(platformScale, 0, 0, platformScale, 0, 0);
    const context = toRenderContext(ctx);
    return {
        canvas,
        context,
        renderer: new Canvas2DPreviewRenderer(context, width, height),
        width,
        height,
        platformScale,
        clear () {
            ctx.save();
            ctx.setTransform(platformScale, 0, 0, platformScale, 0, 0);
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, width, height);
            ctx.restore();
        },
        dispose () {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    };
}
class PixelEngine {
    surface;
    loop;
    constructor(options){
        this.surface = options.surface ?? createPixelCanvasSurface(options);
        this.loop = new EngineLoop({
            clock: options.clock ?? new BrowserAnimationFrameClock(),
            update: ({ deltaSeconds })=>options.loop.update(deltaSeconds),
            render: ()=>{
                this.surface.clear();
                options.loop.render(this.surface.context, this.surface.renderer);
            }
        });
    }
    start() {
        this.loop.start();
    }
    stop() {
        this.loop.stop();
    }
    dispose() {
        this.loop.dispose();
        this.surface.dispose();
    }
}
class PlatformBrowserAdapter {
    loadImage(url) {
        return new Promise((resolve, reject)=>{
            const image = new Image();
            image.onload = ()=>resolve({
                    kind: 'platform',
                    source: image,
                    width: image.width,
                    height: image.height
                });
            image.onerror = ()=>reject(new Error(`Failed to load image from ${url}`));
            image.src = url;
        });
    }
    createOffscreenSurface(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to create offscreen canvas context');
        }
        ctx.imageSmoothingEnabled = false;
        return {
            context: toRenderContext(ctx),
            image: canvas,
            width,
            height
        };
    }
}
function requireElement(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element;
}
class DebugMinimap {
    canvas;
    ctx;
    worldWidth;
    worldHeight;
    tiles;
    sunLights;
    scaleX;
    scaleY;
    staticMap;
    constructor(config){
        this.canvas = config.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.worldWidth = config.worldWidth;
        this.worldHeight = config.worldHeight;
        this.tiles = config.tiles;
        this.sunLights = config.sunLights;
        this.scaleX = this.canvas.width / this.worldWidth;
        this.scaleY = this.canvas.height / this.worldHeight;
        this.staticMap = document.createElement('canvas');
        this.staticMap.width = this.canvas.width;
        this.staticMap.height = this.canvas.height;
        this.renderStaticMap();
    }
    renderStaticMap() {
        const ctx = this.staticMap.getContext('2d');
        const { scaleX, scaleY } = this;
        ctx.fillStyle = '#1a1628';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        for (const tile of this.tiles){
            ctx.fillStyle = this.getTileColor(tile.material);
            ctx.fillRect(Math.floor(tile.x * scaleX), Math.floor(tile.y * scaleY), Math.max(1, Math.ceil(tile.width * scaleX)), Math.max(1, Math.ceil(tile.height * scaleY)));
        }
        ctx.fillStyle = '#f4c45f';
        for (const sun of this.sunLights){
            const sx = Math.floor(sun.x * scaleX);
            const sy = Math.floor(sun.y * scaleY);
            ctx.fillRect(sx - 1, sy - 1, 3, 3);
        }
    }
    getTileColor(material) {
        switch(material){
            case 'wall':
                return '#5e5478';
            case 'glass':
                return '#4ea8cc';
            case 'decor':
                return '#7bd0b1';
            case 'grate':
                return '#b29668';
        }
    }
    render(playerPos, cameraRect) {
        const { ctx, scaleX, scaleY } = this;
        ctx.drawImage(this.staticMap, 0, 0);
        const cx = Math.floor(cameraRect.x * scaleX);
        const cy = Math.floor(cameraRect.y * scaleY);
        const cw = Math.max(1, Math.ceil(cameraRect.width * scaleX));
        const ch = Math.max(1, Math.ceil(cameraRect.height * scaleY));
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cw, ch);
        const px = Math.floor(playerPos.x * scaleX);
        const py = Math.floor(playerPos.y * scaleY);
        ctx.fillStyle = '#73ff99';
        ctx.fillRect(px - 1, py - 1, 3, 3);
    }
}
const panelMargin = 12;
const debugWindowStorageKey = 'sidebound.game.debug-window';
function createDebugPanelElements() {
    return {
        stage: requireElement('.stage'),
        panel: requireElement('#debug-panel'),
        handle: requireElement('#debug-panel-handle'),
        reset: requireElement('#debug-panel-reset'),
        soundToggle: requireElement('#sound-toggle'),
        pauseToggle: requireElement('#pause-toggle'),
        lightingToggle: requireElement('#debug-lighting'),
        collisionToggle: requireElement('#debug-collision'),
        noclipToggle: requireElement('#debug-noclip'),
        fpsMetric: requireElement('#metric-fps'),
        frameMetric: requireElement('#metric-frame'),
        updateMetric: requireElement('#metric-update'),
        renderMetric: requireElement('#metric-render'),
        rayTimeMetric: requireElement('#metric-ray-time'),
        raysMetric: requireElement('#metric-rays'),
        checksMetric: requireElement('#metric-checks'),
        memoryMetric: requireElement('#metric-memory'),
        groundedMetric: requireElement('#metric-grounded'),
        velocityMetric: requireElement('#metric-velocity'),
        mapSizeMetric: requireElement('#metric-map-size'),
        solidsMetric: requireElement('#metric-solids'),
        occludersMetric: requireElement('#metric-occluders'),
        sunsMetric: requireElement('#metric-suns')
    };
}
function readDebugWindowSettings() {
    try {
        const value = globalThis.localStorage.getItem(debugWindowStorageKey);
        if (!value) {
            return {};
        }
        const parsed = JSON.parse(value);
        return {
            panelLeft: typeof parsed.panelLeft === 'number' ? parsed.panelLeft : undefined,
            panelTop: typeof parsed.panelTop === 'number' ? parsed.panelTop : undefined,
            showLighting: typeof parsed.showLighting === 'boolean' ? parsed.showLighting : undefined,
            showCollision: typeof parsed.showCollision === 'boolean' ? parsed.showCollision : undefined,
            soundPreferred: typeof parsed.soundPreferred === 'boolean' ? parsed.soundPreferred : undefined
        };
    } catch  {
        return {};
    }
}
function saveDebugWindowSettings(nextSettings) {
    try {
        const currentSettings = readDebugWindowSettings();
        globalThis.localStorage.setItem(debugWindowStorageKey, JSON.stringify({
            ...currentSettings,
            ...nextSettings
        }));
    } catch  {}
}
function toMegabytes(bytes) {
    return (bytes / 1024 / 1024).toFixed(1);
}
function isMemoryPerformance(value) {
    const candidate = value;
    return typeof candidate.memory?.usedJSHeapSize === 'number' && typeof candidate.memory.totalJSHeapSize === 'number' && typeof candidate.memory.jsHeapSizeLimit === 'number';
}
function formatMemory() {
    if (!isMemoryPerformance(performance) || !performance.memory) {
        return 'n/a';
    }
    return `${toMegabytes(performance.memory.usedJSHeapSize)} / ${toMegabytes(performance.memory.jsHeapSizeLimit)} MB`;
}
class DebugPanel {
    elements;
    savedSettings;
    panelDrag;
    nextMetricsUpdate = 0;
    soundButtonState;
    soundToggleHandler;
    paused = false;
    constructor(){
        this.elements = createDebugPanelElements();
        this.savedSettings = readDebugWindowSettings();
        this.soundButtonState = {
            enabled: false,
            preferred: this.savedSettings.soundPreferred ?? false
        };
        this.soundToggleHandler = ()=>this.soundButtonState;
    }
    get root() {
        return this.elements.panel;
    }
    get showLighting() {
        return this.elements.lightingToggle.checked;
    }
    get showCollision() {
        return this.elements.collisionToggle.checked;
    }
    get noClip() {
        return this.elements.noclipToggle.checked;
    }
    get soundPreferred() {
        return this.savedSettings.soundPreferred ?? false;
    }
    get isPaused() {
        return this.paused;
    }
    setSoundToggleHandler(handler) {
        this.soundToggleHandler = handler;
    }
    setSoundButtonState(state) {
        this.soundButtonState = state;
        this.updateSoundButton();
    }
    start() {
        this.applySavedToggleSettings();
        this.initializeWindow();
        this.elements.soundToggle.addEventListener('click', this.handleSoundToggleClick);
        this.elements.pauseToggle.addEventListener('click', this.handlePauseToggleClick);
        this.elements.lightingToggle.addEventListener('change', this.handleLightingToggleChange);
        this.elements.collisionToggle.addEventListener('change', this.handleCollisionToggleChange);
        this.updateSoundButton();
        this.updatePauseButton();
    }
    updateMetrics(metrics) {
        const now = performance.now();
        if (now < this.nextMetricsUpdate) {
            return;
        }
        this.nextMetricsUpdate = now + 120;
        this.elements.fpsMetric.textContent = metrics.fps.toFixed(0);
        this.elements.frameMetric.textContent = `${metrics.frameMs.toFixed(2)}ms`;
        this.elements.updateMetric.textContent = `${metrics.updateMs.toFixed(2)}ms`;
        this.elements.renderMetric.textContent = `${metrics.renderMs.toFixed(2)}ms`;
        this.elements.rayTimeMetric.textContent = `${metrics.rayMs.toFixed(2)}ms`;
        this.elements.raysMetric.textContent = String(metrics.rays);
        this.elements.checksMetric.textContent = String(metrics.rayChecks);
        this.elements.memoryMetric.textContent = formatMemory();
        this.elements.groundedMetric.textContent = String(metrics.grounded);
        this.elements.velocityMetric.textContent = `${metrics.velocity.x.toFixed(1)}, ${metrics.velocity.y.toFixed(1)}`;
        this.elements.mapSizeMetric.textContent = metrics.mapSize;
        this.elements.solidsMetric.textContent = String(metrics.solids);
        this.elements.occludersMetric.textContent = String(metrics.occluders);
        this.elements.sunsMetric.textContent = `${metrics.activeSuns} / ${metrics.totalSuns}`;
    }
    applySavedToggleSettings() {
        if (this.savedSettings.showLighting !== undefined) {
            this.elements.lightingToggle.checked = this.savedSettings.showLighting;
        }
        if (this.savedSettings.showCollision !== undefined) {
            this.elements.collisionToggle.checked = this.savedSettings.showCollision;
        }
    }
    initializeWindow() {
        if (this.savedSettings.panelLeft !== undefined && this.savedSettings.panelTop !== undefined) {
            this.setPosition(this.savedSettings.panelLeft, this.savedSettings.panelTop);
        } else {
            this.resetPosition();
        }
        globalThis.addEventListener('resize', this.keepInViewport);
        globalThis.addEventListener('pointermove', this.moveDrag);
        globalThis.addEventListener('pointerup', this.stopDrag);
        globalThis.addEventListener('pointercancel', this.stopDrag);
        this.elements.handle.addEventListener('pointerdown', this.startDrag);
        this.elements.handle.addEventListener('keydown', this.moveWithKeyboard);
        this.elements.reset.addEventListener('click', this.resetPosition);
    }
    handleSoundToggleClick = async ()=>{
        this.soundButtonState = await this.soundToggleHandler();
        saveDebugWindowSettings({
            soundPreferred: this.soundButtonState.preferred
        });
        this.updateSoundButton();
    };
    handlePauseToggleClick = ()=>{
        this.paused = !this.paused;
        this.updatePauseButton();
    };
    handleLightingToggleChange = ()=>{
        saveDebugWindowSettings({
            showLighting: this.elements.lightingToggle.checked
        });
    };
    handleCollisionToggleChange = ()=>{
        saveDebugWindowSettings({
            showCollision: this.elements.collisionToggle.checked
        });
    };
    startDrag = (event)=>{
        if (event.button !== 0) {
            return;
        }
        const rect = this.elements.panel.getBoundingClientRect();
        this.panelDrag = {
            pointerId: event.pointerId,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top
        };
        this.elements.panel.classList.add('is-dragging');
        this.elements.handle.setPointerCapture(event.pointerId);
        event.preventDefault();
    };
    moveDrag = (event)=>{
        if (!this.panelDrag || event.pointerId !== this.panelDrag.pointerId) {
            return;
        }
        this.setPosition(event.clientX - this.panelDrag.offsetX, event.clientY - this.panelDrag.offsetY);
    };
    stopDrag = (event)=>{
        if (!this.panelDrag || event.pointerId !== this.panelDrag.pointerId) {
            return;
        }
        this.panelDrag = undefined;
        this.elements.panel.classList.remove('is-dragging');
        if (this.elements.handle.hasPointerCapture(event.pointerId)) {
            this.elements.handle.releasePointerCapture(event.pointerId);
        }
    };
    moveWithKeyboard = (event)=>{
        const rect = this.elements.panel.getBoundingClientRect();
        const step = event.shiftKey ? 16 * 3 : 16;
        let nextX = rect.left;
        let nextY = rect.top;
        if (event.key === 'ArrowLeft') {
            nextX -= step;
        } else if (event.key === 'ArrowRight') {
            nextX += step;
        } else if (event.key === 'ArrowUp') {
            nextY -= step;
        } else if (event.key === 'ArrowDown') {
            nextY += step;
        } else if (event.key === 'Home') {
            this.resetPosition();
            event.preventDefault();
            event.stopPropagation();
            return;
        } else {
            return;
        }
        this.setPosition(nextX, nextY);
        event.preventDefault();
        event.stopPropagation();
    };
    resetPosition = ()=>{
        const stageRect = this.elements.stage.getBoundingClientRect();
        const panelRect = this.elements.panel.getBoundingClientRect();
        const left = Math.min(stageRect.right - panelRect.width - 16, globalThis.innerWidth - panelRect.width - 12);
        const top = Math.max(stageRect.top + 16, 12);
        this.setPosition(left, top);
    };
    keepInViewport = ()=>{
        const rect = this.elements.panel.getBoundingClientRect();
        this.setPosition(rect.left, rect.top);
    };
    setPosition(left, top) {
        const rect = this.elements.panel.getBoundingClientRect();
        const maxLeft = Math.max(12, globalThis.innerWidth - rect.width - 12);
        const maxTop = Math.max(12, globalThis.innerHeight - rect.height - 12);
        this.elements.panel.style.left = `${clamp(left, panelMargin, maxLeft)}px`;
        this.elements.panel.style.top = `${clamp(top, panelMargin, maxTop)}px`;
        this.elements.panel.style.right = 'auto';
        this.elements.panel.style.bottom = 'auto';
        saveDebugWindowSettings({
            panelLeft: Number.parseFloat(this.elements.panel.style.left),
            panelTop: Number.parseFloat(this.elements.panel.style.top)
        });
    }
    updateSoundButton() {
        if (this.soundButtonState.enabled) {
            this.elements.soundToggle.textContent = 'Sound enabled';
        } else if (this.soundButtonState.preferred) {
            this.elements.soundToggle.textContent = 'Enable saved sound';
        } else {
            this.elements.soundToggle.textContent = 'Enable sound';
        }
        this.elements.soundToggle.setAttribute('aria-pressed', String(this.soundButtonState.preferred));
    }
    updatePauseButton() {
        this.elements.pauseToggle.textContent = this.paused ? 'Resume game' : 'Pause game';
        this.elements.pauseToggle.setAttribute('aria-pressed', String(this.paused));
    }
}
const controls = {
    maxSpeed: 78,
    groundAcceleration: 780,
    airAcceleration: 430,
    friction: 920,
    gravity: 420,
    jumpVelocity: 287
};
class CharacterRenderComponent {
    renderer = new CharacterRenderer();
    appearance;
    equipment;
    constructor(appearance, equipment){
        this.appearance = appearance;
        this.equipment = equipment;
    }
    draw(frame) {
        this.renderer.draw({
            renderer: frame.renderer,
            appearance: this.appearance,
            equipment: this.equipment,
            frame: frame.frame,
            x: frame.x,
            y: frame.y,
            flipX: frame.flipX
        });
    }
}
const MobState = {
    Idle: 'idle',
    Running: 'running',
    Stopping: 'stopping',
    Jumping: 'jumping',
    Falling: 'falling',
    Landing: 'landing'
};
function resolveMobState(current, grounded, velocityX, velocityY, inputHorizontal, justLanded, justJumped, stoppingThreshold) {
    if (justJumped) return MobState.Jumping;
    if (!grounded && velocityY > 0) return MobState.Falling;
    if (!grounded && velocityY <= 0) return MobState.Jumping;
    if (justLanded) return MobState.Landing;
    if (current === MobState.Landing) {
        return MobState.Landing;
    }
    if (inputHorizontal !== 0) return MobState.Running;
    if (Math.abs(velocityX) > stoppingThreshold) return MobState.Stopping;
    return MobState.Idle;
}
const DEFAULT_ANIMATION_MAP = {
    [MobState.Idle]: 'idle',
    [MobState.Running]: 'run',
    [MobState.Stopping]: 'stop',
    [MobState.Jumping]: 'jump',
    [MobState.Falling]: 'fall',
    [MobState.Landing]: 'land'
};
class Mob {
    x;
    y;
    width;
    height;
    spawnPoint;
    vx = 0;
    vy = 0;
    grounded = false;
    facing = 1;
    mobState = MobState.Idle;
    noClip = false;
    spriteOffsetX;
    spriteOffsetY;
    animator;
    physics;
    animationMap;
    solids;
    constructor(options){
        this.width = options.width;
        this.height = options.height;
        this.x = options.spawn.x;
        this.y = options.spawn.y - this.height;
        this.spawnPoint = {
            x: this.x,
            y: this.y
        };
        this.physics = options.physics;
        this.solids = options.solids;
        this.animationMap = options.animationMap ?? DEFAULT_ANIMATION_MAP;
        this.animator = new SpriteAnimator(options.spriteSheet);
        this.spriteOffsetX = options.spriteOffsetX ?? 0;
        this.spriteOffsetY = options.spriteOffsetY ?? 0;
    }
    getRect() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
    getCenter() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height / 2
        };
    }
    respawn() {
        this.x = this.spawnPoint.x;
        this.y = this.spawnPoint.y;
        this.vx = 0;
        this.vy = 0;
        this.grounded = false;
        this.mobState = MobState.Falling;
    }
    getShadowProjection() {
        const footY = this.y + this.height;
        let groundY = Number.POSITIVE_INFINITY;
        for (const solid of this.solids){
            const overlapsFootprint = this.x < solid.x + solid.width && this.x + this.width > solid.x;
            if (!overlapsFootprint || solid.y < footY - 0.5) continue;
            groundY = Math.min(groundY, solid.y);
        }
        if (!Number.isFinite(groundY)) {
            return null;
        }
        return {
            x: this.x + this.width / 2,
            y: groundY,
            distance: Math.max(0, groundY - footY)
        };
    }
    updatePhysics(deltaSeconds, inputHorizontal, jumpRequested, jumpHeld = false, downHeld = false) {
        if (this.noClip) {
            const noclipSpeed = this.physics.maxSpeed * 2.5;
            this.vx = inputHorizontal * noclipSpeed;
            if (jumpHeld && !downHeld) {
                this.vy = -noclipSpeed;
            } else if (downHeld && !jumpHeld) {
                this.vy = noclipSpeed;
            } else {
                this.vy = 0;
            }
            this.x += this.vx * deltaSeconds;
            this.y += this.vy * deltaSeconds;
            this.grounded = false;
            return;
        }
        const wasGrounded = this.grounded;
        let justJumped = false;
        const acceleration = this.grounded ? this.physics.groundAcceleration : this.physics.airAcceleration;
        const targetVx = inputHorizontal * this.physics.maxSpeed;
        if (inputHorizontal !== 0) {
            this.facing = inputHorizontal;
            this.vx = approach(this.vx, targetVx, acceleration * deltaSeconds);
        } else if (this.grounded) {
            this.vx = approach(this.vx, 0, this.physics.friction * deltaSeconds);
        } else {
            this.vx = approach(this.vx, 0, this.physics.airAcceleration * 0.18 * deltaSeconds);
        }
        if (jumpRequested && this.grounded) {
            this.vy = -this.physics.jumpVelocity;
            this.grounded = false;
            justJumped = true;
        }
        this.vy += this.physics.gravity * deltaSeconds;
        this.moveHorizontal(this.vx * deltaSeconds);
        this.moveVertical(this.vy * deltaSeconds);
        const justLanded = this.grounded && !wasGrounded;
        const nextState = resolveMobState(this.mobState, this.grounded, this.vx, this.vy, inputHorizontal, justLanded, justJumped, this.physics.stoppingThreshold);
        this.transitionState(nextState);
    }
    updateAnimation(deltaSeconds) {
        if (this.animator.finished) {
            if (this.mobState === MobState.Landing || this.mobState === MobState.Stopping) {
                this.transitionState(MobState.Idle);
            }
        }
        this.animator.update(deltaSeconds);
    }
    draw(renderer) {
        const drawX = Math.round(this.x + this.spriteOffsetX);
        const drawY = Math.round(this.y + this.spriteOffsetY);
        const flipX = this.facing < 0;
        this.animator.draw(renderer, drawX, drawY, flipX);
    }
    transitionState(next) {
        if (next === this.mobState) return;
        this.mobState = next;
        const clipName = this.animationMap[next];
        if (clipName) {
            this.animator.play(clipName);
        }
    }
    moveHorizontal(distance) {
        this.x += distance;
        const rect = this.getRect();
        for (const solid of this.solids){
            if (!rectsIntersect(rect, solid)) continue;
            if (distance > 0) {
                this.x = solid.x - this.width;
            } else if (distance < 0) {
                this.x = solid.x + solid.width;
            }
            this.vx = 0;
            rect.x = this.x;
        }
    }
    moveVertical(distance) {
        this.y += distance;
        this.grounded = false;
        const rect = this.getRect();
        for (const solid of this.solids){
            if (!rectsIntersect(rect, solid)) continue;
            if (distance > 0) {
                this.y = solid.y - this.height;
                this.grounded = true;
            } else if (distance < 0) {
                this.y = solid.y + solid.height;
            }
            this.vy = 0;
            rect.y = this.y;
        }
    }
}
const PLAYER_PHYSICS = {
    maxSpeed: controls.maxSpeed,
    groundAcceleration: controls.groundAcceleration,
    airAcceleration: controls.airAcceleration,
    friction: controls.friction,
    gravity: controls.gravity,
    jumpVelocity: controls.jumpVelocity,
    stoppingThreshold: 8
};
const jumpCue = {
    frequency: 246,
    durationSeconds: 0.09,
    gain: 0.04
};
const landCue = {
    frequency: 118,
    durationSeconds: 0.08,
    gain: 0.03
};
function createStepCue(vx) {
    return {
        frequency: 76 + Math.round(Math.abs(vx) % 20),
        durationSeconds: 0.04,
        gain: 0.016
    };
}
class PlayerMob extends Mob {
    stepCooldown = 0;
    renderComponent;
    appearance;
    equipped = {};
    constructor(spawn, solids, appearance){
        super({
            spawn,
            width: appearance.definition.hitbox.width,
            height: appearance.definition.hitbox.height,
            spriteSheet: appearance.base,
            physics: PLAYER_PHYSICS,
            solids,
            spriteOffsetX: appearance.definition.spriteOffset.x,
            spriteOffsetY: appearance.definition.spriteOffset.y
        });
        registerSpriteAnimationClips(this.animator, appearance.definition.clips);
        this.appearance = appearance;
        this.renderComponent = new CharacterRenderComponent(appearance, this.equipped);
    }
    update(deltaSeconds, input) {
        const cues = [];
        const previousState = this.mobState;
        this.updatePhysics(deltaSeconds, input.horizontal, input.jumpQueued, input.jumpHeld, input.downHeld);
        if (this.y < -200 || this.x < -200) {
            this.respawn();
        }
        this.animator.playbackRate = this.resolvePlaybackRate(input.horizontal);
        this.updateAnimation(deltaSeconds);
        if (this.mobState === MobState.Jumping && previousState !== MobState.Jumping) {
            cues.push(jumpCue);
        }
        if (this.mobState === MobState.Landing && previousState !== MobState.Landing) {
            cues.push(landCue);
        }
        this.addStepCues(cues, deltaSeconds, input.horizontal);
        return cues;
    }
    getEquipment() {
        return {
            ...this.equipped
        };
    }
    setEquipment(equipment) {
        Object.assign(this.equipped, equipment);
    }
    equip(equipmentId) {
        const equipment = this.appearance.equipment[equipmentId];
        this.equipped[equipment.slot] = equipmentId;
    }
    draw(renderer) {
        const drawX = Math.round(this.x + this.spriteOffsetX);
        const drawY = Math.round(this.y + this.spriteOffsetY);
        const flipX = this.facing < 0;
        const frame = this.animator.currentFrame;
        this.renderComponent.draw({
            renderer,
            frame,
            x: drawX,
            y: drawY,
            flipX
        });
    }
    addStepCues(cues, deltaSeconds, horizontal) {
        if (!this.grounded || horizontal === 0 || Math.abs(this.vx) < 12) {
            this.stepCooldown = 0;
            return;
        }
        this.stepCooldown -= deltaSeconds;
        if (this.stepCooldown <= 0) {
            cues.push(createStepCue(this.vx));
            this.stepCooldown = 0.16;
        }
    }
    resolvePlaybackRate(horizontal) {
        const speedRatio = Math.min(1, Math.abs(this.vx) / Math.max(1, PLAYER_PHYSICS.maxSpeed));
        switch(this.mobState){
            case MobState.Running:
                return 0.92 + speedRatio * 0.8;
            case MobState.Stopping:
                return 1.05;
            case MobState.Jumping:
                return 0.94 + Math.abs(horizontal) * 0.08;
            case MobState.Falling:
                return 0.9;
            case MobState.Landing:
                return 1.12;
            default:
                return 0.98;
        }
    }
}
const bgTop = {
    r: 42,
    g: 36,
    b: 64,
    a: 1
};
const bgBottom = {
    r: 22,
    g: 18,
    b: 40,
    a: 1
};
const stripe = {
    r: 48,
    g: 40,
    b: 72,
    a: 1
};
const pillar = {
    r: 61,
    g: 51,
    b: 88,
    a: 1
};
class BackgroundLayer {
    order = 0;
    world;
    constructor(world){
        this.world = world;
    }
    render(frame) {
        const { renderer } = frame;
        const { width, height } = this.world;
        const halfHeight = Math.round(height / 2);
        renderer.fillRect({
            x: 0,
            y: 0,
            width,
            height: halfHeight
        }, bgTop);
        renderer.fillRect({
            x: 0,
            y: halfHeight,
            width,
            height: height - halfHeight
        }, bgBottom);
        for(let x = 0; x < width; x += 16){
            renderer.fillRect({
                x,
                y: 0,
                width: 2,
                height
            }, stripe);
        }
        for(let x = 8; x < width; x += 32){
            renderer.fillRect({
                x,
                y: 24,
                width: 8,
                height: 106
            }, pillar);
        }
    }
}
const wallColor = {
    r: 78,
    g: 70,
    b: 104,
    a: 1
};
const wallHighlight = {
    r: 110,
    g: 100,
    b: 136,
    a: 1
};
const wallShadow = {
    r: 54,
    g: 47,
    b: 72,
    a: 1
};
const glassColor = {
    r: 136,
    g: 204,
    b: 255,
    a: 0.55
};
const glassHighlight = {
    r: 215,
    g: 246,
    b: 255,
    a: 0.85
};
const decorColor = {
    r: 123,
    g: 208,
    b: 177,
    a: 1
};
const decorBright = {
    r: 181,
    g: 246,
    b: 217,
    a: 1
};
const grateBackground = {
    r: 40,
    g: 34,
    b: 47,
    a: 1
};
const grateBar = {
    r: 159,
    g: 140,
    b: 114,
    a: 1
};
const grateHighlight = {
    r: 215,
    g: 183,
    b: 124,
    a: 1
};
class TerrainLayer {
    order = 10;
    tiles;
    constructor(world){
        this.tiles = world.tiles;
    }
    render(frame) {
        const { renderer } = frame;
        for (const tile of this.tiles){
            switch(tile.material){
                case 'wall':
                    this.drawWall(renderer, tile);
                    break;
                case 'glass':
                    this.drawGlass(renderer, tile);
                    break;
                case 'decor':
                    this.drawDecor(renderer, tile);
                    break;
                case 'grate':
                    this.drawGrate(renderer, tile);
                    break;
            }
        }
    }
    drawWall(renderer, tile) {
        renderer.fillRect({
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: tile.height
        }, wallColor);
        renderer.fillRect({
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: 1
        }, wallHighlight);
        renderer.fillRect({
            x: tile.x,
            y: tile.y + tile.height - 1,
            width: tile.width,
            height: 1
        }, wallShadow);
    }
    drawGlass(renderer, tile) {
        renderer.fillRect({
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: tile.height
        }, glassColor);
        renderer.fillRect({
            x: tile.x + 4,
            y: tile.y + 4,
            width: tile.width - 8,
            height: 2
        }, glassHighlight);
        renderer.fillRect({
            x: tile.x + 4,
            y: tile.y + 4,
            width: 2,
            height: tile.height - 8
        }, glassHighlight);
    }
    drawDecor(renderer, tile) {
        const cx = tile.x + Math.floor(tile.width / 2);
        const cy = tile.y + Math.floor(tile.height / 2);
        renderer.fillRect({
            x: cx - 1,
            y: cy - 1,
            width: 3,
            height: 3
        }, decorColor);
        renderer.fillRect({
            x: cx,
            y: cy - 5,
            width: 1,
            height: 11
        }, decorBright);
        renderer.fillRect({
            x: cx - 5,
            y: cy,
            width: 11,
            height: 1
        }, decorBright);
    }
    drawGrate(renderer, tile) {
        const bar = Math.max(2, Math.round(tile.width * 0.12));
        const inset = Math.max(3, Math.round(tile.width * 0.16));
        const center = tile.x + Math.floor((tile.width - bar) / 2);
        const far = tile.x + tile.width - inset - bar;
        renderer.fillRect({
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: tile.height
        }, grateBackground);
        renderer.fillRect({
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: bar
        }, grateBar);
        renderer.fillRect({
            x: tile.x,
            y: tile.y + tile.height - bar,
            width: tile.width,
            height: bar
        }, grateBar);
        renderer.fillRect({
            x: tile.x + inset,
            y: tile.y,
            width: bar,
            height: tile.height
        }, grateBar);
        renderer.fillRect({
            x: center,
            y: tile.y,
            width: bar,
            height: tile.height
        }, grateBar);
        renderer.fillRect({
            x: far,
            y: tile.y,
            width: bar,
            height: tile.height
        }, grateBar);
        renderer.fillRect({
            x: tile.x,
            y: tile.y,
            width: tile.width,
            height: 1
        }, grateHighlight);
    }
}
const shadowColor = {
    r: 8,
    g: 6,
    b: 14,
    a: 0.25
};
class EntityLayer {
    order = 20;
    mobs = [];
    itemProvider = ()=>[];
    addMob(mob) {
        this.mobs.push(mob);
    }
    setItemProvider(provider) {
        this.itemProvider = provider;
    }
    removeMob(mob) {
        const index = this.mobs.indexOf(mob);
        if (index !== -1) this.mobs.splice(index, 1);
    }
    render(frame) {
        const { renderer } = frame;
        for (const item of this.itemProvider()){
            this.drawItem(renderer, item);
        }
        for (const mob of this.mobs){
            this.drawMob(renderer, mob);
        }
    }
    drawItem(renderer, item) {
        item.spriteSheet.drawFrame(renderer, item.frameIndex ?? 0, Math.round(item.x), Math.round(item.y), item.flipX ?? false);
    }
    drawMob(renderer, mob) {
        this.drawGroundShadow(renderer, mob);
        mob.draw(renderer);
    }
    drawGroundShadow(renderer, mob) {
        const projection = mob.getShadowProjection();
        if (projection === null) return;
        const heightFactor = clamp(projection.distance / 80, 0, 1);
        const radiusX = Math.round(mob.width * 1.9 * (1 - heightFactor * 0.45));
        const alpha = 0.28 * (1 - heightFactor * 0.72);
        const centerX = projection.x;
        renderer.fillRect({
            x: Math.round(centerX - radiusX / 2),
            y: projection.y,
            width: radiusX,
            height: 2
        }, {
            ...shadowColor,
            a: alpha
        });
    }
}
const solidColor = {
    r: 255,
    g: 106,
    b: 106,
    a: 0.9
};
const playerColor = {
    r: 115,
    g: 255,
    b: 153,
    a: 0.9
};
const itemColor = {
    r: 246,
    g: 211,
    b: 101,
    a: 0.9
};
const rayColor = {
    r: 97,
    g: 210,
    b: 255,
    a: 0.28
};
const radiusColor = {
    r: 244,
    g: 196,
    b: 95,
    a: 0.65
};
class DebugLayer {
    order = 100;
    showCollision = false;
    showLighting = false;
    solids;
    playerRectProvider = null;
    itemRectProvider = null;
    lightPolygonProvider = null;
    constructor(solids){
        this.solids = solids;
    }
    setPlayerRectProvider(provider) {
        this.playerRectProvider = provider;
    }
    setItemRectProvider(provider) {
        this.itemRectProvider = provider;
    }
    setLightPolygonProvider(provider) {
        this.lightPolygonProvider = provider;
    }
    render(frame) {
        const { renderer } = frame;
        if (this.showCollision) {
            this.drawCollision(renderer);
        }
        if (this.showLighting) {
            this.drawLightingDebug(renderer);
        }
    }
    drawCollision(renderer) {
        for (const solid of this.solids){
            renderer.strokeRect(solid, solidColor);
        }
        if (this.playerRectProvider) {
            renderer.strokeRect(this.playerRectProvider(), playerColor);
        }
        if (this.itemRectProvider) {
            for (const rect of this.itemRectProvider()){
                renderer.strokeRect(rect, itemColor);
            }
        }
    }
    drawLightingDebug(renderer) {
        if (!this.lightPolygonProvider) return;
        const entries = this.lightPolygonProvider();
        for (const { polygon, origin, radius } of entries){
            for (const hit of polygon){
                renderer.drawLine(origin, hit, rayColor);
            }
            const points = [];
            for(let i = 0; i < 32; i++){
                const angle = i / 32 * Math.PI * 2;
                points.push({
                    x: origin.x + Math.cos(angle) * radius,
                    y: origin.y + Math.sin(angle) * radius
                });
            }
            renderer.drawPolygon(points, radiusColor);
        }
    }
}
class ItemFactory {
    registry;
    iconSheets;
    constructor(registry, iconSheets){
        this.registry = registry;
        this.iconSheets = iconSheets;
    }
    createPickup(itemId, position, id = itemId) {
        const definition = this.registry.getItem(itemId);
        const spriteSheet = this.iconSheets[definition.id];
        return {
            id,
            kind: definition.id,
            x: position.x,
            y: position.y,
            width: definition.pickup.size.width,
            height: definition.pickup.size.height,
            spriteSheet,
            effects: definition.effects
        };
    }
}
function spriteUrl(fileName) {
    return `/assets/sprites/${fileName}`;
}
const spriteAssetIds = {
    playerBase: 'characters/player/base',
    redCapeBack: 'equipment/red-cape/back',
    redCapeFront: 'equipment/red-cape/front',
    redCapeIcon: 'items/red-cape/icon',
    ironSwordEquipped: 'equipment/iron-sword/equipped',
    ironSwordIcon: 'items/iron-sword/icon'
};
const spriteAssets = [
    {
        id: spriteAssetIds.playerBase,
        url: spriteUrl('player-base.png')
    },
    {
        id: spriteAssetIds.redCapeBack,
        url: spriteUrl('cape-back.png')
    },
    {
        id: spriteAssetIds.redCapeFront,
        url: spriteUrl('cape-front.png')
    },
    {
        id: spriteAssetIds.redCapeIcon,
        url: spriteUrl('cape-icon.png')
    },
    {
        id: spriteAssetIds.ironSwordEquipped,
        url: spriteUrl('sword-equipped.png')
    },
    {
        id: spriteAssetIds.ironSwordIcon,
        url: spriteUrl('sword-icon.png')
    }
];
const playerCharacter = defineCharacter({
    id: 'player',
    atlas: spriteAssetIds.playerBase,
    frame: {
        width: 32,
        height: 32,
        columns: 8,
        rows: 6
    },
    hitbox: {
        width: 8,
        height: 28
    },
    spriteOffset: {
        x: -13,
        y: -3
    },
    clips: {
        idle: {
            frames: [
                0,
                1,
                2,
                3,
                4,
                5
            ],
            fps: 9,
            loop: true
        },
        run: {
            frames: [
                8,
                9,
                10,
                11,
                12,
                13,
                14,
                15
            ],
            fps: 18,
            loop: true
        },
        jump: {
            frames: [
                16,
                17,
                18
            ],
            fps: 10,
            loop: false
        },
        fall: {
            frames: [
                24,
                25,
                26
            ],
            fps: 10.5,
            loop: true
        },
        land: {
            frames: [
                32,
                33,
                34,
                35
            ],
            fps: 20,
            loop: false
        },
        stop: {
            frames: [
                40,
                41,
                42,
                43
            ],
            fps: 20,
            loop: false
        }
    },
    frameMetadata: Object.fromEntries(Array.from({
        length: 8 * 6
    }, (_, frame)=>[
            frame,
            {
                frame
            }
        ]))
});
const ironSwordEquipment = defineEquipment({
    id: 'ironSword',
    slot: 'mainHand',
    layers: [
        {
            id: 'ironSwordEquipped',
            atlas: spriteAssetIds.ironSwordEquipped,
            order: 'heldItem',
            align: 'characterFrame'
        }
    ]
});
const redCapeEquipment = defineEquipment({
    id: 'redCape',
    slot: 'back',
    layers: [
        {
            id: 'redCapeBack',
            atlas: spriteAssetIds.redCapeBack,
            order: 'behindBody',
            align: 'characterFrame'
        },
        {
            id: 'redCapeFront',
            atlas: spriteAssetIds.redCapeFront,
            order: 'frontAccessory',
            align: 'characterFrame'
        }
    ]
});
const redCapeItem = defineItem({
    id: 'redCapeItem',
    icon: spriteAssetIds.redCapeIcon,
    pickup: {
        size: {
            width: 16,
            height: 16
        }
    },
    effects: [
        {
            type: 'equip',
            equipment: 'redCape'
        }
    ]
});
const ironSwordItem = defineItem({
    id: 'ironSwordItem',
    icon: spriteAssetIds.ironSwordIcon,
    pickup: {
        size: {
            width: 16,
            height: 16
        }
    },
    effects: [
        {
            type: 'equip',
            equipment: 'ironSword'
        }
    ]
});
const demoContent = new ContentRegistry().registerImageAssets(spriteAssets).registerCharacter(playerCharacter).registerEquipment(redCapeEquipment).registerEquipment(ironSwordEquipment).registerItem(redCapeItem).registerItem(ironSwordItem);
const demoContentIds = {
    player: playerCharacter.id,
    redCapeItem: redCapeItem.id,
    ironSwordItem: ironSwordItem.id
};
async function loadCharacterAppearance(renderer, registry, assets, characterId) {
    const definition = registry.getCharacter(characterId);
    const base = await loadSpriteSheet(renderer, assets, definition.atlas, definition.frame.width, definition.frame.height, definition.frame.columns, definition.frame.rows);
    const equipmentEntries = await Promise.all(registry.getEquipmentDefinitions().map(async (equipment)=>{
        const visualLayers = await Promise.all(equipment.layers.map(async (layer)=>({
                id: layer.id,
                order: layer.order,
                spriteSheet: await loadSpriteSheet(renderer, assets, layer.atlas, definition.frame.width, definition.frame.height, definition.frame.columns, definition.frame.rows)
            })));
        return [
            equipment.id,
            createLoadedEquipmentDefinition(equipment, visualLayers)
        ];
    }));
    return {
        definition,
        base,
        equipment: Object.fromEntries(equipmentEntries)
    };
}
function loadItemIconSheet(renderer, assets, item) {
    return loadSpriteSheet(renderer, assets, item.icon, item.pickup.size.width, item.pickup.size.height, 1, 1);
}
async function loadItemIconSheets(renderer, registry, assets) {
    const entries = await Promise.all(registry.getItems().map(async (item)=>[
            item.id,
            await loadItemIconSheet(renderer, assets, item)
        ]));
    return Object.fromEntries(entries);
}
async function loadDemoContent(loader, renderer) {
    demoContent.assertValid();
    const assets = new AssetStore(loader);
    assets.registerImages(demoContent.getImageAssets());
    await assets.preloadAll();
    const playerDefinition = demoContent.getCharacter(demoContentIds.player);
    const playerAppearance = await loadCharacterAppearance(renderer, demoContent, assets, playerDefinition.id);
    const itemIconSheets = await loadItemIconSheets(renderer, demoContent, assets);
    return {
        registry: demoContent,
        playerAppearance,
        itemIconSheets,
        summary: {
            characters: demoContent.getCharacters().map((definition)=>definition.id),
            equipment: demoContent.getEquipmentDefinitions().map((definition)=>definition.id),
            items: demoContent.getItems().map((definition)=>definition.id),
            atlases: demoContent.getImageAssets().map((definition)=>definition.id)
        }
    };
}
class DemoAudio {
    audioContext;
    enabled = false;
    preferred;
    constructor(soundPreferred){
        this.preferred = soundPreferred;
    }
    get state() {
        return {
            enabled: this.enabled,
            preferred: this.preferred
        };
    }
    async toggle() {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
        }
        if (this.enabled) {
            this.enabled = false;
            this.preferred = false;
            return this.state;
        }
        await this.audioContext.resume();
        this.enabled = true;
        this.preferred = true;
        this.playTone({
            frequency: 196,
            durationSeconds: 0.08,
            gain: 0.035
        });
        return this.state;
    }
    playTone(cue) {
        if (!this.audioContext || !this.enabled) {
            return;
        }
        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(cue.frequency, now);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(cue.gain, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.durationSeconds);
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + cue.durationSeconds);
    }
}
function getPickupItemRect(item) {
    return {
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height
    };
}
class ItemSystem {
    items = [];
    context;
    constructor(context){
        this.context = context;
    }
    add(item) {
        this.items.push(item);
    }
    remove(item) {
        const index = this.items.indexOf(item);
        if (index !== -1) this.items.splice(index, 1);
    }
    update() {
        const holderRect = this.context.equipmentHolder.getRect();
        for(let index = this.items.length - 1; index >= 0; index -= 1){
            const item = this.items[index];
            if (!rectsIntersect(holderRect, getPickupItemRect(item))) {
                continue;
            }
            this.applyPickupEffect(item);
            this.items.splice(index, 1);
        }
    }
    getItems() {
        return this.items;
    }
    getDebugRects() {
        return this.items.map(getPickupItemRect);
    }
    applyPickupEffect(item) {
        for (const effect of item.effects){
            this.context.equipmentHolder.equip(effect.equipment);
        }
    }
}
const viewport = {
    width: 450,
    height: 250
};
function wallRow() {
    return '#'.repeat(50);
}
function row(content = '') {
    return `#${content.padEnd(50 - 2, ' ').slice(0, 50 - 2)}#`;
}
const registry = new TileRegistry().register({
    glyph: '#',
    material: 'wall',
    collision: 'solid',
    light: 'opaque'
}).register({
    glyph: 'C',
    material: 'glass',
    collision: 'none',
    light: 'none'
}).register({
    glyph: '.',
    material: 'decor',
    collision: 'none',
    light: 'none'
}).register({
    glyph: 'G',
    material: 'grate',
    collision: 'solid',
    light: 'vertical-bar'
}).register({
    glyph: '@',
    spawn: true
});
const MAP_ROWS = [
    wallRow(),
    row(),
    row('       C             .          C'),
    row(),
    row('     ######        GGGGGG        ######'),
    row('                    G  G'),
    row('          C         G  G       .'),
    row('                    GGGG'),
    row(),
    row('        .       C             ####'),
    row('                         ####'),
    row('   ####      ####      GGGG'),
    row(),
    row('       C            .       C'),
    row('                 ####'),
    row('        GGGGGG'),
    row('        G    G           ####'),
    row('        GGGGGG'),
    row(),
    row('   C       .        C          ####'),
    row('        ####       GGGG'),
    row('  .   C            G  G       .'),
    row('  @  . C       GGGGGG       C'),
    row('###########GGGGGG#######     ########'),
    row('          #      #       .'),
    wallRow(),
    wallRow(),
    wallRow()
];
const world = TileMapBuilder.from(MAP_ROWS).withTileSize(28).build(registry);
const demoLocation = defineLocation({
    id: 'debug.main',
    region: 'debug',
    bounds: rect([
        0,
        0,
        world.width,
        world.height
    ]),
    tilemap: chunkedTilemap('inline/demo-map', {
        chunkSize: [
            16,
            16
        ],
        preloadRadius: 1,
        unloadRadius: 2
    }),
    spawnPoints: {
        start: [
            world.spawn.x,
            world.spawn.y
        ]
    },
    connections: [
        edgeConnection('right', {
            id: 'debug-loop-right',
            to: {
                location: 'debug.main',
                spawn: 'start'
            },
            transition: 'debug'
        })
    ]
});
const demoRegion = defineRegion({
    id: 'debug',
    locations: [
        demoLocation
    ]
});
const demoWorld = defineWorld({
    regions: [
        demoRegion
    ],
    start: {
        location: demoLocation.id,
        spawn: 'start'
    }
});
assertValidWorldDefinition(demoWorld);
function createKeyboardInputSource() {
    return {
        addEventListener (type, listener) {
            globalThis.addEventListener(type, listener);
        },
        removeEventListener (type, listener) {
            globalThis.removeEventListener(type, listener);
        }
    };
}
class DemoApplication {
    debugPanel;
    input;
    audio;
    player;
    itemSystem;
    camera;
    pipeline;
    lightingLayer;
    debugLayer;
    minimap;
    engine;
    surface;
    loadedContent;
    itemFactory;
    sunLights;
    playerLight;
    mapTilesW = Math.round(world.width / 28);
    mapTilesH = Math.round(world.height / 28);
    diagnostics = {
        ...createFrameDiagnostics(),
        rayMs: 0,
        rays: 0,
        rayChecks: 0
    };
    static async create() {
        const platform = new PlatformBrowserAdapter();
        const canvas = requireElement('#game');
        const surface = createPixelCanvasSurface({
            canvas,
            width: viewport.width,
            height: viewport.height,
            scale: 'css',
            background: '#1e1a2e'
        });
        return new DemoApplication(await loadDemoContent(platform, surface.renderer), surface);
    }
    constructor(loadedContent, surface){
        const minimapCanvas = requireElement('#debug-minimap');
        const lighting = new RayLighting(world.lightOccluders);
        this.surface = surface;
        this.loadedContent = loadedContent;
        this.debugPanel = new DebugPanel();
        this.input = new InputManager({
            source: createKeyboardInputSource(),
            blockedBy: {
                contains: (target)=>target instanceof Node && this.debugPanel.root.contains(target)
            }
        });
        this.audio = new DemoAudio(this.debugPanel.soundPreferred);
        this.player = new PlayerMob(world.spawn, world.solids, loadedContent.playerAppearance);
        this.itemSystem = new ItemSystem({
            equipmentHolder: this.player
        });
        this.itemFactory = new ItemFactory(loadedContent.registry, loadedContent.itemIconSheets);
        this.camera = new SideViewCamera(world, viewport);
        this.pipeline = new RenderPipeline();
        this.sunLights = DemoApplication.createSunLights();
        this.playerLight = new AttachedLight({
            positionProvider: ()=>({
                    x: this.player.x + this.player.width / 2,
                    y: this.player.y + this.player.height / 2
                }),
            radius: 120,
            color: {
                r: 200,
                g: 220,
                b: 255
            },
            intensity: 0.85
        });
        this.lightingLayer = new LightingLayer(lighting, viewport.width, viewport.height, {});
        this.debugLayer = new DebugLayer(world.solids);
        this.minimap = new DebugMinimap({
            canvas: minimapCanvas,
            worldWidth: world.width,
            worldHeight: world.height,
            tiles: world.tiles,
            sunLights: this.sunLights.map((sun)=>({
                    x: sun.getPosition().x,
                    y: sun.getPosition().y,
                    radius: sun.getLightRadius()
                }))
        });
        this.configureRenderPipeline();
        this.addStarterPickups();
        this.configureDebugPanel();
        this.camera.snapToPlayer(this.player);
        this.engine = new PixelEngine({
            canvas: surface.canvas,
            surface: this.surface,
            width: viewport.width,
            height: viewport.height,
            scale: 'css',
            background: '#1e1a2e',
            loop: {
                update: (deltaSeconds)=>this.update(deltaSeconds),
                render: (_context, renderer)=>this.render(renderer)
            }
        });
    }
    start() {
        this.debugPanel.start();
        this.input.start();
        this.logMapInfo();
        this.engine.start();
    }
    static createSunLights() {
        const sunLights = [];
        const sunSpacingX = 28 * 12;
        const sunSpacingY = 28 * 14;
        const sunRadius = 28 * 10;
        for(let y = 28 * 2; y < world.height - 28 * 4; y += sunSpacingY){
            for(let x = sunSpacingX; x < world.width - sunSpacingX / 2; x += sunSpacingX){
                const insideSolid = world.solids.some((solid)=>x >= solid.x && x <= solid.x + solid.width && y >= solid.y && y <= solid.y + solid.height);
                if (insideSolid) continue;
                sunLights.push(new PointLight({
                    position: {
                        x,
                        y
                    },
                    radius: sunRadius,
                    color: {
                        r: 255,
                        g: 240,
                        b: 180
                    },
                    intensity: 0.9
                }));
            }
        }
        return sunLights;
    }
    configureRenderPipeline() {
        const backgroundLayer = new BackgroundLayer(world);
        const terrainLayer = new TerrainLayer(world);
        const entityLayer = new EntityLayer();
        entityLayer.addMob(this.player);
        entityLayer.setItemProvider(()=>this.itemSystem.getItems());
        this.lightingLayer.setCameraProvider(()=>this.camera.getRect());
        this.lightingLayer.addLight(this.playerLight);
        for (const sun of this.sunLights){
            this.lightingLayer.addLight(sun);
        }
        this.debugLayer.setPlayerRectProvider(()=>this.player.getRect());
        this.debugLayer.setItemRectProvider(()=>this.itemSystem.getDebugRects());
        this.debugLayer.setLightPolygonProvider(()=>this.lightingLayer.activeSunData);
        this.pipeline.addLayer(backgroundLayer);
        this.pipeline.addLayer(terrainLayer);
        this.pipeline.addLayer(entityLayer);
        this.pipeline.addLayer(this.lightingLayer);
        this.pipeline.addLayer(this.debugLayer);
    }
    configureDebugPanel() {
        this.debugPanel.setSoundButtonState(this.audio.state);
        this.debugPanel.setSoundToggleHandler(()=>this.audio.toggle());
    }
    addStarterPickups() {
        this.addStarterPickup('starter-cape', demoContentIds.redCapeItem, 24);
        this.addStarterPickup('starter-sword', demoContentIds.ironSwordItem, 44);
    }
    addStarterPickup(id, itemId, offsetX) {
        const item = this.loadedContent.registry.getItem(itemId);
        this.itemSystem.add(this.itemFactory.createPickup(itemId, {
            x: this.player.x + offsetX,
            y: this.player.y + this.player.height - item.pickup.size.height
        }, id));
    }
    update(deltaSeconds) {
        const updateStart = performance.now();
        const safeDeltaSeconds = Math.min(deltaSeconds, 0.05);
        const playerInput = this.input.readPlayerFrame();
        updateFrameDiagnostics(this.diagnostics, deltaSeconds);
        if (this.debugPanel.isPaused) {
            this.diagnostics.updateMs = 0;
            return;
        }
        for (const cue of this.player.update(safeDeltaSeconds, playerInput)){
            this.audio.playTone(cue);
        }
        this.itemSystem.update();
        this.camera.update(safeDeltaSeconds, this.player);
        this.debugLayer.showCollision = this.debugPanel.showCollision;
        this.debugLayer.showLighting = this.debugPanel.showLighting;
        this.player.noClip = this.debugPanel.noClip;
        this.pipeline.update(safeDeltaSeconds);
        this.diagnostics.rayMs = this.lightingLayer.lastRayMs;
        this.diagnostics.rays = this.lightingLayer.lastRays;
        this.diagnostics.rayChecks = this.lightingLayer.lastRayChecks;
        this.diagnostics.updateMs = performance.now() - updateStart;
    }
    render(renderer) {
        const renderStart = performance.now();
        const cameraRect = this.camera.getRect();
        const frame = {
            renderer,
            camera: cameraRect
        };
        this.pipeline.render(frame);
        this.diagnostics.renderMs = performance.now() - renderStart;
        this.debugPanel.updateMetrics({
            ...this.diagnostics,
            grounded: this.player.grounded,
            velocity: {
                x: this.player.vx,
                y: this.player.vy
            },
            activeSuns: this.lightingLayer.activeSunCount,
            totalSuns: this.lightingLayer.totalSunCount,
            mapSize: `${this.mapTilesW}×${this.mapTilesH}`,
            solids: world.solids.length,
            occluders: world.lightOccluders.length
        });
        this.minimap.render({
            x: this.player.x,
            y: this.player.y
        }, cameraRect);
    }
    logMapInfo() {
        console.log(`[Content] characters=${this.loadedContent.summary.characters.join(', ')} equipment=${this.loadedContent.summary.equipment.join(', ')} items=${this.loadedContent.summary.items.join(', ')} atlases=${this.loadedContent.summary.atlases.length}`);
        console.log(`[Map] ${this.mapTilesW}×${this.mapTilesH} tiles (${world.width}×${world.height}px), ${world.solids.length} solid rects, ${world.lightOccluders.length} light occluders, ${this.sunLights.length} suns`);
    }
}
const application = await DemoApplication.create();
application.start();
