# GitHub Release Checklist

## 1. Create the repository

Recommended repository name:

- `totm-overlay`

## 2. Upload the module contents

Push these files and folders:

- `module.json`
- `README.md`
- `LICENSE.txt`
- `scripts/`
- `styles/`
- `templates/`
- `lang/`

## 3. Build the release zip

Create a zip named:

- `totm-overlay.zip`

Its root should contain the module files directly, not an extra parent folder layer.

## 4. Fill in public URLs

The manifest is already set for:

- owner: `direbun`
- repo: `totm-overlay`

Update the version/tag fields when you make a new release.

## 5. Make a GitHub release

Recommended tag:

- `v3.0.0`

Upload:

- `totm-overlay.zip`
- `module.json`

## 6. Install in Foundry

Use this manifest URL:

- `https://github.com/direbun/totm-overlay/releases/latest/download/module.json`

## 3.0.0

- Unified Background Library replaces the separate Choose Background and Manage Backgrounds flows.
- Added compact toolbar controls, a categories dropdown, inline background renaming, and Fill to Scene toggles on background cards.
- Improved background name cleanup for newly added images and file-based rename actions.
- Fixed stale/invisible board character placements and added board character recovery helpers.
- Improved performance with scheduled refreshes, duplicate listener cleanup, and more targeted updates.
- Hardened rendered UI text with HTML escaping and safer background/library handling.
- Foundry VTT v13 compatibility retained.
