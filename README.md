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

Open `scenario/` from the **Scenario table** header link to explore a tangible 3D terrain demonstration. Drag the amber tailings piece to lift it and drop freely anywhere on the model. Pipeline routing, footprint, three impact indicators and a finite company fund update during movement. Click an indicator for its causal chain, or compare with the El Negrillo reference. Click protection controls to allocate or release money. The info button beside “ALLOCATE TO PROTECTION” explains all five protections and the funding rules. Water, habitat, dust/noise, monitoring and closure use distinct blue, green, amber, violet and pink colors across controls, cylinders, rings and fund allocations. Colored cylinders surround the tailings site, connected to it by dashed lines; they cannot be moved independently. Each cylinder emits its own expanding rings and follows the site. Select the tailings label and use the arrow keys for keyboard placement; Shift increases the step. Drag empty terrain to look from side to side, scroll or pinch to zoom, and use Layers to change projected overlays. Rotate gently sweeps between front views; automatic and manual movement stay on the front side of the table so the display remains visible.

Terrain, settlement positions, water pathways, habitat and productive-land layers are schematic, project-authored examples, not surveyed spatial datasets. Indicators are illustrative calculations. The terrain-aware corridor is calibrated so the El Negrillo reference reads 12.2 km, following the supplied KPI slides. The illustrative US$20 million company fund covers site setup first (US$2 million plus US$0.18 million per relative site-cost point, capped at the fund). Protections draw from what remains in selection order: water US$2.8 million, habitat US$3.15 million, dust/noise US$1.75 million, monitoring US$1.4 million, closure restoration US$2.1 million. Partial funding gives proportional benefits; unfunded requests stay selected and regain funding at cheaper sites. Removing a request releases its allocation. The TV donut shows site, individual protection allocations and the unallocated balance. These are game assumptions, not company commitments or cost estimates. Cylinders sit close to the tailings piece. Partial funding reduces the filled cylinder height and pulse brightness, with a dashed shell showing the missing share. Unfunded requests retain translucent cylinders, dashed rims and sides, faint connecting lines, and a 0% label; they emit no pulses. The rings illustrate activity, not measured geographic reach. Independent monitoring changes oversight only; protection does not remove the occupied footprint. Relative cost is an index, not an engineering estimate. Three.js r180 is bundled under its MIT license in `dist/scenario/vendor/`. The project map, workshop notes and Unity scene-selection behavior remain available separately.

Placement checks sample the entire 1.8 × 1.5 model footprint. Open-water overlap, intersection with schematic settlement buildings, habitat sensitivity at or above 0.38 (the shown boundary), or more than 0.8 model units of height variation make a candidate unsuitable in this demonstration. The site and footprint turn red, and the TV gives the reason while dragging. Click the TV status for all detected conflicts. Funding cannot clear these exclusions; free movement remains available to find another candidate. These thresholds and examples are prototype assumptions, not engineering feasibility or legal protected-area assessments. A candidate that passes still requires real site assessment. The reference comparison likewise does not imply suitability.

Run `node --test tests/scenario-model.test.mjs tests/scenario-camera.test.mjs tests/scenario-funding.test.mjs tests/scenario-performance.test.mjs` for causal-model, footprint suitability, fund conservation and camera checks. Browser verification covers continuous dragging, placement warnings, keyboard placement, protection pieces, controls and responsive layouts.

The scenario implementation and its rendering dependencies are contained in `dist/scenario/`. Ocean swells use displaced geometry, moving surface normals, Fresnel reflections, depth colors and broken shoreline foam. River flow and terrain-conforming pollution and dust projections animate continuously while the page is visible. Noise uses a quiet, static dotted field instead of echoing rings around the tailings. Impact projections follow the tailings piece, and protection changes their intensity. Reduced-motion settings keep the animated fields still. The scenario uses the project map's blue glass panels, controls and selected states, and the existing root Unity client. Its live KPI display and impact legend sit on a physical monitor behind the terrain and follow the shared camera, with perspective-correct interactive controls. The printed terrain uses matte ivory physical materials, fine filament shading and an approximate warm subsurface scattering effect. A project-authored ridged height field with downhill flow accumulation creates branching gullies; its 513 × 305 mesh casts relief shadows under angled lighting. All scenario layers start visible, including habitat and productive land. These areas use low-opacity diagonal hatching with a fine antialiased boundary. Opposing hatch directions distinguish the two areas while keeping the printed relief visible. Protection allocations do not resize the canvas. Renderer resizes preserve camera zoom and orientation; only startup and explicit Reset refit the view.

The scenario has dim exhibition lighting: a cool rectangular emitter follows the physical TV, while a soft overhead light, procedural studio reflections and a seamless radial backdrop and fading floor shadows ground the model. Terrain colors include a baked horizon-occlusion approximation for stronger gullies. Projected fields use additive light, with restrained quarter-resolution HDR bloom and FXAA antialiasing. Dust uses irregular advected noise instead of a repeating grid. The rounded tailings piece and protection cylinders use rough resin shading and approximate forward scattering, plus internal emission. Small colored lights follow funded cylinders and the lifted tailings piece; unfunded ghosts emit no light. This is a real-time lighting approximation, not full SSGI or path-traced subsurface transport. All rendering modules match Three.js r180 and load locally under its MIT license. The KPI DOM remains sharp and interactive over the physical screen, and no supplied reference photo is bundled. Rendering uses a bounded pixel budget (normally 1.4 million pixels, at most 1.5× pixel ratio), 30 fps for idle animated fields and full browser cadence during interaction. Point lights stay registered when protections are hidden, with intensity set to zero, so toggles do not change shader variants. Hidden materials are precompiled during loading. Stationary pipelines, footprints, pulses and cylinder links reuse geometry; layer colors are cached. Picking samples the height field instead of scanning the terrain triangles, and stationary views skip repeated DOM projection/layout. Add `?profile=1` to the local scenario URL for canvas data attributes containing frame costs, input-to-render submission latency, shader counts and drawing-buffer size. This diagnostic adds no visible UI; it does not measure GPU completion or display latency.

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
