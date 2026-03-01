# Contributing

Thanks for helping improve InfinityGrid Sticker Designer.

## Before You Start
- Check open issues and existing PRs first.
- For substantial changes, open an issue to discuss scope before implementation.

## Setup
1. Create and activate a Python virtual environment.
2. Install dependencies:
   - `pip install -r requirements.txt`
3. Run locally:
   - `python server.py`
4. Open:
   - `http://localhost:3000`

## Development Guidelines
- Keep PRs small and focused.
- Do not mix unrelated refactors with feature changes.
- Preserve existing behavior unless the change explicitly targets it.
- Keep frontend structure:
  - markup: `index.html`
  - styles: `assets/css/app.css`
  - logic: `assets/js/app.js`
- Prefer readable, maintainable code over clever shortcuts.

## Validation Checklist
Before opening a PR, verify:
- Editor can create/edit/delete tags.
- Zone editing works for both icon and text zones.
- Single export works for `3MF`, `STEP`, `SVG`.
- Batch export works for selected format.
- JSON import/export works.
- UI remains usable on mobile and desktop.

## Pull Request Content
Include in your PR description:
- Summary of changes.
- Why the change was needed.
- Manual test steps.
- Screenshots or short clips for UI updates.
- Any known limitations/follow-ups.

## Style and Formatting
- Follow `.editorconfig`.
- Keep line endings normalized via `.gitattributes`.
- Avoid introducing non-ASCII text unless required.
