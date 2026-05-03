# 06_MOBILE_WEB_CONSTRAINTS

## Targets

1. **iPhone Safari** (canary device) — must work
2. **Android Chrome** — must work
3. **Desktop browser** — should work (mouse/touch fallback)

If iPhone Safari breaks, the build fails. Other browsers are not allowed to compensate.

## Tap-to-begin splash (micro-spec)

The first 1.5 seconds of every session.

- Black canvas, soft pond ambient already playing at 30% volume (autoplay-allowed since silent on iOS by default)
- "Reel Mobile" wordmark fades in over 800ms in muted gold
- Single tap dismisses with 600ms cross-fade

**The single tap performs all of these:**
1. Resume `AudioContext` (Web Audio unlock)
2. Request fullscreen via `document.documentElement.requestFullscreen()` (silent fail allowed)
3. Attempt orientation lock to portrait (silent fail allowed)
4. Start session timer
5. Initialise `tracking.ts` session object
6. Trigger one-time haptic pulse (`navigator.vibrate(10)` — iOS will silently ignore)

No menu. No settings. No "press start." One tap, in.

## iOS Safari foot-guns

### Viewport
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1">
```

Use `100dvh`, never `100vh`. iOS Safari URL bar makes `100vh` wrong.

Use safe-area insets:
```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

### Touch handling

On the canvas:
```css
touch-action: none;
user-select: none;
-webkit-user-select: none;
-webkit-touch-callout: none;
overscroll-behavior: none;
```

On UI buttons:
```css
touch-action: manipulation;
```

In JS, all touch event handlers must call `e.preventDefault()` on `touchstart` to prevent system menus, text selection, and force-touch preview.

### Audio unlock

Web Audio is gated behind a user gesture on iOS Safari. The Tap-to-begin splash is the unlock. Do not attempt to play sounds before that tap is registered.

```ts
const ctx = new (window.AudioContext || window.webkitAudioContext)();
// Do nothing until user gesture
onFirstTap(() => {
  ctx.resume();
  audioReady = true;
});
```

### Vibrate API

`navigator.vibrate()` is **silently ignored on iOS Safari**. Always feature-detect. Never rely on haptics for critical feedback. Provide visual + audio fallback for every haptic event.

### WebGL context loss

Safari kills the GL context when:
- Tab is backgrounded
- Memory pressure spikes
- Device sleeps

**Required handlers:**
```ts
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  // Pause game loop, show "Restoring..." overlay
});
canvas.addEventListener('webglcontextrestored', () => {
  // Reload textures, geometry, resume game loop
});
```

Without this, the game dies on tab resume.

### Pinch zoom

Even with viewport meta locked, two-finger gestures fire `gesturestart`. Block them:
```ts
document.addEventListener('gesturestart', e => e.preventDefault());
```

## Orientation

**Portrait-first**, not strict orientation lock. Browser orientation lock is unreliable outside fullscreen.

If the device rotates to landscape and the composition breaks:
- Show a soft overlay: "Rotate back to portrait"
- Pause the game
- Resume on rotation back

Do not block landscape entirely. Just don't render the game in it.

## WebGL fallback

If WebGL is unavailable or context creation fails:
- Show "Reel Mobile needs WebGL. Update your browser or try a different device."
- Do not silently render a black canvas.

## Performance triggers

If FPS drops below 30 for >5 seconds:
1. Drop renderer pixel ratio: 2 → 1.5 → 1
2. Reduce particle count by 50%
3. Disable secondary post-processing
4. Recover when FPS holds 55+ for 10 seconds

Specified in `07_PERFORMANCE_BUDGET.md`.

## Accessibility

- Respect `prefers-reduced-motion: reduce`
  - Dampen water animation to 30%
  - Reduce screen shake to 30%
  - Disable optional particle effects
- Minimum touch target size: 44×44pt
- Colour palette must pass contrast for UI text against pond background (use overlay strip if needed)

## What we never do

- Use `position: fixed` on game UI without testing iOS URL bar collapse
- Rely on `100vh`
- Assume `Notification.requestPermission()` works (deferred to PWA M7)
- Use `localStorage` from server components (Next.js gotcha)
- Assume autoplay video/audio works without user gesture
