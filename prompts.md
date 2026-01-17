# DALL-E Prompts for Virtual Try-On Multi-Angle Sprites

> **Usage**: Upload the original front glasses image along with each prompt to ChatGPT/DALL-E.
> Each prompt is self-contained with full context and constraints.

---

## Key Insight: 2.5D Temple Arm Strategy

In 2.5D virtual try-on (2D image overlay), we CANNOT realistically show temple arms extending toward ears because there's no depth. Production-grade try-ons (Warby Parker, Lenskart) show:
- **Minimal temple arms**: Only the hinge area or first 1-2cm visible
- **Or NO temple arms**: Just the front frame

**Our strategy**: Show ONLY the front frame portion. Temple arms should be either completely removed or show just a short stub near the hinge.

---

## Images Needed (4 total, mirror for 8 views)

| Prompt | Angle | Mirror → |
|--------|-------|----------|
| 1 | Front (0°) | N/A |
| 2 | Left 15° | → Right 15° |
| 3 | Left 30° | → Right 30° |
| 4 | Left 45° | → Right 45° |

**To get RIGHT views**: Horizontally flip the LEFT images

---

## 1. FRONT VIEW (0°) — Face Looking Straight

```
This eyeglasses image will be used in a 2.5D VIRTUAL TRY-ON application where a 2D glasses image is overlaid on a user's face.

Generate a FRONT-FACING view of these SAME glasses showing ONLY the front frame.

WHAT TO SHOW:
- The two lenses with their full frame rims
- The nose bridge connecting the lenses
- The hinges on each side (where temple arms attach)
- Optional: A very short stub (1-2cm) of temple arm near hinge

WHAT TO REMOVE:
- REMOVE all temple arms (the long parts that go to ears)
- OR show only a tiny stub near the hinge, nothing more
- Temple arms should NOT extend outward or be visible beyond the hinge area

DO NOT:
- DO NOT show full temple arms extending to the sides
- DO NOT show temple arms pointing in any direction
- DO NOT add any background

REQUIREMENTS:
- Transparent PNG background (completely transparent, no white or any color)
- Show ONLY the front frame: lenses, rims, nose bridge, hinges
- Remove or minimize temple arms (short stub at hinge maximum)
- Keep exact same frame style, color, material, lens shape, proportions
- High quality, clean product photography style
- Output ONLY the glasses, nothing else
```

---

## 2. LEFT 15° — User Turning Head LEFT

```
This eyeglasses image will be used in a 2.5D VIRTUAL TRY-ON application where a 2D glasses image is overlaid on a user's face.

Generate this SAME pair of glasses rotated 15 degrees (as if wearer turned head LEFT), showing ONLY the front frame with minimal temple arms.

WHAT TO SHOW:
- The front frame with correct 15° perspective
- Right lens appears slightly larger (closer to camera)
- Left lens appears slightly smaller (farther from camera)
- Hinges visible on both sides
- Optional: A short stub of the RIGHT temple arm near hinge (1-2cm max)

WHAT TO REMOVE:
- REMOVE the LEFT temple arm completely (hidden behind head)
- REMOVE or minimize the RIGHT temple arm (show only short stub if any)
- No full-length temple arms

DO NOT:
- DO NOT show any temple arm extending toward ears
- DO NOT show temple arms longer than a short stub
- DO NOT show the LEFT temple arm at all
- DO NOT add any background

REQUIREMENTS:
- Transparent PNG background (completely transparent)
- Show ONLY front frame with 15° left rotation perspective
- Temple arms: removed or very short stub only
- Keep exact same frame style, color, material, proportions
- High quality, clean product photography style
- Output ONLY the glasses, nothing else
```

---

## 3. LEFT 30° — User Turning Head LEFT More (3/4 View)

```
Generate a high-quality product image for a 2.5D virtual try-on system.

Object: Eyeglasses front frame ONLY (intentionally incomplete object).

View & Perspective:
- 30° left head rotation (3/4 view)
- Right lens closer and visibly larger
- Left lens farther and narrower due to foreshortening
- Strong, realistic perspective distortion

Geometry Constraints (CRITICAL):
- The eyeglasses consist ONLY of:
  - Front frame
  - Lenses
  - Nose bridge
  - Right hinge block
- NO full temple arms exist in this image.
- LEFT temple arm DOES NOT EXIST.
- RIGHT temple arm DOES NOT EXIST beyond a hinge stub.
- The right hinge may include a stub no longer than 2–3 cm.
- No geometry extends backward toward ears.

Exclusions:
- Do NOT generate any full or partial temple arms
- Do NOT imply temples via shadows, reflections, or outlines
- Do NOT crop or hide temples — they must be absent from geometry

Style:
- Exact same frame style, color, material, and thickness as reference
- Clean, professional product photography
- Sharp edges, realistic lighting

Background:
- Fully transparent PNG (true alpha, no gray or white background)

Output:
- Only the glasses object
- No background, no props, no text
```

---

## 4. LEFT 45° — User Turning Head LEFT Fully (Near Profile)

```
This eyeglasses image will be used in a 2.5D VIRTUAL TRY-ON application where a 2D glasses image is overlaid on a user's face.

Generate this SAME pair of glasses rotated 45 degrees (near-profile view, wearer turned head LEFT), showing ONLY the front frame.

WHAT TO SHOW:
- The front frame with correct 45° perspective
- Right lens dominant in view (larger, closer)
- Left lens very narrow, almost edge-on
- Right hinge clearly visible
- Optional: Short stub of RIGHT temple arm (3-4cm showing the beginning near hinge)

WHAT TO REMOVE:
- REMOVE the LEFT temple arm completely
- Minimize the RIGHT temple arm (show only beginning near hinge)
- No full-length temple arms

DO NOT:
- DO NOT show temple arms extending toward ears
- DO NOT show more than a short portion of temple arm
- DO NOT show the LEFT temple arm
- DO NOT add any background

REQUIREMENTS:
- Transparent PNG background (completely transparent)
- Show ONLY front frame with 45° left rotation
- Extreme perspective: right lens dominant, left lens edge-on
- Temple arms: minimal stub only
- Keep exact same frame style, color, material
- High quality, clean product photography style
- Output ONLY the glasses, nothing else
```

---

## File Naming Convention

Save in `/public/images/[product-id]/`:
```
front.png      → Prompt 1
left-15.png    → Prompt 2 (mirror for right-15.png)
left-30.png    → Prompt 3 (mirror for right-30.png)
left-45.png    → Prompt 4 (mirror for right-45.png)
```

---

## Common AI Mistakes & Fixes

| Problem | Reply With |
|---------|------------|
| White/colored background | "Make background completely transparent, not white" |
| Full temple arms showing | "Remove temple arms, show only the front frame. Maximum a 2cm stub near hinge" |
| Temple arms toward ears | "Remove all temple arms. In 2.5D we only show the front frame" |
| Both sides showing temple | "Remove ALL temple arms from both sides, or very short stubs only" |
| Left arm visible (in left rotation) | "Remove the LEFT temple arm completely, it's hidden behind head" |
| Proportions changed | "Keep exact same frame design, thickness, lens shape as original" |
| Wrong perspective | "Apply stronger/weaker perspective for [X] degrees rotation" |
