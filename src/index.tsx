import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  BACKEND_API_URL: string;
  BACKEND_API_KEY: string;
  ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS for API routes
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// ==================== HELPER FUNCTIONS ====================

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    'queued': '<span class="badge badge-info">Queued</span>',
    'running': '<span class="badge badge-warning">Running</span>',
    'done': '<span class="badge badge-success">Done</span>',
    'failed': '<span class="badge badge-error">Failed</span>',
    'pending': '<span class="badge badge-secondary">Pending</span>'
  }
  return badges[status] || `<span class="badge">${status}</span>`
}

// ==================== API PROXY ROUTES ====================

// Health check
app.get('/api/health', async (c) => {
  const backendUrl = c.env.BACKEND_API_URL
  
  try {
    const response = await fetch(`${backendUrl}/health`, {
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      }
    })
    const data = await response.json()
    
    return c.json({
      frontend: 'ok',
      backend: data,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return c.json({
      frontend: 'ok',
      backend: 'unreachable',
      error: String(error),
      timestamp: new Date().toISOString()
    }, 503)
  }
})

// Upload batch file
app.post('/api/batch/upload', async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File
  
  if (!file) {
    return c.json({ error: 'No file provided' }, 400)
  }
  
  // Forward to backend
  const backendFormData = new FormData()
  backendFormData.append('file', file)
  
  try {
    const response = await fetch(`${c.env.BACKEND_API_URL}/api/batch/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      },
      body: backendFormData
    })
    
    const data = await response.json()
    return c.json(data, response.status)
  } catch (error) {
    return c.json({ error: 'Failed to upload to backend', details: String(error) }, 500)
  }
})

// Get batch status
app.get('/api/batch/:id/status', async (c) => {
  const batchId = c.req.param('id')
  
  try {
    const response = await fetch(`${c.env.BACKEND_API_URL}/api/batch/${batchId}/status`, {
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      }
    })
    
    const data = await response.json()
    return c.json(data, response.status)
  } catch (error) {
    return c.json({ error: 'Failed to fetch batch status', details: String(error) }, 500)
  }
})

// Get all batches
app.get('/api/batches', async (c) => {
  try {
    const response = await fetch(`${c.env.BACKEND_API_URL}/api/batches`, {
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      }
    })
    
    const data = await response.json()
    return c.json(data, response.status)
  } catch (error) {
    return c.json({ error: 'Failed to fetch batches', details: String(error) }, 500)
  }
})

// Get batch items
app.get('/api/batch/:id/items', async (c) => {
  const batchId = c.req.param('id')
  
  try {
    const response = await fetch(`${c.env.BACKEND_API_URL}/api/batch/${batchId}/items`, {
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      }
    })
    
    const data = await response.json()
    return c.json(data, response.status)
  } catch (error) {
    return c.json({ error: 'Failed to fetch batch items', details: String(error) }, 500)
  }
})

// ==================== WEB UI ROUTES ====================

// Home / Dashboard
app.get('/', (c) => {
  return c.html(/* html */`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Entity Validator - Dashboard</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .badge { 
            display: inline-block; 
            padding: 0.25rem 0.75rem; 
            border-radius: 9999px; 
            font-size: 0.875rem; 
            font-weight: 600; 
          }
          .badge-success { background: #dcfce7; color: #166534; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-error { background: #fee2e2; color: #991b1b; }
          .badge-info { background: #dbeafe; color: #1e40af; }
          .badge-secondary { background: #f3f4f6; color: #374151; }
          .card { 
            background: white; 
            border-radius: 0.5rem; 
            padding: 1.5rem; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
          }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8 max-w-7xl">
            <!-- Header -->
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-gray-900 mb-2">
                    <i class="fas fa-building text-blue-600 mr-3"></i>
                    Entity Validation Platform
                </h1>
                <p class="text-gray-600 text-lg">
                    UK Companies House & Charity Commission Entity Resolution & Enrichment
                </p>
            </div>

            <!-- Stats Cards -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm font-medium">Total Batches</p>
                            <p class="text-3xl font-bold text-gray-900" id="stat-batches">-</p>
                        </div>
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-layer-group text-blue-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm font-medium">Entities Processed</p>
                            <p class="text-3xl font-bold text-gray-900" id="stat-entities">-</p>
                        </div>
                        <div class="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-check-circle text-green-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm font-medium">In Progress</p>
                            <p class="text-3xl font-bold text-gray-900" id="stat-progress">-</p>
                        </div>
                        <div class="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-spinner text-yellow-600 text-xl"></i>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="flex items-center justify-between">
                        <div>
                            <p class="text-gray-500 text-sm font-medium">Success Rate</p>
                            <p class="text-3xl font-bold text-gray-900" id="stat-success">-</p>
                        </div>
                        <div class="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-chart-line text-purple-600 text-xl"></i>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Upload Section -->
            <div class="card mb-8">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-upload text-blue-600 mr-2"></i>
                    Upload Entity Batch
                </h2>
                
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors">
                    <form id="upload-form" enctype="multipart/form-data">
                        <input type="file" id="file-input" name="file" accept=".xlsx,.xls,.csv" class="hidden">
                        <label for="file-input" class="cursor-pointer">
                            <div class="mb-4">
                                <i class="fas fa-cloud-upload-alt text-6xl text-gray-400"></i>
                            </div>
                            <p class="text-lg font-medium text-gray-700 mb-2">
                                Click to upload or drag and drop
                            </p>
                            <p class="text-sm text-gray-500 mb-4">
                                Excel (.xlsx, .xls) or CSV files accepted
                            </p>
                            <div id="file-name" class="text-sm text-blue-600 font-medium mb-4"></div>
                        </label>
                        <button type="submit" id="upload-btn" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed" disabled>
                            <i class="fas fa-upload mr-2"></i>
                            Upload and Process
                        </button>
                    </form>
                </div>

                <div id="upload-status" class="mt-4 hidden">
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p class="text-blue-800 font-medium">
                            <i class="fas fa-info-circle mr-2"></i>
                            <span id="upload-message">Uploading...</span>
                        </p>
                    </div>
                </div>
            </div>

            <!-- Recent Batches -->
            <div class="card">
                <h2 class="text-2xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-history text-blue-600 mr-2"></i>
                    Recent Batches
                </h2>
                
                <div id="batches-loading" class="text-center py-8">
                    <i class="fas fa-spinner fa-spin text-4xl text-gray-400"></i>
                    <p class="text-gray-500 mt-4">Loading batches...</p>
                </div>

                <div id="batches-list" class="hidden">
                    <div class="overflow-x-auto">
                        <table class="w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch ID</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Filename</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entities</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="batches-tbody" class="divide-y divide-gray-200">
                                <!-- Populated by JavaScript -->
                            </tbody>
                        </table>
                    </div>
                </div>

                <div id="batches-empty" class="hidden text-center py-8">
                    <i class="fas fa-inbox text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-500 text-lg">No batches yet. Upload your first batch to get started!</p>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          // File input handling
          const fileInput = document.getElementById('file-input');
          const fileName = document.getElementById('file-name');
          const uploadBtn = document.getElementById('upload-btn');
          const uploadForm = document.getElementById('upload-form');
          const uploadStatus = document.getElementById('upload-status');
          const uploadMessage = document.getElementById('upload-message');

          fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
              fileName.textContent = \`Selected: \${file.name}\`;
              uploadBtn.disabled = false;
            }
          });

          uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const file = fileInput.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            uploadBtn.disabled = true;
            uploadStatus.classList.remove('hidden');
            uploadMessage.textContent = 'Uploading batch to backend...';

            try {
              const response = await axios.post('/api/batch/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });

              uploadMessage.textContent = \`✓ Batch uploaded successfully! Processing started (Batch ID: \${response.data.batch_id || 'N/A'})\`;
              
              // Reset form
              fileInput.value = '';
              fileName.textContent = '';
              uploadBtn.disabled = true;

              // Refresh batches list
              setTimeout(() => {
                loadBatches();
              }, 2000);

            } catch (error) {
              uploadMessage.textContent = \`✗ Upload failed: \${error.response?.data?.error || error.message}\`;
              uploadBtn.disabled = false;
            }
          });

          // Load batches
          async function loadBatches() {
            try {
              const response = await axios.get('/api/batches');
              const batches = response.data.batches || [];

              document.getElementById('batches-loading').classList.add('hidden');

              if (batches.length === 0) {
                document.getElementById('batches-empty').classList.remove('hidden');
                document.getElementById('batches-list').classList.add('hidden');
              } else {
                document.getElementById('batches-empty').classList.add('hidden');
                document.getElementById('batches-list').classList.remove('hidden');

                const tbody = document.getElementById('batches-tbody');
                tbody.innerHTML = batches.map(batch => \`
                  <tr class="hover:bg-gray-50">
                    <td class="px-4 py-3 text-sm font-mono">\${batch.id}</td>
                    <td class="px-4 py-3 text-sm">\${batch.filename || 'N/A'}</td>
                    <td class="px-4 py-3 text-sm">\${batch.total_items || 0}</td>
                    <td class="px-4 py-3 text-sm">\${getStatusBadge(batch.status)}</td>
                    <td class="px-4 py-3 text-sm">
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: \${batch.progress || 0}%"></div>
                      </div>
                      <span class="text-xs text-gray-500">\${batch.progress || 0}%</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">\${new Date(batch.created_at).toLocaleString()}</td>
                    <td class="px-4 py-3 text-sm">
                      <a href="/batch/\${batch.id}" class="text-blue-600 hover:text-blue-800 font-medium">
                        <i class="fas fa-eye mr-1"></i> View
                      </a>
                    </td>
                  </tr>
                \`).join('');

                // Update stats
                document.getElementById('stat-batches').textContent = batches.length;
                const totalEntities = batches.reduce((sum, b) => sum + (b.total_items || 0), 0);
                document.getElementById('stat-entities').textContent = totalEntities;
                const inProgress = batches.filter(b => ['queued', 'running'].includes(b.status)).length;
                document.getElementById('stat-progress').textContent = inProgress;
                const completed = batches.filter(b => b.status === 'done').length;
                const successRate = batches.length > 0 ? Math.round((completed / batches.length) * 100) : 0;
                document.getElementById('stat-success').textContent = \`\${successRate}%\`;
              }

            } catch (error) {
              console.error('Failed to load batches:', error);
              document.getElementById('batches-loading').innerHTML = \`
                <p class="text-red-600"><i class="fas fa-exclamation-circle mr-2"></i>Failed to load batches</p>
              \`;
            }
          }

          function getStatusBadge(status) {
            const badges = {
              'queued': '<span class="badge badge-info">Queued</span>',
              'running': '<span class="badge badge-warning">Running</span>',
              'done': '<span class="badge badge-success">Done</span>',
              'failed': '<span class="badge badge-error">Failed</span>',
              'pending': '<span class="badge badge-secondary">Pending</span>'
            };
            return badges[status] || \`<span class="badge">\${status}</span>\`;
          }

          // Initial load
          loadBatches();

          // Auto-refresh every 10 seconds
          setInterval(loadBatches, 10000);
        </script>
    </body>
    </html>
  `)
})

// Batch detail page
app.get('/batch/:id', async (c) => {
  const batchId = c.req.param('id')
  
  // This would fetch from backend in production
  return c.html(/* html */`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Batch ${batchId} - Entity Validator</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8 max-w-7xl">
            <div class="mb-6">
                <a href="/" class="text-blue-600 hover:text-blue-800 font-medium">
                    <i class="fas fa-arrow-left mr-2"></i>Back to Dashboard
                </a>
            </div>

            <h1 class="text-3xl font-bold text-gray-900 mb-6">
                Batch Details: ${batchId}
            </h1>

            <div class="bg-white rounded-lg shadow p-6">
                <p class="text-gray-600">Loading batch details...</p>
                <div id="batch-details"></div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          async function loadBatchDetails() {
            try {
              const response = await axios.get('/api/batch/${batchId}/items');
              const items = response.data.items || [];
              
              document.getElementById('batch-details').innerHTML = \`
                <h2 class="text-xl font-bold mb-4">Items (\${items.length})</h2>
                <div class="overflow-x-auto">
                  <table class="w-full">
                    <thead class="bg-gray-50">
                      <tr>
                        <th class="px-4 py-2 text-left">Input Name</th>
                        <th class="px-4 py-2 text-left">Matched Entity</th>
                        <th class="px-4 py-2 text-left">Registry</th>
                        <th class="px-4 py-2 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y">
                      \${items.map(item => \`
                        <tr>
                          <td class="px-4 py-2">\${item.input_name}</td>
                          <td class="px-4 py-2">\${item.company_number || item.charity_number || '-'}</td>
                          <td class="px-4 py-2">\${item.resolved_registry || '-'}</td>
                          <td class="px-4 py-2">
                            <span class="badge \${item.enrich_status === 'done' ? 'badge-success' : item.enrich_status === 'running' ? 'badge-warning' : 'badge-secondary'}">
                              \${item.enrich_status || 'pending'}
                            </span>
                          </td>
                        </tr>
                      \`).join('')}
                    </tbody>
                  </table>
                </div>
              \`;
            } catch (error) {
              document.getElementById('batch-details').innerHTML = \`
                <p class="text-red-600">Failed to load batch details: \${error.message}</p>
              \`;
            }
          }

          loadBatchDetails();
        </script>
    </body>
    </html>
  `)
})

export default app
