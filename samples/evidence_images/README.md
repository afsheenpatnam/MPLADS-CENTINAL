# Evidence Images

Referenced by `evidence_file_names` in `../contractor_daily_activity_evidence_demo.csv`. See
`../README.md` → "Evidence images" for the full upload walkthrough (which coordinates/timestamps
to enter for each one to trigger a specific finding).

| File | Currently | Role in the demo |
|---|---|---|
| `site_before_renovation.jpg` | synthetic placeholder | Clean baseline photo |
| `site_progress_wall_work.jpg` | synthetic placeholder | Clean progress photo |
| `site_progress_wall_work_reused.jpg` | **exact byte copy** of `site_progress_wall_work.jpg` | Triggers `WORK_004` Image Reuse |
| `site_final_handover.jpg` | synthetic placeholder | Upload with GPS far from the project site to trigger `WORK_002` Location Mismatch |

## Using your own photos instead

Drop in real site photos under these **same four filenames** and they'll work identically — the
detection engine only looks at file bytes (SHA-256) and a perceptual hash of the image content, it
has no idea these names or this folder exist. The one thing to preserve deliberately: keep
`site_progress_wall_work_reused.jpg` byte-identical to `site_progress_wall_work.jpg` (literally
copy the file) if you want the reuse-detection row to still fire — two *different* photos of the
same wall, even seconds apart, won't match closely enough to cross the similarity threshold.

Regenerate the placeholders (overwrites all four) with:

```bash
node ../../scripts/generate-evidence-samples.js
```
