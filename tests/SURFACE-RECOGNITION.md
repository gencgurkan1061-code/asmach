# Surface recognition scope

Text parser: explicit ISO 1302/21920/4287/4288/25178, ASME B46.1/Y14.36 and JIS B 0601 labels are retained, not treated as equivalent standards. Ra/Rz/Rq/Rt/Rp/Rv/Rmax/RzJIS, profile statistical parameters, selected areal parameters, RMS and CLA are distinguished. No Ra–Rz conversion or grade-number conversion is performed. Explicit units, single limits, U/L pairs, ranges and signed deviations are supported. Incomplete multi-parameter/filter callouts remain review candidates, with no invented limits.

Graphical enrichment: automatic scanning checks isolated upright asymmetric basic, material-removal-required and material-removal-prohibited marks adjacent to recognized numbers/parameter text. Components touching drawing lines, tilted marks and alternate historical/new symbol families may be missed. A bare number beside a symbol is never assumed to be Ra or assigned a unit. Symbol candidates are unselected by default and require review. This is not a claim of complete standards compliance or production-drawing accuracy.

References consulted 2026-09-13:
- https://www.mitutoyo.com/webfoo/wp-content/uploads/1984_Surf_Roughness_PG.pdf
- https://www.mitutoyo.com/webfoo/wp-content/uploads/Surface_Roughness_Measurement.pdf
- https://www.keyence.com/ss/products/microscope/roughness/line/measurement_procedure.jsp

Checks: `tests/surface-requirements.test.cjs`, `scripts/check-surface-vision.cjs` (synthetic marks + line/V/empty negatives), `scripts/check-surface-integration.cjs` (application parser, normalized records, ranking). Real customer PDFs are still required for drawing-specific accuracy validation.
