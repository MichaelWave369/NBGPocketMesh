# PocketMesh research console

React + Vite static GitHub Pages microsite, located independently under `site/`.

- `npm install --prefix site` then `npm run dev --prefix site` for local editing.
- `npm run test --prefix site` runs dependency-free routing simulator tests.
- `npm run build --prefix site` emits `site/dist` using base path `/NBGPocketMesh/`.
- `.github/workflows/pages.yml` builds on pushes to main and publishes via GitHub Pages Actions.

**Provenance contract:** E2-A metrics reproduced as *frozen documented synthetic experiment results* from `docs/E2A_PROTOCOL.md`. The browser simulator uses public synthetic cue generation and a fixed illustrative threshold selector, **not** the real learned E2-A weights or trained router. All display claims are qualified. No model weights downloaded, no inference provider, no private records, no live neural inference.

Site deployment depends on GitHub repository Settings → Pages → Build and deployment → GitHub Actions, plus merging the website PR to main. A green build is not itself evidence of an accessible public website.
