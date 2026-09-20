# MineScope

A map for community workshops about mining projects, starting with Dominga in La Higuera, Chile. Developed in the context of the Minerals Stewardship Consortium, with MIT City Science and the MIT Media Lab.

**[Open MineScope](https://cityscope.media.mit.edu/MineScope/)**

## The map

- Continuous wheel and trackpad zoom, anchored to the pointer.
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

The opening view uses Night terrain, a dark slate-blue Esri topographic map, with only the three Community layers enabled and the Map layers tab open. Geography and Project start off; each group has a Show all / Hide all control, alongside the control for all layers. Desktop starts at zoom 10.8, centred at 29.390° S, 71.205° W. Smaller screens fit the six community areas.

## Run locally

The complete site is in `dist/`. It uses HTML, CSS, JavaScript and Leaflet; no build step or package installation is required.

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:4173/>. An internet connection is needed for background maps and government geography services.

Run `node --test tests/*.test.cjs` to check wheel input, animation timing, zoom limits, example-data provenance, collection filters, arrival placement and heat-map calculations.

## Kiosk demo

After 30 seconds without pointer, touch, keyboard or scroll activity, the app starts the timeline at 2× and visits all six settlements in order, changing location every 10 seconds and looping continuously. A pulsing “Running in demo mode” label appears in the header. Interaction ends the tour, returns to the whole area and plays the timeline at 1×. The header’s Demo button starts the tour immediately and keeps it running during pointer movement, so Full screen can be selected next. Stop demo or click/scroll/type elsewhere to return to the overview. Full screen uses the browser’s fullscreen API and can be exited using the same button or Escape. Open dialogs, note placement and hidden tabs suspend the tour. Automatic tour movements do not send Unity scene commands; those remain tied to user location selections.

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
