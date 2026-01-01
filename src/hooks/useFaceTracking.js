import { useEffect, useRef, useState, useCallback } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { resetSmoothing } from '../utils/transformCalculator'

/**
 * Custom hook for MediaPipe Face Landmarker
 * Handles initialization, video processing, and cleanup
 */
export function useFaceTracking(videoRef, options = {}) {
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState(null)
    const [landmarks, setLandmarks] = useState(null)
    const [isTracking, setIsTracking] = useState(false)

    const landmarkerRef = useRef(null)
    const animationFrameRef = useRef(null)
    const lastVideoTimeRef = useRef(-1)

    const {
        maxFaces = 1,
        minDetectionConfidence = 0.5,
        minTrackingConfidence = 0.5,
        runningMode = 'VIDEO'
    } = options

    // Initialize MediaPipe Face Landmarker
    useEffect(() => {
        let isMounted = true

        async function initializeLandmarker() {
            try {
                setIsLoading(true)
                setError(null)

                // Load WASM files from CDN
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
                )

                // Create Face Landmarker with lite model for mobile performance
                const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
                        delegate: 'GPU'  // Use GPU acceleration when available
                    },
                    runningMode: runningMode,
                    numFaces: maxFaces,
                    minFaceDetectionConfidence: minDetectionConfidence,
                    minFacePresenceConfidence: minTrackingConfidence,
                    minTrackingConfidence: minTrackingConfidence,
                    outputFaceBlendshapes: false,  // Don't need these
                    outputFacialTransformationMatrixes: false  // Don't need these either
                })

                if (isMounted) {
                    landmarkerRef.current = landmarker
                    setIsLoading(false)
                }
            } catch (err) {
                console.error('Failed to initialize Face Landmarker:', err)
                if (isMounted) {
                    setError(err.message || 'Failed to load face tracking')
                    setIsLoading(false)
                }
            }
        }

        initializeLandmarker()

        return () => {
            isMounted = false
            if (landmarkerRef.current) {
                landmarkerRef.current.close()
                landmarkerRef.current = null
            }
        }
    }, [maxFaces, minDetectionConfidence, minTrackingConfidence, runningMode])

    // Process video frames
    const processFrame = useCallback(() => {
        const video = videoRef.current
        const landmarker = landmarkerRef.current

        if (!video || !landmarker || video.paused || video.ended) {
            animationFrameRef.current = requestAnimationFrame(processFrame)
            return
        }

        // Only process new frames
        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime

            try {
                const startTimeMs = performance.now()
                const results = landmarker.detectForVideo(video, startTimeMs)

                if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                    // Use first face
                    setLandmarks(results.faceLandmarks[0])
                    setIsTracking(true)
                } else {
                    setLandmarks(null)
                    setIsTracking(false)
                    resetSmoothing()  // Reset smoothing when face is lost
                }
            } catch (err) {
                console.error('Face detection error:', err)
            }
        }

        animationFrameRef.current = requestAnimationFrame(processFrame)
    }, [videoRef])

    // Start/stop tracking based on video state
    const startTracking = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }
        animationFrameRef.current = requestAnimationFrame(processFrame)
    }, [processFrame])

    const stopTracking = useCallback(() => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
            animationFrameRef.current = null
        }
        setIsTracking(false)
        setLandmarks(null)
        resetSmoothing()
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [])

    return {
        landmarks,
        isLoading,
        error,
        isTracking,
        startTracking,
        stopTracking
    }
}
