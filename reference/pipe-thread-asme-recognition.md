# Pipe thread recognition and ASME drawing tolerances

Supported complete pipe callouts: size-TPI NPT, NPTF, NPTR, NPSC, NPSM, NPSL;
fractional/mixed sizes, quotation marks, whitespace around fractions, spaced
series letters and explicit quantity prefixes are supported. Recognition is
syntactic, not a table lookup certifying a size/TPI combination. NPT size is a
nominal pipe designation, not its outside diameter. No numeric thread limits
are inferred; inspect using the specified thread/gage requirements.

References: ASME B1.20.1 (NPT/NPSC/NPTR/NPSM/NPSL), B1.20.3 (NPTF).
https://www.asme.org/codes-standards/find-codes-standards/b1201-pipe-threads-general-purpose-inch

ASME Y14.5-2009 and -2018 are now selectable as drawing-defined linear
deviation profiles. Users must enter the drawing's lower/upper deviations and
unit; there are deliberately no fabricated ASME default +/- values.
Profiles now support user-entered symmetric title-block values for zero to four
decimal places and a separate angle value in degrees. Empty rows supply no table
value; explicitly configured lower/upper fallback deviations can still apply.
Original source precision is required when applying tables to existing records.
These profiles do not implement pipe gaging limits or blanket GD&T tolerances. Explicit deviations,
limits, thread and fit callouts are protected. Profiles persist using the
existing generalTolerance project object. Existing records require an explicit
preview/apply action; choosing defaults does not rewrite them.

Tests: requirements-test.cjs, workflow-detection-test.cjs, characteristic-editing.test.cjs,
and the ASME/general-tolerance cases in app-integration.test.cjs.

Non-GD&T host parsing attaches versioned measurementEvidence with per-field
source labels (parsed, manual, calculated_from_limits, general_tolerance,
drawing_default). These are not OCR confidence probabilities. Evidence follows
candidate creation and project normalization. Repeated OCR reads carry a
monotonic reading ID so older completions cannot overwrite the latest read.
GD&T parsing and its result structure are deliberately excluded from evidence.
