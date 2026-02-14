# InfinityGrid Sticker Designer

## Can GitHub host this Docker image?
- **Yes** for image storage: use **GitHub Container Registry (GHCR)**.
- **No** for always-on container hosting from your repo alone. You still run containers on your laptop (or another server).

## Build image on push (GitHub Actions)
- Included workflow: `.github/workflows/docker-publish.yml`
- On every `push`, it builds and publishes multi-arch images to GHCR:
  - `ghcr.io/<owner>/infinitygrid-sticker`
- Tags include branch, tag, sha, and `latest` on default branch.

## Hardened Docker + Cloudflare Tunnel
This repo includes:
- `Dockerfile` for the app (`server.py` + static assets)
- `docker-compose.yml` with:
  - image-only deployment (no local build in compose)
  - isolated app service (`app`) on an internal network
  - Cloudflare Tunnel sidecar (`cloudflared`) for public access
  - no host port exposed for the app
  - reduced privileges (`read_only`, `cap_drop: ALL`, `no-new-privileges`, tmpfs, resource limits)

## Setup
1. Create your Cloudflare Tunnel in Zero Trust.
2. In Cloudflare Tunnel public hostname settings, point service to:
   - `http://app:3000`
3. Copy `.env.example` to `.env` and set your token:
   - `CLOUDFLARED_TOKEN=...`
4. Set app image (GHCR):
   - `APP_IMAGE=ghcr.io/<your-github-user-or-org>/infinitygrid-sticker:latest`
5. If your GHCR image is private, login first:
   - `echo <GH_PAT> | docker login ghcr.io -u <github-user> --password-stdin`
6. Start:
   - `docker compose up -d`

## Stop
- `docker compose down`

## Security notes (important for internet exposure)
- Keep your laptop and Docker updated.
- Prefer enabling **Cloudflare Access** (auth) in front of the app if possible.
- Do not mount sensitive host folders into containers.
- Rotate tunnel tokens if compromised.
