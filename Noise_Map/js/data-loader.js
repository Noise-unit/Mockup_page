// =============================================================================
//  data-loader.js  —  DATA SOURCE HANDLER
//  ============================================================================
//  Loads event data from one of three sources depending on CONFIG.dataSource.
//  Switch sources by changing CONFIG.dataSource.activeSource in config.js.
//  If any additional sources are added in config.js it will need to be added here as well 
//
//  Supported sources currently only include:
//    'csv'          — Local or hosted CSV file (such as the test csv in the folder)
//    'googlesheets' — Google Sheet published as CSV
//    'mslists'      — Microsoft SharePoint Lists (REST API)
// =============================================================================


/**
 * Master load function — calls the correct loader based on the active source.
 *
 * @returns {Promise<Array<Object>>}  Array of plain objects, one per data row.
 */
async function loadData() {
  const source = CONFIG.dataSource.activeSource;
  console.log(`[DataLoader] Loading from source: "${source}"`);

  if (source === 'googlesheets') return loadFromGoogleSheets();
  if (source === 'mslists')      return loadFromMicrosoftLists();
  if (source === 'csv')          return loadFromCSV();

  throw new Error(
    `[DataLoader] Unknown activeSource: "${source}". ` +
    `Valid options are 'csv', 'googlesheets', or 'mslists'.`
  );
}


// =============================================================================
//  OPTION A  —  STATIC CSV FILE
//  ============================================================================
//  Set CONFIG.dataSource.csv.url to a local file path ('data/file.csv')
//  or a full https:// URL pointing to a CSV file.
//  Uses the PapaParse library to parse the CSV text into an array of objects.
// =============================================================================

async function loadFromCSV() {
  const url = CONFIG.dataSource.csv.url;

  if (!url) {
    throw new Error('[DataLoader] CSV URL is not set. Update CONFIG.dataSource.csv.url in config.js');
  }

  console.log(`[DataLoader] Fetching CSV: ${url}`);

  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download:       true,   // PapaParse will fetch the URL itself
      header:         true,   // Use the first row as column headers
      skipEmptyLines: true,   // Ignore completely blank rows
      dynamicTyping:  false,  // Keep everything as strings (we parse numbers ourselves)

      complete(results) {
        if (results.errors.length) {
          // Non-fatal warnings — logs them but continues
          console.warn('[DataLoader] CSV parse warnings:', results.errors);
        }
        console.log(`[DataLoader] CSV loaded: ${results.data.length} records.`);
        resolve(results.data);
      },

      error(err) {
        reject(new Error(`[DataLoader] CSV fetch failed: ${err.message}`));
      },
    });
  });
}


// =============================================================================
//  OPTION B  —  GOOGLE SHEETS
//  ============================================================================
//  The Google Sheet MUST be published to the web as CSV:
//    File → Share → Publish to web → select "Entire document" + "CSV" → Publish
//  Copy the URL that appears and paste it into CONFIG.dataSource.googlesheets.url
//  Uses PapaParse to download and parse the sheet directly from the URL 
//  similar to the static csv file.
// =============================================================================

async function loadFromGoogleSheets() {
  const url = CONFIG.dataSource.googlesheets.url;

  if (!url || url.includes('YOUR_GOOGLE_SHEET')) {
    throw new Error(
      '[DataLoader] Google Sheets URL is not configured. ' +
      'Update CONFIG.dataSource.googlesheets.url in config.js.'
    );
  }

  console.log('[DataLoader] Fetching from Google Sheets…');

  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download:       true,
      header:         true,
      skipEmptyLines: true,
      dynamicTyping:  false,

      complete(results) {
        if (results.errors.length) {
          console.warn('[DataLoader] Google Sheets parse warnings:', results.errors);
        }
        console.log(`[DataLoader] Google Sheets loaded: ${results.data.length} records.`);
        resolve(results.data);
      },

      error(err) {
        reject(new Error(`[DataLoader] Google Sheets fetch failed: ${err.message}`));
      },
    });
  });
}


// =============================================================================
//  OPTION C  —  MICROSOFT SHAREPOINT LISTS
//  ============================================================================
//  Uses the SharePoint REST API (_api/web/lists) to fetch list items as JSON.
//
//  IMPORTANT NOTES:
//  • The hosting page must share the same SharePoint domain (same-origin), OR
//    the SharePoint admin must enable CORS for external domains.
//  • Authentication is handled automatically via browser cookies when
//    the user is signed into SharePoint.
//  • For external hosting, consider using Azure AD + OAuth instead — speak
//    to your SharePoint/IT administrator about the best approach.
//
//  Handles SharePoint's default 100-item page limit via recursive pagination.
//  I am not really familiar with this at all and cannot really test this
//  as a non-admin user of the sharepoint system.
//  This code block is based on stackoverflow data and specific tailoring using 
//  AI assistance
// =============================================================================

async function loadFromMicrosoftLists() {
  const { siteUrl, listName, fields } = CONFIG.dataSource.mslists;

  if (!siteUrl || siteUrl.includes('YOUR_SHAREPOINT')) {
    throw new Error(
      '[DataLoader] SharePoint URL is not configured. ' +
      'Update CONFIG.dataSource.mslists in config.js.'
    );
  }

  // Build the fields query string (e.g. "$select=Title,Easting,Northing")
  const selectClause = fields && fields.length > 0
    ? `$select=${fields.join(',')}&`
    : '';

  // Fetch up to 5000 items per request (adjust if needed for very large lists 5000 selected as 
  // the public repo should only show events for a span of a week or two.... I believe)
  const baseUrl =
    `${siteUrl.replace(/\/$/, '')}/_api/web/lists/getbytitle('${encodeURIComponent(listName)}')/items` +
    `?${selectClause}$top=5000`;

  console.log(`[DataLoader] Fetching from SharePoint Lists: ${baseUrl}`);

  // Collect all pages of results
  let allItems = [];
  let nextUrl  = baseUrl;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      method:      'GET',
      credentials: 'include',                    // Include SharePoint session cookies
      headers: {
        'Accept': 'application/json;odata=verbose',  // Ask for JSON (not ATOM XML)
      },
    });

    if (!response.ok) {
      throw new Error(
        `[DataLoader] SharePoint API error: ${response.status} ${response.statusText}. ` +
        `Check the siteUrl and listName in config.js.`
      );
    }

    const data = await response.json();

    // SharePoint wraps results in d.results
    const page = data?.d?.results || [];
    allItems = allItems.concat(page);

    // Check for a next-page link (SharePoint paginates at 100 items by default)
    nextUrl = data?.d?.__next || null;
    if (nextUrl) console.log(`[DataLoader] Fetching next page…`);
  }

  console.log(`[DataLoader] SharePoint Lists loaded: ${allItems.length} records.`);

  // Strip out internal SharePoint metadata fields before returning
  return allItems.map(item => {
    const clean = {};
    Object.keys(item).forEach(key => {
      if (!key.startsWith('__') && !key.startsWith('odata')) {
        clean[key] = item[key];
      }
    });
    return clean;
  });
}
