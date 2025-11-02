# Self-Hosted Deployment Instructions

## Quick Start

1. Clone or copy the repository to your Linux server
2. Navigate to the project directory
3. Start a simple HTTP server:

### Option 1: Python (Recommended for testing)
```bash
python3 -m http.server 8000
```

### Option 2: Node.js http-server
```bash
npx http-server -p 8000
```

### Option 3: Nginx (Production)
Add to your nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/bdgy.poc;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

4. Access the application at `http://your-server:8000` (or your configured port/domain)

## Migrating Data from GitHub Pages

Since localStorage is domain-specific, you'll need to migrate your data:

1. **On the GitHub Pages site:**
   - Open each ledger you want to keep
   - Click the "Export" button
   - Save the downloaded file

2. **On your self-hosted instance:**
   - Click "Import"
   - Select the exported file
   - Your ledger with all transactions will be imported

## File Structure

All files are static and served as-is:
- `index.html` - Main application
- `*.js` - Application logic (no build step required)
- `*.css` - Styles
- `assets/` - Favicon and images

## Data Storage

The application stores all data in browser localStorage with these keys:
- `budgie_ledgers` - List of all ledgers
- `budgie_activeLedger` - Currently selected ledger
- `budgie_${ledgerName}_transactions` - Transaction data
- `budgie_${ledgerName}_startingBalance` - Starting balance
- `budgie_${ledgerName}_startingBalanceDate` - Starting balance date

## Security Notes

- All data is stored client-side in the browser
- No server-side processing or storage
- Consider HTTPS for production deployments
- Regular backups via Export feature recommended