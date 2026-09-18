# MineScope

A map for community workshops about mining projects, starting with Dominga in La Higuera, Chile. Developed in the context of the Minerals Stewardship Consortium, with MIT City Science and the MIT Media Lab.

**[Open MineScope](https://cityscope.media.mit.edu/MineScope/)**

## The map

- Continuous wheel and trackpad zoom, anchored to the pointer.
- Five backgrounds: topography, satellite, streets, relief and seafloor.
- Six project layers for locations, ecosystems, water, community notes, case-study themes and project questions.
- Community notes grouped by location, topic and sentiment.
- Selected comments use a large marker and a line to their detail panel that follows map movement and zoom, including in cluster view.
- Source references and links for map features.
- Workshop notes with location selection and GeoJSON export.
- Desktop and mobile layouts, with a collapsible sidebar in portrait orientation.

The opening view uses Topography with all six layers enabled. Desktop starts at zoom 10, centred at 29.385° S, 71.135° W. Smaller screens fit the six community areas.

## Run locally

The complete site is in `dist/`. It uses HTML, CSS, JavaScript and Leaflet; no build step or package installation is required.

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open <http://127.0.0.1:4173/>. An internet connection is needed for background maps and web fonts.

Run `node --test tests/smooth-zoom.test.cjs` to check wheel input, animation timing, zoom limits and interaction handoffs.

## Publish updates

The deployment repository is **[CityScope/MineScope](https://github.com/CityScope/MineScope)**. The repository and website are public. GitHub Pages publishes `dist/` through `.github/workflows/deploy-pages.yml` whenever changes are pushed to `main`. The workflow can also be run manually from the Actions tab. The site inherits CityScope's existing `cityscope.media.mit.edu` domain and uses HTTPS.

After checking changes locally, commit and push them to `main`. Wait for the **Deploy MineScope** workflow to succeed, then check the live site. Keep asset and data paths relative so the app works under `/MineScope/`.

## Data and sources

The community example contains 640 fictional notes across six locations. It demonstrates filtering and clustering; the assigned sentiments are not a survey. The GeoJSON and About the data view identify its origin. Workshop notes are separate and remain in the browser on the same device and website address. Export notes before switching devices or moving from the local preview to the live site. There is currently no shared submission database.

Project reference locations and case-study themes come from the supplied Dominga case study. Connections between project points are schematic. Feature details retain the source and location information.

- [Minerals Stewardship Consortium introduction, MIT News](https://news.mit.edu/2025/introducing-minerals-stewardship-consortium-1216)
- MineScope use case Dominga: project reference document, not included in the repository or website.
- MSC Mid-Year Research Report 2026: project reference document, not included in the repository or website.

The supplied PDFs, downloaded Humboldt boundary and SERNAGEOMIN registry are excluded from both the repository history and the website. The app retains project-authored locations, discussion points and generated community examples. It does not draw a conservation boundary or display the third-party tailings registry.

Background maps come from OpenTopoMap, OpenStreetMap, Esri and GEBCO. Attribution appears on the map, with provider details beside the background selector. Data, reports, logos and map services retain their respective ownership and terms. Logo sources are recorded in `dist/assets/logo-sources.txt`.
