// =============================================================================
//  map.js  —  CORE MAP LOGIC
//  ============================================================================
//  Handles:
//    • Leaflet map initialisation + OpenStreetMap base layer
//    • GeoJSON overlay layer loading (municipality, noise zones)
//    • Layer visibility and opacity controls
//    • Event marker rendering (circle markers, hover, popups)
//    • Point-in-polygon assignment of municipality to each marker
//    • Legend generation based on colorMap in config.js
//
//  Only the OpenStreetMap base layer is used as the satellite imagery such as 
//  Google or ESRI usually requires special permissions if used for a public project. 
//  While this project is not for profit I was still a bit hesitant to use either of these
//  just as a precaution. Besides the OpenStreetMap should be sufficient enough.
// =============================================================================


// Global Leaflet map instance — used by search.js and other modules
let map;

// GeoJSON layers (null until loaded)
let _municipalityLayer = null;

// MarkerClusterGroup that holds all event circle markers.
// Nearby markers are automatically merged into a single cluster badge.
let _markersGroup;

/**
 * Returns the marker cluster group so other modules (e.g. filters.js)
 * can add/remove individual markers from it directly.
 * @returns {L.MarkerClusterGroup}
 */
function getMarkersGroup() { return _markersGroup; }


// =============================================================================
//  MAP INITIALISATION
// =============================================================================

/**
 * Creates the Leaflet map, attaches it to the #map element, and adds the
 * OpenStreetMap tile base layer.  Must be called first before anything else.
 */
function initMap() {
  map = L.map('map', {
    center:      CONFIG.map.center,
    zoom:        CONFIG.map.initialZoom,
    minZoom:     CONFIG.map.minZoom,
    maxZoom:     CONFIG.map.maxZoom,
    zoomControl: false,
  });

  // Zoom control — top-right keeps it away from the sidebar
  L.control.zoom({ position: 'topright' }).addTo(map);

  // OpenStreetMap tile layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19, // matches the config.js
  }).addTo(map);

  // Marker cluster group — nearby points merge into a numbered badge.
  // iconCreateFunction draws a custom badge that matches the app colour scheme.
  _markersGroup = L.markerClusterGroup({
    maxClusterRadius:  60,   // px — how close points must be to cluster
    spiderfyOnMaxZoom: true, // spread overlapping points at max zoom
    showCoverageOnHover: false,

    iconCreateFunction: function (cluster) {
      const count = cluster.getChildCount();

      // Three size tiers based on how many markers are inside
      let tier, size;
      if      (count < 10)  { tier = 'sm'; size = 34; }
      else if (count < 50)  { tier = 'md'; size = 40; }
      else                  { tier = 'lg'; size = 48; }

      return L.divIcon({
        html: `<div class="cluster-badge cluster-badge--${tier}">${count}</div>`,
        className: '',          // suppress Leaflet's default white square bg
        iconSize:  [size, size],
        iconAnchor:[size / 2, size / 2],
      });
    },
  }).addTo(map);

  console.log('[Map] Leaflet map initialised.');
}


// =============================================================================
//  GEOJSON OVERLAY LAYERS
// =============================================================================

/**
 * Loads the municipality GeoJSON layer.
 * If no URL/source link is set in config.js the function stops in the background
 */
async function loadMunicipalityLayer() {
  const cfg = CONFIG.layers.municipality;

  if (!cfg.url) {
    console.info('[Map] Municipality layer URL not set in config.js — skipping.');
    return;
  }

try {
    const res  = await fetch(cfg.url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${cfg.url}`);
    const data = await res.json();

    // Build a lookup from feature index → pastel colour so each polygon in the layer
    // gets a unique fill while sharing the same stroke style. Should not need to edit this
    const palette = cfg.pastelColors || ['#fbbf24'];
    let featureIndex = 0;

    _municipalityLayer = L.geoJSON(data, {
      style: function () {
        const fillColor = palette[featureIndex % palette.length];
        featureIndex++;
        return {
          color:       cfg.strokeColor,
          fillColor:   fillColor,
          weight:      cfg.strokeWeight,
          opacity:     1,
          fillOpacity: cfg.defaultOpacity,
        };
      },
    // NOT interactive so clicking on the polygon does nothing
      interactive: false,
    }).addTo(map);

    // Populates the municipality filter dropdown using the loaded features from the attribute name
    populateMunicipalityFilter(_municipalityLayer);

    // Now that the layer is loaded, assign municipality to any markers already on the map
    assignMunicipalitiesToMarkers();

    console.log('[Map] Municipality layer loaded.');
  } catch (err) {
    console.error('[Map] Failed to load municipality layer:', err.message);
  }
}

// --- Layer visibility and opacity helpers (called by sidebar controls) -------

/**
 * Shows or hides a named GeoJSON layer.
 * @param {'municipality'|'noiseZone'} layerKey
 * @param {boolean} visible
 */
function setLayerVisibility(layerKey, visible) {
  const layer = layerKey === 'municipality' ? _municipalityLayer : _noiseZoneLayer;
  if (!layer) return;

  if (visible && !map.hasLayer(layer)) map.addLayer(layer);
  if (!visible &&  map.hasLayer(layer)) map.removeLayer(layer);
}


/**
 * Updates the fill opacity of a named GeoJSON layer.
 * @param {'municipality'|'noiseZone'} layerKey
 * @param {number} opacity — 0.0 to 1.0
 */
function setLayerOpacity(layerKey, opacity) {
  const layer = layerKey === 'municipality' ? _municipalityLayer : _noiseZoneLayer;
  if (!layer) return;
  layer.setStyle({ fillOpacity: parseFloat(opacity) });
}


// =============================================================================
//  MARKER RENDERING
// =============================================================================

/**
 * Clears and redraws all event markers from the processed dataset.
 * Each marker gets its colour from the colorBy column and a click popup.
 *
 * @param {Array<Object>} records — Records with 'lat' and 'lon' already attached
 */
function renderMarkers(records) {
  // Remove existing markers and clear the filter registry
  _markersGroup.clearLayers();
  clearMarkerRegistry();

  let drawn = 0;

  records.forEach(record => {
    if (record.lat == null || record.lon == null) return;

    // Determine the marker colour from the configured column
    const colourValue = record[CONFIG.columns.colorBy] || '';
    const colour      = getMarkerColour(colourValue);

    // Create the Leaflet circle marker
    const marker = L.circleMarker([record.lat, record.lon], {
      radius:      CONFIG.marker.radius,
      fillColor:   colour,
      color:       CONFIG.marker.strokeColor,
      weight:      CONFIG.marker.strokeWidth,
      opacity:     1,
      fillOpacity: CONFIG.marker.fillOpacity,
    });

    // Hover: grow on mouse-over, shrink on mouse-out
    marker.on('mouseover', function () {
      this.setRadius(CONFIG.marker.hoverRadius);
      this.setStyle({ weight: 3 });
      this.bringToFront();
    });
    marker.on('mouseout', function () {
      this.setRadius(CONFIG.marker.radius);
      this.setStyle({ weight: CONFIG.marker.strokeWidth });
    });

    // Popup: built by popup.js, appears on click
    marker.bindPopup(buildPopupContent(record), {
      maxWidth:  340,
      className: 'tt-popup',    // Linked to custom CSS in style.css
      closeButton: true,
    });

    _markersGroup.addLayer(marker);

    // Register with the filter system so filters can show/hide this marker
    registerMarker(record, marker);

    drawn++;
  });

  // Update the count display after rendering
  updateFilterCount(drawn, drawn);

  console.log(`[Map] ${drawn} markers rendered.`);
}


// =============================================================================
//  POINT-IN-POLYGON  —  Assigns a municipality name to each marker
// =============================================================================

/**
 * For each registered marker, tests which municipality polygon it falls inside
 * using the leaflet-pip library, then stores the result in record['_municipality'].
 *
 * The filter system reads record['_municipality'] when the municipality filter
 * is active.  If leaflet-pip is not loaded or the layer is not available,
 * the function exits gracefully.
 *
 * Call this:
 *   a) after markers are rendered AND the municipality layer is loaded, OR
 *   b) whenever the municipality layer finishes loading (see loadMunicipalityLayer)
 */
function assignMunicipalitiesToMarkers() {
  if (!_municipalityLayer) return;
  if (typeof leafletPip === 'undefined') {
    console.warn('[Map] leaflet-pip not loaded — municipality filter will not work.');
    return;
  }

  const attr = CONFIG.municipalityFilter.nameAttribute;

  _markerRegistry.forEach(({ record, marker }) => {
    const { lat, lng } = marker.getLatLng();

    // leafletPip.pointInLayer expects [lng, lat] (GeoJSON order)
    const hits = leafletPip.pointInLayer([lng, lat], _municipalityLayer, true);

    record['_municipality'] = hits.length > 0
      ? (hits[0].feature?.properties?.[attr] || '')
      : '';
  });

  console.log('[Map] Municipality assignment complete.');
}
