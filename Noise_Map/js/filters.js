// =============================================================================
//  filters.js  —  FILTER SYSTEM
//  ============================================================================
//  Handles two types of filters:
//
//   1. DATE RANGE FILTER
//      • Reads dates from CONFIG.columns.dateColumn in each record.
//      • A single cell may contain MULTIPLE dates separated by commas,
//        semicolons, pipes (|), or newlines.
//      • Recognises many popular date formats (see parseDate() below).
//      • A record passes the filter if ANY of its dates fall within the range.
//
//   2. MUNICIPALITY FILTER
//      • Filters records by the municipality polygon they fall inside.
//      • Uses point-in-polygon geometry via leaflet-pip.
//      • Requires the municipality GeoJSON layer to be loaded.
//
//  TO CHANGE the date column:  update CONFIG.columns.dateColumn in config.js.
//  TO CHANGE the municipality attribute: update CONFIG.municipalityFilter.nameAttribute.
// =============================================================================


// Registry of all active markers — populated by registerMarker(), used by applyFilters()
let _markerRegistry = [];


/**
 * Adds a marker to the filter registry.
 * Called once per marker when it is created in map.js.
 *
 * @param {Object}          record  — The raw data row
 * @param {L.CircleMarker}  marker  — The Leaflet marker instance
 */
function registerMarker(record, marker) {
  _markerRegistry.push({ record, marker });
}


/**
 * Clears the marker registry.
 * Call this before re-rendering markers (e.g. on data reload).
 */
function clearMarkerRegistry() {
  _markerRegistry = [];
}


// =============================================================================
//  DATE PARSING  —  handles many formats and multi-date cells
// =============================================================================

/**
 * Month name → number lookup (3-letter and full spellings, case-insensitive).
 */
const MONTH_NAMES = {
  jan:1, feb:2, mar:3, apr:4, may:5, jun:6,
  jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
  january:1, february:2, march:3, april:4, june:6,
  july:7, august:8, september:9, october:10, november:11, december:12,
};


/**
 * Splits a cell value into individual date strings.
 * Recognised separators: comma  ,   semicolon  ;   pipe  |   newline  \n
 *
 * @param {string} cellValue
 * @returns {string[]}  Array of trimmed, non-empty date strings
 */
function splitDateCell(cellValue) {
  if (!cellValue && cellValue !== 0) return [];
  return String(cellValue)
    .split(/[,;|\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}


/**
 * Builds a JavaScript Date from year/month/day parts.
 * Handles 2-digit years: 00-49 → 2000s,  50-99 → 1900s.
 * Returns null if the parts do not form a valid calendar date.
 *
 * @param {string|number} year
 * @param {number}        month  — 1-based (January = 1)
 * @param {number}        day
 * @returns {Date|null}
 */
function makeDate(year, month, day) {
  let y = parseInt(year, 10);
  if (y < 100) y = y < 50 ? 2000 + y : 1900 + y;

  const d = new Date(y, month - 1, day);

  // Verify the date didn't roll over (e.g. Feb 31 → Mar 3)
  if (d.getFullYear() === y && d.getMonth() === month - 1 && d.getDate() === day) {
    return d;
  }
  return null;
}


/**
 * Attempts to parse a single date string in any of common formats.
 *
 * Supported patterns (examples):
 *   ISO 8601      2026-05-12
 *   UK / T&T      12/05/2026   12-05-2026   12.05.2026
 *   US            05/12/2026
 *   Long month    12 May 2026  12-May-2026  12-May-26
 *   US long       May 12, 2026
 *   Year-first    2026/05/12
 *
 * For ambiguous DD/MM vs MM/DD: if the first number > 12 it must be the day;
 * otherwise the T&T convention (DD/MM) is assumed.
 *
 * @param {string} raw — A single, already-trimmed date string
 * @returns {Date|null}
 */
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  let m;

  // 1. ISO 8601:  YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return makeDate(m[1], +m[2], +m[3]);

  // 2. YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) return makeDate(m[1], +m[2], +m[3]);

  // 3. DD-Mon-YYYY  /  DD-Mon-YY  (e.g. 14-May-2026, 14-May-26)
  m = s.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})$/);
  if (m) {
    const mon = MONTH_NAMES[m[2].toLowerCase()];
    if (mon) return makeDate(m[3], mon, +m[1]);
  }

  // 4. DD Mon YYYY  (e.g. 14 May 2026)
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})$/);
  if (m) {
    const mon = MONTH_NAMES[m[2].toLowerCase()];
    if (mon) return makeDate(m[3], mon, +m[1]);
  }

  // 5. Mon DD, YYYY  (e.g. May 14, 2026)
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const mon = MONTH_NAMES[m[1].toLowerCase()];
    if (mon) return makeDate(m[3], mon, +m[2]);
  }

  // 6. DD/MM/YYYY  or  MM/DD/YYYY  (numeric slash)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], yr = m[3];
    if (a > 12) return makeDate(yr, b, a);   // First number must be day
    if (b > 12) return makeDate(yr, a, b);   // Second number must be day
    return makeDate(yr, b, a);               // Ambiguous → assume DD/MM (T&T convention)
  }

  // 7. DD-MM-YYYY  or  DD-MM-YY  (numeric dash, not matching ISO because day first)
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], yr = m[3];
    if (a > 12) return makeDate(yr, b, a);
    if (b > 12) return makeDate(yr, a, b);
    return makeDate(yr, b, a);               // Assume DD-MM
  }

  // 8. DD.MM.YYYY
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) return makeDate(m[3], +m[2], +m[1]);

  // 9. Native JS parser as a last resort (handles RFC 2822, some locale strings)
  const native = new Date(s);
  if (!isNaN(native.getTime())) return native;

  return null;  // Unrecognised format
}


/**
 * Returns true if ANY date found in a cell value falls within [startDate, endDate].
 * Either bound can be null to mean "no limit on that end".
 *
 * Example: cell "12-May-2026, 13-May-2026; 14-May-26"
 *   → splits into three dates, each is checked against the range.
 *
 * @param {string}    cellValue
 * @param {Date|null} startDate — Inclusive start (midnight)
 * @param {Date|null} endDate   — Inclusive end (end of day)
 * @returns {boolean}
 */
function cellMatchesDateRange(cellValue, startDate, endDate) {
  const parts = splitDateCell(cellValue);

  for (const part of parts) {
    const d = parseDate(part);
    if (!d) continue;  // Skip strings that couldn't be parsed

    // Normalise to midnight (remove time component)
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    const afterStart = !startDate || day >= startDate;
    const beforeEnd  = !endDate   || day <= endDate;

    if (afterStart && beforeEnd) return true;
  }

  return false;
}


// =============================================================================
//  FILTER APPLICATION
// =============================================================================

/**
 * Reads the current filter values from the sidebar UI and applies them
 * to every registered marker — showing or hiding it accordingly.
 *
 * A marker is SHOWN only if it passes ALL active filters.
 */
function applyFilters() {

  // --- Read date range inputs ---
  const startRaw = document.getElementById('filter-date-start')?.value;
  const endRaw   = document.getElementById('filter-date-end')?.value;

  let startDate = startRaw ? parseDate(startRaw) : null;
  let endDate   = endRaw   ? parseDate(endRaw)   : null;

  // Normalise start to midnight and end to 23:59:59 (inclusive full day)
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate)   endDate.setHours(23, 59, 59, 999);

  // --- Read municipality selection ---
  const selectedMuni = document.getElementById('filter-municipality')?.value || '';

  // --- Apply to each marker ---
  let shown = 0, hidden = 0;

  _markerRegistry.forEach(({ record, marker }) => {
    let pass = true;

    // Check date filter (only when at least one bound is set)
    if (pass && (startDate || endDate)) {
      const cellValue = record[CONFIG.columns.dateColumn] || '';
      if (!cellMatchesDateRange(cellValue, startDate, endDate)) {
        pass = false;
      }
    }

    // Check municipality filter (only when a municipality is selected)
    if (pass && selectedMuni) {
      // _municipality is attached to each record by assignMunicipalitiesToMarkers()
      if ((record['_municipality'] || '') !== selectedMuni) {
        pass = false;
      }
    }

    // Add or remove from the cluster group.
    // Opacity-hiding won't work with clustering because hidden markers would
    // still count toward cluster totals — we must physically remove them.
    const group = getMarkersGroup();
    if (pass && !group.hasLayer(marker)) {
      group.addLayer(marker);
    } else if (!pass && group.hasLayer(marker)) {
      group.removeLayer(marker);
    }

    pass ? shown++ : hidden++;
  });

  // Update the result count badge in the sidebar
  updateFilterCount(shown, _markerRegistry.length);
}


/**
 * Clears all filter inputs and makes all markers visible again.
 */
function resetFilters() {
  const startEl = document.getElementById('filter-date-start');
  const endEl   = document.getElementById('filter-date-end');
  const muniEl  = document.getElementById('filter-municipality');

  if (startEl) startEl.value = '';
  if (endEl)   endEl.value   = '';
  if (muniEl)  muniEl.value  = '';

  // Re-add any markers that were removed by a previous filter pass
  const group = getMarkersGroup();
  _markerRegistry.forEach(({ marker }) => {
    if (!group.hasLayer(marker)) group.addLayer(marker);
  });

  updateFilterCount(_markerRegistry.length, _markerRegistry.length);
}


/**
 * Updates the small "showing X of Y" label below the filter controls.
 * @param {number} shown — Number of currently visible markers
 * @param {number} total — Total number of markers
 */
function updateFilterCount(shown, total) {
  const el = document.getElementById('filter-count');
  if (!el) return;
  el.textContent = total > 0 ? `Showing ${shown} of ${total} events` : '';
}


// =============================================================================
//  MUNICIPALITY DROPDOWN POPULATION
// =============================================================================

/**
 * Populates the municipality <select> element from the loaded GeoJSON layer.
 * Reads the attribute named in CONFIG.municipalityFilter.nameAttribute.
 *
 * @param {L.GeoJSON} geojsonLayer — The Leaflet municipality layer
 */
function populateMunicipalityFilter(geojsonLayer) {
  const select = document.getElementById('filter-municipality');
  if (!select || !geojsonLayer) return;

  const attr  = CONFIG.municipalityFilter.nameAttribute;
  const names = new Set();

  geojsonLayer.eachLayer(layer => {
    const name = layer.feature?.properties?.[attr];
    if (name) names.add(String(name).trim());
  });

  // Reset and rebuild the dropdown
  select.innerHTML = '<option value="">All Municipalities</option>';
  [...names].sort().forEach(name => {
    const opt = document.createElement('option');
    opt.value       = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  console.log(`[Filters] Municipality dropdown populated with ${names.size} entries.`);
}
