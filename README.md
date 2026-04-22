# ParkQuest - Guided Family Trail Prototype

ParkQuest is a mobile-first web prototype for short, family-friendly park adventures.
The current project focuses on a complete **6-step journey** from choosing a trail to finishing with a reward and quick reflection.

This is a static front-end prototype built with plain HTML and CSS, designed for lightweight user testing and concept validation.

---

## Current Project Scope

The implemented flow now follows this end-to-end structure:

1. **Choose a short adventure** (`amenities.html`)
2. **Review the trail before starting** (`progress.html`)
3. **Follow the route** (`activity.html`)
4. **Reach a discovery stop** (`discovery.html`)
5. **Check practical support** (`support.html`)
6. **Finish the short trail** (`completion.html`)

Design intent across all steps:

- Low uncertainty at start (duration, distance, facilities visible)
- Guidance without over-directing (calm route support)
- Short playful discovery moments for parent + child
- Practical comfort support during the walk
- Clear closure and motivation to return

---

## Tech Stack

| Layer | Technology |
|---|---|
| Structure | Semantic HTML5 |
| Styling | Modular CSS (`base.css`, `layout.css`, `components.css` via `style.css`) |
| Interactions | Simple HTML navigation and button states (no runtime app logic required) |
| Fonts & icons | Google Fonts (Plus Jakarta Sans, Work Sans), Material Symbols Outlined |

---

## Repository Structure (Current)

```txt
Prototype/
├── amenities.html          # Step 1: choose a short adventure
├── progress.html           # Step 2: trail overview before start
├── activity.html           # Step 3: route guidance map + next stop card
├── discovery.html          # Step 4: checkpoint mini challenge
├── support.html            # Step 5: practical amenities support
├── completion.html         # Step 6: completion reward + quick feedback
├── css/
│   ├── base.css            # Tokens, typography, reset
│   ├── layout.css          # App shell, headers, nav, page layout
│   ├── components.css      # All page components for step 1-6
│   └── style.css           # CSS entry file (imports all CSS modules)
├── js/
│   └── modules.js/         # Reserved folder (no active JS modules in current flow)
└── README.md
```

---

## Step-by-Step Page Notes

### Step 1 - `amenities.html`
- Presents short trail choices for quick family decision-making
- Highlights trail length, distance, and key amenities icons
- Emphasizes confidence: short, simple, family-friendly

### Step 2 - `progress.html`
- Reframed as **Trail Overview**
- Shows 20-minute context, loop mini map, and 3 discovery stops
- Includes practical essentials before committing to start

### Step 3 - `activity.html`
- Main guided route screen
- Focuses on "Next stop", remaining distance/time, and minimal map controls
- Keeps cognitive load low so users can focus on the park

### Step 4 - `discovery.html`
- Checkpoint activity with one short playful prompt
- Includes audio option and skip option
- Encourages shared parent-child interaction with minimal reading

### Step 5 - `support.html`
- "Make your visit easier" support view
- Shows nearby toilets, water, shade, and accessibility with walking times
- Marks whether support points are on-route or nearby

### Step 6 - `completion.html`
- Clear closure with reward badge ("Nature Explorer")
- Two low-effort reflection questions
- Encourages repeat use with "Try another trail"

---

## User Flow Links (Implemented)

- `amenities.html` -> `progress.html`
- `progress.html` -> `activity.html` (Start trail)
- `activity.html` -> `discovery.html` (I'm here)
- `activity.html` -> `support.html` (Make visit easier)
- `discovery.html` -> `completion.html` (Try the challenge)
- `completion.html` -> `amenities.html` (Try another trail)

---

## Run Locally

Because this is a static prototype, any simple HTTP server works.

Examples:

- Python: `python -m http.server 8080`
- Node: `npx serve .`
- Cursor / VSCode: Live Server extension

Then open:

- `http://localhost:8080/amenities.html` (recommended start for current flow), or
- any specific page directly.

No build step, package manager, or backend is required.

---

## Known Limitations

- Some buttons are intentionally lightweight and non-persistent (prototype behavior)
- No backend, authentication, analytics, or data storage
- Some image assets are remote demo images
- A few legacy script tags may still exist in older pages, but the current flow works as a static UI prototype

---

## Next Suggested Enhancements

- Add lightweight state persistence (current trail, completed stops, feedback choices)
- Replace demo map illustrations with real geospatial data
- Add accessibility pass (focus states, keyboard flow, contrast checks, alt text polish)
- Add bilingual content support if needed for testing

---

## License

Prototype code and content are for concept demonstration and iterative design/testing.
