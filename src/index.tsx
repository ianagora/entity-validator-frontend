import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

// KYC/AML Screening Requirements - Version 1.0
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

// Version check endpoint
app.get('/api/version', (c) => {
  return c.json({
    version: '1.0.1-screening',
    commit: '660005b',
    features: ['screening_list', 'unconditional_render', 'debug_info'],
    deployed: true
  })
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

// Get item details
app.get('/api/item/:id', async (c) => {
  const itemId = c.req.param('id')
  
  try {
    const response = await fetch(`${c.env.BACKEND_API_URL}/api/item/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      }
    })
    
    const data = await response.json()
    return c.json(data, response.status)
  } catch (error) {
    return c.json({ error: 'Failed to fetch item details', details: String(error) }, 500)
  }
})

// Export screening list as CSV
app.get('/api/item/:id/screening-export.csv', async (c) => {
  const itemId = c.req.param('id')
  
  try {
    const response = await fetch(`${c.env.BACKEND_API_URL}/api/item/${itemId}/screening-export.csv`, {
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      }
    })
    
    // Return CSV directly
    const csvData = await response.text()
    return new Response(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=screening_list_${itemId}.csv`
      }
    })
  } catch (error) {
    return c.json({ error: 'Failed to export screening list', details: String(error) }, 500)
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

// Debug endpoint to test screening_list
app.get('/api/debug/item/:id', async (c) => {
  const itemId = c.req.param('id')
  
  try {
    const response = await fetch(`${c.env.BACKEND_API_URL}/api/item/${itemId}`, {
      headers: {
        'Authorization': `Bearer ${c.env.BACKEND_API_KEY}`
      }
    })
    
    const data = await response.json()
    
    return c.json({
      has_screening_list: !!data.screening_list,
      screening_list_type: typeof data.screening_list,
      screening_list_keys: data.screening_list ? Object.keys(data.screening_list) : [],
      entity_count: data.screening_list?.entity?.length || 0,
      governance_count: data.screening_list?.governance_and_control?.length || 0,
      ownership_chain_count: data.screening_list?.ownership_chain?.length || 0,
      full_data: data.screening_list
    })
  } catch (error) {
    return c.json({ error: 'Failed to fetch item details', details: String(error) }, 500)
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
                tbody.innerHTML = batches.map(batch => {
                  const stats = batch.stats || {};
                  const total = stats.total || 0;
                  const enriched = stats.enriched || 0;
                  const inProgress = stats.in_progress || 0;
                  const progress = total > 0 ? Math.round((enriched / total) * 100) : 0;
                  const status = inProgress > 0 ? 'running' : enriched === total && total > 0 ? 'done' : 'pending';
                  
                  return \`
                  <tr class="hover:bg-gray-50 cursor-pointer" onclick="window.location.href='/batch/\${batch.id}'">
                    <td class="px-4 py-3 text-sm font-mono">\${batch.id}</td>
                    <td class="px-4 py-3 text-sm">\${batch.filename || 'N/A'}</td>
                    <td class="px-4 py-3 text-sm">\${total}</td>
                    <td class="px-4 py-3 text-sm">\${getStatusBadge(status)}</td>
                    <td class="px-4 py-3 text-sm">
                      <div class="w-full bg-gray-200 rounded-full h-2">
                        <div class="bg-blue-600 h-2 rounded-full" style="width: \${progress}%"></div>
                      </div>
                      <span class="text-xs text-gray-500">\${progress}%</span>
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-500">\${new Date(batch.created_at).toLocaleString()}</td>
                    <td class="px-4 py-3 text-sm">
                      <a href="/batch/\${batch.id}" class="text-blue-600 hover:text-blue-800 font-medium hover:underline" onclick="event.stopPropagation()">
                        <i class="fas fa-eye mr-1"></i> View
                      </a>
                    </td>
                  </tr>
                  \`;
                }).join('');

                // Update stats
                document.getElementById('stat-batches').textContent = batches.length;
                const totalEntities = batches.reduce((sum, b) => sum + ((b.stats || {}).total || 0), 0);
                document.getElementById('stat-entities').textContent = totalEntities;
                const inProgress = batches.filter(b => ((b.stats || {}).in_progress || 0) > 0).length;
                document.getElementById('stat-progress').textContent = inProgress;
                const completed = batches.filter(b => {
                  const stats = b.stats || {};
                  return stats.total > 0 && stats.enriched === stats.total;
                }).length;
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
// Item detail page
app.get('/item/:id', async (c) => {
  const itemId = c.req.param('id')
  
  return c.html(/* html */`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Entity Details - Entity Validator</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <style>
          .card { background: white; border-radius: 0.5rem; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
          .section-title { font-size: 1.25rem; font-weight: 700; margin-bottom: 1rem; color: #1f2937; }
          .field-label { font-weight: 600; color: #6b7280; margin-right: 0.5rem; }
          .field-value { color: #111827; }
          .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 600; }
          .badge-success { background: #dcfce7; color: #166534; }
          .badge-warning { background: #fef3c7; color: #92400e; }
          .badge-info { background: #dbeafe; color: #1e40af; }
          .tree { font-family: monospace; white-space: pre; padding: 1rem; background: #f9fafb; border-radius: 0.5rem; }
        </style>
    </head>
    <body class="bg-gray-50">
        <div class="container mx-auto px-4 py-8 max-w-7xl">
            <div class="mb-6">
                <a href="javascript:history.back()" class="text-blue-600 hover:text-blue-800 font-medium">
                    <i class="fas fa-arrow-left mr-2"></i>Back
                </a>
            </div>

            <div id="loading" class="text-center py-8">
                <i class="fas fa-spinner fa-spin text-4xl text-blue-600"></i>
                <p class="mt-4 text-gray-600">Loading entity details...</p>
            </div>

            <div id="content" class="hidden"></div>
            <div id="error" class="hidden card">
                <p class="text-red-600"></p>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          console.log('[DEBUG] Page loaded, item ID: ${itemId}');
          
          async function loadItemDetails() {
            try {
              console.log('[DEBUG] Fetching item data...');
              const response = await axios.get('/api/item/${itemId}');
              console.log('[DEBUG] Response status:', response.status);
              const item = response.data;
              console.log('[DEBUG] Item data received:', item ? 'yes' : 'no');
              
              document.getElementById('loading').classList.add('hidden');
              document.getElementById('content').classList.remove('hidden');
              
              // Build shareholders tree (use recursive tree if available, otherwise flat)
              let shareholderTree = '';
              if (item.ownership_tree && item.ownership_tree.shareholders && item.ownership_tree.shareholders.length > 0) {
                shareholderTree = buildRecursiveOwnershipTree(item.ownership_tree);
              } else if (item.shareholders && item.shareholders.length > 0) {
                shareholderTree = buildOwnershipTree(item.shareholders, item.input_name);
              }
              
              // Debug: Log screening_list status
              console.log('[DEBUG] Has screening_list:', !!item.screening_list);
              console.log('[DEBUG] Screening categories:', item.screening_list ? Object.keys(item.screening_list) : 'none');
              console.log('[DEBUG] Building HTML template...');
              
              const htmlContent = \`
                <!-- Header -->
                <div class="card">
                  <h1 class="text-3xl font-bold text-gray-900 mb-4">
                    <i class="fas fa-building text-blue-600 mr-3"></i>
                    \${item.input_name}
                  </h1>
                  <div class="flex gap-4 flex-wrap">
                    <span class="badge \${item.enrich_status === 'done' ? 'badge-success' : 'badge-warning'}">
                      <i class="fas fa-\${item.enrich_status === 'done' ? 'check-circle' : 'clock'} mr-1"></i>
                      \${item.enrich_status || 'pending'}
                    </span>
                    <span class="badge badge-info">
                      <i class="fas fa-landmark mr-1"></i>
                      \${item.resolved_registry || 'N/A'}
                    </span>
                  </div>
                </div>

                <!-- Enrichment Metrics Card -->
                \${item.shareholders && item.shareholders.enrichment_metadata ? \`
                <div class="card" style="background: linear-gradient(to right, #eff6ff, #eef2ff); border-left: 4px solid #6366f1;">
                  <h3 class="text-lg font-semibold mb-4 text-gray-800">
                    <i class="fas fa-chart-line mr-2 text-indigo-600"></i>Enrichment Metrics
                  </h3>
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div class="text-center">
                      <p class="text-xs text-gray-600 uppercase tracking-wide mb-1">Duration</p>
                      <p class="text-3xl font-bold text-indigo-600">\${item.shareholders.enrichment_metadata.enrichment_duration_seconds}s</p>
                    </div>
                    <div class="text-center">
                      <p class="text-xs text-gray-600 uppercase tracking-wide mb-1">Tree Depth</p>
                      <p class="text-3xl font-bold text-indigo-600">\${item.shareholders.enrichment_metadata.tree_depth}</p>
                      <p class="text-xs text-gray-500">layers</p>
                    </div>
                    <div class="text-center">
                      <p class="text-xs text-gray-600 uppercase tracking-wide mb-1">Total Entities</p>
                      <p class="text-3xl font-bold text-indigo-600">\${item.shareholders.enrichment_metadata.total_entities_in_tree}</p>
                      <p class="text-xs text-gray-500">companies/individuals</p>
                    </div>
                    <div class="text-center">
                      <p class="text-xs text-gray-600 uppercase tracking-wide mb-1">Completed</p>
                      <p class="text-sm font-medium text-gray-700">\${item.shareholders.enrichment_metadata.completed_at}</p>
                    </div>
                  </div>
                </div>
                \` : ''}

                <!-- Company Profile -->
                \${item.profile && Object.keys(item.profile).length > 0 ? \`
                <div class="card">
                  <h2 class="section-title"><i class="fas fa-id-card mr-2"></i>Company Profile</h2>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    \${item.company_number ? \`<div><span class="field-label">Company Number:</span><span class="field-value">\${item.company_number}</span></div>\` : ''}
                    \${item.profile.company_name ? \`<div><span class="field-label">Company Name:</span><span class="field-value">\${item.profile.company_name}</span></div>\` : ''}
                    \${item.profile.company_status ? \`<div><span class="field-label">Status:</span><span class="field-value">\${item.profile.company_status}</span></div>\` : ''}
                    \${item.profile.company_type ? \`<div><span class="field-label">Type:</span><span class="field-value">\${item.profile.company_type}</span></div>\` : ''}
                    \${item.profile.date_of_creation ? \`<div><span class="field-label">Incorporated:</span><span class="field-value">\${item.profile.date_of_creation}</span></div>\` : ''}
                    \${item.profile.sic_codes ? \`<div><span class="field-label">SIC Codes:</span><span class="field-value">\${Array.isArray(item.profile.sic_codes) ? item.profile.sic_codes.join(', ') : item.profile.sic_codes}</span></div>\` : ''}
                  </div>
                  \${item.profile.registered_office_address ? \`
                  <div class="mt-4">
                    <span class="field-label">Address:</span>
                    <span class="field-value">
                      \${formatAddress(item.profile.registered_office_address)}
                    </span>
                  </div>
                  \` : ''}
                </div>
                \` : ''}

                <!-- Shareholders/Ownership Structure -->
                \${item.shareholders && item.shareholders.length > 0 ? \`
                <div class="card">
                  <h2 class="section-title"><i class="fas fa-sitemap mr-2"></i>Ownership Structure</h2>
                  <p class="text-sm text-gray-600 mb-4">
                    Extracted from Companies House filings (CS01/AR01/IN01) using Tesseract OCR
                  </p>
                  
                  <!-- Ownership Tree -->
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">
                      <i class="fas fa-project-diagram mr-2"></i>Ownership Tree
                      \${item.ownership_tree ? '<span class="badge badge-success ml-2">Multi-Layer</span>' : ''}
                    </h3>
                    <div id="ownership-tree-container"></div>
                    <div class="mt-4 flex gap-2">
                      <button onclick="zoomIn()" class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                        <i class="fas fa-search-plus"></i> Zoom In
                      </button>
                      <button onclick="zoomOut()" class="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
                        <i class="fas fa-search-minus"></i> Zoom Out
                      </button>
                      <button onclick="resetZoom()" class="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">
                        <i class="fas fa-redo"></i> Reset
                      </button>
                      <button onclick="downloadTreeSVG()" class="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">
                        <i class="fas fa-download"></i> Download SVG
                      </button>
                    </div>
                  </div>
                  
                  <!-- Ownership Chains (if available) -->
                  \${item.ownership_chains && item.ownership_chains.length > 0 ? \`
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">
                      <i class="fas fa-route mr-2"></i>Ultimate Ownership Chains
                    </h3>
                    <p class="text-sm text-gray-600 mb-3">
                      These chains show the path from ultimate beneficial owners to the target company.
                    </p>
                    <div class="space-y-3">
                      \${item.ownership_chains.map((chain, idx) => \`
                        <div class="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                          <div class="font-semibold text-gray-900 mb-2">
                            Chain #\${idx + 1}: \${chain.ultimate_owner} 
                            <span class="text-sm font-normal text-gray-600">
                              (\${chain.total_percentage.toFixed(2)}% - \${chain.chain_length} layers)
                            </span>
                          </div>
                          <div class="text-sm text-gray-700 ml-4">
                            \${chain.ownership_chain.map((owner, ownerIdx) => \`
                              <div class="flex items-center gap-2 py-1">
                                <span>\${owner.is_company ? '🏢' : '👤'}</span>
                                <span class="font-medium">\${owner.name}</span>
                                <span class="text-gray-500">(\${owner.percentage.toFixed(2)}%)</span>
                                \${owner.company_number ? \`<span class="text-xs text-gray-400">[\${owner.company_number}]</span>\` : ''}
                                \${ownerIdx < chain.ownership_chain.length - 1 ? '<i class="fas fa-arrow-down text-gray-400 ml-2"></i>' : ''}
                              </div>
                            \`).join('')}
                          </div>
                        </div>
                      \`).join('')}
                    </div>
                  </div>
                  \` : ''}
                  
                  <!-- Shareholder Table -->
                  <div>
                    <h3 class="text-lg font-semibold mb-3">Shareholder Details</h3>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-2 text-left">Name</th>
                            <th class="px-4 py-2 text-left">Shares</th>
                            <th class="px-4 py-2 text-left">Percentage</th>
                            <th class="px-4 py-2 text-left">Class</th>
                            <th class="px-4 py-2 text-left">Type</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y">
                          \${item.shareholders.map(sh => \`
                            <tr>
                              <td class="px-4 py-2 font-medium">\${sh.name}</td>
                              <td class="px-4 py-2">\${(sh.shares_held || 0).toLocaleString()}</td>
                              <td class="px-4 py-2">\${sh.percentage || 0}%</td>
                              <td class="px-4 py-2">\${sh.share_class || '-'}</td>
                              <td class="px-4 py-2">
                                \${isParentCompany(sh.name) ? 
                                  '<span class="badge badge-warning">Parent Company</span>' : 
                                  '<span class="badge badge-info">Individual</span>'}
                              </td>
                            </tr>
                          \`).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                \` : item.enrich_status === 'done' ? \`
                <div class="card">
                  <h2 class="section-title"><i class="fas fa-sitemap mr-2"></i>Ownership Structure</h2>
                  <p class="text-gray-600">No shareholder information found in CS01/AR01/IN01 filings.</p>
                </div>
                \` : ''}

                <!-- Officers -->
                \${item.officers && item.officers.items && item.officers.items.length > 0 ? \`
                <div class="card">
                  <h2 class="section-title"><i class="fas fa-users mr-2"></i>Officers (\${item.officers.items.length})</h2>
                  <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                      <thead class="bg-gray-50">
                        <tr>
                          <th class="px-4 py-2 text-left">Name</th>
                          <th class="px-4 py-2 text-left">Role</th>
                          <th class="px-4 py-2 text-left">Appointed</th>
                          <th class="px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y">
                        \${item.officers.items.slice(0, 10).map(officer => \`
                          <tr>
                            <td class="px-4 py-2">\${officer.name}</td>
                            <td class="px-4 py-2">\${officer.officer_role || '-'}</td>
                            <td class="px-4 py-2">\${officer.appointed_on || '-'}</td>
                            <td class="px-4 py-2">
                              <span class="badge \${officer.resigned_on ? 'badge-warning' : 'badge-success'}">
                                \${officer.resigned_on ? 'Resigned' : 'Active'}
                              </span>
                            </td>
                          </tr>
                        \`).join('')}
                      </tbody>
                    </table>
                  </div>
                  \${item.officers.items.length > 10 ? \`<p class="text-sm text-gray-500 mt-2">Showing 10 of \${item.officers.items.length} officers</p>\` : ''}
                </div>
                \` : ''}

                <!-- PSCs (Persons with Significant Control) -->
                \${item.pscs && item.pscs.items && item.pscs.items.length > 0 ? \`
                <div class="card">
                  <h2 class="section-title"><i class="fas fa-user-shield mr-2"></i>Persons with Significant Control (\${item.pscs.items.length})</h2>
                  <div class="space-y-3">
                    \${item.pscs.items.map(psc => \`
                      <div class="p-3 bg-gray-50 rounded">
                        <p class="font-semibold">\${psc.name}</p>
                        \${psc.natures_of_control ? \`
                        <p class="text-sm text-gray-600 mt-1">
                          <i class="fas fa-check-circle text-green-600 mr-1"></i>
                          \${Array.isArray(psc.natures_of_control) ? psc.natures_of_control.join(', ') : psc.natures_of_control}
                        </p>
                        \` : ''}
                        \${psc.notified_on ? \`<p class="text-xs text-gray-500 mt-1">Notified: \${psc.notified_on}</p>\` : ''}
                      </div>
                    \`).join('')}
                  </div>
                </div>
                \` : ''}

                <!-- KYC/AML Screening Requirements -->
                <div class="card">
                  <div class="flex justify-between items-start mb-4">
                    <div>
                      <h2 class="section-title mb-2">
                        <i class="fas fa-search-dollar mr-2"></i>KYC/AML Screening Requirements
                      </h2>
                      <p class="text-sm text-gray-600">
                        Comprehensive list of persons and entities requiring screening based on UK AML regulations.
                      </p>
                    </div>
                    <div class="flex gap-2">
                      <a href="/api/item/\${item.id}/screening-export.csv" 
                         class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                         download>
                        <i class="fas fa-download mr-2"></i>Download CSV
                      </a>
                      <button onclick="window.print()" 
                              class="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium">
                        <i class="fas fa-print mr-2"></i>Print
                      </button>
                    </div>
                  </div>

                  <!-- Entities & Governance (Merged) -->
                  \${((item.screening_list && item.screening_list.entity && item.screening_list.entity.length > 0) || (item.screening_list && item.screening_list.governance_and_control && item.screening_list.governance_and_control.length > 0)) ? \`
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 flex items-center">
                      <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">🏢</span>
                      Entities & Governance
                    </h3>
                    <p class="text-sm text-gray-600 mb-3">All entities, directors, company secretary, and PSCs from the complete ownership structure</p>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm border">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-2 text-left border">Name</th>
                            <th class="px-4 py-2 text-left border">Type/Role</th>
                            <th class="px-4 py-2 text-left border">Category</th>
                            <th class="px-4 py-2 text-left border">Company Number</th>
                            <th class="px-4 py-2 text-left border">Status/Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          \${(item.screening_list.entity || []).map(entity => \`
                            <tr class="hover:bg-gray-50">
                              <td class="px-4 py-2 border font-medium">\${entity.name}</td>
                              <td class="px-4 py-2 border">
                                <span class="badge badge-info">\${entity.type}</span>
                              </td>
                              <td class="px-4 py-2 border text-xs">Entity</td>
                              <td class="px-4 py-2 border">\${entity.company_number || '-'}</td>
                              <td class="px-4 py-2 border">
                                <span class="badge \${entity.status === 'active' ? 'badge-success' : 'badge-warning'}">
                                  \${entity.status}
                                </span>
                              </td>
                            </tr>
                          \`).join('')}
                          \${(item.screening_list.governance_and_control || []).map(person => \`
                            <tr class="hover:bg-gray-50">
                              <td class="px-4 py-2 border font-medium">\${person.name}</td>
                              <td class="px-4 py-2 border">
                                <span class="badge \${person.category === 'Directors' ? 'badge-info' : person.category === 'PSCs' ? 'badge-error' : 'badge-secondary'}">
                                  \${person.role}
                                </span>
                              </td>
                              <td class="px-4 py-2 border text-xs">\${person.category}</td>
                              <td class="px-4 py-2 border">-</td>
                              <td class="px-4 py-2 border text-xs">
                                \${person.appointed_on ? \`Appointed: \${person.appointed_on}<br>\` : ''}
                                \${person.nationality ? \`Nationality: \${person.nationality}<br>\` : ''}
                                \${person.dob ? \`DOB: \${person.dob}\` : ''}
                              </td>
                            </tr>
                          \`).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  \` : ''}

                  <!-- Ownership Chain -->
                  \${item.screening_list.ownership_chain && item.screening_list.ownership_chain.length > 0 ? \`
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 flex items-center">
                      <span class="bg-green-100 text-green-800 px-2 py-1 rounded mr-2">🔗</span>
                      Ownership Chain
                    </h3>
                    <p class="text-sm text-gray-600 mb-3">Direct shareholders, parents, grandparents, ultimate parents (≥10%)</p>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm border">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-2 text-left border">Name</th>
                            <th class="px-4 py-2 text-left border">Role</th>
                            <th class="px-4 py-2 text-left border">Shareholding</th>
                            <th class="px-4 py-2 text-left border">Company Number</th>
                            <th class="px-4 py-2 text-left border">Category</th>
                            <th class="px-4 py-2 text-left border">Layer</th>
                          </tr>
                        </thead>
                        <tbody>
                          \${item.screening_list.ownership_chain.map(owner => {
                            const depthColors = {
                              0: 'bg-green-50',
                              1: 'bg-yellow-50',
                              2: 'bg-orange-50'
                            };
                            const depthColor = depthColors[owner.depth] || 'bg-red-50';
                            return \`
                            <tr class="hover:bg-gray-50 \${depthColor}">
                              <td class="px-4 py-2 border font-medium">
                                \${owner.is_company ? '🏢' : '👤'} \${owner.name}
                              </td>
                              <td class="px-4 py-2 border">\${owner.role}</td>
                              <td class="px-4 py-2 border font-semibold text-green-700">\${owner.shareholding}</td>
                              <td class="px-4 py-2 border text-xs">\${owner.company_number || '-'}</td>
                              <td class="px-4 py-2 border text-xs">\${owner.category}</td>
                              <td class="px-4 py-2 border text-center">
                                <span class="badge">\${owner.depth}</span>
                              </td>
                            </tr>
                            \`;
                          }).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  \` : ''}

                  <!-- UBOs -->
                  \${item.screening_list.ubos && item.screening_list.ubos.length > 0 ? \`
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 flex items-center">
                      <span class="bg-red-100 text-red-800 px-2 py-1 rounded mr-2">⭐</span>
                      Ultimate Beneficial Owners (UBOs)
                    </h3>
                    <p class="text-sm text-gray-600 mb-3">Individuals with ≥10% indirect ownership or control</p>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm border">
                        <thead class="bg-red-50">
                          <tr>
                            <th class="px-4 py-2 text-left border">Name</th>
                            <th class="px-4 py-2 text-left border">Role</th>
                            <th class="px-4 py-2 text-left border">Shareholding</th>
                            <th class="px-4 py-2 text-left border">Shares Held</th>
                            <th class="px-4 py-2 text-left border">Type</th>
                            <th class="px-4 py-2 text-left border">Layer</th>
                          </tr>
                        </thead>
                        <tbody>
                          \${item.screening_list.ubos.map(ubo => \`
                            <tr class="hover:bg-red-50 bg-yellow-50">
                              <td class="px-4 py-2 border font-bold">👤 \${ubo.name}</td>
                              <td class="px-4 py-2 border">\${ubo.role}</td>
                              <td class="px-4 py-2 border font-semibold text-red-700">\${ubo.shareholding}</td>
                              <td class="px-4 py-2 border">\${ubo.shares_held ? ubo.shares_held.toLocaleString() : '-'}</td>
                              <td class="px-4 py-2 border text-xs">
                                \${ubo.indirect_ownership ? '<span class="badge badge-warning">Indirect</span>' : '<span class="badge badge-info">Control</span>'}
                              </td>
                              <td class="px-4 py-2 border text-center">
                                <span class="badge">\${ubo.depth || 0}</span>
                              </td>
                            </tr>
                          \`).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  \` : ''}

                  <!-- Trusts -->
                  \${item.screening_list.trusts && item.screening_list.trusts.length > 0 ? \`
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 flex items-center">
                      <span class="bg-indigo-100 text-indigo-800 px-2 py-1 rounded mr-2">📋</span>
                      Trusts
                    </h3>
                    <p class="text-sm text-gray-600 mb-3">Settlors, Trustees, Protectors, Beneficiaries</p>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm border">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-2 text-left border">Name</th>
                            <th class="px-4 py-2 text-left border">Role</th>
                            <th class="px-4 py-2 text-left border">Shareholding</th>
                            <th class="px-4 py-2 text-left border">Category</th>
                          </tr>
                        </thead>
                        <tbody>
                          \${item.screening_list.trusts.map(trust => \`
                            <tr class="hover:bg-gray-50 bg-purple-50">
                              <td class="px-4 py-2 border font-medium">\${trust.name}</td>
                              <td class="px-4 py-2 border">
                                <span class="badge badge-secondary">\${trust.role}</span>
                              </td>
                              <td class="px-4 py-2 border">\${trust.shareholding || '-'}</td>
                              <td class="px-4 py-2 border text-xs">\${trust.category}</td>
                            </tr>
                          \`).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  \` : ''}

                  <div class="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                    <p><strong>Data Sources:</strong> Companies House API, PSC Register, Ownership Tree Analysis</p>
                    <p class="mt-1"><strong>Note:</strong> This screening list is based on public register data and includes all entities from the ownership structure.</p>
                  </div>
                </div>
              \`;
              
              console.log('[DEBUG] HTML template built, length:', htmlContent.length);
              console.log('[DEBUG] Includes screening section:', htmlContent.includes('KYC/AML Screening Requirements'));
              
              document.getElementById('content').innerHTML = htmlContent;
              console.log('[DEBUG] HTML content set successfully');
              
            } catch (error) {
              document.getElementById('loading').classList.add('hidden');
              document.getElementById('error').classList.remove('hidden');
              document.getElementById('error').querySelector('p').textContent = 
                'Failed to load entity details: ' + error.message;
            }
          }
          
          // SVG Tree Visualization Functions
          let currentZoom = 1;
          const minZoom = 0.5;
          const maxZoom = 3;
          const zoomStep = 0.2;
          
          function zoomIn() {
            currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
            updateTreeZoom();
          }
          
          function zoomOut() {
            currentZoom = Math.max(currentZoom - zoomStep, minZoom);
            updateTreeZoom();
          }
          
          function resetZoom() {
            currentZoom = 1;
            updateTreeZoom();
          }
          
          function updateTreeZoom() {
            const svg = document.querySelector('#ownership-tree-container svg');
            if (svg) {
              const g = svg.querySelector('g');
              if (g) {
                g.setAttribute('transform', 'scale(' + currentZoom + ')');
              }
            }
          }
          
          function downloadTreeSVG() {
            const svg = document.querySelector('#ownership-tree-container svg');
            if (!svg) return;
            
            const svgData = new XMLSerializer().serializeToString(svg);
            const blob = new Blob([svgData], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'ownership-structure-' + itemId + '.svg';
            link.click();
            URL.revokeObjectURL(url);
          }
          
          function buildRecursiveOwnershipTree(tree, depth = 0) {
            if (!tree) return 'No ownership data available';
            
            // Calculate tree structure and positions
            const nodes = [];
            const links = [];
            
            function traverseTree(node, depth, x, y, parentId) {
              const nodeId = 'node-' + nodes.length;
              const isCompany = node.is_company !== false;
              
              nodes.push({
                id: nodeId,
                name: node.company_name || node.name,
                companyNumber: node.company_number,
                percentage: node.percentage || (depth === 0 ? 100 : 0),
                shares: node.shares_held || 0,
                isCompany: isCompany,
                depth: depth,
                x: x,
                y: y
              });
              
              if (parentId) {
                links.push({ source: parentId, target: nodeId });
              }
              
              // Process both shareholders and children arrays
              const shareholders = node.shareholders || [];
              const children = node.children || [];
              const allChildren = [...shareholders, ...children];
              
              if (allChildren.length > 0) {
                const childY = y + 150;
                const totalWidth = allChildren.length * 250;
                const startX = x - totalWidth / 2 + 125;
                
                allChildren.forEach((sh, idx) => {
                  const childX = startX + idx * 250;
                  traverseTree(sh, depth + 1, childX, childY, nodeId);
                });
              }
            }
            
            traverseTree(tree, 0, 400, 50, null);
            
            // Generate SVG and inject into container
            const svg = createOwnershipSVG(nodes, links);
            setTimeout(() => {
              const container = document.getElementById('ownership-tree-container');
              if (container) {
                container.innerHTML = svg;
              }
            }, 100);
            
            return ''; // Return empty string as we're injecting directly
          }
          
          function createOwnershipSVG(nodes, links) {
            if (nodes.length === 0) return '<p class="text-gray-500">No ownership data</p>';
            
            // Calculate SVG dimensions
            const maxX = Math.max(...nodes.map(n => n.x)) + 150;
            const maxY = Math.max(...nodes.map(n => n.y)) + 100;
            const width = Math.max(800, maxX);
            const height = Math.max(400, maxY);
            
            const depthColors = [
              '#1e40af', // blue-800 (root)
              '#3b82f6', // blue-500
              '#059669', // green-600
              '#10b981', // green-500
              '#f59e0b', // yellow-500
              '#f97316', // orange-500
              '#ef4444', // red-500
              '#dc2626'  // red-600
            ];
            
            let svg = '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg" style="border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff;">';
            svg += '<defs>';
            svg += '<marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" /></marker>';
            svg += '<filter id="shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dx="0" dy="2" result="offsetblur"/><feComponentTransfer><feFuncA type="linear" slope="0.2"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
            svg += '</defs>';
            svg += '<g transform="scale(1)">';
            
            // Draw links first (so they appear behind nodes)
            links.forEach(link => {
              const source = nodes.find(n => n.id === link.source);
              const target = nodes.find(n => n.id === link.target);
              if (source && target) {
                const sourceX = source.x;
                const sourceY = source.y + 40; // Bottom of source box
                const targetX = target.x;
                const targetY = target.y - 10; // Top of target box
                
                // Draw curved line
                const midY = (sourceY + targetY) / 2;
                svg += '<path d="M ' + sourceX + ' ' + sourceY + ' C ' + sourceX + ' ' + midY + ', ' + targetX + ' ' + midY + ', ' + targetX + ' ' + targetY + '" stroke="#9ca3af" stroke-width="2" fill="none" marker-end="url(#arrowhead)"/>';
                
                // Add percentage label on link if available
                if (target.percentage > 0) {
                  const labelX = (sourceX + targetX) / 2;
                  const labelY = (sourceY + targetY) / 2 - 5;
                  svg += '<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" font-size="11" fill="#6b7280" font-weight="600">' + target.percentage.toFixed(1) + '%</text>';
                }
              }
            });
            
            // Draw nodes
            nodes.forEach(node => {
              const color = depthColors[Math.min(node.depth, depthColors.length - 1)];
              const fillColor = node.depth === 0 ? color : '#ffffff';
              const strokeColor = color;
              const textColor = node.depth === 0 ? '#ffffff' : '#1f2937';
              
              // Node box
              svg += '<rect x="' + (node.x - 100) + '" y="' + (node.y - 35) + '" width="200" height="70" rx="8" ry="8" fill="' + fillColor + '" stroke="' + strokeColor + '" stroke-width="2" filter="url(#shadow)" style="cursor: pointer;"/>';
              
              // Company icon
              const icon = node.isCompany ? '🏢' : '👤';
              svg += '<text x="' + (node.x - 90) + '" y="' + (node.y - 10) + '" font-size="16">' + icon + '</text>';
              
              // Company name with wrapping
              const maxCharsPerLine = 20;
              const words = node.name.split(' ');
              let lines = [];
              let currentLine = '';
              
              words.forEach(word => {
                if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
                  currentLine = currentLine ? currentLine + ' ' + word : word;
                } else {
                  if (currentLine) lines.push(currentLine);
                  currentLine = word;
                }
              });
              if (currentLine) lines.push(currentLine);
              
              // Limit to 2 lines
              if (lines.length > 2) {
                lines[1] = lines[1].substring(0, maxCharsPerLine - 3) + '...';
                lines = lines.slice(0, 2);
              }
              
              // Render text with tspan for each line
              const startY = node.y - 15 + (lines.length === 1 ? 5 : 0);
              svg += '<text x="' + (node.x - 65) + '" y="' + startY + '" font-size="11" font-weight="600" fill="' + textColor + '">';
              lines.forEach((line, idx) => {
                svg += '<tspan x="' + (node.x - 65) + '" dy="' + (idx === 0 ? 0 : 12) + '">' + escapeXml(line) + '</tspan>';
              });
              svg += '</text>';
              
              // Company number
              if (node.companyNumber) {
                svg += '<text x="' + (node.x - 65) + '" y="' + (node.y + 5) + '" font-size="10" fill="' + (node.depth === 0 ? '#e5e7eb' : '#6b7280') + '">' + node.companyNumber + '</text>';
              }
              
              // Shares info
              if (node.shares > 0) {
                const sharesText = node.shares.toLocaleString() + ' shares';
                svg += '<text x="' + (node.x - 65) + '" y="' + (node.y + 20) + '" font-size="9" fill="' + (node.depth === 0 ? '#d1d5db' : '#9ca3af') + '">' + sharesText + '</text>';
              }
            });
            
            svg += '</g></svg>';
            
            return svg;
          }
          
          function escapeXml(unsafe) {
            if (typeof unsafe !== 'string') return '';
            return unsafe.replace(/[<>&'"]/g, function (c) {
              switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case "'": return '&apos;';
                case '"': return '&quot;';
                default: return c;
              }
            });
          }
          
          function buildOwnershipTree(shareholders, companyName) {
            if (!shareholders || shareholders.length === 0) return 'No ownership data available';
            
            let tree = '📊 ' + companyName + '\\n';
            tree += '│\\n';
            
            // Sort by percentage descending
            const sorted = [...shareholders].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
            
            sorted.forEach((sh, idx) => {
              const isLast = idx === sorted.length - 1;
              const connector = isLast ? '└── ' : '├── ';
              const percentage = (sh.percentage || 0).toFixed(2);
              const shares = (sh.shares_held || 0).toLocaleString();
              const isParent = isParentCompany(sh.name);
              const icon = isParent ? '🏢' : '👤';
              
              tree += connector + icon + ' ' + sh.name + ' (' + percentage + '% - ' + shares + ' shares)\\n';
              
              if (isParent && !isLast) {
                tree += '│   ' + '  [Parent Company - May have own shareholders]\\n';
              }
            });
            
            return tree;
          }
          
          function isParentCompany(name) {
            if (!name) return false;
            const lowerName = name.toLowerCase();
            return lowerName.includes('limited') || lowerName.includes('ltd') || 
                   lowerName.includes('plc') || lowerName.includes('llp') ||
                   lowerName.includes('trust') || lowerName.includes('lp');
          }
          
          function formatAddress(addr) {
            if (!addr) return 'N/A';
            const parts = [
              addr.address_line_1,
              addr.address_line_2,
              addr.locality,
              addr.postal_code,
              addr.country
            ].filter(p => p);
            return parts.join(', ');
          }
          
          loadItemDetails();
        </script>
    </body>
    </html>
  `)
})

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
                        <tr class="hover:bg-gray-50 cursor-pointer" onclick="window.location.href='/item/\${item.id}'">
                          <td class="px-4 py-2">
                            <a href="/item/\${item.id}" class="text-blue-600 hover:text-blue-800 hover:underline" onclick="event.stopPropagation()">
                              \${item.input_name}
                            </a>
                          </td>
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
