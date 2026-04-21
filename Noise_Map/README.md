# Noise Variation Applications Map
## Trinidad & Tobago — Interactive Leaflet Map

---

## Project Structure

```
noise-map/
│
├── index.html              ← Main HTML — embed this in your website
│
├── css/
│   └── style.css           ← All visual styling (colours, layout, fonts)
│
├── js/
│   ├── config.js           ← *** START HERE — all settings in one place ***
│   ├── data-loader.js      ← Handles CSV / Google Sheets / MS Lists data
│   ├── utm-converter.js    ← Converts UTM coordinates to Lat/Lon
│   ├── popup.js            ← Controls what appears inside clicked popups
│   ├── filters.js          ← Date range + municipality filter logic
│   ├── search.js           ← OpenStreetMap location search
│   ├── map.js              ← Map init, layers, markers, legend
│   └── main.js             ← App entry point; wires all modules together
│
├── noise_applications.csv   ← Sample data (replace with real data)
│
│
└── Municipality.geojson     ← Copy of the municipality layer used in the map

```

---

## Quick Start: The 5 Things to Change

Open **`js/config.js`** and update the following:

### 1. Data Source
```js
activeSource: 'csv',   // Change to 'googlesheets' or 'mslists'
csv: { url: 'data/your_file.csv' },
```

### 2. Column Names
```js
columns: {
  easting:   'Easting',           // Your UTM Easting column header
  northing:  'Northing',          // Your UTM Northing column header
  colorBy:   'Status',// Column that controls point colour
  dateColumn:'Event dates',       // Column used for date filtering
}
```

### 3. GeoJSON Layers
```js
layers: {
  municipality: { url: 'https://raw.githubusercontent.com/Noise-unit/GeojsonLayers/refs/heads/main/Municipality.geojson' },
}
```

### 4. Colour Mapping
```js
colorMap: {
  values: {
    'Issued':     '#22c55e',
    'Pending':      '#f59e0b',
    // Add status values here
  }
}
```

### 5. Municipality GeoJSON Attribute
```js
municipalityFilter: {
  nameAttribute: 'NAME_1',  // The property in the GeoJSON that holds the name
}
```

---

## Data Source Options

### Option A — CSV File (Simplest)
Place your CSV in the `/data/` folder. First row must be headers.

```js
activeSource: 'csv',
csv: { url: 'data/noise_applications.csv' }
```

### Option B — Google Sheets
In Google Sheets: **File → Share → Publish to web → CSV → Publish**.
Copy the URL.

```js
activeSource: 'googlesheets',
googlesheets: { url: 'https://docs.google.com/spreadsheets/d/...' }
```

### Option C — Microsoft SharePoint Lists
Your page must be on the same SharePoint domain (or CORS/OAuth configured).

```js
activeSource: 'mslists',
mslists: {
  siteUrl:  'https://yourorg.sharepoint.com/sites/yoursite',
  listName: 'NoiseVariationApplications',
  fields:   ['Title', 'Easting', 'Northing', 'Event_Dates', 'Application_Status'],
}
```

---

## Customising the Popup

Edit the `rows` array in **`js/popup.js`** (Section 4):

```js
const rows = [
  { label: 'Applicant',    value: record['Applicant_Name'] },
  { label: 'Event Dates',  value: record['Event_Dates']    },
  // Reorder these lines to change what appears first in the popup
  // Delete a line to remove it from the popup
  // Add a new line like: { label: 'Your Label', value: record['Your_Column'] }
];
```

Change the title (big text at top):
```js
const title = record['Event_Name'] || record['Title'] || 'Noise Application';
```

---

## Embedding in Your Website

### Iframe (Easiest)
```html
<iframe
  src="/noise-map/index.html"
  style="width: 100%; height: 650px; border: none; border-radius: 12px;"
  title="Noise Variation Map"
></iframe>
```

### Direct Embed (Same server)
Copy the contents of `<body>` into your page and include all `<link>` and
`<script>` tags from `<head>` in your page's head section.

---

## Date Formats Supported

The date filter in `filters.js` recognises all these formats (and more):

| Format          | Example           |
|-----------------|-------------------|
| `DD-Mon-YYYY`   | 14-May-2026       |
| `DD-Mon-YY`     | 14-May-26         |
| `DD/MM/YYYY`    | 14/05/2026        |
| `YYYY-MM-DD`    | 2026-05-14        |
| `DD Mon YYYY`   | 14 May 2026       |
| `Mon DD, YYYY`  | May 14, 2026      |
| `DD.MM.YYYY`    | 14.05.2026        |

**Multiple dates in one cell** are supported — separate them with commas,
semicolons, or pipes:  
`12-May-2026, 13-May-2026; 14-May-26`

---

## UTM Zone Handling

- Default zone: **20N** (set in `CONFIG.utm.defaultZone`)
- Supported zones: **19, 20, 21** (set in `CONFIG.utm.supportedZones`)
- To specify a zone per row, set `CONFIG.columns.utmZoneColumn` to the column name

---

## Libraries Used (all loaded from CDN)

| Library      | Version | Purpose                                |
|--------------|---------|----------------------------------------|
| Leaflet      | 1.9.4   | Interactive map                        |
| proj4        | 2.9.0   | UTM → WGS84 coordinate conversion      |
| PapaParse    | 5.4.1   | CSV and Google Sheets parsing          |
| leaflet-pip  | 1.1.0   | Point-in-polygon (municipality filter) |

No build tools required — works as plain HTML/CSS/JS files on any web server.
