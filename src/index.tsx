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
          const itemId = ${JSON.stringify(itemId)};
          console.log('[DEBUG] Page loaded, item ID:', itemId);
          
          // Store tree data globally for toggle
          let globalOwnershipTree = null;
          let globalItem = null;
          
          function toggleTreeView() {
            const isInverted = document.getElementById('tree-view-toggle').checked;
            console.log('[TOGGLE] Switching to ' + (isInverted ? 'UBO-down' : 'bottom-up') + ' view');
            
            if (globalOwnershipTree) {
              buildRecursiveOwnershipTree(globalOwnershipTree, 0, isInverted);
            }
          }
          
          async function loadItemDetails() {
            try {
              console.log('[DEBUG] Fetching item data...');
              const response = await axios.get('/api/item/' + itemId);
              console.log('[DEBUG] Response status:', response.status);
              const item = response.data;
              globalItem = item;  // Store globally
              console.log('[DEBUG] Item data received:', item ? 'yes' : 'no');
              
              document.getElementById('loading').classList.add('hidden');
              document.getElementById('content').classList.remove('hidden');
              
              // Build shareholders tree (use recursive tree if available, otherwise flat)
              let shareholderTree = '';
              if (item.ownership_tree && item.ownership_tree.shareholders && item.ownership_tree.shareholders.length > 0) {
                globalOwnershipTree = item.ownership_tree;  // Store globally for toggle
                shareholderTree = buildRecursiveOwnershipTree(item.ownership_tree, 0, false);
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
                  <!-- Ownership Tree -->
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3">
                      <i class="fas fa-project-diagram mr-2"></i>Ownership Tree
                      \${item.ownership_tree ? '<span class="badge badge-success ml-2">Multi-Layer</span>' : ''}
                    </h3>
                    <!-- UBO-Down View toggle hidden temporarily
                    <div class="mb-3 flex items-center gap-3">
                      <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="tree-view-toggle" onchange="toggleTreeView()" class="w-4 h-4 text-blue-600 rounded">
                        <span class="text-sm font-medium text-gray-700">
                          <i class="fas fa-layer-group mr-1"></i>
                          Show UBO-Down View
                        </span>
                      </label>
                      <span class="text-xs text-gray-500">(Ultimate Beneficial Owners at top)</span>
                    </div>
                    -->
                    <div id="ownership-tree-container" style="overflow: auto; max-width: 100%; max-height: 600px;"></div>
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
                </div>
                \` : item.enrich_status === 'done' ? \`
                <div class="card">
                  <h2 class="section-title"><i class="fas fa-sitemap mr-2"></i>Ownership Structure</h2>
                  <p class="text-gray-600">No shareholder information found in CS01/AR01/IN01 filings.</p>
                </div>
                \` : ''}



                <!-- KYC/AML Screening Requirements -->
                <div class="card">
                  <!-- Download CSV and Print buttons hidden temporarily (showing too many parties)
                  <div class="flex justify-between items-center mb-4">
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
                  -->

                  <!-- Consolidated Screening List -->
                  \${(() => {
                    // Normalize and consolidate all individuals and entities from the complete ownership structure
                    const personMap = new Map(); // Use Map to track unique individuals by name
                    
                    // Advanced name normalization function
                    const normalizeName = (name) => {
                      if (!name) return '';
                      
                      // DEBUG for Kenning
                      const isKenning = name.toUpperCase().includes('KENNING');
                      if (isKenning) console.log('[NORMALIZE] Input:', name);
                      
                      // For companies, uppercase and normalize legal suffixes
                      if (name.toUpperCase().includes('LIMITED') || 
                          name.toUpperCase().includes('LTD') ||
                          name.toUpperCase().includes('PLC') ||
                          name.toUpperCase().includes('LLP')) {
                        let normalized = name.trim().toUpperCase();
                        if (isKenning) console.log('[NORMALIZE] After uppercase:', normalized);
                        
                        // Normalize legal suffixes: Use string methods to avoid regex issues in template literals
                        normalized = normalized.split(' LIMITED').join(' LTD');
                        normalized = normalized.endsWith(' LIMITED') ? normalized.slice(0, -8) + ' LTD' : normalized;
                        normalized = normalized === 'LIMITED' ? 'LTD' : normalized;
                        if (isKenning) console.log('[NORMALIZE] After LIMITED→LTD:', normalized);
                        
                        normalized = normalized.split('P.L.C').join('PLC');
                        normalized = normalized.split('L.L.P').join('LLP');
                        normalized = normalized.split(' COMPANY').join(' CO');
                        
                        // Remove punctuation - use character class that works in template literals
                        // Keep only: A-Z, 0-9, and spaces
                        normalized = normalized.split('').filter(c => {
                          const code = c.charCodeAt(0);
                          return (code >= 65 && code <= 90) || // A-Z
                                 (code >= 48 && code <= 57) || // 0-9
                                 code === 32; // space
                        }).join('');
                        if (isKenning) console.log('[NORMALIZE] After punctuation removal:', normalized);
                        
                        // Remove extra whitespace
                        normalized = normalized.split(' ').filter(s => s.length > 0).join(' ');
                        if (isKenning) console.log('[NORMALIZE] Final (company):', normalized);
                        
                        return normalized;
                      }
                      
                      // For individuals: normalize name variations
                      let normalized = name.trim().toUpperCase();
                      
                      // Remove titles (Mr, Mrs, Ms, Miss, Dr, etc.)
                      normalized = normalized.replace(/^(MR|MRS|MS|MISS|DR|SIR|DAME|LORD|LADY|PROFESSOR|PROF)\\.?\\s+/i, '');
                      
                      // Handle "LASTNAME, Firstname" format -> "FIRSTNAME LASTNAME"
                      if (normalized.includes(',')) {
                        const parts = normalized.split(',').map(p => p.trim());
                        if (parts.length === 2) {
                          // Reverse: "KHAN, HAROON" -> "HAROON KHAN"
                          normalized = parts[1] + ' ' + parts[0];
                        }
                      }
                      
                      // Remove extra whitespace
                      normalized = normalized.replace(/\s+/g, ' ').trim();
                      
                      // Sort words alphabetically for better matching
                      // This handles "HAROON KHAN" vs "KHAN HAROON"
                      const words = normalized.split(' ').sort().join(' ');
                      
                      return words;
                    };
                    
                    // Helper function to add or merge person data
                    const addPerson = (name, data) => {
                      const normalizedName = normalizeName(name);
                      
                      // DEBUG: Log every addPerson call for companies
                      if (data.isCompany && name.toUpperCase().includes('KENNING')) {
                        console.log('[ADD_PERSON DEBUG] Adding:', name, '→ Normalized:', normalizedName, 'Data:', data);
                      }
                      
                      if (personMap.has(normalizedName)) {

                        const existing = personMap.get(normalizedName);
                        
                        // Choose the "best" display name (prefer the one with nationality/DOB as it's more formal)
                        if (data.nationality || data.dob) {
                          // Use the name with more data
                          if (!existing.nationality && !existing.dob) {
                            existing.name = name.trim();
                          }
                        } else if (!existing.name.includes(',') && name.includes(',')) {
                          // Prefer "LASTNAME, Firstname" format (more formal)
                          existing.name = name.trim();
                        }
                        
                        // Merge roles (avoid duplicates)
                        if (data.role && !existing.roles.includes(data.role)) {
                          existing.roles.push(data.role);
                        }
                        
                        // Update other fields if not present (use first non-null value)
                        existing.nationality = existing.nationality || data.nationality;
                        existing.dob = existing.dob || data.dob;
                        
                        // Merge linked entities (avoid duplicates)
                        if (data.linkedEntity && !existing.linkedEntities.includes(data.linkedEntity)) {
                          existing.linkedEntities.push(data.linkedEntity);
                        }
                        
                        existing.isCompany = existing.isCompany || data.isCompany;
                        existing.companyNumber = existing.companyNumber || data.companyNumber;
                      } else {
                        personMap.set(normalizedName, {
                          name: name.trim(),
                          roles: data.role ? [data.role] : [],
                          nationality: data.nationality || null,
                          dob: data.dob || null,
                          linkedEntities: data.linkedEntity ? [data.linkedEntity] : [],
                          isCompany: data.isCompany || false,
                          companyNumber: data.companyNumber || null
                        });
                      }
                    };
                    
                    // Extract target company name and number for reference
                    const targetCompanyName = item.input_name || item.profile?.company_name || 'Target Company';
                    const targetCompanyNumber = item.company_number;
                    
                    // DEBUG: Log what screening_list contains
                    console.log('[SCREENING DEBUG] screening_list keys:', Object.keys(item.screening_list || {}));
                    console.log('[SCREENING DEBUG] ownership_chain length:', item.screening_list?.ownership_chain?.length || 0);
                    console.log('[SCREENING DEBUG] entity length:', item.screening_list?.entity?.length || 0);
                    
                    // 1. Process ownership_chain
                    // - Include ONLY companies (entities) from the ownership chain
                    // - SKIP all individuals from ownership_chain (they'll come from governance_and_control)
                    console.log('[SCREENING DEBUG] ownership_chain exists?', !!item.screening_list?.ownership_chain, 'length:', item.screening_list?.ownership_chain?.length);
                    if (item.screening_list?.ownership_chain) {
                      console.log('[SCREENING DEBUG] Processing', item.screening_list.ownership_chain.length, 'ownership_chain entries');
                      item.screening_list.ownership_chain.forEach(entry => {
                        console.log('[SCREENING DEBUG] ownership_chain entry:', entry.name, 'is_company:', entry.is_company, 'type:', typeof entry.is_company);
                        if (entry.is_company) {
                          // Add ALL corporate entities from the chain
                          addPerson(entry.name, {
                            role: entry.role,
                            linkedEntity: targetCompanyName,
                            isCompany: true,
                            companyNumber: entry.company_number
                          });
                        }
                        // Skip ALL individuals from ownership_chain
                        // (they will be added from governance_and_control section instead)
                      });
                    }
                    
                    // 2. Process governance_and_control (directors, secretaries, PSCs from target company)
                    if (item.screening_list?.governance_and_control) {
                      item.screening_list.governance_and_control.forEach(person => {
                        addPerson(person.name, {
                          role: person.role,
                          nationality: person.nationality,
                          dob: person.dob,
                          linkedEntity: targetCompanyName,
                          isCompany: false
                        });
                      });
                    }
                    
                    // 3. Process UBOs (ultimate beneficial owners)
                    if (item.screening_list?.ubos) {
                      item.screening_list.ubos.forEach(ubo => {
                        addPerson(ubo.name, {
                          role: ubo.role,
                          linkedEntity: targetCompanyName,
                          isCompany: false
                        });
                      });
                    }
                    
                    // 4. Process trusts
                    if (item.screening_list?.trusts) {
                      item.screening_list.trusts.forEach(trust => {
                        addPerson(trust.name, {
                          role: trust.role,
                          linkedEntity: targetCompanyName,
                          isCompany: false
                        });
                      });
                    }
                    
                    // 5. Process entities
                    if (item.screening_list?.entity) {
                      item.screening_list.entity.forEach(entity => {
                        addPerson(entity.name, {
                          role: entity.type,
                          linkedEntity: 'N/A',
                          isCompany: true,
                          companyNumber: entity.company_number
                        });
                      });
                    }
                    
                    // DEBUG: Check if Kenning is in the Map before converting to array
                    console.log('[MAP DEBUG] personMap size:', personMap.size);
                    console.log('[MAP DEBUG] personMap keys:', Array.from(personMap.keys()));
                    const kenningInMap = Array.from(personMap.entries()).find(([key, val]) => key.includes('KENNING'));
                    if (kenningInMap) {
                      console.log('[MAP DEBUG] Found KENNING in map:', kenningInMap);
                    } else {
                      console.log('[MAP DEBUG] ❌ KENNING NOT in map!');
                    }
                    
                    // Convert Map to sorted array
                    const consolidatedList = Array.from(personMap.values()).sort((a, b) => {
                      // Sort companies first, then individuals alphabetically
                      if (a.isCompany !== b.isCompany) return a.isCompany ? -1 : 1;
                      return a.name.localeCompare(b.name);
                    });
                    
                    console.log('[SCREENING DEBUG] Final consolidated list - Total entries:', consolidatedList.length);
                    console.log('[SCREENING DEBUG] Companies in list:', consolidatedList.filter(p => p.isCompany).map(p => p.name));
                    console.log('[SCREENING DEBUG] Individuals in list:', consolidatedList.filter(p => !p.isCompany).map(p => p.name));
                    
                    // Get unique linked entities for filter
                    const uniqueLinkedEntities = [...new Set(consolidatedList.flatMap(p => p.linkedEntities))].sort();
                    
                    return consolidatedList.length > 0 ? \`
                  <div class="mb-6">
                    <h3 class="text-lg font-semibold mb-3 flex items-center">
                      <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2">📋</span>
                      Consolidated Screening List
                    </h3>
                    <p class="text-sm text-gray-600 mb-3">
                      Comprehensive list of persons and entities requiring screening based on UK AML regulations.
                    </p>
                    
                    <div class="overflow-x-auto">
                      <table id="screening-table" class="w-full text-sm border">
                        <thead class="bg-gray-50">
                          <tr>
                            <th class="px-4 py-2 text-left border">Name</th>
                            <th class="px-4 py-2 text-left border">Role(s)</th>
                            <th class="px-4 py-2 text-left border">Nationality</th>
                            <th class="px-4 py-2 text-left border">DOB</th>
                            <th class="px-4 py-2 text-left border">Linked Entity</th>
                          </tr>
                        </thead>
                        <tbody>
                          \${consolidatedList.map((person, idx) => \`
                            <tr class="screening-row hover:bg-gray-50 \${person.isCompany ? 'bg-blue-50' : ''}" data-linked-entities="\${person.linkedEntities.join('||')}" data-index="\${idx}">
                              <td class="px-4 py-2 border font-medium">
                                \${person.isCompany ? '🏢' : '👤'} \${person.name}
                                \${person.companyNumber ? \`<br><span class="text-xs text-gray-500">\${person.companyNumber}</span>\` : ''}
                              </td>
                              <td class="px-4 py-2 border">
                                \${person.roles.map(role => \`<span class="badge badge-info mr-1 mb-1">\${role}</span>\`).join('')}
                              </td>
                              <td class="px-4 py-2 border text-xs">\${person.nationality || '-'}</td>
                              <td class="px-4 py-2 border text-xs">\${person.dob || '-'}</td>
                              <td class="px-4 py-2 border text-xs">\${person.linkedEntities.join(', ') || '-'}</td>
                            </tr>
                          \`).join('')}
                        </tbody>
                      </table>
                    </div>
                  </div>
                    \` : '<p class="text-gray-600">No screening data available.</p>';
                  })()}


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
          
          // Screening Table Filter Functions
          function filterScreeningTable() {
            const filterValue = document.getElementById('linked-entity-filter').value;
            const rows = document.querySelectorAll('.screening-row');
            let visibleCount = 0;
            
            rows.forEach(row => {
              const linkedEntities = row.getAttribute('data-linked-entities').split('||');
              
              if (!filterValue) {
                // Show all rows
                row.style.display = '';
                visibleCount++;
              } else {
                // Show only rows that have the selected linked entity
                if (linkedEntities.includes(filterValue)) {
                  row.style.display = '';
                  visibleCount++;
                } else {
                  row.style.display = 'none';
                }
              }
            });
            
            // Update visible count
            const visibleCountElement = document.getElementById('screening-visible');
            if (visibleCountElement) {
              visibleCountElement.textContent = visibleCount;
            }
          }
          
          function clearScreeningFilter() {
            const filterSelect = document.getElementById('linked-entity-filter');
            if (filterSelect) {
              filterSelect.value = '';
              filterScreeningTable();
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
            if (!svg) {
              alert('Please wait for the ownership tree to load before downloading.');
              return;
            }
            
            try {
              // Clone the SVG to avoid modifying the original
              const svgClone = svg.cloneNode(true);
              
              // Add XML declaration and namespace
              const xmlDeclaration = String.fromCharCode(60, 63) + 'xml version="1.0" encoding="UTF-8"' + String.fromCharCode(63, 62) + '\\n';
              const svgData = xmlDeclaration + new XMLSerializer().serializeToString(svgClone);
              
              const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'ownership-structure-' + itemId + '.svg';
              link.style.display = 'none';
              document.body.appendChild(link);
              
              // Force click with a slight delay
              setTimeout(() => {
                link.click();
                setTimeout(() => {
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                }, 100);
              }, 100);
              
              console.log('SVG download initiated');
            } catch (error) {
              console.error('SVG download failed:', error);
              alert('Failed to download SVG: ' + error.message);
            }
          }
          
          // Invert ownership tree to show UBOs at top, target company at bottom
          function invertOwnershipTree(tree) {
            if (!tree) return null;
            
            console.log('[INVERT] ========================================');
            console.log('[INVERT] Starting tree inversion (UBO-down view)...');
            console.log('[INVERT] ========================================');
            
            const targetCompany = {
              name: tree.company_name || tree.name,
              company_number: tree.company_number,
              is_company: true,
              depth: 0  // Will be recalculated
            };
            
            // Find all UBOs (leaf nodes with no children/shareholders)
            const ubos = [];
            const ownershipPaths = [];  // Track paths from UBO to target
            
            function findUBOs(node, path = [], cumulativePercentage = 100) {
              const currentPath = [...path, {
                name: node.company_name || node.name,
                company_number: node.company_number,
                percentage: node.percentage || 100,
                is_company: node.is_company !== false,
                shares_held: node.shares_held
              }];
              
              const shareholders = node.shareholders || [];
              const children = node.children || [];
              const allChildren = [...shareholders, ...children];
              
              if (allChildren.length === 0) {
                // This is a UBO (leaf node)
                const effectivePercentage = cumulativePercentage;
                console.log('[INVERT] Found UBO: ' + currentPath[currentPath.length - 1].name + ' (' + effectivePercentage.toFixed(2) + '% effective)');
                
                ubos.push({
                  name: currentPath[currentPath.length - 1].name,
                  company_number: currentPath[currentPath.length - 1].company_number,
                  is_company: currentPath[currentPath.length - 1].is_company,
                  effective_percentage: effectivePercentage,
                  path: currentPath
                });
                
                ownershipPaths.push({
                  ubo: currentPath[currentPath.length - 1].name,
                  path: currentPath,
                  effective_percentage: effectivePercentage
                });
              } else {
                // Recurse into children
                allChildren.forEach(child => {
                  const childPercentage = child.percentage || 0;
                  const newCumulative = (cumulativePercentage * childPercentage) / 100;
                  findUBOs(child, currentPath, newCumulative);
                });
              }
            }
            
            // Start from root (target company)
            findUBOs(tree, [], 100);
            
            console.log('[INVERT] Found ' + ubos.length + ' UBOs');
            console.log('[INVERT] Building inverted tree structure...');
            
            // Build inverted tree: each UBO becomes a root
            const invertedTrees = ubos.map(ubo => {
              // Reverse the path (UBO at top, target at bottom)
              const reversedPath = [...ubo.path].reverse();
              
              // Build tree structure
              let currentNode = null;
              reversedPath.forEach((pathNode, idx) => {
                const node = {
                  name: pathNode.name,
                  company_name: pathNode.name,
                  company_number: pathNode.company_number,
                  is_company: pathNode.is_company,
                  percentage: pathNode.percentage,
                  shares_held: pathNode.shares_held,
                  depth: idx,
                  shareholders: [],
                  children: []
                };
                
                // Add effective percentage to UBO node
                if (idx === 0) {
                  node.effective_percentage = ubo.effective_percentage;
                  node.percentage = ubo.effective_percentage;
                }
                
                if (currentNode) {
                  currentNode.children.push(node);
                }
                
                if (idx === 0) {
                  // This is the UBO (root of this tree)
                  currentNode = node;
                } else {
                  currentNode = node;
                }
              });
              
              // Return the root (UBO)
              return reversedPath[0] ? {
                name: reversedPath[0].name,
                company_name: reversedPath[0].name,
                company_number: reversedPath[0].company_number,
                is_company: reversedPath[0].is_company,
                percentage: ubo.effective_percentage,
                effective_percentage: ubo.effective_percentage,
                shares_held: reversedPath[0].shares_held,
                depth: 0,
                children: reversedPath.length > 1 ? [{
                  name: reversedPath[1].name,
                  company_name: reversedPath[1].name,
                  company_number: reversedPath[1].company_number,
                  is_company: reversedPath[1].is_company,
                  percentage: reversedPath[1].percentage,
                  shares_held: reversedPath[1].shares_held,
                  depth: 1,
                  children: buildChildChain(reversedPath.slice(2), 2)
                }] : [],
                shareholders: []
              } : null;
            }).filter(t => t !== null);
            
            function buildChildChain(pathNodes, startDepth) {
              if (pathNodes.length === 0) return [];
              
              const firstNode = pathNodes[0];
              return [{
                name: firstNode.name,
                company_name: firstNode.name,
                company_number: firstNode.company_number,
                is_company: firstNode.is_company,
                percentage: firstNode.percentage,
                shares_held: firstNode.shares_held,
                depth: startDepth,
                children: buildChildChain(pathNodes.slice(1), startDepth + 1),
                shareholders: []
              }];
            }
            
            console.log('[INVERT] Built ' + invertedTrees.length + ' inverted trees');
            
            // Return a structure that can be rendered
            // For now, we'll create a "virtual root" that contains all UBO trees
            return {
              name: 'Ultimate Beneficial Owners',
              company_name: 'Ultimate Beneficial Owners',
              is_company: false,
              percentage: 100,
              depth: -1,  // Virtual root
              children: invertedTrees,
              shareholders: []
            };
          }

          function buildRecursiveOwnershipTree(tree, depth = 0, inverted = false) {
            if (!tree) return 'No ownership data available';
            
            // Apply inversion if requested
            const workingTree = inverted ? invertOwnershipTree(tree) : tree;
            
            // Calculate tree structure and positions
            const nodes = [];
            const links = [];
            
            // Track ALL seen nodes to prevent duplicates (companies AND individuals)
            const seenCompanies = new Set();
            
            console.log('[TREE] ========================================');
            console.log('[TREE] Starting tree traversal...');
            console.log('[TREE] ========================================');
            
            // Calculate subtree width recursively with maximum width constraint
            function getSubtreeWidth(node) {
              const shareholders = node.shareholders || [];
              const children = node.children || [];
              const allChildren = [...shareholders, ...children];
              
              if (allChildren.length === 0) {
                return 250; // Leaf node width
              }
              
              // For many children (>6), use compact layout (200px per child instead of recursive)
              if (allChildren.length > 6) {
                return allChildren.length * 200; // Compact spacing
              }
              
              // Sum of all children's widths
              let totalWidth = 0;
              allChildren.forEach(child => {
                totalWidth += getSubtreeWidth(child);
              });
              
              return Math.max(250, totalWidth); // At least 250px wide
            }
            
            function traverseTree(node, depth, x, y, parentId, effectivePercentage) {
              const nodeId = 'node-' + nodes.length;
              const isCompany = node.is_company !== false;
              const companyNumber = node.company_number;
              const nodeName = node.company_name || node.name;
              
              // Skip virtual root in inverted mode
              if (depth === -1 && nodeName === 'Ultimate Beneficial Owners') {
                console.log('[TREE] Skipping virtual root, processing UBO children...');
                const children = node.children || [];
                const childY = y + 150;
                
                // Calculate spacing for UBOs
                const childWidths = children.map(child => getSubtreeWidth(child));
                const totalWidth = childWidths.reduce((a, b) => a + b, 0);
                let currentX = x - totalWidth / 2;
                
                children.forEach((sh, idx) => {
                  const childWidth = childWidths[idx];
                  const childX = currentX + childWidth / 2;
                  traverseTree(sh, 0, childX, childY, null, 100);
                  currentX += childWidth;
                });
                return;
              }
              
              // Create unique identifier for ALL nodes (prevents duplicate rendering)
              // - Companies: use company number
              // - Individuals: use name + position to ensure uniqueness
              const nodeKey = companyNumber || (nodeName + '-' + x + '-' + y);
              
              // DEBUG: Log each node being processed
              console.log('[TREE] Depth ' + depth + ': Processing "' + nodeName + '" (' + (companyNumber || 'individual') + ') at (' + x + ',' + y + ') - Parent: ' + (parentId || 'ROOT'));
              
              // Check if this node has already been processed (prevents duplicates)
              if (seenCompanies.has(nodeKey)) {
                console.log('[TREE] ⚠️ Skipping duplicate node: ' + nodeName + ' (' + nodeKey + ')');
                return;
              }
              
              // Track this node as processed
              seenCompanies.add(nodeKey);
              
              // Use effective percentage if available (for UBOs in inverted tree)
              const displayPercentage = node.effective_percentage || node.percentage || (depth === 0 ? 100 : 0);
              
              nodes.push({
                id: nodeId,
                name: nodeName,
                companyNumber: companyNumber,
                percentage: displayPercentage,
                percentageBand: node.percentage_band || '',
                shares: node.shares_held || 0,
                isCompany: isCompany,
                depth: depth,
                x: x,
                y: y,
                country: node.country || ''
              });
              
              if (parentId) {
                links.push({ source: parentId, target: nodeId });
              }
              
              // Process both shareholders and children arrays
              const shareholders = node.shareholders || [];
              const children = node.children || [];
              const allChildren = [...shareholders, ...children];
              
              // DEBUG: Log children being processed
              if (allChildren.length > 0) {
                console.log('[TREE]   └─ ' + nodeName + ' has ' + allChildren.length + ' children:', allChildren.map(c => c.company_name || c.name));
              }
              
              if (allChildren.length > 0) {
                const childY = y + 150;
                
                // Calculate each child's width and position them with proper spacing
                let currentX = x;
                const childWidths = allChildren.map(child => getSubtreeWidth(child));
                const totalWidth = childWidths.reduce((a, b) => a + b, 0);
                currentX = x - totalWidth / 2;
                
                allChildren.forEach((sh, idx) => {
                  const childWidth = childWidths[idx];
                  const childX = currentX + childWidth / 2;
                  const childEffective = sh.effective_percentage || ((effectivePercentage * (sh.percentage || 100)) / 100);
                  traverseTree(sh, depth + 1, childX, childY, nodeId, childEffective);
                  currentX += childWidth;
                });
              }
            }
            
            // Calculate total tree width and start from center
            const treeWidth = getSubtreeWidth(workingTree);
            const startX = treeWidth / 2;
            console.log('[TREE] Total tree width: ' + treeWidth + 'px, starting at X=' + startX);
            
            // Start traversal with depth -1 for virtual root in inverted mode
            const startDepth = (inverted && workingTree.depth === -1) ? -1 : 0;
            traverseTree(workingTree, startDepth, startX, 50, null, 100);
            
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
          
          // Map country names to flag emojis
          function getCountryFlag(country) {
            if (!country || typeof country !== 'string') return '';
            const countryUpper = country.toUpperCase().trim();
            const flagMap = {
              'ENGLAND': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
              'SCOTLAND': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
              'WALES': '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
              'NORTHERN IRELAND': '🇬🇧',
              'UNITED KINGDOM': '🇬🇧',
              'UK': '🇬🇧',
              'GERMANY': '🇩🇪',
              'FRANCE': '🇫🇷',
              'SPAIN': '🇪🇸',
              'ITALY': '🇮🇹',
              'NETHERLANDS': '🇳🇱',
              'BELGIUM': '🇧🇪',
              'IRELAND': '🇮🇪',
              'LUXEMBOURG': '🇱🇺',
              'SWITZERLAND': '🇨🇭',
              'AUSTRIA': '🇦🇹',
              'DENMARK': '🇩🇰',
              'SWEDEN': '🇸🇪',
              'NORWAY': '🇳🇴',
              'FINLAND': '🇫🇮',
              'POLAND': '🇵🇱',
              'CZECH REPUBLIC': '🇨🇿',
              'PORTUGAL': '🇵🇹',
              'GREECE': '🇬🇷',
              'USA': '🇺🇸',
              'UNITED STATES': '🇺🇸',
              'CANADA': '🇨🇦',
              'AUSTRALIA': '🇦🇺',
              'NEW ZEALAND': '🇳🇿',
              'JAPAN': '🇯🇵',
              'CHINA': '🇨🇳',
              'INDIA': '🇮🇳',
              'SINGAPORE': '🇸🇬',
              'HONG KONG': '🇭🇰',
              'SOUTH KOREA': '🇰🇷',
              'BRAZIL': '🇧🇷',
              'MEXICO': '🇲🇽',
              'ARGENTINA': '🇦🇷',
              'SOUTH AFRICA': '🇿🇦',
              'RUSSIA': '🇷🇺',
              'TURKEY': '🇹🇷',
              'ISRAEL': '🇮🇱',
              'UAE': '🇦🇪',
              'SAUDI ARABIA': '🇸🇦'
            };
            return flagMap[countryUpper] || '🌍';
          }
          
          function createOwnershipSVG(nodes, links) {
            if (nodes.length === 0) return '<p class="text-gray-500">No ownership data</p>';
            
            // Calculate actual bounds of the tree
            const minX = Math.min(...nodes.map(n => n.x)) - 100; // Left padding
            const maxX = Math.max(...nodes.map(n => n.x)) + 100; // Right padding
            const maxY = Math.max(...nodes.map(n => n.y)) + 100;
            
            // Shift all nodes to prevent cutoff (add 50px left margin)
            const xOffset = minX < 50 ? 50 - minX : 0;
            nodes.forEach(n => n.x += xOffset);
            
            // Calculate final SVG dimensions
            const width = maxX - minX + xOffset + 100;
            const height = Math.max(400, maxY + 150);  // Add 150px bottom margin to prevent cutoff
            
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
            
            let svg = '<svg width="' + width + '" height="' + height + '" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + width + ' ' + height + '" style="border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; display: block; margin: 0 auto; max-width: 100%;">';
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
                // Always show label if percentageBand exists, or if percentage > 0
                if (target.percentageBand || target.percentage > 0) {
                  const labelX = (sourceX + targetX) / 2;
                  const labelY = (sourceY + targetY) / 2 - 5;
                  // Show percentage band if available (e.g., "75-100% voting rights"), otherwise exact percentage
                  const label = target.percentageBand || (target.percentage.toFixed(1) + '%');
                  svg += '<text x="' + labelX + '" y="' + labelY + '" text-anchor="middle" font-size="10" fill="#6b7280" font-weight="600">' + escapeXml(label) + '</text>';
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
              
              // Company icon with country flag
              const icon = node.isCompany ? '🏢' : '👤';
              const flag = getCountryFlag(node.country);
              
              // DEBUG: Log country flag rendering
              if (node.depth <= 2) {
                console.log('[FLAG DEBUG] Node:', node.name, 'Country:', node.country, 'Flag:', flag, 'Has country:', !!node.country, 'Has flag:', !!flag);
              }
              
              svg += '<text x="' + (node.x - 90) + '" y="' + (node.y - 10) + '" font-size="16">' + icon + '</text>';
              if (flag && node.country) {
                svg += '<text x="' + (node.x + 80) + '" y="' + (node.y - 10) + '" font-size="16" title="' + escapeXml(node.country) + '">' + flag + '</text>';
              } else if (node.isCompany && !node.companyNumber) {
                // Show question mark for non-UK companies (no UK company number)
                svg += '<text x="' + (node.x + 80) + '" y="' + (node.y - 10) + '" font-size="16" title="Non-UK company (no UK company number)">❓</text>';
              }
              
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
                <div id="batch-loading" class="text-center py-8">
                    <i class="fas fa-spinner fa-spin text-4xl text-blue-600 mb-4"></i>
                    <p class="text-gray-600">Loading batch details...</p>
                </div>
                <div id="batch-details"></div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script>
          const batchId = ${JSON.stringify(batchId)};
          console.log('[BATCH] Page loaded, batch ID:', batchId);
          
          async function loadBatchDetails() {
            try {
              console.log('[BATCH] Fetching batch items...');
              const response = await axios.get('/api/batch/' + batchId + '/items');
              console.log('[BATCH] Response received:', response.status);
              console.log('[BATCH] Data:', response.data);
              
              const items = response.data.items || [];
              console.log('[BATCH] Items count:', items.length);
              
              // Hide loading spinner
              const loadingEl = document.getElementById('batch-loading');
              if (loadingEl) loadingEl.style.display = 'none';
              
              if (items.length === 0) {
                document.getElementById('batch-details').innerHTML = 
                  '<div class="text-center py-8">' +
                  '<i class="fas fa-inbox text-gray-400 text-5xl mb-4"></i>' +
                  '<p class="text-gray-600">No items found in this batch</p>' +
                  '</div>';
                return;
              }
              
              // Build table rows
              const tableRows = items.map(item => {
                const statusClass = 
                  item.enrich_status === 'done' ? 'bg-green-100 text-green-800' : 
                  item.enrich_status === 'running' ? 'bg-yellow-100 text-yellow-800' : 
                  'bg-gray-100 text-gray-800';
                
                return '<tr class="hover:bg-gray-50">' +
                  '<td class="px-4 py-2">' +
                    '<a href="/item/' + item.id + '" class="text-blue-600 hover:text-blue-800 hover:underline font-medium">' +
                      item.input_name +
                    '</a>' +
                  '</td>' +
                  '<td class="px-4 py-2">' + (item.company_number || item.charity_number || '-') + '</td>' +
                  '<td class="px-4 py-2">' + (item.resolved_registry || '-') + '</td>' +
                  '<td class="px-4 py-2">' +
                    '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + statusClass + '">' +
                      (item.enrich_status || 'pending') +
                    '</span>' +
                  '</td>' +
                  '<td class="px-4 py-2">' +
                    '<a href="/item/' + item.id + '" class="text-blue-600 hover:text-blue-800 text-sm font-medium">' +
                      'View Details <i class="fas fa-arrow-right ml-1"></i>' +
                    '</a>' +
                  '</td>' +
                '</tr>';
              }).join('');
              
              document.getElementById('batch-details').innerHTML = 
                '<h2 class="text-xl font-bold mb-4">Items (' + items.length + ')</h2>' +
                '<div class="overflow-x-auto">' +
                  '<table class="w-full">' +
                    '<thead class="bg-gray-50">' +
                      '<tr>' +
                        '<th class="px-4 py-2 text-left">Input Name</th>' +
                        '<th class="px-4 py-2 text-left">Matched Entity</th>' +
                        '<th class="px-4 py-2 text-left">Registry</th>' +
                        '<th class="px-4 py-2 text-left">Status</th>' +
                        '<th class="px-4 py-2 text-left">Actions</th>' +
                      '</tr>' +
                    '</thead>' +
                    '<tbody class="divide-y">' +
                      tableRows +
                    '</tbody>' +
                  '</table>' +
                '</div>';
              
              console.log('[BATCH] Table rendered successfully');
            } catch (error) {
              console.error('[BATCH] Error loading batch:', error);
              document.getElementById('batch-details').innerHTML = 
                '<div class="text-center py-8">' +
                  '<i class="fas fa-exclamation-triangle text-red-500 text-5xl mb-4"></i>' +
                  '<p class="text-red-600 font-semibold mb-2">Failed to load batch details</p>' +
                  '<p class="text-gray-600 text-sm">' + error.message + '</p>' +
                  '<button onclick="loadBatchDetails()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">' +
                    '<i class="fas fa-redo mr-2"></i>Retry' +
                  '</button>' +
                '</div>';
            }
          }

          // Start loading immediately
          loadBatchDetails();
          console.log('[BATCH] loadBatchDetails() called');
        </script>
    </body>
    </html>
  `)
})

export default app
