// =============================================================================
//  search.js  —  LOCATION SEARCH
//  ============================================================================
//  Provides a text search bar that geocodes location queries using the free
//  OpenStreetMap Nominatim API and flies the map to the result.
//
//  Searches are restricted to Trinidad and Tobago (countryCode in config.js).
//  The user presses Enter or clicks the search button to trigger a search.
// =============================================================================


/**
 * Initialises the search input and button event listeners.
 * Must be called after the DOM is ready.
 */
function initSearch() {
  const inputEl  = document.getElementById('search-input');
  const buttonEl = document.getElementById('search-button');

  if (!inputEl) {
    console.warn('[Search] #search-input element not found in the DOM.');
    return;
  }

  // Apply placeholder text from config
  inputEl.placeholder = CONFIG.search.placeholder;

  // Trigger search on Enter key
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerSearch(inputEl.value);
    }
  });

  // Trigger search on button click
  buttonEl?.addEventListener('click', () => triggerSearch(inputEl.value));

  console.log('[Search] Search bar initialised.');
}


/**
 * Entry point for a search — validates the query then calls performSearch().
 * @param {string} query — Raw text from the search input
 */
function triggerSearch(query) {
  const trimmed = (query || '').trim();

  if (!trimmed) {
    setSearchStatus('Type a location name and press Enter.', 'info');
    return;
  }

  performSearch(trimmed);
}


/**
 * Geocodes a location string using the Nominatim API and zooms the map.
 * Uses a debounce-free approach — each call is independent.
 *
 * @param {string} query — Validated, non-empty search string
 */
async function performSearch(query) {
  setSearchStatus('Searching…', 'loading');

  try {
    // Build the Nominatim request URL
    // Docs: https://nominatim.org/release-docs/develop/api/Search/
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q',            query);
    url.searchParams.set('countrycodes', CONFIG.search.countryCode);  // Restrict to T&T
    url.searchParams.set('format',       'json');
    url.searchParams.set('limit',        '5');   // Get a few results in case first is bad
    url.searchParams.set('addressdetails', '0');

    const response = await fetch(url.toString(), {
      headers: {
        // Nominatim's Usage Policy requires a meaningful User-Agent
        'User-Agent': 'TT-NoiseVariationMap/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from Nominatim`);
    }

    const results = await response.json();

    if (!results || results.length === 0) {
      setSearchStatus(`No results found for "${query}".`, 'error');
      return;
    }

    // Use the first (highest-ranked) result
    const best = results[0];
    const lat  = parseFloat(best.lat);
    const lon  = parseFloat(best.lon);

    // Fly the map smoothly to the result
    map.flyTo([lat, lon], CONFIG.search.zoomToResult, {
      animate: true,
      duration: 1.2, // this can be increased or reduced as needed to make it faster or slower to zoom
    });

    // Show a short summary of what was found
    // Truncate long display names to keep the UI tidy
    const shortName = best.display_name.split(',').slice(0, 2).join(',').trim();
    setSearchStatus(`📍 ${shortName}`, 'success');

    // Auto-clear the success message after 5 seconds
    setTimeout(() => setSearchStatus('', 'idle'), 5000);

  } catch (err) {
    console.error('[Search] Geocoding failed:', err);
    setSearchStatus('Search failed. Please try again.', 'error');
  }
}


/**
 * Updates the status message displayed below the search bar.
 *
 * @param {string} message — Text to display (empty to hide)
 * @param {string} type    — 'idle' | 'info' | 'loading' | 'success' | 'error'
 */
function setSearchStatus(message, type) {
  const el = document.getElementById('search-status');
  if (!el) return;

  el.textContent = message;

  // Remove all status modifier classes then add the current one
  el.className = 'search-status';
  if (type && type !== 'idle') el.classList.add(`search-status--${type}`);

  // Toggle visibility
  el.style.display = message ? 'block' : 'none';
}
