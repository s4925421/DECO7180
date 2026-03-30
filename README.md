# ParkQuest — Mobile Web Prototype

A mobile-first static website for discovering parks and trails in Brisbane, Australia. The UI follows an **“Organic Navigator”** design direction: forest greens, soft surfaces, rounded cards, and glass-style navigation—implemented with plain **HTML, CSS, and JavaScript** (no framework).

---

## Current Status

The prototype is **functionally complete** for core flows: map exploration, amenity-oriented filters, trail browsing, progress/rewards-style screens, settings, and cross-page navigation with a persistent bottom tab bar. Interactive map data uses **Leaflet** with **OpenStreetMap** tiles (no API key required). Search uses the **Photon** geocoding API (OSM-based, browser-friendly) to resolve place names to coordinates.

---

## Tech Stack

| Layer | Technology |
|--------|------------|
| Structure | Semantic HTML5 |
| Styling | Modular CSS (`base`, `layout`, `components` via `style.css`) |
| Behaviour | Vanilla JavaScript (IIFE modules, no bundler) |
| Map | [Leaflet 1.9](https://leafletjs.com/) + OSM raster tiles |
| Fonts & icons | Google Fonts (Plus Jakarta Sans, Work Sans), Material Symbols Outlined |
| Reference assets | `model/DESIGN.md`, `model/code.html` (design notes & legacy Tailwind reference) |

---

## Project Structure

```
Prototype/
├── index.html          # Map home (Leaflet map, search, chips, featured park)
├── amenities.html      # Amenities list + illustrative map block
├── trails.html         # Trail themes with filter chips
├── progress.html       # Progress, missions, badges, saved parks
├── settings.html       # Preferences / about
├── css/
│   ├── base.css        # Design tokens, reset, typography
│   ├── layout.css      # App shell, map stage, navigation, drawer
│   ├── components.css# UI components (cards, chips, popups, etc.)
│   └── style.css       # Imports the above
├── js/
│   ├── maps.js         # Leaflet map, markers, popups, geolocation, search
│   ├── maps-config.js  # Optional tile URL / map config
│   ├── main.js         # Drawer menu, amenity chip events
│   ├── favorites.js    # Renders saved parks on progress page
│   ├── script.js       # Trail list filter chips (trails page)
│   └── navagation.js   # Lightweight global hook (`js-ready` class)
├── Image/              # Design reference screenshots (optional)
└── model/              # Design documentation and planning artifacts
```

---

## Pages Overview

| Page | Purpose |
|------|---------|
| **index.html** | Interactive map, quick filters (toilets, water, shade, seating, all parks), featured park card, side drawer, FABs (locate me, link to amenities) |
| **amenities.html** | Static “facilities near you” list with SVG park illustration |
| **trails.html** | Scrollable trail cards; filter chips (short walk, educational, most active) |
| **progress.html** | Gamified progress UI; **Saved parks** list populated from `localStorage` |
| **settings.html** | Placeholder preferences and about text |

Bottom navigation links **Map**, **My Trails**, **Rewards**, and **Settings** across pages; the active tab is marked with `is-active` in HTML.

---

## Map & Data

- **Tiles**: Default OSM endpoint `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` (configurable in `js/maps-config.js`).
- **Markers**: Four Brisbane-area points of interest (e.g. Roma Street Parkland, South Bank, City Botanic Gardens, New Farm Park) with amenity tags used for chip filtering.
- **Popups**: Links to OpenStreetMap view and OSRM-based directions; “Save park” syncs with `localStorage` (`parkquest_favorites`).
- **Search**: Enter key submits a query to Photon (`photon.komoot.io`), biased toward Brisbane; results pan/zoom the map and drop a temporary marker.
- **Geolocation**: “My location” FAB centers the map when the user grants permission.

---

## Local Development

1. Serve the folder over **HTTP** (Leaflet and `fetch` behave more reliably than `file://`). Examples:
   - **VS Code / Cursor**: “Live Server” or similar extension.
   - **Python**: `python -m http.server 8080` from the project root.
   - **Node**: `npx serve .`
2. Open `http://localhost:<port>/index.html` (or the server root).

No build step or package manager is required.

---

## Configuration

**`js/maps-config.js`** — optional. Exposes `window.PARKQUEST_MAP_CONFIG` with a `tileUrl` string. Replace the default OSM template if you use another compatible XYZ tile provider.

---

## Design Notes

- Colour tokens and “no harsh 1px dividers” guidance are documented in `model/DESIGN.md`.
- Reference mockups live under `Image/`; they informed layout and tone but are not required at runtime.

---

## Browser Support

Targets modern mobile browsers (Chromium, Safari, Firefox) with support for:

- CSS custom properties, `backdrop-filter` (navigation bar), `color-mix` (where used)
- `fetch`, `localStorage`, `navigator.geolocation`

---

## Known Limitations

- Search depends on third-party **Photon** availability and network access.
- Trail cards and some content use remote images (e.g. Unsplash) for demo visuals.
- The site is a **front-end prototype**; there is no backend or user accounts.

---

## License

Content and code are provided as a **prototype** for evaluation or extension. Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright). Respect Nominatim/Photon/OSM [usage policies](https://operations.osmfoundation.org/policies/) if you scale traffic or add server-side geocoding.
