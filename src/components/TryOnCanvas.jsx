import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
import { Application, Sprite, Texture, Container, Assets, BlurFilter, Graphics, ColorMatrixFilter } from 'pixi.js'
import { useFaceTracking } from '../hooks/useFaceTracking'
import { calculateGlassesTransform, checkFacePosition, resetSmoothing } from '../utils/transformCalculator'
import { calculateFitConfidence } from '../utils/fitCalculator'

/**
 * TryOnCanvas Component
 * Main try-on experience with PixiJS WebGL rendering
 */
const TryOnCanvas = forwardRef(({
    selectedProduct,
    products,
    onProductChange,
    onFitCalculated,
    showDebug = false
}, ref) => {
    const containerRef = useRef(null)
    const videoRef = useRef(null)
    const appRef = useRef(null)
    const glassesRef = useRef(null)
    const shadowRef = useRef(null)

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

    // Helper to check conditions periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (!cameraReady) return

            // Check lighting
            if (checkLighting) {
                const lighting = checkLighting()
                if (lighting === 'low') {
                    setFaceStatus(prev => prev.ok ? { ok: true, message: 'Lighting is dim' } : prev)
                }
            }
        }, 2000) // Check every 2s

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

            // Create nose bridge shadow for realism
            // This creates the illusion of depth where glasses rest on nose
            const bridgeShadowGraphics = new Graphics()
            bridgeShadowGraphics.fill({ color: 0x000000, alpha: 0.2 })
            // Small ellipse for nose bridge contact point
            bridgeShadowGraphics.ellipse(0, 0, 25, 8)
            bridgeShadowGraphics.fill()

            const shadowTexture = app.renderer.generateTexture(bridgeShadowGraphics)
            const shadowSprite = new Sprite(shadowTexture)
            shadowSprite.anchor.set(0.5, 0.5)
            shadowSprite.visible = false
            shadowSprite.zIndex = 3  // Above glasses for overlay effect

            // Subtle blur for soft shadow edge
            const blurFilter = new BlurFilter()
            blurFilter.blur = 4
            shadowSprite.filters = [blurFilter]

            glassesContainer.addChild(shadowSprite)
            shadowRef.current = shadowSprite

            // Create glasses sprite (will be updated when product changes)
            const glassesSprite = new Sprite()
            glassesSprite.anchor.set(0.5, 0.5)
            glassesSprite.visible = false
            glassesSprite.zIndex = 2

            glassesContainer.addChild(glassesSprite)
            glassesRef.current = glassesSprite

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

    // Load glasses texture when product changes
    useEffect(() => {
        if (!glassesRef.current || !selectedProduct) return

        async function loadGlasses() {
            try {
                // Load the glasses texture
                const texture = await Assets.load(selectedProduct.image)

                if (glassesRef.current) {
                    glassesRef.current.texture = texture
                    // Scale will be handled by the physics engine in the render loop
                    glassesRef.current.visible = true

                    // Update shadow
                    if (shadowRef.current) {
                        shadowRef.current.visible = true
                    }
                }
            } catch (err) {
                console.error('Failed to load glasses texture:', err)
            }
        }

        loadGlasses()
    }, [selectedProduct])



    // Update glasses position based on landmarks
    useEffect(() => {
        if (!landmarks || !glassesRef.current || !appRef.current) {
            if (glassesRef.current) {
                glassesRef.current.visible = false
            }
            if (shadowRef.current) {
                shadowRef.current.visible = false
            }
            return
        }

        // Check face position
        const status = checkFacePosition(landmarks)
        setFaceStatus(status)

        // Calculate fit confidence
        if (onFitCalculated && selectedProduct) {
            const fitInfo = calculateFitConfidence(landmarks, selectedProduct)
            onFitCalculated(fitInfo)
        }

        // Calculate transform with enhanced 2.5D and PHYSICS SCALING
        const transform = calculateGlassesTransform(
            landmarks,
            canvasSize.width,
            canvasSize.height,
            selectedProduct?.config || {},
            faceMatrix,
            selectedProduct?.frameWidth || 140 // Pass the real frame width in mm
        )

        if (!transform) {
            glassesRef.current.visible = false
            if (shadowRef.current) {
                shadowRef.current.visible = false
            }
            return
        }

        // Apply transforms to glasses sprite
        // Mirror the X position since video is flipped
        const mirroredX = canvasSize.width - transform.x

        // Get the base scale from the texture (set when product loads)
        const texture = glassesRef.current.texture
        if (!texture || !texture.width) return

        // PHYSICS SCALING:
        // transform.targetPixelWidth is the onscreen pixel width derived from physical mm width
        const finalScale = transform.targetPixelWidth / texture.width

        glassesRef.current.position.set(mirroredX, transform.y)
        // Use NEGATIVE X scale for horizontal mirror, POSITIVE Y to keep right-side up
        // Use uniform scale for both axes to avoid asymmetric lens sizes
        glassesRef.current.scale.set(-finalScale, finalScale)
        glassesRef.current.rotation = -transform.rotation  // Negate for mirrored display

        // Remove all skew effects - they cause more problems than they solve
        // The rotation alone handles head tilt correctly
        glassesRef.current.skew.set(0, 0)

        glassesRef.current.visible = true

        // Update nose bridge shadow - positioned at bridge of nose
        if (shadowRef.current) {
            // Shadow sits slightly below glasses center (on nose bridge)
            const bridgeOffsetY = 8 * finalScale  // Small offset down
            shadowRef.current.position.set(mirroredX, transform.y + bridgeOffsetY)
            shadowRef.current.scale.set(finalScale * 0.8, finalScale * 0.5)
            shadowRef.current.rotation = -transform.rotation
            shadowRef.current.alpha = 0.25  // Subtle shadow
            shadowRef.current.visible = true
        }

        // Update debug info
        if (showDebug && transform.raw) {
            setDebugInfo({
                x: Math.round(mirroredX),
                y: Math.round(transform.y),
                scale: transform.scale.toFixed(2),
                yaw: transform.raw.yaw.toFixed(1),
                pitch: transform.raw.pitch.toFixed(1),
                roll: transform.raw.roll.toFixed(1)
            })
        }
    }, [landmarks, faceMatrix, canvasSize, selectedProduct, showDebug])

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
                        </>
                    )}
                </div>
            )}
        </div>
    )
})

export default TryOnCanvas
