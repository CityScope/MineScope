# MineScope project instructions

## Deployment

- The user has designated `https://github.com/CityScope/MineScope` as the permanent repository and GitHub Pages as the live hosting destination.
- The user explicitly approved a public repository and public GitHub Pages site after learning that CityScope's Free plan does not support Pages from private repositories.
- The live URL is `https://cityscope.media.mit.edu/MineScope/`, inherited from the organization's existing Pages domain. Do not change the organization's domain settings.
- Show every change in the local preview first. Deploy only after the user has reviewed the preview and requests deployment. Then publish verified changes by committing and pushing to `main`. The Deploy MineScope workflow publishes `dist/` automatically. Wait for deployment success and check the live site before reporting a change as live.
- Do not deploy this project to Sites or another host unless the user changes the destination.
- Keep local work, exports, credentials and browser-collected workshop notes out of the repository and deployment. Only `dist/` is published by the Pages workflow.
- Do not upload the supplied PDFs or downloaded third-party spatial datasets, including in Git history. The deployment contains project-authored data and the community example generated for this project. Basemap tiles load from their original providers with attribution; do not mirror them.
- Older local history is retained only on `local-before-publication`. Never push that branch or use `git push --all` or `--mirror`.
- Use relative asset and data URLs so the app works at `/MineScope/`.

## App conventions

- Plain English, compact controls and the Radar design system: Arial, compact controls, neutral surfaces, and blue, green and amber accents.
- Always use the dark theme, including headers, sidebars, dialogs and native controls. Do not follow the system color preference.
- Keep the City Science and MIT Media Lab marks secondary to the MineScope wordmark.
- Preserve the Night terrain opening view (Esri World Topographic Map), Satellite as an alternative, only Community layers enabled at startup, and the portrait sidebar drawer. The third-party tailings registry and downloaded conservation boundary files stay excluded. Protected areas, watercourses and catchments load directly from the government SIMBIO services in the browser.
- Open the Map layers tab with Geography, Project and Community groups. Provide Show all / Hide all controls for Geography, Project and Community so users can turn each group on or off.
- Keep example community data separate from actual workshop notes and preserve source metadata.
- Kiosk demo starts after 30 seconds idle, tours six settlements every 10 seconds at 2×, and returns to the overview playing at 1× on interaction. Manual Demo and Full screen controls sit in the header; manual tours tolerate pointer movement so both buttons can be used together. Keep automatic touring separate from Unity scene commands.
- Check JavaScript syntax and exercise the affected controls and responsive layouts before deploying.

## Local preview

Serve `dist/` with `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` when a preview is not already running. No build step is needed.
