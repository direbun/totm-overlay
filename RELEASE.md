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

- `v2.0.0`

Upload:

- `totm-overlay.zip`

## 6. Install in Foundry

Use the raw `module.json` URL from the GitHub repo as the Foundry manifest URL.
