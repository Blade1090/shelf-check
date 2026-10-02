# Shelf Check NES + Famicom — Phase 2

## Added
- NES / FAMICOM regional shelf selector from Phase 1.
- Frozen 1,040-identity Famicom census and 1,041 release records.
- Famicom dossiers for all 1,040 identities.
- Language Barrier LOW / MEDIUM / HIGH display with practical reason.
- NES counterpart status on Famicom cards and dossiers.
- Cross-region status is display-only and never grants ownership or completion.
- Explicit Famicom OWNED / NEEDED toggle separate from NES ownership.
- Famicom local data included in backup/restore schema 2; old schema 1 NES backups remain accepted.
- PWA service-worker cache bumped to v35 and includes all Phase 2 assets.

## Safety invariants verified
- Existing NES census file is byte-identical to the downloaded production repo.
- NES CORE remains exactly 816.
- Famicom remains exactly 1,040 identities / 1,041 releases.
- Every Famicom identity has a dossier.
- Every linked NES identity exists in the 816 NES CORE census.
- Relationship data contains no ownership or completion fields.
- Original NES static regression suite passes after version expectations were updated.
- Famicom-specific QA suite passes.
- JavaScript syntax checks pass for app.js, famicom-dossier.js, and backup-restore.js.
- All 70 service-worker assets resolve to files in the build.

## Not yet changed
- GameEye import does not yet populate Famicom ownership.
- Famicom pricing / wishlist / roulette are not enabled yet.
- No production GitHub branch or live GitHub Pages deployment has been modified by this build.
