import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Application, Sprite, Texture, Container, Assets, BlurFilter, Graphics, ColorMatrixFilter } from 'pixi.js'
import { useFaceTracking } from '../hooks/useFaceTracking'
import { calculateGlassesTransform, checkFacePosition, resetSmoothing } from '../utils/transformCalculator'
import { calculateFitConfidence } from '../utils/fitCalculator'

/**
 * TryOnCanvas Component
 * Main try-on experience with PixiJS WebGL rendering
 * Supports multi-angle 2.5D sprite rendering
 */
const TryOnCanvas = forwardRef(({
    selectedProduct,
    products,
    onProductChange,
    onFitCalculated,
    showDebug = false,
    sizingMode = 'aesthetic'  // 'aesthetic' (default) or 'trueSize'
}, ref) => {
    const containerRef = useRef(null)
    const videoRef = useRef(null)
    const appRef = useRef(null)
    const glassesContainerRef = useRef(null)
    const shadowRef = useRef(null)
    const brightnessFilterRef = useRef(null)
    const reflectionRef = useRef(null)

    // Multi-angle sprite refs: { 0: Sprite, 15: Sprite, 30: Sprite, 45: Sprite }
    const angleSpriteRefs = useRef({})
    const loadedSpritesRef = useRef({})

    // Expose screenshot method to parent
    useImperativeHandle(ref, () => ({
        takeScreenshot: async () => {
            if (!appRef.current || !appRef.current.renderer) return null
            try {
                // Ensure latest render
                appRef.current.render()
                // Extract canvas content as image
                const image = await appRef.current.renderer.extract.base64(appRef.current.stage)
                return image
            } catch (err) {
                console.error('Screenshot failed:', err)
                return null
            }
        }
    }))


    const [cameraReady, setCameraReady] = useState(false)
    const [cameraError, setCameraError] = useState(null)
    const [canvasSize, setCanvasSize] = useState({ width: 640, height: 480 })
    const [faceStatus, setFaceStatus] = useState({ ok: false, message: 'Initializing...' })
    const [debugInfo, setDebugInfo] = useState(null)

    const { landmarks, faceMatrix, faceCount, isLoading, error, isTracking, startTracking, stopTracking, checkLighting } = useFaceTracking(videoRef)

    // Helper to check conditions periodically and apply dynamic lighting
    useEffect(() => {
        const interval = setInterval(() => {
            if (!cameraReady) return

            // Check lighting and apply dynamic brightness
            if (checkLighting) {
                const lightingData = checkLighting()
                if (lightingData) {
                    // Update face status based on lighting
                    if (lightingData.status === 'low') {
                        setFaceStatus(prev => prev.ok ? { ok: true, message: 'Lighting is dim' } : prev)
                    }

                    // Dynamic Lighting: DISABLED - was causing black glasses
                    if (brightnessFilterRef.current) {
                        brightnessFilterRef.current.brightness(1.0, false)
                    }
                }
            }
        }, 500)

        return () => clearInterval(interval)
    }, [cameraReady, checkLighting])

    // Initialize camera
    useEffect(() => {
        let stream = null

        async function initCamera() {
            try {
                // Request camera with optimal settings for face tracking
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1280, max: 1920 },
                        height: { ideal: 720, max: 1080 },
                        frameRate: { ideal: 30, max: 60 }
                    },
                    audio: false
                })

                if (videoRef.current) {
                    videoRef.current.srcObject = stream

                    videoRef.current.onloadedmetadata = () => {
                        const { videoWidth, videoHeight } = videoRef.current
                        setCanvasSize({ width: videoWidth, height: videoHeight })
                        videoRef.current.play()
                        setCameraReady(true)
                    }
                }
            } catch (err) {
                console.error('Camera access error:', err)
                setCameraError(
                    err.name === 'NotAllowedError'
                        ? 'Camera access denied. Please allow camera access and refresh.'
                        : 'Unable to access camera. Please check your camera settings.'
                )
            }
        }

        initCamera()

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }, [])

    // Initialize PixiJS
    useEffect(() => {
        if (!containerRef.current || !cameraReady) return

        let app = null

        async function initPixi() {
            // Create PixiJS Application
            app = new Application()

            await app.init({
                width: canvasSize.width,
                height: canvasSize.height,
                backgroundAlpha: 0,
                antialias: true,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            })

            // Add canvas to container
            containerRef.current.appendChild(app.canvas)

            // Create video texture
            const videoTexture = Texture.from(videoRef.current)
            const videoSprite = new Sprite(videoTexture)

            // Mirror the video horizontally (selfie mode)
            videoSprite.anchor.set(0.5, 0.5)
            videoSprite.position.set(canvasSize.width / 2, canvasSize.height / 2)
            videoSprite.scale.x = -1  // Flip horizontally

            app.stage.addChild(videoSprite)

            // Create glasses container (for proper transform origin)
            const glassesContainer = new Container()
            glassesContainer.sortableChildren = true
            app.stage.addChild(glassesContainer)
            glassesContainerRef.current = glassesContainer

            // Create nose bridge shadow for realism
            const bridgeShadowGraphics = new Graphics()
            bridgeShadowGraphics.fill({ color: 0x000000, alpha: 0.2 })
            bridgeShadowGraphics.ellipse(0, 0, 25, 8)
            bridgeShadowGraphics.fill()

            const shadowTexture = app.renderer.generateTexture(bridgeShadowGraphics)
            const shadowSprite = new Sprite(shadowTexture)
            shadowSprite.anchor.set(0.5, 0.5)
            shadowSprite.visible = false
            shadowSprite.zIndex = 10  // Above glasses

            const blurFilter = new BlurFilter()
            blurFilter.blur = 4
            shadowSprite.filters = [blurFilter]

            glassesContainer.addChild(shadowSprite)
            shadowRef.current = shadowSprite

            // Create brightness filter for dynamic lighting
            const brightnessFilter = new ColorMatrixFilter()
            brightnessFilterRef.current = brightnessFilter

            // Create lens reflection sprite
            const reflectionGraphics = new Graphics()
            reflectionGraphics.fill({ color: 0xFFFFFF, alpha: 0.15 })
            reflectionGraphics.ellipse(0, 0, 60, 30)
            reflectionGraphics.fill()

            const reflectionTexture = app.renderer.generateTexture(reflectionGraphics)
            const reflectionSprite = new Sprite(reflectionTexture)
            reflectionSprite.anchor.set(0.5, 0.5)
            reflectionSprite.visible = false
            reflectionSprite.zIndex = 20
            reflectionSprite.blendMode = 'add'

            const reflectionBlur = new BlurFilter()
            reflectionBlur.blur = 8
            reflectionSprite.filters = [reflectionBlur]

            glassesContainer.addChild(reflectionSprite)
            reflectionRef.current = reflectionSprite

            appRef.current = app

            // Start face tracking
            startTracking()
        }

        initPixi()

        return () => {
            stopTracking()
            if (app) {
                app.destroy(true, { children: true, texture: true })
            }
        }
    }, [cameraReady, canvasSize, startTracking, stopTracking])

    // Load glasses sprites when product changes
    useEffect(() => {
        if (!glassesContainerRef.current || !selectedProduct || !appRef.current) return

        async function loadGlassesSprites() {
            const container = glassesContainerRef.current

            // Clear existing angle sprites
            Object.values(angleSpriteRefs.current).forEach(sprite => {
                if (sprite && container.children.includes(sprite)) {
                    container.removeChild(sprite)
                }
            })
            angleSpriteRefs.current = {}
            loadedSpritesRef.current = {}

            // Check if product has multi-angle sprites
            if (selectedProduct.sprites) {
                // Load all angle sprites
                const angles = [0, 15, 30, 45]

                for (const angle of angles) {
                    const spritePath = selectedProduct.sprites[angle]
                    if (spritePath) {
                        try {
                            const texture = await Assets.load(spritePath)

                            const sprite = new Sprite(texture)
                            sprite.anchor.set(0.5, 0.5)
                            sprite.visible = false
                            sprite.zIndex = 5
                            sprite.filters = [brightnessFilterRef.current]

                            container.addChild(sprite)
                            angleSpriteRefs.current[angle] = sprite
                            loadedSpritesRef.current[angle] = true
                        } catch (err) {
                            console.error(`Failed to load sprite for angle ${angle}:`, err)
                        }
                    }
                }

                // Show front view by default
                if (angleSpriteRefs.current[0]) {
                    angleSpriteRefs.current[0].visible = true
                }
            } else {
                // Fallback: Load single image for products without multi-angle sprites
                try {
                    const texture = await Assets.load(selectedProduct.image)

                    const sprite = new Sprite(texture)
                    sprite.anchor.set(0.5, 0.5)
                    sprite.visible = true
                    sprite.zIndex = 5
                    sprite.filters = [brightnessFilterRef.current]

                    container.addChild(sprite)
                    angleSpriteRefs.current[0] = sprite
                    loadedSpritesRef.current[0] = true
                } catch (err) {
                    console.error('Failed to load glasses texture:', err)
                }
            }

            // Show shadow
            if (shadowRef.current) {
                shadowRef.current.visible = true
            }
        }

        loadGlassesSprites()
    }, [selectedProduct])

    // Helper function to determine which sprite to show based on yaw
    // Note: Video is mirrored (selfie mode) and sprites have temple arm on RIGHT side
    // - Positive yaw (in mirrored video) = user turning LEFT visually → show original sprite (temple on right = far side)
    // - Negative yaw (in mirrored video) = user turning RIGHT visually → mirror sprite (so temple on left = far side)
    // MediaPipe yaw values are LOWER than actual head rotation, so we use lower thresholds
    const getSpriteForYaw = useCallback((yaw) => {
        const absYaw = Math.abs(yaw)

        // Determine base angle with LOWER thresholds (MediaPipe gives lower yaw values than actual rotation)
        let baseAngle
        if (absYaw < 5) {
            baseAngle = 0       // Nearly straight: use front view
        } else if (absYaw < 12) {
            baseAngle = 15      // Slight turn: use 15° sprite
        } else if (absYaw < 20) {
            baseAngle = 30      // Moderate turn: use 30° sprite
        } else {
            baseAngle = 45      // Strong turn: use 45° sprite
        }

        // In mirrored video:
        // - Positive yaw = head turned left visually → use original sprite (temple on right = behind head)
        // - Negative yaw = head turned right visually → mirror sprite (temple now on left = behind head)
        const shouldMirror = yaw < 0

        return { baseAngle, shouldMirror }
    }, [])

    // Update glasses position based on landmarks
    useEffect(() => {
        if (!landmarks || !appRef.current || !glassesContainerRef.current) {
            // Hide all sprites
            Object.values(angleSpriteRefs.current).forEach(sprite => {
                if (sprite) sprite.visible = false
            })
            if (shadowRef.current) shadowRef.current.visible = false
            return
        }

        // Check if we have any sprites loaded
        if (Object.keys(angleSpriteRefs.current).length === 0) return

        // Check face position
        const status = checkFacePosition(landmarks)
        setFaceStatus(status)

        // Calculate fit confidence
        if (onFitCalculated && selectedProduct) {
            const fitInfo = calculateFitConfidence(landmarks, selectedProduct)
            onFitCalculated(fitInfo)
        }

        // Calculate transform with sizing mode
        const transform = calculateGlassesTransform(
            landmarks,
            canvasSize.width,
            canvasSize.height,
            selectedProduct?.config || {},
            faceMatrix,
            selectedProduct?.frameWidth || 140,
            sizingMode
        )

        if (!transform) {
            Object.values(angleSpriteRefs.current).forEach(sprite => {
                if (sprite) sprite.visible = false
            })
            if (shadowRef.current) shadowRef.current.visible = false
            return
        }

        // Mirror the X position since video is flipped
        const mirroredX = canvasSize.width - transform.x

        // Get yaw for angle selection
        const yaw = transform.raw?.yaw || 0
        const { baseAngle, shouldMirror } = getSpriteForYaw(yaw)

        // Hide all sprites first
        Object.values(angleSpriteRefs.current).forEach(sprite => {
            if (sprite) {
                sprite.visible = false
                sprite.alpha = 0
            }
        })

        // Get the active sprite
        const activeSprite = angleSpriteRefs.current[baseAngle] || angleSpriteRefs.current[0]

        if (!activeSprite || !activeSprite.texture || !activeSprite.texture.width) return

        // Calculate scale
        const finalScale = transform.targetPixelWidth / activeSprite.texture.width

        // Apply transforms
        activeSprite.position.set(mirroredX, transform.y)

        // Apply mirroring based on turn direction
        // When shouldMirror is true (turning right), we flip the sprite
        // Base scale is negative (for video mirror), so we flip sign
        const xScale = shouldMirror ? finalScale : -finalScale
        activeSprite.scale.set(xScale, finalScale)

        activeSprite.rotation = -transform.rotation
        activeSprite.skew.set(0, 0)
        activeSprite.visible = true
        activeSprite.alpha = 1

        // Update nose bridge shadow
        if (shadowRef.current) {
            const bridgeOffsetY = 8 * finalScale
            shadowRef.current.position.set(mirroredX, transform.y + bridgeOffsetY)
            shadowRef.current.scale.set(finalScale * 0.8, finalScale * 0.5)
            shadowRef.current.rotation = -transform.rotation
            shadowRef.current.alpha = 0.25
            shadowRef.current.visible = true
        }

        // Dynamic Lens Reflection
        if (reflectionRef.current && transform.raw) {
            const yawRadians = yaw * (Math.PI / 180)
            const reflectionOffsetX = -Math.sin(yawRadians) * 80 * finalScale
            const reflectionOffsetY = -Math.sin((transform.raw.pitch || 0) * (Math.PI / 180)) * 30 * finalScale

            reflectionRef.current.position.set(
                mirroredX + reflectionOffsetX,
                transform.y - 10 * finalScale + reflectionOffsetY
            )
            reflectionRef.current.scale.set(finalScale * 1.5, finalScale * 0.8)
            reflectionRef.current.rotation = -transform.rotation
            reflectionRef.current.visible = true
        }

        // Update debug info
        if (showDebug && transform.raw) {
            setDebugInfo({
                x: Math.round(mirroredX),
                y: Math.round(transform.y),
                scale: finalScale.toFixed(2),
                yaw: yaw.toFixed(1),
                pitch: (transform.raw.pitch || 0).toFixed(1),
                roll: (transform.raw.roll || 0).toFixed(1),
                activeAngle: baseAngle,
                mirrored: shouldMirror,
                sizingMode
            })
        }
    }, [landmarks, faceMatrix, canvasSize, selectedProduct, showDebug, getSpriteForYaw, onFitCalculated, sizingMode])

    // Handle window resize
    useEffect(() => {
        function handleResize() {
            if (!appRef.current || !videoRef.current) return

            const container = containerRef.current
            if (!container) return

            // Calculate aspect-ratio preserving size
            const containerRect = container.getBoundingClientRect()
            const videoAspect = canvasSize.width / canvasSize.height
            const containerAspect = containerRect.width / containerRect.height

            let displayWidth, displayHeight

            if (containerAspect > videoAspect) {
                displayHeight = containerRect.height
                displayWidth = displayHeight * videoAspect
            } else {
                displayWidth = containerRect.width
                displayHeight = displayWidth / videoAspect
            }

            if (appRef.current.canvas) {
                appRef.current.canvas.style.width = `${displayWidth}px`
                appRef.current.canvas.style.height = `${displayHeight}px`
            }
        }

        handleResize()
        window.addEventListener('resize', handleResize)

        return () => window.removeEventListener('resize', handleResize)
    }, [canvasSize])

    // Error states
    if (cameraError) {
        return (
            <div className="error-container">
                <div className="error-icon">📷</div>
                <p className="error-message">{cameraError}</p>
                <button onClick={() => window.location.reload()} className="retry-button">
                    Try Again
                </button>
            </div>
        )
    }

    if (error) {
        return (
            <div className="error-container">
                <div className="error-icon">⚠️</div>
                <p className="error-message">Face tracking error: {error}</p>
                <button onClick={() => window.location.reload()} className="retry-button">
                    Reload
                </button>
            </div>
        )
    }

    return (
        <div className="tryon-canvas-wrapper">
            {/* Hidden video element for camera feed */}
            <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                style={{ display: 'none' }}
            />

            {/* PixiJS canvas container */}
            <div
                ref={containerRef}
                className="canvas-container"
            />

            {/* Loading overlay */}
            {(isLoading || !cameraReady) && (
                <div className="loading-overlay">
                    <div className="loading-spinner"></div>
                    <p>{!cameraReady ? 'Starting camera...' : 'Loading face tracking...'}</p>
                </div>
            )}

            {/* Face guidance */}
            {!isLoading && cameraReady && !faceStatus.ok && (
                <div className="face-guidance">
                    <p>{faceStatus.message}</p>
                </div>
            )}

            {/* Debug info */}
            {showDebug && isTracking && (
                <div className="debug-info">
                    <p>✓ Tracking Active</p>
                    <p>Landmarks: {landmarks?.length || 0}</p>
                    {debugInfo && (
                        <>
                            <p>Pos: ({debugInfo.x}, {debugInfo.y})</p>
                            <p>Scale: {debugInfo.scale}</p>
                            <p>Yaw: {debugInfo.yaw}°</p>
                            <p>Pitch: {debugInfo.pitch}°</p>
                            <p>Roll: {debugInfo.roll}°</p>
                            <p style={{ color: '#00ff00' }}>Angle: {debugInfo.activeAngle}°</p>
                            <p style={{ color: '#ffff00' }}>Mirror: {debugInfo.mirrored ? 'Yes' : 'No'}</p>
                            <p style={{ color: '#00ffff' }}>Mode: {debugInfo.sizingMode}</p>
                        </>
                    )}
                </div>
            )}
        </div>
    )
})

export default TryOnCanvas
