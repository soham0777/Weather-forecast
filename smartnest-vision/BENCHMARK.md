# Original vs optimized - synthetic benchmark

Ground truth is known exactly (see `smartnest_synthetic.py`). Original = notebook Steps 3, 4, 6 ported line for line; its Step 5 was not shared, so a stand-in in the same style is used.

`(ref)` = optimized run given an empty-bed reference image; `(lens)` = given the lens model. The original has neither option.

| scene | sheet area err (orig / new) | usable area err (orig / new) | cut-outs found (orig / new) | worst circle D err mm (orig / new) | time ms (orig / new) |
|---|---|---|---|---|---|
| fresh_sheet | -0.83% / +0.022% | -0.83% / +0.022% | 0/0 / 0/0 | - / - | 28 / 344 |
| four_circles | -0.71% / +0.022% | -0.68% / +0.039% | 4/4 / 4/4 | 1.4 / 0.4 | 29 / 357 |
| mixed_holes | -0.71% / +0.022% | -0.64% / +0.042% | 6/7 / 7/7 | 1.3 / 0.4 | 36 / 349 |
| irregular_remnant | -0.53% / +0.036% | -0.49% / +0.052% | 3/3 / 3/3 | 1.7 / 0.2 | 30 / 374 |
| dark_steel (ref) | +25.26% / -0.119% | +20.91% / -0.131% | 4/4 (2 not circle) / 4/4 | 3.8 / 0.2 | 32 / 544 |
| lens_distortion (lens) | +7.37% / +0.027% | +7.15% / +0.044% | 1/7 / 7/7 | - / 0.4 | 31 / 402 |
| small_bed | -1.08% / +0.023% | -0.97% / +0.037% | 5/5 / 5/5 | 1.5 / 0.2 | 10 / 249 |

Notes:

- `mixed_holes`: original missed D25 @ (1500,400)
- `lens_distortion`: original missed D180 @ (600,450)
- `lens_distortion`: original missed D80 @ (1100,420)
- `lens_distortion`: original missed D25 @ (1500,400)
- `lens_distortion`: original missed rectangle @ (1950,875)
- `lens_distortion`: original missed rectangle @ (900,950)
- `lens_distortion`: original missed D70 @ (235,1100)
- The original exports DXF in image coordinates (y down): every layout is mirrored top-to-bottom on a Y-up CNC controller. The optimized export flips Y and is re-read and compared before release.
