// =============================================================================
//  main.js  —  APPLICATION ENTRY POINT
//  ============================================================================
//  Controls the startup sequence and wires together all the modules.
//  This is the last script loaded. It calls functions defined in:
//    config.js, data-loader.js, utm-converter.js, popup.js,
//    filters.js, search.js, map.js
//
//  STARTUP SEQUENCE:
//    1. Initialise the Leaflet map
//    2. Wire up all sidebar controls (toggles[If used], sliders, buttons)
//    3. Initialise the search bar
//    4. Load GeoJSON overlay layers (municipality + noise zones) in parallel
//    5. Load event data (from the configured source)
//    6. Convert UTM coordinates → Lat/Lon
//    7. Render markers on the map
//    8. Assign municipality to each marker (point-in-polygon)
// =============================================================================


// =============================================================================
//  LOADING OVERLAY HELPERS
// =============================================================================

/** Shows the loading overlay with a status message. */
function showLoading(message = 'Loading…') {
  const overlay = document.getElementById('loading-overlay');
  const msgEl   = document.getElementById('loading-message');
  if (overlay) overlay.classList.add('loading-overlay--visible');
  if (msgEl)   msgEl.textContent = message;
}

/** Hides the loading overlay. */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) overlay.classList.remove('loading-overlay--visible');
}

/** Displays an error banner (used when a critical step fails). */
function showError(message) {
  const banner = document.getElementById('error-banner');
  const text   = document.getElementById('error-text');
  if (banner) banner.style.display = 'flex';
  if (text)   text.textContent     = message;
  console.error('[App]', message);
}

/** Hides the error banner. */
function hideError() {
  const banner = document.getElementById('error-banner');
  if (banner) banner.style.display = 'none';
}


// =============================================================================
//  SIDEBAR CONTROLS SETUP
// =============================================================================

/**
 * Wires up all interactive controls in the sidebar:
 *   • Municipality layer toggle (if used) + opacity slider
 *   • Filter apply / reset buttons
 *   • Mobile sidebar button
 *   • Error banner dismiss button
 */
function setupSidebarControls() {

  // --- Municipality Layer Controls ---

  // Checkbox: show/hide the layer
  document.getElementById('toggle-municipality')?.addEventListener('change', function () {
    setLayerVisibility('municipality', this.checked);
    // Grey out the slider when the layer is off
    document.getElementById('opacity-municipality')?.toggleAttribute('disabled', !this.checked);
  });

  // Range slider: change opacity
  const muniSlider = document.getElementById('opacity-municipality');
  muniSlider?.addEventListener('input', function () {
    setLayerOpacity('municipality', this.value);
    document.getElementById('opacity-municipality-val').textContent =
      Math.round(this.value * 100) + '%';
  });

  // --- Filter Buttons ---

  document.getElementById('filter-apply')?.addEventListener('click', applyFilters);
  document.getElementById('filter-reset')?.addEventListener('click', resetFilters);


  // --- Mobile Sidebar Toggle (hamburger button) ---
  // On small screens a button overlays the map to open/close the sidebar

  document.getElementById('sidebar-hamburger')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('sidebar--open');
    document.getElementById('map-overlay-backdrop')?.classList.toggle('visible');
  });

  // Tapping the backdrop (behind the open sidebar) closes it on mobile
  document.getElementById('map-overlay-backdrop')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('sidebar--open');
    document.getElementById('map-overlay-backdrop')?.classList.remove('visible');
  });

  // --- Error Banner Dismiss ---

  document.getElementById('error-dismiss')?.addEventListener('click', hideError);


  console.log('[App] Sidebar controls wired up.');
}


// =============================================================================
//  MAIN INITIALISATION
// =============================================================================

/**
 * Application bootstrap — runs when the DOM is ready.
 */
async function initApp() {
  try {

    // ── Step 1: Map ──────────────────────────────────────────────────────────
    showLoading('Initialising map…');
    initMap();

    // ── Step 2: Sidebar & Search ──────────────────────────────────────────────
    setupSidebarControls();
    initSearch();

    // ── Step 3: GeoJSON Layers ────────────────────────────────────────────────
    // Load any layers here all at the same time (Promise.all = parallel fetch)
    showLoading('Loading map layers…');
    await Promise.all([
      loadMunicipalityLayer(),
    ]);

    // ── Step 4: Event Data ────────────────────────────────────────────────────
    showLoading('Fetching noise application data…');
    const rawRecords = await loadData();

    if (!rawRecords || rawRecords.length === 0) {
      console.warn('[App] Data source returned zero records.');
    }

    // ── Step 5: Coordinate Conversion ─────────────────────────────────────────
    showLoading('Converting coordinates…');
    const geoRecords = processCoordinates(rawRecords);

    // ── Step 6: Render Markers ────────────────────────────────────────────────
    showLoading('Rendering events on map…');
    renderMarkers(geoRecords);

    // ── Step 7: Point-in-Polygon Assignment ───────────────────────────────────
    // Assign each marker to a municipality so the filter can use it
    // (if the municipality layer loaded, this runs; otherwise it's a no-op)
    assignMunicipalitiesToMarkers();

    // ── Done ──────────────────────────────────────────────────────────────────
    hideLoading();
    console.log(`[App] Ready — ${geoRecords.length} event(s) displayed.`);

  } catch (err) {
    hideLoading();
    showError(`Failed to load: ${err.message}`);
    console.error('[App] Fatal error during initialisation:', err);
  }
}


// Kick off the app once the HTML is fully parsed
document.addEventListener('DOMContentLoaded', initApp);
