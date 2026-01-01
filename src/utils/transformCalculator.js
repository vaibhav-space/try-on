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
 * Calculate angle between two points (for roll)
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
 * Main transform calculation function
 * @param {Array} landmarks - Array of 478 landmarks from MediaPipe
 * @param {number} canvasWidth - Width of the rendering canvas
 * @param {number} canvasHeight - Height of the rendering canvas
 * @param {Object} glassesConfig - Product-specific configuration
 * @returns {Object} Transform data for PixiJS sprite
 */
export function calculateGlassesTransform(landmarks, canvasWidth, canvasHeight, glassesConfig = {}) {
    if (!landmarks || landmarks.length < 468) {
        return null
    }

    // Default configuration
    const config = {
        widthMultiplier: glassesConfig.widthMultiplier || 1.35,  // How much wider than IPD
        verticalOffset: glassesConfig.verticalOffset ?? 0.02,    // Offset from eye level (positive = lower)
        bridgeOffset: glassesConfig.bridgeOffset || 0,           // Fine-tune horizontal centering
        ...glassesConfig
    }

    // Get key landmarks
    const leftEyeOuter = landmarks[LANDMARKS.LEFT_EYE.OUTER_CORNER]
    const rightEyeOuter = landmarks[LANDMARKS.RIGHT_EYE.OUTER_CORNER]
    const leftEyeInner = landmarks[LANDMARKS.LEFT_EYE.INNER_CORNER]
    const rightEyeInner = landmarks[LANDMARKS.RIGHT_EYE.INNER_CORNER]
    const noseBridge = landmarks[LANDMARKS.NOSE.BRIDGE_TOP]

    // Calculate interpupillary distance (IPD) - the key scaling reference
    const ipd = distance(leftEyeInner, rightEyeInner)

    // Calculate glasses width based on outer eye corners + multiplier
    const outerEyeDistance = distance(leftEyeOuter, rightEyeOuter)
    const glassesWidth = outerEyeDistance * config.widthMultiplier

    // Position: center between inner eye corners, with vertical offset
    const eyeCenter = midpoint(leftEyeInner, rightEyeInner)
    const position = {
        x: eyeCenter.x * canvasWidth + config.bridgeOffset,
        y: (eyeCenter.y + config.verticalOffset) * canvasHeight  // ADD offset (positive = down)
    }

    // Rotation (roll): angle between outer eye corners
    // Use left to right order for correct angle orientation
    const roll = angleBetween(
        { x: leftEyeOuter.x * canvasWidth, y: leftEyeOuter.y * canvasHeight },
        { x: rightEyeOuter.x * canvasWidth, y: rightEyeOuter.y * canvasHeight }
    )

    // Estimate yaw and pitch for perspective effects
    const yaw = estimateYaw(landmarks)
    const pitch = estimatePitch(landmarks)

    // Scale based on IPD (normalized to typical face)
    // Base reference: IPD of ~0.12 in normalized coordinates is "average"
    const baseIPD = 0.10
    const scale = (ipd / baseIPD) * (glassesWidth / outerEyeDistance)

    // Calculate perspective skew from yaw
    // When head turns right (positive yaw), left side should appear larger
    const skewX = Math.sin(yaw) * 0.15  // Reduced for subtlety

    // Vertical skew from pitch (minimal for glasses)
    const skewY = Math.sin(pitch) * 0.05

    // Apply smoothing
    const smoothedX = smooth(position.x, previousValues.x)
    const smoothedY = smooth(position.y, previousValues.y)
    const smoothedScale = smooth(scale, previousValues.scale)
    const smoothedRotation = smooth(roll, previousValues.rotation, 0.4)  // More smoothing on rotation
    const smoothedSkewX = smooth(skewX, previousValues.skewX)
    const smoothedSkewY = smooth(skewY, previousValues.skewY)

    // Update previous values
    previousValues = {
        x: smoothedX,
        y: smoothedY,
        scale: smoothedScale,
        rotation: smoothedRotation,
        skewX: smoothedSkewX,
        skewY: smoothedSkewY
    }

    return {
        x: smoothedX,
        y: smoothedY,
        scale: smoothedScale,
        rotation: smoothedRotation,
        skewX: smoothedSkewX,
        skewY: smoothedSkewY,

        // Raw values for debugging
        raw: {
            ipd,
            yaw: yaw * (180 / Math.PI),  // Convert to degrees
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
