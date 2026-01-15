# Design System: VibeSync

## 1. Visual Identity: "The Void & The Pulse"
The aesthetic mirrors the bridge between the silent void of code transparency and the electric pulse of human creativity. It is **Dark**, **Minimal**, and **Kinetic**.

- **Theme**: Deep Dark Mode (Cyberpunk/Developer-Centric).
- **Vibe**: Focus, Flow, Clarity, Future-Industrial.

---

## 2. Color Palette

### Primary (The Void)
Backgrounds that recede to let content breathe.
- `Bg-Deep`: `#050505` (Main App Background)
- `Bg-Surface`: `#0F1115` (Cards/Panels)
- `Bg-Glass`: `rgba(15, 17, 21, 0.7)` (Blur: 12px)

### Accents (The Pulse)
Used sparingly to indicate "Vibe" status, intent, and activity.
- `Vibe-Cyan`: `#00F0FF` (New Code / Active Vibe)
- `Intent-Purple`: `#BD00FF` (extracted Intent / AI Logic)
- `Alert-Amber`: `#FFD600` (Drift Detection / Warnings)
- `Success-Green`: `#00FF94` (Spec Synced)

### Typography
- `Text-Primary`: `#EEEEEE`
- `Text-Secondary`: `#888888`
- `Text-Muted`: `#444444`

---

## 3. Typography

### Body & UI
**Font Family**: `Inter`, sans-serif
- **Weights**: Light (300), Regular (400), Medium (500)
- **Use**: General UI, headers, dashboard controls.

### Code & Data
**Font Family**: `JetBrains Mono`, monospace
- **Weights**: Regular (400)
- **Use**: Code snippets, specs, terminal logs, "Mental Model" graphs.

---

## 4. Components & Effects

### Glassmorphism (The HUD)
All floating panels (Dashboard, Spec Viewer) use a glass effect to feel like a "Heads-Up Display" over the code.
```css
.glass-panel {
  background: rgba(15, 17, 21, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
```

### Neon Borders (Active State)
When the "Watcher" detects a change, the UI pulses.
```css
.vibe-active {
  border-color: #00F0FF;
  box-shadow: 0 0 15px rgba(0, 240, 255, 0.2);
}
```

### Micro-Interactions
- **Drift Alert**: A subtle amber glow breathing on the edge of the screen when specs drift.
- **Sync Pulse**: A quick ripple of green light across the top bar when the Spec is updated.

---

## 5. Layout Needs
- **Sidebar**: Collapsible "Spec Stream" (Timeline of changes).
- **Center Stage**: The "Mental Model" Graph (Nodes of features/files).
- **Bottom Bar**: "Vibe Status" (Terminal-like activity log).
