# Shelf Check — NES

Standalone NES replication of Shelf Check for Matty.

This repository is intentionally separate from Josh's PS4 Shelf Check. It uses its own repository, PWA identity, cache namespace, localStorage key, data, and deployment.

## Current milestone

- 816 provisional North American CORE playable identities
- Browser-side GameEye CSV import
- OWNED / NEEDED / ALL filtering and search
- NES charcoal/gray/red visual identity
- Unique storage key: `shelfcheck-nes-matty-v1`
- Unique service-worker cache: `shelfcheck-nes-matty-v1`

## Baseline test

Expected result for Matty's 2026-09-29 GameEye export:

- 363 NES/Famicom game rows
- 298 CORE-matching rows
- 65 non-core rows
- 0 unmatched
- 23 duplicated identities
- 276 distinct CORE identities
- 33.82% of 816

The raw GameEye export is private input only and is not committed to this repository.
