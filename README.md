# MineScope

A map for community workshops about mining projects, starting with Dominga in La Higuera, Chile. Developed in the context of the Minerals Stewardship Consortium, with MIT City Science and the MIT Media Lab.

**[Open MineScope](https://cityscope.media.mit.edu/MineScope/)**

## The map

- Continuous wheel and trackpad zoom, anchored to the pointer.
- Community notes move directly from location totals to a brief individual-dot view, then larger icons. Terrain zoom 11.35 starts dots and zoom 12 starts icons; 2D fallback uses equivalent thresholds one level higher. Icons are 32 px with 44 px targets and hover/keyboard-focus highlighting.
- Four backgrounds: Night terrain, Satellite, Map and Topography.
- Three geography layers for protected areas, watercourses and catchments, loaded directly from the government SIMBIO services.
- Seven project and community layers for locations, ecosystems, water, community notes, case-study themes and project questions.
- Community and social-feed examples grouped by location, topic and sentiment, with platform marks.
- A looping collection timeline with play, pause, date scrubbing and playback speed. The location summary shows the latest matching note as it arrives. Opening a note pauses playback.
- A regional sentiment-balance map and four concentration maps on a shared scale, with topic, date and source filters.
- Typography, surfaces and visualization colors aligned with MineScope Radar.
- Selected comments use a large marker and a line to their detail panel that follows map movement and zoom, including in cluster view.
- Source references and links for map features.
- Workshop notes with location selection and GeoJSON export.
- Desktop and mobile layouts, with a collapsible sidebar in portrait orientation.

The opening view uses 3D Night terrain, a dark slate-blue OpenFreeMap map with Mapterhorn elevation, with only the three Community layers enabled and the Map layers tab open. Geography and Project start off; each group has a Show all / Hide all control, alongside the control for all layers. The overview starts at zoom 9.95, centred at 29.400° S, 71.270° W, with a 54° pitch. Site visits land at zoom 13.15 and 58° pitch. Night terrain and Satellite are the two backgrounds; the 3D/2D control changes pitch. Elevation is shown at 1.35× vertical scale. Terrain, basemap tiles, labels and fonts load from their original providers; no downloaded terrain package is published.

## Run locally

The complete site is in `dist/`. It uses HTML, CSS, JavaScript and Leaflet; no build step or package installation is required.

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:4173/>. An internet connection is needed for background maps and government geography services.

Run `node --test tests/*.test.cjs` to check wheel input, animation timing, zoom limits, example-data provenance, collection filters, arrival placement and heat-map calculations.

## Scenario table

Open `scenario/` from the **Scenario table** header link. Drag/lift/drop the amber tailings handle freely, or use arrow keys on its label (Shift for larger steps). The terrain footprint, illustrative pipeline, three impact indicators and company fund update during movement. Click a KPI for its causal chain, compare with the case-study El Negrillo anchor, and use Layers to change projections. The KPI display and legend sit on a physical monitor behind the table. Orbiting is restricted to front views; resizing preserves camera zoom and direction, while Reset explicitly refits the view.

The table now matches the latest user-supplied GeoJSON rectangle for La Higuera: approximately **47.308 × 47.068 km**, with a near-square horizontal aspect ratio. The frame maps longitude and latitude directly so every edge follows the exact GeoJSON boundary; UTM zone 19S is used to calculate its horizontal dimensions. North is the rear edge. A 513 × 513 elevation grid is resampled at about 90 m from live Mapzen / Tilezen Terrarium tiles, with 2.8× vertical exaggeration. Elevation and ocean masking replace the earlier procedural hills and coastline. Attribution: SRTM / GMTED terrain courtesy of USGS; ETOPO1 bathymetry courtesy of NOAA. The DEM-derived shoreline is approximate. Eight principal settlement centers load live from OpenStreetMap; displayed building blocks are illustrative. Watercourses (including seasonal quebradas), protected areas, catchments, agricultural land and occupied land load directly from Chile MMA's SIMBIO services. Source information and limitations are available from the table's extent badge. No supplied ZIP, imagery, PDFs or downloaded spatial datasets are bundled. Elevation failures stop loading with a retry option; missing optional sources are explicitly identified as incomplete.

The amber object is an oversized handle. Its projected **185 ha** demonstration footprint uses the real horizontal scale. Whole-footprint placement checks use open-water overlap, SIMBIO protected areas / wetlands, mapped occupied land and settlement vicinity, the study boundary, and illustrative terrain thresholds (150 m relief or slope above 0.35). Invalid candidates turn red while moving; funding cannot clear these constraints. A passing candidate does not establish engineering feasibility or legal suitability. Plant and El Negrillo anchors retain the supplied case-study map references. Routing, impact scores, downhill pollution traces, dust/noise and all budgets remain demonstration calculations, not measured exposure or engineering predictions. The earlier forced 12.2 km route calibration is removed; displayed corridor distances now use the table's actual geographic scale.

The illustrative **US$20M fund** pays site setup first (US$2M plus US$0.18M per location-cost point, capped at the fund), then protections in selection order: water US$2.8M, habitat US$3.15M, dust/noise US$1.75M, monitoring US$1.4M and closure US$2.1M. Benefits scale with the funded share; unfunded selections regain allocations at cheaper locations. Removing a selection releases its funds. The TV donut shows the allocations and remaining balance. Five attached cylinders use blue, green, amber, violet and pink, with dashed links to the tailings. Each funded cylinder emits its own activity rings; partial fills and translucent dashed ghosts show missing funding. Monitoring supports oversight without reducing physical risk scores. The tray's info button explains each protection. All layers start visible; protected and productive areas use restrained hatching with thin edges.

A configurable **two-way WebSocket link** exchanges normalized table position, geographic coordinates, lift/drop phase and ordered protection selections. Browser edits send full state; incoming physical patches update the scene, KPIs and fund without changing the camera. No endpoint is embedded or required for local operation. Movement is coalesced at 20 Hz; discrete changes and final drops send immediately. Echo rejection, validation, backpressure, reconnect and snapshot resynchronization are included. This is independent of the existing Unity client. See [the protocol and calibration guide](docs/physical-table-api.md) for runtime configuration, message examples and a localhost relay / physical-client simulator.

All rendering code and Three.js r180 dependencies live in `dist/scenario/` (MIT license in `vendor/`). Matte ivory relief, resin emission / approximate scattering, a cool TV emitter, restrained bloom, animated ocean swells and seamless studio atmosphere retain the existing visual design. The renderer uses a one-million-pixel target, adaptive terrain detail (full 90 m grid when zoomed in), ocean / empty-overlay triangle culling, cached static shadows, inexpensive surface glows for the protection cylinders, and scattering on the resin pieces. Drag events coalesce to one geography calculation per animation frame; terrain-aware routes are precomputed from the fixed plant. Protection toggles reuse the location checks and existing geometry. Settlement blocks use one instanced draw; label measurements are batched before positioning. Placement exclusion reasons follow the tailings piece in a compact label. Idle animation stays at 30 fps; active interactions render on animation frames. `?profile=1` exposes DOM diagnostics for CPU costs, drawing-buffer size and shader counts; these do not measure GPU completion or actual display latency.

Run `node --test tests/scenario-*.test.mjs` for coordinate round trips, DEM decoding, geographic footprint scale, suitability, fund conservation, camera persistence, synchronization and rendering-policy checks. The relay integration test uses real local WebSocket connections and requires permission to bind a localhost port. The relay and simulator are outside `dist/` and are not published by Pages.

## Kiosk demo

After 30 seconds without pointer, touch, keyboard or scroll activity, the app starts the timeline at 2× and visits all six settlements in order, changing location every 10 seconds and looping continuously. A pulsing “Running in demo mode” label appears in the header. Interaction ends the tour, returns to the whole area and plays the timeline at 1×. The header’s Demo button starts the tour immediately and keeps it running during pointer movement, so Full screen can be selected next. Stop demo or click/scroll/type elsewhere to return to the overview. Full screen uses the browser’s fullscreen API and can be exited using the same button or Escape. Open dialogs, note placement and hidden tabs suspend the tour. Automatic tour movements do not send Unity scene commands; those remain tied to user location selections.

## Unity location messages

Select Los Choros or El Trapiche to send one `site.load` POST to `https://mining.mistermatti.com/events`, using `LosChoros_Diorama` or `ElTrapiche_Diorama`. Location cards, map location clusters and the location selector use the same handler. Other locations, individual notes, timeline playback and map pan/zoom send nothing. Repeated location selections each send a new message, as requested; there are no automatic retries or camera commands.

Open the app with `?unityKey=YOUR_KEY` to connect, for example `https://cityscope.media.mit.edu/MineScope/?unityKey=YOUR_KEY`. A `#unityKey=YOUR_KEY` fragment is also accepted. No key is embedded in the app or saved in browser storage. The app reads the key into memory and immediately removes it from the address bar; open the original keyed link again after a reload. A no-referrer policy keeps the page URL out of requests to map and asset providers. The supplied key is sent only as an Authorization header to the fixed Unity server. Without a key, the header displays “API key missing” and no request is sent. There is no key-entry or Unity setup button.

A small header indicator checks the server and key once on startup. The relay authenticates before validating event JSON: an empty envelope receives its specific validation error with a valid key, or 401 with an invalid key, without broadcasting a scene event. This is used because `/health` does not currently allow cross-origin browser access. Any different response is shown as unavailable. There is no polling. Location selections update the indicator with the relay's delivery count: API ready, Unity connected, Unity offline, key rejected, or unavailable. The timestamp is in the indicator tooltip. Delivery confirms the relay handed the message to Unity, not that Unity executed it.

## Recovery and saved-note reliability

Workshop collections are validated one record at a time. Recoverable notes remain available when another entry is malformed. Before replacement, the previous good collection is backed up locally; damaged original data is retained separately. If preservation or saving fails, the current collection and draft remain intact. A Note recovery button offers the original collection for download. A stale tab is prevented from silently replacing a newer saved collection.

A graphics reset recreates the 3D renderer once with the current view and background. Repeated failure or missing WebGL leaves an interactive 2D map and a Retry 3D control. The timeline resumes after cached browser-history restoration and suspends its timer while hidden or paused. Terrain refreshes are coalesced and unchanged source data is not uploaded repeatedly.

Run the additional browser checks described in `tests/README-reliability.md` before publishing changes to these paths.

## Publish updates

The deployment repository is **[CityScope/MineScope](https://github.com/CityScope/MineScope)**. The repository and website are public. GitHub Pages publishes `dist/` through `.github/workflows/deploy-pages.yml` whenever changes are pushed to `main`. The workflow can also be run manually from the Actions tab. The site inherits CityScope's existing `cityscope.media.mit.edu` domain and uses HTTPS.

Show every change in the local preview first. After the user reviews it and requests deployment, commit and push verified changes to `main`. Wait for the **Deploy MineScope** workflow to succeed, then check the live site. Keep asset and data paths relative so the app works under `/MineScope/`.

## Data and sources

The project-authored examples contain 640 community notes and 320 social-feed posts across six locations. The social posts are not downloaded conversations and are not attributed to real accounts. Their platform, sentiment, coordinates and 1–18 September 2026 collection dates are assigned for this prototype. No social-media APIs are connected. Heat maps use a fixed geographic hexagon grid and nearby notes within 10 km, weighted by distance. Sentiment balance runs from concerned through mixed to hopeful. Category concentration uses one shared reference maximum across dates, topics and sources, so changing a filter does not rescale the colors. Areas without nearby notes remain clear. These maps describe the notes, not the proportion of residents with an opinion. The GeoJSON files and Evidence source entries identify its origin. Workshop notes are separate, retain their own dates, remain visible during replay, and stay in the browser on the same device and website address. Export notes before switching devices or moving from the local preview to the live site. There is currently no shared submission database.

Project reference locations and case-study themes come from the supplied Dominga case study. Connections between project points are schematic. Feature details retain the source and location information.

- [Minerals Stewardship Consortium introduction, MIT News](https://news.mit.edu/2025/introducing-minerals-stewardship-consortium-1216)
- MineScope use case Dominga: project reference document, not included in the repository or website.
- MSC Mid-Year Research Report 2026: project reference document, not included in the repository or website.

The supplied PDFs, downloaded Humboldt boundary file and SERNAGEOMIN registry remain excluded from the repository and deployment. Protected-area, watercourse and catchment geometry is requested directly from the original SIMBIO services in the browser and kept in memory. No third-party spatial dataset is mirrored in this repository. The app retains project-authored locations, discussion points and generated community examples; it does not display the third-party tailings registry.

The protected-area layer includes the Humboldt Archipelago, Humboldt Penguin National Reserve, the Chañaral and Choros–Damas marine reserves, La Boca wetland and Cruz Grande. Watercourses and catchments cover the Dominga and Los Choros area; named records can be selected for source details. If a service is unavailable, its layer details offer a retry. The government registry notes that SBAP is the official biodiversity data authority and SIMBIO provides interoperability services.

- [Protected areas · SIMBIO](https://arcgis.mma.gob.cl/server/rest/services/SIMBIO/SIMBIO_AP/MapServer/0)
- [Watercourses · SIMBIO](https://arcgis.mma.gob.cl/server/rest/services/SIMBIO/SIMBIO_HIDROGRAFIA/MapServer/0)
- [Catchments · SIMBIO](https://arcgis.mma.gob.cl/server/rest/services/SIMBIO/SIMBIO_DIVISION_CUENCA/MapServer/1)

Background maps come from OpenTopoMap, OpenStreetMap and Esri. Attribution appears on the map, with provider details beside the background selector. Data, reports, logos and map services retain their respective ownership and terms. Logo sources are recorded in `dist/assets/logo-sources.txt`.
