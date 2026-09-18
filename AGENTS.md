# MineScope project instructions

## Deployment

- The user has designated `https://github.com/CityScope/MineScope` as the permanent repository and GitHub Pages as the live hosting destination.
- The user explicitly approved a public repository and public GitHub Pages site after learning that CityScope's Free plan does not support Pages from private repositories.
- The live URL is `https://cityscope.media.mit.edu/MineScope/`, inherited from the organization's existing Pages domain. Do not change the organization's domain settings.
- Publish completed, verified app changes by committing and pushing to `main`. The Deploy MineScope workflow publishes `dist/` automatically. Wait for deployment success and check the live site before reporting a change as live.
- Do not deploy this project to Sites or another host unless the user changes the destination.
- Keep local work, exports, credentials and browser-collected workshop notes out of the repository and deployment. Only `dist/` is published by the Pages workflow.
- Do not upload the supplied PDFs or downloaded third-party spatial datasets, including in Git history. The deployment contains project-authored data and the community example generated for this project. Basemap tiles load from their original providers with attribution; do not mirror them.
- Older local history is retained only on `local-before-publication`. Never push that branch or use `git push --all` or `--mirror`.
- Use relative asset and data URLs so the app works at `/MineScope/`.

## App conventions

- Plain English, compact controls and the existing dark teal, copper and sand palette.
- Keep the City Science and MIT Media Lab marks secondary to the MineScope wordmark.
- Preserve the Topography opening view, all available project layers enabled, and the portrait sidebar drawer. The third-party tailings registry and downloaded conservation boundary are excluded from the hosted app.
- Keep example community data separate from actual workshop notes and preserve source metadata.
- Check JavaScript syntax and exercise the affected controls and responsive layouts before deploying.

## Local preview

Serve `dist/` with `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist` when a preview is not already running. No build step is needed.
