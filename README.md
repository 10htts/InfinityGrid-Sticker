# InfinityGrid Sticker Designer

InfinityGrid Sticker Designer is a self-hosted web app for creating Gridfinity-style label stickers with icon + text layouts and exporting them for printing/CAD workflows.

## Features
- Interactive editor with slot-based icon/text editing.
- Export formats:
  - `3MF` (multi-part, slicer-friendly color/material assignment)
  - `STEP` (multi-body CAD)
  - `SVG` (2D profile/mask)
- Batch export for all saved tags in `3MF`, `STEP`, or `SVG`.
- JSON import/export for backup and sharing.
- Local icon library from `Icons_SVG/`.
- Browser-side local storage for saved tags.

## Project Status
- Actively maintained.
- Suitable for personal/self-hosted use.
- Contributions are welcome.

## Stack
- Frontend: `index.html`, `assets/js/app.js`, `assets/css/app.css`
- Backend: FastAPI + Build123d (`server.py`)
- Packaging: Docker (`Dockerfile`, `docker-compose.yml`)

## Requirements
- Python `3.12+`
- `pip`
- Optional: Docker / Docker Compose

## Local Development
1. Create and activate a virtual environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Run:
   - `python server.py`
4. Open:
   - `http://localhost:3000`

## Docker
Build and run locally:
1. `docker build -t infinitygrid-sticker:local .`
2. `docker run --rm -p 3000:3000 infinitygrid-sticker:local`
3. Open `http://localhost:3000`

Cloudflared sidecar deployment is available via `docker-compose.yml` and `.env.example`.
Note: `docker-compose.yml` currently references `ghcr.io/10htts/infinitygrid-sticker:latest` by default.
Forks should update the image reference to their own registry/image.
Runtime note: export workers use temporary files. In hardened deployments (`read_only: true`), keep a writable `/tmp` mount (tmpfs is recommended).

## API
- `GET /api/icons`
- `POST /api/export_step`
- `POST /api/export_3mf`

## Repository Layout
- `server.py`: API and export logic.
- `index.html`: UI shell.
- `assets/js/app.js`: frontend state/render/export flows.
- `assets/css/app.css`: styling.
- `Icons_SVG/`: icon source assets.
- `bases/`: base STL assets used by export routines.
- `docs/`: project notes and technical handoff docs.

## Documentation
- Contributing: `CONTRIBUTING.md`
- Security policy: `SECURITY.md`
- Code of conduct: `CODE_OF_CONDUCT.md`
- Changelog: `CHANGELOG.md`
- Support: `SUPPORT.md`
- Third-party notices: `THIRD_PARTY_NOTICES.md`

## License
This project is licensed under the MIT License. See `LICENSE`.
