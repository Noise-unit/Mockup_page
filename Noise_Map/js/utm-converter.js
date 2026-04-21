// =============================================================================
//  utm-converter.js  —  UTM → WGS84 COORDINATE CONVERSION
//  ============================================================================
//  Converts UTM (Easting / Northing) coordinates to geographic (Lat / Lon)
//  using the proj4 library. Supports zones 19N, 20N (default), and 21N.
//
//  Requires: proj4.js  (loaded via <script> in index.html)
// =============================================================================


// Cache proj4 projection strings so they are only built once per zone
const _projCache = {};

/**
 * Returns (and caches) the proj4 projection string for a given UTM zone.
 *
 * @param {number} zone       — UTM zone number (e.g. 20)
 * @param {string} hemisphere — 'N' or 'S'
 * @returns {string}  proj4 projection string
 */
function getUtmProjection(zone, hemisphere) {
  const key = `${zone}${hemisphere}`;
  if (!_projCache[key]) {
    // +proj=utm    : Universal Transverse Mercator
    // +zone=XX     : The numbered UTM zone
    // +datum=WGS84 : World Geodetic System 1984 reference ellipsoid
    // +units=m     : Coordinates are in metres
    // +no_defs     : Don't inherit any default parameters
    // +south       : Added only for Southern hemisphere zones
    _projCache[key] =
      `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs` +
      (hemisphere === 'S' ? ' +south' : '');
  }
  return _projCache[key];
}

// WGS84 geographic (lat/lon) projection string — the target of all conversions
const WGS84_PROJ = '+proj=longlat +datum=WGS84 +no_defs';


/**
 * Converts a single UTM point to WGS84 latitude / longitude.
 *
 * @param {number} easting    — UTM Easting  (metres)
 * @param {number} northing   — UTM Northing (metres)
 * @param {number} zone       — UTM zone number (e.g. 20)
 * @param {string} hemisphere — 'N' or 'S'
 * @returns {{ lat: number, lon: number } | null}  — or null if conversion fails
 */
function utmToLatLon(easting, northing, zone, hemisphere = 'N') {
  try {
    const utmProj = getUtmProjection(zone, hemisphere);

    // proj4(sourceProj, targetProj, [x, y])
    // x = Easting, y = Northing  →  returns [longitude, latitude]
    const [lon, lat] = proj4(utmProj, WGS84_PROJ, [easting, northing]);

    return { lat, lon };

  } catch (err) {
    console.error(
      `[UTMConverter] Conversion failed (Zone ${zone}${hemisphere}, ` +
      `E:${easting}, N:${northing}):`, err
    );
    return null;
  }
}


/**
 * Determines the UTM zone for a given data record.
 *
 * Logic:
 *  1. If CONFIG.columns.utmZoneColumn is set, read the zone from that column.
 *  2. Otherwise, use CONFIG.utm.defaultZone.
 *  3. Logs a warning if the zone is outside CONFIG.utm.supportedZones.
 *
 * @param {Object} record — A single data row
 * @returns {number}      — UTM zone number
 */
function getZoneForRecord(record) {
  const { utmZoneColumn } = CONFIG.columns;
  const { defaultZone, supportedZones } = CONFIG.utm;

  if (utmZoneColumn && record[utmZoneColumn]) {
    // Extract only the digits from values like "20N", "Zone 20", "UTM 20"
    const raw    = String(record[utmZoneColumn]);
    const parsed = parseInt(raw.replace(/\D/g, ''), 10);

    if (!isNaN(parsed)) {
      if (!supportedZones.includes(parsed)) {
        console.warn(
          `[UTMConverter] Zone ${parsed} is not in CONFIG.utm.supportedZones ` +
          `[${supportedZones.join(', ')}]. The point may display incorrectly.`
        );
      }
      return parsed;
    }
  }

  return defaultZone;
}


/**
 * Processes an entire dataset: converts each row's UTM coordinates to lat/lon
 * and attaches 'lat' and 'lon' properties to the record object.
 *
 * Rows with missing, non-numeric, or unconvertible coordinates are skipped
 * and a warning is logged for each skipped row.
 *
 * An additional check warns if converted points fall far outside
 * the expected bounding box for Trinidad & Tobago.
 *
 * @param {Array<Object>} records — Raw data rows from the data loader
 * @returns {Array<Object>}       — Valid records with lat/lon added
 */
function processCoordinates(records) {
  const { easting: eastCol, northing: northCol } = CONFIG.columns;
  const { hemisphere } = CONFIG.utm;

  // Approximate bounding box for T&T (with some padding)
  const TT_BOUNDS = { minLat: 9.0, maxLat: 12.5, minLon: -62.5, maxLon: -59.5 };

  const valid   = [];
  let   skipped = 0;

  records.forEach((record, index) => {
    const rowNum  = index + 1;
    const easting  = parseFloat(record[eastCol]);
    const northing = parseFloat(record[northCol]);

    // --- Guard: numeric check ---
    if (isNaN(easting) || isNaN(northing)) {
      console.warn(
        `[UTMConverter] Row ${rowNum}: missing or non-numeric coordinates ` +
        `(${eastCol}="${record[eastCol]}", ${northCol}="${record[northCol]}"). Skipped.`
      );
      skipped++;
      return;
    }

    const zone   = getZoneForRecord(record);
    const result = utmToLatLon(easting, northing, zone, hemisphere);

    if (!result) {
      console.warn(`[UTMConverter] Row ${rowNum}: conversion returned null. Skipped.`);
      skipped++;
      return;
    }

    const { lat, lon } = result;

    // --- Sanity check which warn if a point is far outside T&T ---
    if (
      lat < TT_BOUNDS.minLat || lat > TT_BOUNDS.maxLat ||
      lon < TT_BOUNDS.minLon || lon > TT_BOUNDS.maxLon
    ) {
      console.warn(
        `[UTMConverter] Row ${rowNum}: converted point (${lat.toFixed(5)}, ${lon.toFixed(5)}) ` +
        `appears to be OUTSIDE Trinidad & Tobago. Check the source coordinates and UTM zone.`
      );
      // The point will still be inclueded - This should honestly never be an issue for Noise Applications though
      // but included to keep everthing consistent and a bit more robust i.e. hopefully prevents it from breaking
    }

    // Attach lat/lon to a copy of the record (don't mutate the original)
    valid.push({ ...record, lat, lon });
  });

  if (skipped > 0) {
    console.warn(`[UTMConverter] ${skipped} row(s) skipped due to coordinate errors.`);
  }
  console.log(`[UTMConverter] ${valid.length} of ${records.length} records converted successfully.`);

  return valid;
}
