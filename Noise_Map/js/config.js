// =============================================================================
//  config.js  —  MAIN CONFIGURATION FILE
//  ============================================================================
//  *** THIS IS THE PRIMARY FILE THAT WILL NEED TO BE EDITTED ***
//
//  Contains all the settings that control how the map looks and behaves.
//  Each setting has a comment explaining what it does and what values are valid
//  to hopefully make it easier to manipulate as needed.
//  You shouldn't really need to touch any of the other js files.
// =============================================================================

const CONFIG = {

  // ---------------------------------------------------------------------------
  //  MAP DISPLAY SETTINGS
  //  Controls the initial view when the map first loads.
  // ---------------------------------------------------------------------------
  map: {
    // Centre point of Trinidad and Tobago [latitude, longitude]
    center: [10.6918, -61.2225],

    // How zoomed in the map starts (1 = whole world, 18 = street level)
    initialZoom: 9,

    // Limits for how far the user can zoom in or out
    minZoom: 7,
    maxZoom: 19, //This should be high enough
  },


  // ---------------------------------------------------------------------------
  //  DATA SOURCE SETTINGS
  //  Change 'activeSource' to switch between data sources:
  //    'csv'          —  Local or hosted CSV file  (simplest option)
  //    'googlesheets' —  A published Google Sheet (CSV export URL)
  //    'mslists'      —  Microsoft SharePoint / Lists (REST API)
  //
  //  I don't know how the data will be intended to be pulled into the map
  //  but I used the two methods I am most used to and a MS LISTS Option I found
  //  I haven't tested this option as I primarly use free options xD 
  // ---------------------------------------------------------------------------
  dataSource: {

    // *** CHANGE THIS LINE to switch which source is used as listed above ***
    // *** Currently set to CSV and linked to a test CSV file in the folder ***
    activeSource: 'csv',

    // --- Option A: Static CSV file ---
    // Place your CSV in the /data/ folder, or use a full https:// URL.
    csv: {
      url: 'https://raw.githubusercontent.com/Noise-unit/Mockup_page/refs/heads/main/noise_applications.csv', // test CSV in the folder
    },

    // --- Option B: Google Sheets ---
    // In Google Sheets: File → Share → Publish to web → select "CSV" format.
    // Copy the generated URL and paste it below. 
    // I usually use this method to allow for near-real-time updates but this would have
    // obvious security limitations and challenges if it were to be used as the public data source
    googlesheets: {
      url: 'YOUR_GOOGLE_SHEET_PUBLISHED_CSV_URL_HERE',
      // Example:
      // url: 'https://docs.google.com/spreadsheets/d/SHEET_ID/pub?gid=0&single=true&output=csv',
    },

    // --- Option C: Microsoft SharePoint Lists ---
    // Your SharePoint site root URL (no trailing slash).
    // The map uses the SharePoint REST API to fetch list items.
    // I've seen guides saying that the page hosting the map must be on the same SharePoint tenant,
    // or CORS and authentication must be configured externally.
    // I am not familiar with this at all so I haven't been able to test this just included as I was 
    // informed that MS Lists was being used as the means to parse the information for the public repo.
    // Any other method would need to be further researched / added as required
    // but that is outside my scope of capability.
    mslists: {
      siteUrl:  'YOUR_SHAREPOINT_SITE_URL',
      // Example: 'https://yourorg.sharepoint.com/sites/yoursite'

      listName: 'YOUR_LIST_NAME',
      // Example: 'NoiseVariationApplications'

      // Specific fields to retrieve. Leave as [] to retrieve ALL fields.
      // Listing fields improves performance on large lists 
      // but for the public repo we shouldn't have much fields anyway so it should be fine.
      fields: [],
      // Example: ['Title', 'Applicant', 'Easting', 'Northing', 'Event dates', 'Status'],
    },
  },


  // ---------------------------------------------------------------------------
  //  COLUMN / FIELD NAME SETTINGS
  //  *** CHANGE THESE to match the exact column headers in the dataset source ***
  //  These will be case-sensitive so 'Easting' and 'easting' cannot be used interchangeably.
  // ---------------------------------------------------------------------------
  columns: {
    // Column containing the UTM Easting value (X coordinate)
    // For the test CSV this is the 'Easting' column
    easting: 'Easting',

    // Column containing the UTM Northing value (Y coordinate)
    // For the test CSV this is the 'Northing' column
    northing: 'Northing',

    // (Optional) Column specifying the UTM Zone per row (e.g. "20N", "20", "Zone 20").
    // If ALL your points use the same zone, set this to null and use defaultZone below.
    // This shouldn'tbe needed for Noise as the locations would all be onshore and within the 20N zone
    // would be more applicable to something like CECs which may have points to the far east/west coast etc.
    utmZoneColumn: null,
    // Example: utmZoneColumn: 'UTM_Zone',

    // *** Which column controls the COLOUR of each point on the map? ***
    // Change this to the column name in the dataset.
    // For the test CSV this is the 'Status' column
    colorBy: 'Status',
    // Examples: 'Status', 'Application_Status', etc. generally the column which speaks to the status of the application

    // Which column contains the event date(s) used for the DATE FILTER?
    // The column may contain multiple dates separated by commas or semicolons.
    // Most of the common date formats should be captured to account for any mdate format that is used
    // For the test CSV this is the 'Event dates' column
    dateColumn: 'Event dates',
    // Examples: 'Event_Dates', 'Start_Date', 'Application_Date', 'Event_Start' etc.
  },


  // ---------------------------------------------------------------------------
  //  UTM COORDINATE SETTINGS
  //  Trinidad & Tobago sits primarily in UTM Zone 20N.
  //  Points near the edge of the Economic Zone may fall in Zone 19N or 21N 
  //  but not really applicable for Noise.
  // ---------------------------------------------------------------------------
  utm: {
    // Zone used when utmZoneColumn above is null (i.e. a single zone for all data)
    defaultZone: 20,

    // Hemisphere: 'N' for Northern (T&T is in the Northern hemisphere)
    hemisphere: 'N',

    // Zones the converter is allowed to use. Points in other zones get a warning 
    // as these should never be valid for T&T anyway.
    supportedZones: [19, 20, 21],
  },


  // ---------------------------------------------------------------------------
  //  POINT COLOUR SETTINGS
  //  Maps values in the 'colorBy' column to colours on the map.
  //  Add or remove entries to match the actual values in your data.
  //  Any value NOT listed here will use the 'default' colour.
  // ---------------------------------------------------------------------------
  colorMap: {
    // Add one entry per unique value in your colorBy column.
    // Colours selected here are strictly preference based and can be adjusted 
    // based on discussion etc.
    // The 4 main categories are captured (Issued, Pending, Refused and Cancelled. 
    // anything other than these would be captured by the default colour as 'Other' 
    // but this can be removed to just keep the 4 main ones or additional ones can be added) 
    values: {
      'Issued':     '#22c55e',   // Green
      'Pending':      '#f59e0b',   // Amber
      'Refused':     '#ef4444',   // Red
      'Cancelled':    '#94a3b8',   // Grey
    },

    // Colour used for any value that is not listed above
    default: '#9451d6ff',            // Purple
  },


  // ---------------------------------------------------------------------------
  //  MARKER APPEARANCE SETTINGS
  //  Controls how event points look on the map.
  // ---------------------------------------------------------------------------
  marker: {
    radius:       8,         // Normal size (pixels)
    hoverRadius:  12,        // Size when the user hovers over the point
    fillOpacity:  0.88,      // Transparency of the fill (0 = invisible, 1 = solid)
    strokeColor:  '#ffffff', // Colour of the ring around each point
    strokeWidth:  2,         // Thickness of that ring
  },


  // ---------------------------------------------------------------------------
  //  GEOJSON OVERLAY LAYER SETTINGS
  //  The file path is currenly linked to a GitHub Repo where I have the GEOJSON stored
  //  but this can be switched for any other prefered location. 
  //  The GEOJSON file is located in the folder labeled 'Municipality.geojson' 
  //  This was obtained from a public database and formated with the appropiate 
  //  Coordinate Reference System to ensure it loads up on a leaflet map.
  // ---------------------------------------------------------------------------
  layers: {

    municipality: {
      name:           'Municipalities',            // Label shown in the sidebar
      url:            'https://raw.githubusercontent.com/Noise-unit/GeojsonLayers/refs/heads/main/Municipality.geojson', //GitHub Repo Link
      defaultOpacity: 0.40,
      strokeColor:    '#7c7a78ff', 
      strokeWeight:   1.5,

      // Each polygon is assigned a colour by its position in the GeoJSON feature array.
      // Reorder or replace these hex values to preference. I prefer the pastel colours 
      // which is why I chose these colours. 15 colours identified for each municipality and Tobago.
      pastelColors: [
        '#f9c6c6', // pastel red
        '#fcd8b0', // pastel orange
        '#fef3b0', // pastel yellow
        '#c8f0c8', // pastel green
        '#b0e0f5', // pastel sky blue
        '#c5cff7', // pastel periwinkle
        '#e0bbf5', // pastel lavender
        '#f7c5e8', // pastel pink
        '#b5ead7', // pastel mint
        '#ffd7ba', // pastel peach
        '#c9f0f0', // pastel teal
        '#d4c5f9', // pastel violet
        '#f5e6c8', // pastel sand
        '#cce5ff', // pastel cornflower
        '#d5f5c5', // pastel lime
      ],
    },
  },

  
  // ---------------------------------------------------------------------------
  //  MUNICIPALITY FILTER SETTINGS
  //  Change 'nameAttribute' to the exact property name in your municipality
  //  GeoJSON that contains the municipality/region name used for filtering.
  //  This is importnat to ensure that the dropdown populates properly.
  //  The GEOJSON file linked and in the folder uses the 'NAME_1' Attribute name.
  // ---------------------------------------------------------------------------
  municipalityFilter: {
    // The GeoJSON feature property used to identify each municipality
    nameAttribute: 'NAME_1',
    // Based on the GEOJSON file currently used - (A publicly available file)
  },

  // ---------------------------------------------------------------------------
  //  SEARCH BAR SETTINGS
  //  Uses OpenStreetMap Nominatim for geocoding.
  // ---------------------------------------------------------------------------
  search: {
    countryCode:  'tt',                            // Restricts results to T&T and selects the first result to zoom to
    zoomToResult: 17,                              // Zoom level after searching 17 felt good to me but can be increased or decreased
    placeholder:  'Search for a location in T&T…',
  },

};
