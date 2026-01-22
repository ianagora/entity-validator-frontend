# Entity Validator - Cloudflare Frontend

## Project Overview

**Name**: Entity Validation & Enrichment Platform (Frontend)  
**Goal**: Modern web interface for UK entity validation and enrichment  
**Technology Stack**: Hono + TypeScript + Cloudflare Pages + TailwindCSS

## Architecture

This is the **frontend layer** of a hybrid architecture:

```
┌─────────────────────────────────────┐
│   Cloudflare Pages (This Project)  │
│   - User interface                  │
│   - File upload handling            │
│   - Real-time dashboard             │
│   - API proxy to backend            │
└─────────────┬───────────────────────┘
              │
              │ HTTPS API
              │
┌─────────────▼───────────────────────┐
│   Railway Backend (Python)          │
│   - Entity enrichment workers       │
│   - Shareholder extraction          │
│   - Database & job processing       │
└─────────────────────────────────────┘
```

## Features

### Currently Completed

✅ **Dashboard UI**
- Real-time statistics (batches, entities, progress, success rate)
- Auto-refreshing batch list (10-second intervals)
- Modern, responsive design with TailwindCSS

✅ **File Upload Interface**
- Drag-and-drop support
- Excel (.xlsx, .xls) and CSV file support
- Progress feedback and status messages

✅ **API Proxy Layer**
- `/api/health` - Health check (frontend + backend)
- `/api/batch/upload` - Batch file upload
- `/api/batches` - List all batches
- `/api/batch/:id/status` - Batch status
- `/api/batch/:id/items` - Batch items detail

✅ **Batch Management**
- View all batches with status
- Progress tracking with visual progress bars
- Real-time status updates

### Features Not Yet Implemented

🔲 **User Authentication** (planned via Cloudflare Access)
🔲 **Advanced Filtering** (search, date range, status filter)
🔲 **Export Results** (download enriched data)
🔲 **Item Detail View** (individual entity inspection)
🔲 **Webhook Configuration** (for notifications)
🔲 **Analytics Dashboard** (charts and trends)

## URLs

**Development**: http://localhost:3000  
**Production**: https://entity-validator.pages.dev (after deployment)  
**Backend API**: Set via environment variable `BACKEND_API_URL`

## Data Architecture

**Frontend Layer**:
- Stateless API proxy (no local data storage)
- All data fetched from backend API
- Cloudflare Pages for global edge distribution

**Backend Integration**:
- RESTful API communication
- Bearer token authentication
- JSON data exchange format

## Development

### Prerequisites

- Node.js 18+ and npm
- Wrangler CLI (installed via npm)
- Backend API URL and API key

### Local Development

```bash
# Install dependencies
cd /home/user/webapp && npm install

# Build the project
cd /home/user/webapp && npm run build

# Start development server (sandbox)
cd /home/user/webapp && pm2 start ecosystem.config.cjs

# Test
curl http://localhost:3000
pm2 logs entity-validator-frontend --nostream

# Stop
pm2 delete entity-validator-frontend
```

### Environment Variables

Create `.dev.vars` for local development:

```env
BACKEND_API_URL=http://localhost:8000
BACKEND_API_KEY=your-secret-key-here
ENVIRONMENT=development
```

**For production**, set secrets via Wrangler:

```bash
npx wrangler pages secret put BACKEND_API_URL
npx wrangler pages secret put BACKEND_API_KEY
```

## Deployment

### Deploy to Cloudflare Pages

```bash
# Build the project
cd /home/user/webapp && npm run build

# Deploy to Cloudflare
npx wrangler pages deploy dist --project-name entity-validator

# Set production secrets
npx wrangler pages secret put BACKEND_API_URL --project-name entity-validator
npx wrangler pages secret put BACKEND_API_KEY --project-name entity-validator
```

### Continuous Deployment

Connect your GitHub repository to Cloudflare Pages for automatic deployments on every push to `main` branch.

## API Endpoints

### Frontend API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Dashboard home page |
| `/batch/:id` | GET | Batch detail page |
| `/api/health` | GET | Health check (frontend + backend) |
| `/api/batch/upload` | POST | Upload batch file |
| `/api/batches` | GET | List all batches |
| `/api/batch/:id/status` | GET | Get batch status |
| `/api/batch/:id/items` | GET | Get batch items |

All `/api/*` routes proxy to the backend API with authentication.

## Project Structure

```
webapp/
├── src/
│   └── index.tsx           # Main Hono application
├── public/                 # Static assets (if needed)
├── dist/                   # Build output (generated)
├── .wrangler/              # Wrangler cache (git-ignored)
├── ecosystem.config.cjs    # PM2 configuration
├── vite.config.ts          # Vite build configuration
├── wrangler.jsonc          # Cloudflare configuration
├── package.json            # Dependencies and scripts
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

## User Guide

### Uploading a Batch

1. Navigate to the dashboard home page
2. Click "Click to upload" or drag a file to the upload area
3. Select an Excel (.xlsx/.xls) or CSV file
4. Click "Upload and Process"
5. Monitor progress in the "Recent Batches" section

### Viewing Batch Details

1. In the dashboard, find your batch in "Recent Batches"
2. Click the "View" button
3. See all entities, their match status, and enrichment results
4. Download results (if backend supports file downloads)

### Monitoring System Health

- Visit `/api/health` to check frontend and backend status
- Dashboard shows real-time statistics
- Batches auto-refresh every 10 seconds

## Deployment Status

- **Platform**: Cloudflare Pages
- **Status**: ⚠️ Ready for deployment (needs backend URL and API key)
- **Tech Stack**: Hono + TypeScript + TailwindCSS + FontAwesome
- **Last Updated**: 2024-12-05

## Cost Estimate

### Cloudflare Pages
- **Free tier**: 500 builds/month, unlimited bandwidth
- **Cost**: $0/month (free tier sufficient for most use cases)

### Total Frontend Cost: $0-5/month

## Recommended Next Steps

1. **Setup Backend API**: Deploy Python backend to Railway
2. **Configure Secrets**: Add `BACKEND_API_URL` and `BACKEND_API_KEY`
3. **Deploy to Cloudflare**: Run deployment command
4. **Add Authentication**: Implement Cloudflare Access for user login
5. **Enable Analytics**: Add Cloudflare Web Analytics
6. **Setup Custom Domain**: Configure custom domain (optional)

## Support

For issues or questions:
- Check backend API health: `/api/health`
- Review Wrangler logs: `npx wrangler pages deployment tail`
- Backend logs: Check Railway dashboard

---

**Built with ❤️ using Hono on Cloudflare Pages**
# Trigger deployment
<!-- Deploy trigger: 1769028572 -->

<!-- Environment variable updated: 2026-01-22 09:14:53 UTC -->
