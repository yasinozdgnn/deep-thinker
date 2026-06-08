# Project Development TODO

[x] Task 1: # Implementation Strategy: `selam.html`

## 1. Document Structure

- **HTML5** with `lang="tr"`.
- All CSS embedded inside `<style>` in `<head>`.
- All JavaScript embedded inside a single `<script>` at the end of `<body>`.
- External dependency: only **Orbitron** font from Google Fonts (load via `<link>`).

## 2. CSS Design Tokens (CSS Custom Properties)

Define the following custom properties inside `:root`:

```
--color-bg-start: #0a0e27
--color-bg-end: #161a3b
--color-grid: rgba(0, 150, 255, 0.08)
--color-text: #ffffff
--color-glow: #00bfff
--color-border-base: rgba(0, 191, 255, 0.4)
--color-border-glow: rgba(0, 191, 255, 0.9)
--font-display: 'Orbitron', sans-serif
--transition-speed: 300ms
```

## 3. Layout & Centering

Use a **flexbox** layout on `<body>`:

```
display: flex
justify-content: center
align-items: center
min-height: 100vh
margin: 0
overflow: hidden
background: linear-gradient(135deg, var(--color-bg-start), var(--color-bg-end))
position: relative
```

Create a `<main>` container element with `id="container"`:

```
position: relative
display: flex
justify-content: center
align-items: center
padding: 2rem 4rem
```

## 4. Grid Background Pattern

Apply to `<body>` using `background-size` on a pseudo-element or directly on `body`:

```
background-image:
  linear-gradient(rgba(0,150,255,0.1) 1px, transparent 1px),
  linear-gradient(90deg, rgba(0,150,255,0.1) 1px, transparent 1px)
background-size: 40px 40px
```

## 5. Cyperpunk Text Styling (`h1`)

- Font: `var(--font-display)` with `font-weight: 700`.
- Color: `var(--color-text)`.
- Font size: `clamp(2.5rem, 8vw, 6rem)` for responsiveness.
- **Neon glow** via multiple `text-shadow` layers:

```
text-shadow:
  0 0 7px var(--color-glow),
  0 0 10px var(--color-glow),
  0 0 21px var(--color-glow),
  0 0 42px var(--color-glow),
  0 0 82px var(--color-glow)
```

- **Premium UX**: Add a `transition` on `text-shadow` over `var(--transition-speed)` so that hover intensifies the glow.

## 6. Animated Border Container

Wrap the `<h1>` inside a `<div id="border-box">` (or use the `<main>` as the container). Apply:

```
border: 2px solid var(--color-border-base)
border-radius: 8px
padding: 2rem 4rem
position: relative
overflow: hidden
background: rgba(0, 0, 0, 0.2)
backdrop-filter: blur(4px)
```

**Animated border effect** using a pseudo-element (`::before`) that is a rotating gradient or a sweeping line.

Method 1: Rotating conic‑gradient overflow hidden on the parent:

```css
#border-box::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: conic-gradient(
    transparent,
    var(--color-border-glow),
    transparent 30%,
    transparent 70%,
    var(--color-border-glow),
    transparent
  );
  animation: spinBorder 4s linear infinite;
  z-index: -1;
}

@keyframes spinBorder {
  100% { transform: rotate(360deg); }
}
```

Then give the container a `background` value to cover the pseudo‑element, so only the border shows.

Method 2 (simpler): Use a `border-image` with animation, but the gradient approach is more robust.

## 7. Interactive JavaScript Enhancements

Although the file is mostly static, include minimal **state handling** and **event listeners** for a “Premium UX”.

### 7.1 State Object
Define a small state object:

```js
const state = {
  glowIntensity: 1,
  gridVisible: true
};
```

### 7.2 Event Listener: Click Toggle on Container
When the user clicks the main heading, toggle an additional CSS class `glow-pulse` that intensifies the glow momentarily (play a keyframe animation).

- Add event listener to `h1`:
  - Toggle class `glow-intense`
- CSS:
  - `glow-intense` sets `text-shadow` with doubled spread radii and a 500ms transition.
  - Optionally, after 300ms remove the class (use `setTimeout` inside the listener).

### 7.3 Optional: Double‑click to Toggle Grid
On the `body`, listen for `dblclick` to toggle `--hidden-grid` class.

```js
document.body.addEventListener('dblclick', () => {
  document.body.classList.toggle('no-grid');
  state.gridVisible = !state.gridVisible;
});
```
CSS:
```css
body.no-grid { background-image: none; }
```

### 7.4 Window Load Animation
Add a `onload` or `DOMContentLoaded` listener that adds an `animate-in` class to the container to fade in and slide up.

- Initial state: `opacity: 0; transform: translateY(20px)`
- `animate-in`: `opacity: 1; transform: translateY(0); transition: all 1s cubic-bezier(0.25, 1, 0.5, 1)`

## 8. Premium UX Animations (CSS Keyframes)

Define the following keyframes inside `<style>`:

### 8.1 `glowPulse`
```
@keyframes glowPulse {
  0%, 100% { text-shadow: ... (base) }
  50% { text-shadow: ... (intense, larger blur) }
}
```

### 8.2 `borderGlow`
Already the conic‑gradient rotation.

### 8.3 `fadeSlideIn`
Used for initial page load.

## 9. Responsive & Accessibility

- Add `meta viewport` tag.
- Ensure color contrast: white on dark blue passes WCAG AAA.
- Provide `prefers-reduced-motion` media query to reduce all animations.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## 10. Final File Structure

```
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Merhaba Dünya</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap" rel="stylesheet">
  <style>
    /* All CSS here */
  </style>
</head>
<body>
  <main id="container">
    <div id="border-box">
      <h1 id="hello-text">Merhaba Dünya</h1>
    </div>
  </main>
  <script>
    // All JavaScript here
  </script>
</body>
</html>
```

## 11. Coding Rules

- Use only **single quotes** for CSS and JavaScript string literals.
- No unused CSS rules or JS variables.
- Prefer `const` over `let` where possible.
- Add comments only for non‑obvious behaviour (e.g., specific animation reasoning).
- Ensure no errors in browser console (no console.log in production).
- Lint automatically: no missing semicolons, correct indentation (2 spaces) .

## 12. DRY & SOLID Implementation

- CSS custom properties avoid token duplication.
- The `glow` function is unified; no multiple repeated shadow definitions.
- Animation keyframes are reusable (pulse applies to both hover and pulse class).
- JavaScript state object allows easy future extensions.

## 13. Final Verification Checklist

- [ ] Page loads with no external requests except Google Fonts.
- [ ] Text “Merhaba Dünya” centered, white, neon glow.
- [ ] Background is dark blue gradient with subtle grid lines.
- [ ] Container has animated glowing border (rotation conic‑gradient).
- [ ] Font is Orbitron.
- [ ] On hover over heading, glow intensifies.
- [ ] Click on heading triggers a pulse animation.
- [ ] Double‑click on body toggles grid visibility.
- [ ] Initial fade‑in animation on load.
- [ ] Respects `prefers-reduced-motion`.
- [ ] All code lint‑clean.

Proceed to implement `selam.html` exactly as specified.
