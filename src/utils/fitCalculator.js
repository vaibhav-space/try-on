import { LANDMARKS } from './landmarkIndices'

/**
 * Fit Calculator
 * Calculates how well glasses fit based on face measurements
 */

// Average face width to frame width ratio (based on ergonomic studies)
// Face width is typically measured at temples/cheekbones
const AVERAGE_FACE_WIDTH_MM = 145  // Average adult face width at temples

/**
 * Calculate distance between two landmarks
 */
function distance(p1, p2) {
    return Math.sqrt(
        Math.pow(p2.x - p1.x, 2) +
        Math.pow(p2.y - p1.y, 2)
    )
}

/**
 * Estimate face width in mm from landmarks
 * Uses outer eye corners + scaling factor to approximate temple width
 * @param {Array} landmarks - Face landmarks from MediaPipe
 * @param {number} ipd - Interpupillary distance in normalized coords
 * @returns {number} Estimated face width in mm
 */
export function estimateFaceWidth(landmarks) {
    if (!landmarks || landmarks.length < 468) {
        return null
    }

    // Get outer eye corners
    const leftEyeOuter = landmarks[LANDMARKS.LEFT_EYE.OUTER_CORNER]
    const rightEyeOuter = landmarks[LANDMARKS.RIGHT_EYE.OUTER_CORNER]

    // Get temple/cheekbone landmarks for wider measurement
    // Landmark 234 = left temple, 454 = right temple (approximate)
    const leftTemple = landmarks[234] || leftEyeOuter
    const rightTemple = landmarks[454] || rightEyeOuter

    // Calculate normalized temple width
    const templeWidth = distance(leftTemple, rightTemple)

    // Convert to mm using IPD as reference
    // Average IPD is ~63mm, and in normalized coords it's typically ~0.10-0.12
    const outerEyeWidth = distance(leftEyeOuter, rightEyeOuter)
    const avgIPDmm = 63  // mm
    const avgIPDNorm = 0.10  // normalized

    // Scale factor: mm per normalized unit
    const scaleFactor = avgIPDmm / avgIPDNorm

    // Temple width is typically 1.1-1.15x outer eye width
    const estimatedFaceWidthMM = templeWidth * scaleFactor * 1.1

    return Math.round(estimatedFaceWidthMM)
}

/**
 * Calculate fit confidence for a glasses frame
 * @param {Array} landmarks - Face landmarks
 * @param {Object} product - Product with frameWidth property
 * @returns {Object} { fitLabel, fitScore, recommendation }
 */
export function calculateFitConfidence(landmarks, product) {
    if (!landmarks || !product || !product.frameWidth) {
        return {
            fitLabel: 'Unable to determine',
            fitScore: 0,
            recommendation: null,
            faceWidth: null
        }
    }

    const faceWidth = estimateFaceWidth(landmarks)

    if (!faceWidth) {
        return {
            fitLabel: 'Measuring...',
            fitScore: 0,
            recommendation: null,
            faceWidth: null
        }
    }

    const frameWidth = product.frameWidth
    const difference = frameWidth - faceWidth

    // Determine fit based on difference
    let fitLabel, fitScore, recommendation

    if (Math.abs(difference) <= 5) {
        // Perfect match
        fitLabel = 'Perfect Fit'
        fitScore = 100
        recommendation = 'These frames match your face width perfectly!'
    } else if (Math.abs(difference) <= 10) {
        // Good fit
        fitLabel = 'Good Fit'
        fitScore = 85
        recommendation = difference > 0
            ? 'Slightly wider than your face - comfortable fit'
            : 'Slightly narrower - snug fit'
    } else if (difference > 10 && difference <= 20) {
        // Frame is larger
        fitLabel = 'Slightly Large'
        fitScore = 65
        recommendation = 'These frames may feel loose on your face'
    } else if (difference < -10 && difference >= -20) {
        // Frame is smaller
        fitLabel = 'Slightly Small'
        fitScore = 65
        recommendation = 'These frames may feel tight on your face'
    } else if (difference > 20) {
        // Too large
        fitLabel = 'May Be Too Large'
        fitScore = 40
        recommendation = 'Consider a smaller frame size'
    } else {
        // Too small
        fitLabel = 'May Be Too Small'
        fitScore = 40
        recommendation = 'Consider a larger frame size'
    }

    return {
        fitLabel,
        fitScore,
        recommendation,
        faceWidth,
        frameWidth,
        difference
    }
}

/**
 * Get fit status color for UI
 * @param {number} fitScore 
 * @returns {string} CSS color value
 */
export function getFitColor(fitScore) {
    if (fitScore >= 85) return '#22c55e'  // Green - great fit
    if (fitScore >= 65) return '#eab308'  // Yellow - okay fit
    return '#ef4444'  // Red - poor fit
}

/**
 * Get a simple fit indicator emoji
 * @param {number} fitScore 
 * @returns {string} Emoji
 */
export function getFitEmoji(fitScore) {
    if (fitScore >= 85) return '✓'
    if (fitScore >= 65) return '~'
    return '✗'
}
