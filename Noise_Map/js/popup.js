// =============================================================================
//  popup.js  —  MARKER POPUP TEMPLATE
//  ============================================================================
//  Controls exactly what information appears inside a popup when a user
//  clicks on a map point — and how it looks.
//
//  TO CUSTOMISE THE POPUP:
//  ─────────────────────────────────────────────────────────────────────────
//  • Change the TITLE:    Edit the 'title' line in Section 1.
//  • Change the SUBTITLE: Edit the 'subtitle' line in Section 2.
//  • Add/remove/reorder BODY ROWS: Edit the 'rows' array in Section 3.
//    Each row is one line:  { label: 'Display Label', value: record['COLUMN_NAME'] }
//    Move a row up to make it appear earlier. Delete a row to remove it.
//  • Change COLUMN NAMES: Replace 'COLUMN_NAME' with the exact header from
//    your dataset (case-sensitive).
//
//  The set up below is based on the test CSV in the folder
// =============================================================================

/**
 * Returns the colour for a given category value.
 * Uses the colorMap defined in config.js.
 *
 * @param {string} value — value from the colorBy column
 * @returns {string}     — hex colour string
 */
function getMarkerColour(value) {
  if (!value) return CONFIG.colorMap.default;
  const trimmed = String(value).trim();
  return CONFIG.colorMap.values[trimmed] ?? CONFIG.colorMap.default;
}


/**
 * Builds the full HTML string for a marker popup.
 * Edit the sections below to customise what the popup shows.
 *
 * @param {Object} record — One data row (all columns available as record['ColName'] we only 
 * really need one but a second is listed as a backup)
 * @returns {string}      — HTML string injected into the Leaflet popup
 */
function buildPopupContent(record) {

  // ============================================================
  //  SECTION 1 — TITLE  (Large bold text at the top of the popup)
  //  Change 'Applicant' to the column name for the main title.
  //  The || fallback is used when a value is missing as a backup
  //  More of these can be added if need.
  // ============================================================
  const title =
    record['Applicant'] ||
    record['Reference No.']       ||
    'Noise Variation Application';

  // ============================================================
  //  SECTION 2 — SUBTITLE  (Smaller text just below the title)
  //  Change 'Reference No' to a different column if preferred.
  //  Set to '' to hide the subtitle entirely.
  // ============================================================
  const subtitle = record['Reference No.']
    ? `Reference: ${record['Reference No.']}`
    : '';


  // ============================================================
  //  SECTION 3 — COLOUR BADGE  (shown in the popup header)
  //  Automatically uses the same column and colours as the map markers.
  //  Usually you won't need to touch this at all.
  // ============================================================
  const statusValue  = record[CONFIG.columns.colorBy] || 'Unknown';
  const statusColour = getMarkerColour(statusValue);


  // ============================================================
  //  SECTION 4 — BODY ROWS
  //  ─────────────────────────────────────────────────────────────
  //  Each object in this array becomes one row in the popup body.
  //  FORMAT:  { label: 'Human-readable label', value: record['COLUMN_NAME'] }
  //
  //  • TO REORDER: Move rows up or down in the array.
  //  • TO REMOVE:  Delete (or comment out) the row.
  //  • TO ADD:     Add a new { label: '...', value: record['...'] } line.
  //  • Rows where value is blank/null are automatically hidden.
  // ============================================================
  const rows = [

    // --- Primary details ---
    { label: 'Applicant',        value: record['Applicant']      },
    { label: 'Event Type',       value: record['Description']    },

    // --- Location ---
    { label: 'Address',          value: record['Event Location'] },
   // { label: 'Municipality',     value: record['Municipality']   },

    // --- Dates/Times ---
    { label: 'Event Date(s)',    value: record['Event dates']    },
    { label: 'Start Time',   value: record['Start time']},

    // *** ADD MORE ROWS BELOW THIS LINE IF NEEDED ***
    // --- Group Name ---
    // { label: 'Your Label', value: record['Your_Column_Name'] },

  ];

  // Filter out rows that have no value
  const filledRows = rows.filter(r => r.value !== undefined && r.value !== null && String(r.value).trim() !== '');


  // ============================================================
  //  SECTION 5 — COORDINATES ROW  (shown at the bottom)
  //  Displays the UTM coordinates for the point. If Lat/Lon prefered the span class can be replaced with
  //  ${record.lat.toFixed(5)}°N, ${Math.abs(record.lon).toFixed(5)}°W 
  //  Or this entire block can be removed if no shown coordinates are preferred 
  // ============================================================
  const coordRow = record.lat != null
    ? `<div class="popup-coords">
         <span class="popup-coords-icon">📍UTM WGS84 </span>
         Easting: ${record['Easting']}
         <br> 
         Northing: ${record['Northing']}        
       </div>`
    : '';  

  // ── Build the HTML ──────────────────────────────────────────

  const rowsHTML = filledRows.map(r => `
    <div class="popup-row">
      <span class="popup-label">${escapeHtml(String(r.label))}</span>
      <span class="popup-value">${escapeHtml(String(r.value))}</span>
    </div>
  `).join('');

  return `
    <div class="popup-container">

      <div class="popup-header">
        <div class="popup-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="popup-subtitle">${escapeHtml(subtitle)}</div>` : ''}
        <span class="popup-badge" style="background:${statusColour}20; color:${statusColour}; border-color:${statusColour}40;">
          <span class="popup-badge-dot" style="background:${statusColour};"></span>
          ${escapeHtml(statusValue)}
        </span>
      </div>

      <div class="popup-body">
        ${rowsHTML || '<p class="popup-empty">No additional details available.</p>'}
      </div>

      ${coordRow}

    </div>
  `;
}

/**
 * Escapes HTML special characters to prevent XSS injection.
 * Always call this when embedding user/dataset data into HTML strings.
 *
 * @param {string} text
 * @returns {string}
 */
function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, ch => map[ch]);
}
