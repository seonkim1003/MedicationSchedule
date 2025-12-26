# Medication Tracker Calendar

A medication tracking calendar application that helps you track when you take your medications. Features include daily tracking with yes/no buttons, visual status indicators (green/red boxes), and timestamp editing for missed entries.

## Features

- 📅 Monthly calendar view with medication status indicators
- 💊 Configurable medication list (add/remove medications)
- ✅ Daily tracking with Yes/No buttons
- 🕐 Automatic timestamp recording
- ✏️ Edit timestamps for past entries
- 💾 Cloud storage via Cloudflare Workers + KV
- 📱 Responsive design
- 🔒 **Public read access** - Anyone can view calendars
- 🔐 **Password-protected editing** - Password required to make changes

## Setup Instructions

### 1. Frontend Setup

1. Install dependencies (optional, uses npx):
   ```bash
   npm install
   ```

2. Run the frontend locally:
   ```bash
   npm run dev
   ```
   This will start a local server on http://localhost:3000

### 2. Cloudflare Worker Setup

#### Prerequisites
- A Cloudflare account
- Wrangler CLI installed globally or via npm

#### Step 1: Install Wrangler
```bash
npm install -g wrangler
# OR
npm install wrangler --save-dev
```

#### Step 2: Login to Cloudflare
```bash
wrangler login
```

#### Step 3: Create KV Namespace
```bash
cd worker
wrangler kv:namespace create "MEDICATION_KV"
```

This will output something like:
```
🌀  Creating namespace with title "MEDICATION_KV"
✨  Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "MEDICATION_KV", id = "abc123def456..." }
```

#### Step 4: Update wrangler.toml
Copy the `id` from the output above and update `worker/wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "MEDICATION_KV"
id = "abc123def456..."  # Replace with your actual ID
```

#### Step 5: Update API URL in Frontend
Edit `script.js` and update the `API_BASE_URL`:
```javascript
const API_BASE_URL = 'https://your-worker.your-subdomain.workers.dev';
```

For local development, use:
```javascript
const API_BASE_URL = 'http://localhost:8787';
```

#### Step 6: Set Edit Password (Required for Production)
For **production deployment**, set the password as a secret in Cloudflare:

```bash
cd worker
wrangler secret put EDIT_PASSWORD
```

When prompted, enter: `SRC_Goat` (or your desired password)

**Note**: For local development, the password is already set to `SRC_Goat` in the `.dev.vars` file. This password will be required for all write operations (adding medications, tracking doses, etc.).

#### Step 7: Deploy Worker
```bash
cd worker
wrangler deploy
```

Or use the npm script:
```bash
npm run worker:deploy
```

#### Step 8: Test Locally (Optional)
The password is already configured in `worker/.dev.vars` as `SRC_Goat` for local development.

To start the worker locally:
```bash
npm run worker:dev
```

This starts the worker on http://localhost:8787. Use password `SRC_Goat` when logging in to edit.

## Usage

### Viewing (Public Access)
- Anyone can view the calendar without authentication
- The calendar shows all medication tracking data in read-only mode
- A "View Only" indicator appears when not authenticated

### Editing (Password Required)
1. **Login**: Click the "🔒 Login to Edit" button in the header and enter the password
2. **Add Medications**: Once authenticated, click the Settings button (⚙️) to add medications
3. **Track Daily**: Click on any day in the calendar to track medications for that day
4. **Record Status**: Click "Yes" if you took the medication, "No" if you missed it
5. **Edit Timestamps**: Use the timestamp editor to update when you actually took a medication if you forgot to record it
6. **View Status**: See green boxes (taken) and red boxes (missed) beneath each day

**Note**: Authentication expires after 24 hours. You'll need to login again to continue editing.

## Data Storage

- Medications are stored in Cloudflare KV under: `user:{userId}:medications`
- Daily entries are stored under: `user:{userId}:entries:{date}`
- User ID is automatically generated and stored in browser localStorage

## Development

### Frontend Development
```bash
npm run dev
```

### Worker Development
```bash
npm run worker:dev
```

### Deploy Worker
```bash
npm run worker:deploy
```

## File Structure

```
ScheduleWebsite/
├── index.html          # Main HTML structure
├── styles.css          # Calendar and UI styling
├── script.js           # Frontend logic and API calls
├── package.json        # Frontend dependencies and scripts
├── worker/
│   ├── worker.js       # Cloudflare Worker API
│   └── wrangler.toml   # Worker configuration
└── README.md           # This file
```

## Troubleshooting

### Worker not responding
- Check that the KV namespace ID is correct in `wrangler.toml`
- Verify you're logged in: `wrangler whoami`
- Check worker logs: `wrangler tail`

### CORS errors
- Ensure the Worker URL is correct in `script.js`
- Check that CORS headers are being sent (they're included in the worker code)

### Data not persisting
- Verify KV namespace is created and bound correctly
- Check browser console for API errors
- Verify user ID is being generated (check localStorage)

## License

ISC



