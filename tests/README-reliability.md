# Reliability regression checks

Run `node --test tests/*.test.cjs` for the standard unit suite and workshop-storage failure cases.

With the local preview running on port 4173, run `node tests/reliability.browser.cjs` in an environment where Playwright and its Chromium browser are installed. Set `NODE_PATH` if Playwright is in a separate tooling directory, and optionally set `MINESCOPE_BROWSER` to the Chromium executable. `MINESCOPE_URL` overrides the localhost URL. `MINESCOPE_RESULTS` overrides `/tmp/minescope-reliability` for screenshots and JSON results.

The browser suite uses isolated profiles and synthetic notes. It tests idle rendering, GPU-context loss and repeated-failure fallback, unavailable WebGL, style-service failure, malformed-note recovery/export/reload, storage quota failure, actual back/forward cache restoration, timer duplication, layer/heat/selection controls, portrait layout and a 65-second kiosk tour. It sends no authenticated Unity commands. External basemap providers must be available for successful 3D checks.

Expected outcome: zero uncaught page errors, no unchanged note/heat uploads during the ten-second paused interval, preserved valid notes and recovery bytes, working playback after actual cached navigation, and a usable map after graphics failures.

Run `node tests/note-zoom.browser.cjs` with the same browser environment to check the three zoom stages in both 3D and 2D, reverse zoom, repeated-cycle marker cleanup, filters, heat and layer switches, larger targets, hover/selection, All notes override, portrait layout, and reduced motion. Its default results directory is `/tmp/minescope-note-zoom`.
