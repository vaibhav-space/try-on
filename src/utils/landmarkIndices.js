/**
 * MediaPipe Face Mesh Landmark Indices
 * Reference: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
 * 
 * Total landmarks: 478 (468 face + 10 iris)
 */

// Eye landmarks - critical for glasses positioning
export const LANDMARKS = {
    // Left eye (from viewer's perspective, person's right eye)
    LEFT_EYE: {
        OUTER_CORNER: 33,
        INNER_CORNER: 133,
        TOP: 159,
        BOTTOM: 145,
        CENTER: 468  // Iris center (if iris tracking enabled)
    },

    // Right eye (from viewer's perspective, person's left eye)
    RIGHT_EYE: {
        OUTER_CORNER: 263,
        INNER_CORNER: 362,
        TOP: 386,
        BOTTOM: 374,
        CENTER: 473  // Iris center (if iris tracking enabled)
    },

    // Nose landmarks - for vertical positioning
    NOSE: {
        BRIDGE_TOP: 6,      // Between eyes, top of bridge
        BRIDGE_MID: 168,    // Middle of nose bridge
        TIP: 1,             // Tip of nose
        BOTTOM: 2           // Bottom of nose
    },

    // Forehead and face outline
    FACE: {
        FOREHEAD_CENTER: 10,
        CHIN: 152,
        LEFT_CHEEK: 234,
        RIGHT_CHEEK: 454,
        LEFT_TEMPLE: 127,
        RIGHT_TEMPLE: 356
    },

    // Ear proximity points (for temple arm occlusion)
    EARS: {
        LEFT_TOP: 234,
        LEFT_TRAGION: 93,
        RIGHT_TOP: 454,
        RIGHT_TRAGION: 323
    }
}

// Indices used for head pose estimation
export const POSE_LANDMARKS = {
    // These 6 points are commonly used for head pose estimation
    NOSE_TIP: 1,
    CHIN: 152,
    LEFT_EYE_OUTER: 33,
    RIGHT_EYE_OUTER: 263,
    LEFT_MOUTH_CORNER: 61,
    RIGHT_MOUTH_CORNER: 291
}

// Subset of landmarks we need for glasses placement (for performance)
export const GLASSES_LANDMARKS = [
    LANDMARKS.LEFT_EYE.OUTER_CORNER,
    LANDMARKS.LEFT_EYE.INNER_CORNER,
    LANDMARKS.RIGHT_EYE.OUTER_CORNER,
    LANDMARKS.RIGHT_EYE.INNER_CORNER,
    LANDMARKS.NOSE.BRIDGE_TOP,
    LANDMARKS.NOSE.BRIDGE_MID,
    LANDMARKS.FACE.LEFT_TEMPLE,
    LANDMARKS.FACE.RIGHT_TEMPLE,
    POSE_LANDMARKS.NOSE_TIP,
    POSE_LANDMARKS.CHIN
]
