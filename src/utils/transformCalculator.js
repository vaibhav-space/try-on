import { LANDMARKS, POSE_LANDMARKS } from './landmarkIndices'

/**
 * Transform Calculator
 * Calculates positioning, scaling, and rotation for glasses overlay
 * based on MediaPipe face landmarks
 */

// Smoothing factor for exponential moving average (0 = no smoothing, 1 = max smoothing)
const SMOOTHING_FACTOR = 0.5

// Previous frame values for smoothing
let previousValues = {
    x: null,
    y: null,
    scale: null,
    rotation: null,
    skewX: null,
    skewY: null
}

/**
 * Smooth a value using exponential moving average
 */
function smooth(current, previous, factor = SMOOTHING_FACTOR) {
    if (previous === null) return current
    return previous + (current - previous) * (1 - factor)
}

/**
 * Calculate Euclidean distance between two points
 */
function distance(p1, p2) {
    return Math.sqrt(
        Math.pow(p2.x - p1.x, 2) +
        Math.pow(p2.y - p1.y, 2) +
        Math.pow((p2.z || 0) - (p1.z || 0), 2)
    )
}

/**
 * Calculate midpoint between two points
 */
function midpoint(p1, p2) {
    return {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: ((p1.z || 0) + (p2.z || 0)) / 2
    }
}

/**
 * Extract Euler angles from MediaPipe's 4x4 transformation matrix
 * The matrix is in column-major order (16 floats)
 * @param {Object} matrix - MediaPipe facialTransformationMatrix
 * @returns {Object} { yaw, pitch, roll } in radians
 */
function extractAnglesFromMatrix(matrix) {
    if (!matrix || !matrix.data || matrix.data.length < 16) {
        return null
    }

    // MediaPipe returns column-major 4x4 matrix
    // Layout: [m00,m10,m20,m30, m01,m11,m21,m31, m02,m12,m22,m32, m03,m13,m23,m33]
    const m = matrix.data

    // Extract rotation components (3x3 rotation matrix is in top-left)
    // Column-major: m[col * 4 + row]
    const m00 = m[0], m10 = m[1], m20 = m[2]
    const m01 = m[4], m11 = m[5], m21 = m[6]
    const m02 = m[8], m12 = m[9], m22 = m[10]

    // Extract Euler angles (ZYX convention which is common for face tracking)
    // These formulas work for most rotation orders
    let pitch, yaw, roll

    // Check for gimbal lock
    if (Math.abs(m20) >= 0.9999) {
        // Gimbal lock - use fallback
        yaw = 0
        pitch = m20 > 0 ? -Math.PI / 2 : Math.PI / 2
        roll = Math.atan2(-m01, m11)
    } else {
        pitch = Math.asin(-m20)  // Pitch (up/down)
        yaw = Math.atan2(m10, m00)  // Yaw (left/right)
        roll = Math.atan2(m21, m22)  // Roll (tilt)
    }

    return { yaw, pitch, roll }
}

/**
 * Calculate angle between two points (for roll fallback)
 */
function angleBetween(p1, p2) {
    return Math.atan2(p2.y - p1.y, p2.x - p1.x)
}

/**
 * Estimate head yaw (left-right rotation) from landmarks
 * Uses the difference in z-coordinates of left and right face points
 */
function estimateYaw(landmarks) {
    const leftEye = landmarks[LANDMARKS.LEFT_EYE.OUTER_CORNER]
    const rightEye = landmarks[LANDMARKS.RIGHT_EYE.OUTER_CORNER]
    const noseTip = landmarks[POSE_LANDMARKS.NOSE_TIP]

    // Calculate the center point between eyes
    const eyeCenter = midpoint(leftEye, rightEye)

    // Nose offset from center indicates yaw
    const noseOffset = noseTip.x - eyeCenter.x
    const eyeDistance = distance(leftEye, rightEye)

    // Normalize by eye distance and convert to angle estimate
    // Positive = turning right, Negative = turning left
    const yawFactor = noseOffset / eyeDistance

    // Also use z-depth difference between eyes
    const zDiff = (leftEye.z || 0) - (rightEye.z || 0)

    // Combine both signals (tuned empirically)
    return Math.atan(yawFactor * 2 + zDiff * 3)
}

/**
 * Estimate head pitch (up-down rotation) from landmarks
 */
function estimatePitch(landmarks) {
    const noseBridge = landmarks[LANDMARKS.NOSE.BRIDGE_TOP]
    const chin = landmarks[POSE_LANDMARKS.CHIN]
    const forehead = landmarks[LANDMARKS.FACE.FOREHEAD_CENTER]

    // Distance from forehead to nose vs nose to chin
    const upperFace = distance(forehead, noseBridge)
    const lowerFace = distance(noseBridge, chin)

    // Ratio indicates pitch - looking up = more lower face visible
    const ratio = lowerFace / (upperFace + lowerFace)

    // Convert to angle estimate (neutral is ~0.55 ratio)
    return (ratio - 0.55) * 2
}

/**
 * Main transform calculation function - Enhanced 2.5D version
 * @param {Array} landmarks - Array of 478 landmarks from MediaPipe
 * @param {number} canvasWidth - Width of the rendering canvas
 * @param {number} canvasHeight - Height of the rendering canvas
 * @param {Object} glassesConfig - Product-specific configuration
 * @param {Object} faceMatrix - Optional 4x4 transformation matrix from MediaPipe
 * @param {number} frameWidthMM - Frame width in millimeters (for trueSize mode)
 * @param {string} sizingMode - 'aesthetic' (default) or 'trueSize'
 * @returns {Object} Transform data for PixiJS sprite
 */
export function calculateGlassesTransform(landmarks, canvasWidth, canvasHeight, glassesConfig = {}, faceMatrix = null, frameWidthMM = 140, sizingMode = 'aesthetic') {
    if (!landmarks || landmarks.length < 468) {
        return null
    }

    // Default configuration
    const config = {
        verticalOffset: glassesConfig.verticalOffset ?? 0.02,
        bridgeOffset: glassesConfig.bridgeOffset || 0,
        widthMultiplier: glassesConfig.widthMultiplier ?? 0.85, // Face width multiplier for aesthetic mode (0.8-0.9 = natural fit)
        ...glassesConfig
    }

    // Get key landmarks
    const leftEyeOuter = landmarks[LANDMARKS.LEFT_EYE.OUTER_CORNER]
    const rightEyeOuter = landmarks[LANDMARKS.RIGHT_EYE.OUTER_CORNER]
    const leftEyeInner = landmarks[LANDMARKS.LEFT_EYE.INNER_CORNER]
    const rightEyeInner = landmarks[LANDMARKS.RIGHT_EYE.INNER_CORNER]
    // Temple landmarks for face width estimation (approximate locations)
    const leftTemple = landmarks[234] || leftEyeOuter
    const rightTemple = landmarks[454] || rightEyeOuter

    // === Calculate Face Width in Pixels ===
    // Temple to Temple distance gives us face width
    const faceWidthPx = distance(
        { x: leftTemple.x * canvasWidth, y: leftTemple.y * canvasHeight },
        { x: rightTemple.x * canvasWidth, y: rightTemple.y * canvasHeight }
    )

    // === Calculate Target Width Based on Sizing Mode ===
    let targetPixelWidth

    // Always calculate pixelsPerMM for debug output
    const REFERENCE_FACE_WIDTH_MM = 145  // Average human face width
    const pixelsPerMM = faceWidthPx / REFERENCE_FACE_WIDTH_MM

    if (sizingMode === 'trueSize') {
        // === TRUESIZE MODE: Physics-based Scaling ===
        // Frame size in mm → pixels (actual physical size)
        targetPixelWidth = frameWidthMM * pixelsPerMM
    } else {
        // === AESTHETIC MODE: Face-Proportional Scaling (DEFAULT) ===
        // Glasses width = face width * multiplier
        // This makes EVERY glasses look good on any face, regardless of actual frame size
        // Typical multiplier: 1.1 - 1.35 (glasses slightly wider than face looks natural)
        targetPixelWidth = faceWidthPx * config.widthMultiplier
    }

    // === Angles ===
    // For yaw and pitch, use matrix if available, otherwise estimate
    let yaw, pitch
    const matrixAngles = extractAnglesFromMatrix(faceMatrix)

    if (matrixAngles) {
        yaw = matrixAngles.yaw
        pitch = matrixAngles.pitch
    } else {
        yaw = estimateYaw(landmarks)
        pitch = estimatePitch(landmarks)
    }

    // ALWAYS use landmark-based roll - it's more stable and accurate
    const roll = angleBetween(
        { x: leftEyeOuter.x * canvasWidth, y: leftEyeOuter.y * canvasHeight },
        { x: rightEyeOuter.x * canvasWidth, y: rightEyeOuter.y * canvasHeight }
    )

    // === Dynamic anchor point based on head rotation ===
    const outerEyeDistance = distance(leftEyeOuter, rightEyeOuter)
    const eyeCenter = midpoint(leftEyeInner, rightEyeInner)

    // Shift anchor based on yaw (turning head right moves anchor left)
    const yawOffset = Math.sin(yaw) * outerEyeDistance * 0.3

    // Shift anchor based on pitch (looking up moves glasses up slightly)
    const pitchOffset = Math.sin(pitch) * 0.02

    const position = {
        x: eyeCenter.x * canvasWidth + config.bridgeOffset + yawOffset * canvasWidth,
        y: (eyeCenter.y + config.verticalOffset + pitchOffset) * canvasHeight
    }

    // === Asymmetric perspective scaling ===
    // When head turns right (positive yaw), right side of glasses should appear smaller
    const perspectiveStrength = 0.25  // How much perspective distortion to apply
    const yawEffect = Math.sin(yaw) * perspectiveStrength

    const scale = 1 // Placeholder, will be used by TryOnCanvas via targetPixelWidth instead

    // Calculate perspective skew - stronger effect from yaw
    const skewX = Math.sin(yaw) * 0.25

    // Vertical skew from pitch
    const skewY = Math.sin(pitch) * 0.08

    // Apply smoothing
    const smoothedX = smooth(position.x, previousValues.x)
    const smoothedY = smooth(position.y, previousValues.y)
    const smoothedWidth = smooth(targetPixelWidth, previousValues.scale) // Reusing scale slot for width
    const smoothedRotation = smooth(roll, previousValues.rotation, 0.3)
    const smoothedSkewX = smooth(skewX, previousValues.skewX)
    const smoothedSkewY = smooth(skewY, previousValues.skewY)

    // Update previous values
    previousValues = {
        x: smoothedX,
        y: smoothedY,
        scale: smoothedWidth, // Storing width here for smoothing continuity
        rotation: smoothedRotation,
        skewX: smoothedSkewX,
        skewY: smoothedSkewY
    }

    return {
        x: smoothedX,
        y: smoothedY,
        targetPixelWidth: smoothedWidth, // The key output for physics scaling
        scale: 1, // Legacy return, ignored by updated TryOnCanvas
        rotation: smoothedRotation,
        skewX: smoothedSkewX,
        skewY: smoothedSkewY,

        // Raw values for debugging
        raw: {
            ipd: distance(leftEyeInner, rightEyeInner),
            faceWidthPx,
            pixelsPerMM,
            yaw: yaw * (180 / Math.PI),
            pitch: pitch * (180 / Math.PI),
            roll: roll * (180 / Math.PI)
        }
    }
}

/**
 * Reset smoothing (call when face is lost to prevent jump when face returns)
 */
export function resetSmoothing() {
    previousValues = {
        x: null,
        y: null,
        scale: null,
        rotation: null,
        skewX: null,
        skewY: null
    }
}

/**
 * Check if face is in a good position for try-on
 * @param {Array} landmarks - Face landmarks
 * @returns {Object} Status and guidance message
 */
export function checkFacePosition(landmarks) {
    if (!landmarks || landmarks.length < 468) {
        return { ok: false, message: 'No face detected' }
    }

    const leftEye = landmarks[LANDMARKS.LEFT_EYE.OUTER_CORNER]
    const rightEye = landmarks[LANDMARKS.RIGHT_EYE.OUTER_CORNER]
    const noseTip = landmarks[POSE_LANDMARKS.NOSE_TIP]

    // Check if face is too far to one side
    const faceCenter = (leftEye.x + rightEye.x) / 2
    if (faceCenter < 0.25) {
        return { ok: false, message: 'Move right' }
    }
    if (faceCenter > 0.75) {
        return { ok: false, message: 'Move left' }
    }

    // Check if face is too small (too far from camera)
    const ipd = distance(leftEye, rightEye)
    if (ipd < 0.06) {
        return { ok: false, message: 'Move closer' }
    }
    if (ipd > 0.25) {
        return { ok: false, message: 'Move back' }
    }

    // Check extreme head rotation
    const yaw = Math.abs(estimateYaw(landmarks))
    if (yaw > 0.6) {
        return { ok: false, message: 'Face forward' }
    }

    return { ok: true, message: '' }
}
