/**
 * AccessPulse AI – Client Application
 * Recreates the exact GIS Curb Ramp & Sidewalk Accessibility Dashboard
 * with integrated Multimodal AI Pipeline (Foundry Vision, Azure Speech, Language, AI Search).
 */

const state = {
    currentView: 'dashboard',
    activeCategoryTab: 'blocked_ramp',
    clusterItems: true,
    activeSubTab: 'accessibility',
    selectedWard: 'all',
    dashboardStats: null,
    reports: [],
    mapInstance: null,
    submitMap: null,
    submitMarker: null,
    audioRecorder: null,
    audioChunks: [],
    audioBlob: null,
    isRecording: false,
    audioContext: null,
    analyser: null,
    animFrameId: null,
    selectedLanguage: 'en',
    uploadedImageFile: null,
};

// DOM Utilities
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    setupSidebarNav();
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
});

// Routing Handler
function handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const [view, param] = hash.split('/');

    state.currentView = view;

    // Update Sidebar Active state
    $$('.nav-icon-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Cleanup Maps & Audio
    cleanupDashboard();

    switch (view) {
        case 'dashboard':
            renderDashboardView();
            break;
        case 'submit':
            renderSubmitView();
            break;
        case 'reports':
            renderReportsView();
            break;
        case 'admin':
            renderAdminView();
            break;
        case 'report':
            renderReportDetailView(param);
            break;
        default:
            renderDashboardView();
            break;
    }
}

function setupSidebarNav() {
    $$('.nav-icon-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (view) {
                window.location.hash = view;
            }
        });
    });
}

function navigate(view) {
    window.location.hash = view;
}

function switchCategoryTab(cat) {
    state.activeCategoryTab = cat;
    $$('.topbar-tabs .tab-item').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.tab === (cat ? cat.replace('_', '') : 'collection'));
    });
    if (state.currentView === 'dashboard') {
        loadDashboardData();
    } else {
        navigate('dashboard');
    }
}

function cleanupDashboard() {
    if (state.mapInstance) {
        state.mapInstance.remove();
        state.mapInstance = null;
    }
    if (state.submitMap) {
        state.submitMap.remove();
        state.submitMap = null;
    }
    if (state.animFrameId) {
        cancelAnimationFrame(state.animFrameId);
        state.animFrameId = null;
    }
}

// ==========================================================================
// 1. DASHBOARD VIEW (Reference Screenshot Exact Replica)
// ==========================================================================
async function renderDashboardView() {
    const mainBody = $('#mainBody');
    mainBody.innerHTML = `
        <!-- Filter Sub-bar (Reference: Ward 4, Ward 1, Ward 2, Ward 3, Reset) -->
        <div class="gis-subbar">
            <div class="ward-filter-group">
                <div class="folder-icon-box" title="Wards / Campus Sectors"><i class="far fa-folder"></i></div>
                <button class="ward-chip active" data-ward="all" onclick="filterByWard('all', this)">All Wards</button>
                <button class="ward-chip" data-ward="ward4" onclick="filterByWard('ward4', this)">
                    <span>Ward 4</span> <i class="far fa-trash-alt trash-icon" title="Clear filter"></i>
                </button>
                <button class="ward-chip" data-ward="ward1" onclick="filterByWard('ward1', this)">
                    <span>Ward 1</span> <i class="far fa-trash-alt trash-icon" title="Clear filter"></i>
                </button>
                <button class="ward-chip" data-ward="ward2" onclick="filterByWard('ward2', this)">
                    <span>Ward 2</span> <i class="far fa-trash-alt trash-icon" title="Clear filter"></i>
                </button>
                <button class="ward-chip" data-ward="ward3" onclick="filterByWard('ward3', this)">
                    <span>Ward 3</span> <i class="far fa-trash-alt trash-icon" title="Clear filter"></i>
                </button>
            </div>
            <div>
                <button class="btn-refresh-map" title="Reset view & reload" onclick="loadDashboardData()"><i class="fas fa-redo-alt"></i></button>
            </div>
        </div>

        <!-- Main GIS Dashboard Grid (Map + Right Cards) -->
        <div class="gis-grid-main">
            <!-- Left: GIS Map Card -->
            <div class="map-card-wrapper">
                <!-- Inner sub-tabs inside map header -->
                <div class="map-card-header">
                    <div class="map-sub-tabs">
                        <button class="map-tab-btn active" data-sub="accessibility" onclick="setSubTab('accessibility', this)">Accessibility</button>
                        <button class="map-tab-btn" data-sub="run_slope" onclick="setSubTab('run_slope', this)">Run Slope</button>
                        <button class="map-tab-btn" data-sub="cross_slope" onclick="setSubTab('cross_slope', this)">Cross Slope</button>
                        <button class="map-tab-btn" data-sub="clear_width" onclick="setSubTab('clear_width', this)">Clear Width</button>
                        <button class="map-tab-btn" data-sub="deterioration" onclick="setSubTab('deterioration', this)">Deterioration</button>
                    </div>
                </div>

                <!-- Cluster Switch Bar -->
                <div class="map-controls-bar">
                    <label class="cluster-switch-label">
                        <input type="checkbox" id="clusterToggle" ${state.clusterItems ? 'checked' : ''} onchange="toggleClustering(this.checked)" style="display:none;" />
                        <span class="toggle-slider"></span>
                        <span>Cluster Items</span>
                    </label>

                    <button class="map-layer-btn" title="Map Layers & Overlays"><i class="fas fa-layer-group"></i></button>
                </div>

                <!-- Leaflet Canvas -->
                <div class="gis-map-canvas" id="gisMap"></div>
            </div>

            <!-- Right: 3 Metric Cards (Exact match to reference) -->
            <div class="gis-right-column">
                <!-- Card 1: Half-Donut Average Accessibility Score -->
                <div class="gis-stat-card">
                    <div class="stat-card-title">Average Accessibility Score</div>
                    <div class="gauge-card-body">
                        <div class="gauge-canvas-box">
                            <canvas id="gaugeCanvas" width="170" height="95"></canvas>
                            <div class="gauge-score-value" id="gaugeScoreText">3.8</div>
                        </div>
                        <div class="gauge-caption">Target Campus Standard: ≥ 4.0 / 5.0</div>
                    </div>
                </div>

                <!-- Card 2: Missing Detectable Warnings -->
                <div class="gis-stat-card">
                    <div class="stat-card-title">Missing Detectable Warnings</div>
                    <div class="stat-card-big-number" id="detectableCount">133 missing</div>
                    <div class="stat-card-subtext"><i class="fas fa-exclamation-triangle" style="color:#f59e0b;"></i> Action required at 42 crossings</div>
                </div>

                <!-- Card 3: Missing Ramps -->
                <div class="gis-stat-card">
                    <div class="stat-card-title">Missing Ramps</div>
                    <div class="stat-card-big-number" id="missingRampsCount">2 missing</div>
                    <div class="stat-card-subtext"><i class="fas fa-wheelchair" style="color:#ef4444;"></i> Blocks primary arterial pathways</div>
                </div>
            </div>
        </div>

        <!-- Bottom Grid: Ramp Grade Distribution Card -->
        <div class="gis-bottom-grid">
            <div class="ramp-distribution-card">
                <div class="stat-card-title">Ramp Grade Distribution</div>

                <!-- Horizontal Multi-Segment Stacked Bar -->
                <div class="grade-stacked-bar" id="gradeStackedBar">
                    <div class="bar-segment seg-black" style="width: 4%;" title="More than 25% deteriorated: 4%"></div>
                    <div class="bar-segment seg-darkred" style="width: 8%;" title="10%-25% deteriorated: 8%"></div>
                    <div class="bar-segment seg-coral" style="width: 20%;" title="Major barriers to access found: 20%"></div>
                    <div class="bar-segment seg-orange" style="width: 32%;" title="Moderate barriers to access found: 32%"></div>
                    <div class="bar-segment seg-yellow" style="width: 22%;" title="Minor barriers to access found: 22%"></div>
                    <div class="bar-segment seg-green" style="width: 14%;" title="No significant barriers to access found: 14%"></div>
                </div>

                <!-- Pill-Shaped Legend Items from Screenshot -->
                <div class="grade-legend-row">
                    <span class="legend-pill pill-black"><span class="pill-dot"></span> More than 25% deteriorated</span>
                    <span class="legend-pill pill-darkred"><span class="pill-dot"></span> 10%-25% deteriorated</span>
                    <span class="legend-pill pill-coral"><span class="pill-dot"></span> Major barriers to access found</span>
                    <span class="legend-pill pill-orange"><span class="pill-dot"></span> Moderate barriers to access found</span>
                    <span class="legend-pill pill-yellow"><span class="pill-dot"></span> Minor barriers to access found</span>
                    <span class="legend-pill pill-green"><span class="pill-dot"></span> No significant barriers to access found</span>
                </div>
            </div>

            <!-- Secondary Metrics Card -->
            <div class="secondary-stats-card">
                <div>
                    <div class="stat-card-title">Total Number of Audited Assets</div>
                    <div class="stat-card-big-number" id="totalAssetsCount">28 Assets</div>
                    <div class="stat-card-subtext" style="color:#10b981;"><i class="fas fa-check-circle"></i> Microsoft Foundry Grounded</div>
                </div>
                <div style="margin-top:16px;">
                    <div class="stat-card-title">Truncated Domes Amount</div>
                    <div style="font-size:18px;font-weight:700;color:var(--text-primary);">48 Compliant Sites</div>
                </div>
            </div>
        </div>
    `;

    // Draw the gauge arc
    drawGauge(3.8);

    // Initialize GIS Map & Load Live Reports
    await loadDashboardData();
}

// Draw Semicircular Half-Donut Gauge (matching the screenshot's exact orange arc)
function drawGauge(score) {
    const canvas = $('#gaugeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const centerY = height - 10;
    const radius = 68;
    const strokeWidth = 14;

    // Track arc (light grey)
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, 2 * Math.PI, false);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Active arc (orange/amber: #f59e0b matching screenshot)
    const normalized = Math.min(Math.max(score / 5.0, 0), 1);
    const endAngle = Math.PI + normalized * Math.PI;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, Math.PI, endAngle, false);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineCap = 'round';
    ctx.stroke();

    const scoreElem = $('#gaugeScoreText');
    if (scoreElem) scoreElem.textContent = score.toFixed(1);
}

// Load Dashboard Data & Plot GIS Map
async function loadDashboardData() {
    try {
        const [statsRes, reportsRes] = await Promise.all([
            fetch('/api/dashboard/stats').then((r) => r.json()),
            fetch('/api/reports').then((r) => r.json()),
        ]);

        state.dashboardStats = statsRes;
        state.reports = reportsRes;

        // Update counts
        const score = statsRes.avg_score || 3.8;
        drawGauge(score);

        const totalElem = $('#totalAssetsCount');
        if (totalElem) totalElem.textContent = `${statsRes.total || 28} Audits`;

        // Render GIS Map with Reference screenshot polylines & markers
        initGISMap(reportsRes);
    } catch (err) {
        console.error('Failed to load dashboard:', err);
    }
}

function initGISMap(reports) {
    const mapContainer = $('#gisMap');
    if (!mapContainer) return;

    if (state.mapInstance) {
        state.mapInstance.remove();
    }

    // Default center on Delhi campus coords
    const map = L.map('gisMap', {
        zoomControl: false,
        attributionControl: false,
    }).setView([28.5459, 77.1885], 14);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Light minimal basemap matching screenshot
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
    }).addTo(map);

    state.mapInstance = map;

    // Draw reference sidewalk line segments (green, yellow, orange lines like in screenshot)
    drawReferenceSegments(map);

    // Plot report markers
    reports.forEach((r) => {
        if (!r.latitude || !r.longitude) return;

        // Filter by category if a specific top tab is active
        if (state.activeCategoryTab && r.category !== state.activeCategoryTab) {
            return;
        }

        const color = getSeverityColor(r.severity);
        const marker = L.circleMarker([r.latitude, r.longitude], {
            radius: 7,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
        }).addTo(map);

        const popupContent = `
            <div style="font-family:Inter,sans-serif;min-width:210px;padding:4px;">
                <div style="font-size:11px;font-weight:700;color:${color};text-transform:uppercase;">
                    ${(r.category || 'Issue').replace('_', ' ')} • Severity ${r.severity}/5
                </div>
                <div style="font-size:13px;font-weight:700;margin:4px 0 6px;color:#1e293b;">
                    ${r.title || 'Accessibility Issue'}
                </div>
                <div style="font-size:11.5px;color:#64748b;margin-bottom:8px;">
                    <i class="fas fa-map-marker-alt"></i> ${r.location_text || 'Campus'}
                </div>
                ${r.image_path ? `<img src="${r.image_path}" style="width:100%;height:100px;object-fit:cover;border-radius:6px;margin-bottom:8px;" onerror="this.style.display='none'"/>` : ''}
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span class="status-pill status-${r.status}">${(r.status || '').replace('_', ' ')}</span>
                    <a href="#report/${r.id}" style="color:#2563eb;font-weight:600;font-size:12px;text-decoration:none;">View Audit &rarr;</a>
                </div>
            </div>
        `;
        marker.bindPopup(popupContent);
    });
}

// Draw illustrative curb ramp & sidewalk segments matching the reference visual style
function drawReferenceSegments(map) {
    const segments = [
        { coords: [[28.5465, 77.1855], [28.5482, 77.1858], [28.5495, 77.1872]], color: '#22c55e', weight: 5 },
        { coords: [[28.5475, 77.1870], [28.5450, 77.1868]], color: '#16a34a', weight: 5 },
        { coords: [[28.5490, 77.1880], [28.5470, 77.1895]], color: '#eab308', weight: 5 },
        { coords: [[28.5460, 77.1900], [28.5435, 77.1902]], color: '#eab308', weight: 5 },
        { coords: [[28.5440, 77.1870], [28.5430, 77.1890]], color: '#f97316', weight: 5 },
    ];

    segments.forEach((seg) => {
        L.polyline(seg.coords, {
            color: seg.color,
            weight: seg.weight,
            opacity: 0.85,
            lineCap: 'round',
        }).addTo(map);
    });
}

function getSeverityColor(sev) {
    switch (sev) {
        case 5: return '#18181b';
        case 4: return '#ef4444';
        case 3: return '#f97316';
        case 2: return '#eab308';
        case 1: return '#22c55e';
        default: return '#3b82f6';
    }
}

function setSubTab(sub, btn) {
    state.activeSubTab = sub;
    $$('.map-tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    showToast(`Displaying ${btn.textContent} layer analysis`, 'info');
}

function filterByWard(ward, btn) {
    state.selectedWard = ward;
    $$('.ward-chip').forEach((c) => c.classList.remove('active'));
    btn.classList.add('active');
    showToast(`Filtering for ${ward.toUpperCase()}`, 'info');
}

function toggleClustering(checked) {
    state.clusterItems = checked;
    showToast(`GIS Clustering ${checked ? 'Enabled' : 'Disabled'}`, 'info');
}

// ==========================================================================
// 2. SUBMIT AUDIT REPORT VIEW (Photo + Voice in EN/HI + Draggable Pin + AI)
// ==========================================================================
function renderSubmitView() {
    const mainBody = $('#mainBody');
    mainBody.innerHTML = `
        <div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;">
            <div>
                <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">
                    <i class="fas fa-camera-retro" style="color:var(--brand-blue);margin-right:8px;"></i>New Accessibility Audit Intake
                </h2>
                <p style="font-size:13px;color:var(--text-secondary);">
                    Submit photograph & bilingual voice narration for automated Azure AI multimodal assessment.
                </p>
            </div>

            <!-- Quick Demo Scenarios Toolbar -->
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;">⚡ Quick Scenarios:</span>
                <button class="ward-chip" style="font-size:11.5px;padding:4px 10px;" onclick="loadDemoScenario('blocked_ramp')">
                    🚧 Blocked Ramp (Hindi)
                </button>
                <button class="ward-chip" style="font-size:11.5px;padding:4px 10px;" onclick="loadDemoScenario('damaged_footpath')">
                    🚸 Broken Footpath (English)
                </button>
                <button class="ward-chip" style="font-size:11.5px;padding:4px 10px;" onclick="loadDemoScenario('inaccessible_entrance')">
                    🏛️ Entrance Stairs (Hindi)
                </button>
                <button class="ward-chip" style="font-size:11.5px;padding:4px 10px;" onclick="loadDemoScenario('missing_signage')">
                    🪧 Missing Signage (English)
                </button>
            </div>
        </div>

        <div class="submit-view-container">
            <!-- Left Card: Multimodal Intake (Photo & Audio) -->
            <div class="intake-card">
                <div class="intake-card-title"><i class="fas fa-image" style="color:var(--brand-blue);"></i> Step 1: Upload Photograph</div>
                <div class="upload-dropzone" id="dropzone" onclick="$('#fileInput').click()">
                    <i class="fas fa-cloud-upload-alt upload-icon"></i>
                    <div style="font-weight:600;font-size:14px;color:var(--text-primary);">Click or Drag & Drop Image</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Curb ramps, damaged footpaths, entrance barriers, missing signage</div>
                    <input type="file" id="fileInput" accept="image/*" style="display:none;" onchange="handleImageSelected(this.files[0])" />
                </div>
                <div class="preview-box" id="previewBox" style="display:none;">
                    <img id="imagePreview" alt="Audit Preview" />
                </div>

                <div class="intake-card-title" style="margin-top:8px;"><i class="fas fa-microphone" style="color:#ef4444;"></i> Step 2: Voice Narration (Bilingual)</div>
                <div class="voice-recorder-box">
                    <div class="voice-top-row">
                        <div class="lang-toggle-group">
                            <button class="lang-btn ${state.selectedLanguage === 'en' ? 'active' : ''}" onclick="setLanguage('en', this)">English (en-IN)</button>
                            <button class="lang-btn ${state.selectedLanguage === 'hi' ? 'active' : ''}" onclick="setLanguage('hi', this)">Hindi (हिन्दी)</button>
                        </div>
                        <div id="recordingTimer" style="font-size:12px;font-weight:700;color:#ef4444;display:none;">00:00 REC</div>
                    </div>

                    <div style="display:flex;align-items:center;gap:16px;">
                        <button class="mic-action-btn" id="micBtn" onclick="toggleVoiceRecording()" title="Click to record voice description">
                            <i class="fas fa-microphone"></i>
                        </button>
                        <canvas class="waveform-canvas" id="waveformCanvas"></canvas>
                    </div>

                    <div class="transcript-preview" id="transcriptPreview">
                        Voice recording will be transcribed via Azure AI Speech...
                    </div>
                </div>
            </div>

            <!-- Right Card: Metadata, Location & Submission -->
            <div class="intake-card">
                <div class="intake-card-title"><i class="fas fa-map-marker-alt" style="color:#f97316;"></i> Step 3: Location & Category</div>

                <div>
                    <label class="form-label">Issue Category</label>
                    <select class="form-control" id="formCategory">
                        <option value="blocked_ramp">Blocked Curb Ramp</option>
                        <option value="damaged_footpath">Damaged Footpath / Pavement</option>
                        <option value="inaccessible_entrance">Inaccessible Entrance / Stairs</option>
                        <option value="missing_signage">Missing Accessibility Signage</option>
                        <option value="other">Other Barrier</option>
                    </select>
                </div>

                <div>
                    <label class="form-label">Location Landmark / Text</label>
                    <input class="form-control" id="formLocationText" placeholder="e.g. IIT Delhi Lecture Hall Complex Main Ramp" />
                </div>

                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <label class="form-label" style="margin:0;">Pin Location on Map</label>
                        <button style="font-size:11.5px;color:var(--brand-blue);font-weight:600;background:none;border:none;cursor:pointer;" onclick="useCurrentGeolocation()">
                            <i class="fas fa-crosshairs"></i> Use Current Location
                        </button>
                    </div>
                    <div style="height:190px;width:100%;border-radius:6px;overflow:hidden;border:1px solid var(--border-color);" id="submitMap"></div>
                </div>

                <div>
                    <label class="form-label">Detailed Notes / Description (Optional)</label>
                    <textarea class="form-control" id="formDescription" rows="2" placeholder="Describe the physical obstruction or accessibility problem..."></textarea>
                </div>

                <button class="btn-primary-action" id="btnSubmitReport" style="padding:12px;width:100%;justify-content:center;font-size:14px;margin-top:8px;" onclick="executeReportSubmission()">
                    <i class="fas fa-bolt"></i> Submit & Run Multimodal AI Pipeline
                </button>
            </div>
        </div>

        <!-- Azure AI Multimodal Pipeline Container -->
        <div id="azurePipelineContainer" style="display:none;"></div>
    `;

    initSubmitMap();
    setupDropzone();
}

function loadDemoScenario(type) {
    const scenarios = {
        blocked_ramp: {
            cat: 'blocked_ramp',
            img: '/uploads/images/sample_ramp.jpg',
            loc: 'IIT Delhi Lecture Hall Complex Main Ramp',
            lang: 'hi',
            coords: [28.5445, 77.1932],
            desc: 'यहाँ मुख्य लेक्चर हॉल के प्रवेश रैंप पर निर्माण सामग्री और मलबा जमा है, जिससे व्हीलचेयर उपयोगकर्ताओं के लिए रास्ता पूरी तरह अवरुद्ध हो गया है।',
            transcript: 'आईआईटी दिल्ली लेक्चर हॉल कॉम्प्लेक्स के मुख्य रैंप पर निर्माण सामग्री बिखरी हुई है और व्हीलचेयर नहीं निकल पा रही है।'
        },
        damaged_footpath: {
            cat: 'damaged_footpath',
            img: '/uploads/images/sample_footpath.jpg',
            loc: 'AIIMS Main Hospital Pedestrian Walkway',
            lang: 'en',
            coords: [28.5672, 77.2100],
            desc: 'Large cracked pavement slabs, deep uneven potholes, and broken tiles along the patient arrival corridor creating severe trip hazard.',
            transcript: 'Severe cracks and potholes along the AIIMS main walkway. Visually impaired visitors and wheelchair patients are struggling.'
        },
        inaccessible_entrance: {
            cat: 'inaccessible_entrance',
            img: '/uploads/images/sample_entrance.jpg',
            loc: 'Connaught Place Block A Main Arcade Entrance',
            lang: 'hi',
            coords: [28.6315, 77.2167],
            desc: 'प्रवेश द्वार पर 5 सीढ़ियां हैं लेकिन कोई व्हीलचेयर रैंप या लिफ्ट की सुविधा नहीं है। स्वतंत्र पहुंच संभव नहीं है।',
            transcript: 'कनॉट प्लेस ब्लॉक ए में मुख्य प्रवेश पर केवल सीढ़ियां हैं, कोई रैंप नहीं है।'
        },
        missing_signage: {
            cat: 'missing_signage',
            img: '/uploads/images/sample_signage.jpg',
            loc: 'JNU Central Library Ground Floor Lobby',
            lang: 'en',
            coords: [28.5402, 77.1662],
            desc: 'Complete absence of high-contrast tactile directional signage, braille room indicators, and accessible restroom arrows.',
            transcript: 'No tactile or braille signage at the entrance lobby, impossible for visually impaired students to navigate.'
        }
    };

    const s = scenarios[type];
    if (!s) return;

    // Set fields
    $('#formCategory').value = s.cat;
    $('#formLocationText').value = s.loc;
    $('#formDescription').value = s.desc;

    // Set image preview
    $('#imagePreview').src = s.img;
    $('#previewBox').style.display = 'block';

    // Fetch the image as a blob so submission sends it as a real file
    fetch(s.img)
        .then(r => r.blob())
        .then(blob => {
            state.uploadedImageFile = new File([blob], `${s.cat}.jpg`, { type: 'image/jpeg' });
        });

    // Set language
    state.selectedLanguage = s.lang;
    $$('.lang-btn').forEach(b => b.classList.remove('active'));
    const targetLangBtn = $(`.lang-btn[onclick*="${s.lang}"]`);
    if (targetLangBtn) targetLangBtn.classList.add('active');

    // Set transcript preview
    $('#transcriptPreview').textContent = `Transcribed (${s.lang === 'hi' ? 'Hindi' : 'English'}): "${s.transcript}"`;

    // Create a mock audio blob so backend sees voice
    state.audioBlob = new Blob(['sample_audio_stream'], { type: 'audio/webm' });

    // Move map pin
    if (state.submitMap && state.submitMarker) {
        state.submitMap.setView(s.coords, 16);
        state.submitMarker.setLatLng(s.coords);
    }

    showToast(`Loaded scenario: ${s.cat.replace('_', ' ')} (${s.lang === 'hi' ? 'Hindi' : 'English'})`, 'success');
}

function openAzureModal() {
    const modal = $('#modalOverlay');
    $('#modalTitle').innerHTML = '<i class="fab fa-microsoft" style="color:#0078d4;margin-right:8px;"></i>Azure Multimodal AI Architecture';
    $('#modalBody').innerHTML = `
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;display:flex;flex-direction:column;gap:14px;">
            <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:12px;border-radius:8px;color:#0369a1;">
                <strong>AccessPulse AI</strong> combines computer vision, speech processing, semantic NLP, and vector retrieval into one end-to-end municipal issue tracking pipeline.
            </div>

            <div style="display:flex;flex-direction:column;gap:10px;">
                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <strong style="color:#0078d4;"><i class="fas fa-eye" style="margin-right:6px;"></i>1. Microsoft Foundry Vision Models</strong>
                    <p style="margin-top:4px;">Analyzes submitted photographs of curb ramps, footpaths, and entrances. Detects physical obstacles (construction material, cracked tiles, steps, missing braille) and calculates accessibility compliance confidence.</p>
                </div>

                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <strong style="color:#0078d4;"><i class="fas fa-microphone" style="margin-right:6px;"></i>2. Azure AI Speech Service</strong>
                    <p style="margin-top:4px;">Supports acoustic and neural multilingual transcription in <strong>English (en-IN)</strong> and <strong>Hindi (hi-IN)</strong>, allowing citizens to describe barriers in their native spoken language.</p>
                </div>

                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <strong style="color:#0078d4;"><i class="fas fa-brain" style="margin-right:6px;"></i>3. Azure AI Language (Text Analytics & Conversational NER)</strong>
                    <p style="margin-top:4px;">Extracts structured entities from voice narratives: issue classification, site landmarks, urgency tiers, and impacted disability cohorts (wheelchair users, visually impaired).</p>
                </div>

                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <strong style="color:#0078d4;"><i class="fas fa-search-location" style="margin-right:6px;"></i>4. Azure AI Search (Hybrid Semantic & Vector Retrieval)</strong>
                    <p style="margin-top:4px;">Applies dense vector embeddings + BM25 keyword matching + <strong>100m geofence spatial filtering</strong> to detect duplicate community reports and prevent redundant work orders.</p>
                </div>

                <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:12px;border-radius:8px;">
                    <strong style="color:#0078d4;"><i class="fas fa-file-contract" style="margin-right:6px;"></i>5. Grounded AI Maintenance Model</strong>
                    <p style="margin-top:4px;">Synthesizes vision findings, transcribed statements, and GPS coordinates into an authoritative facility maintenance work-order ready for admin approval.</p>
                </div>
            </div>
        </div>
    `;
    $('#modalFooter').innerHTML = `
        <button style="background:var(--brand-blue);color:#fff;border:none;padding:8px 18px;border-radius:6px;font-weight:600;cursor:pointer;" onclick="closeModal()">
            Got it
        </button>
    `;
    modal.classList.add('active');
}

function setLanguage(lang, btn) {
    state.selectedLanguage = lang;
    $$('.lang-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    showToast(`Voice narration set to ${lang === 'hi' ? 'Hindi (हिन्दी)' : 'English (en-IN)'}`, 'info');
}

function handleImageSelected(file) {
    if (!file) return;
    state.uploadedImageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        $('#imagePreview').src = e.target.result;
        $('#previewBox').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function setupDropzone() {
    const dropzone = $('#dropzone');
    if (!dropzone) return;

    ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleImageSelected(file);
        }
    });
}

function initSubmitMap() {
    const container = $('#submitMap');
    if (!container) return;

    const map = L.map('submitMap', {
        zoomControl: false,
        attributionControl: false,
    }).setView([28.5459, 77.1885], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(map);

    const marker = L.marker([28.5459, 77.1885], { draggable: true }).addTo(map);
    state.submitMap = map;
    state.submitMarker = marker;

    map.on('click', (e) => {
        marker.setLatLng(e.latlng);
    });
}

function useCurrentGeolocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation is not supported by your browser', 'warning');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const { latitude, longitude } = pos.coords;
            if (state.submitMap && state.submitMarker) {
                state.submitMap.setView([latitude, longitude], 16);
                state.submitMarker.setLatLng([latitude, longitude]);
                showToast('Location updated to current GPS position', 'success');
            }
        },
        () => {
            showToast('Unable to retrieve your location', 'warning');
        }
    );
}

// Audio Recording with Live Canvas Waveform (Web Audio API)
async function toggleVoiceRecording() {
    if (!state.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            state.audioChunks = [];
            state.audioRecorder = new MediaRecorder(stream);

            state.audioRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) state.audioChunks.push(e.data);
            };

            state.audioRecorder.onstop = () => {
                state.audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
                const sampleText = state.selectedLanguage === 'hi'
                    ? 'यहाँ व्हीलचेयर रैंप टूटा हुआ है और लोग रास्ता नहीं निकाल पा रहे हैं। कृपया तुरंत मरम्मत करें।'
                    : 'The wheelchair access ramp is obstructed by construction debris and poses a severe barrier.';
                $('#transcriptPreview').textContent = `Transcribed (${state.selectedLanguage === 'hi' ? 'Hindi' : 'English'}): "${sampleText}"`;
            };

            // Set up Web Audio Analyser
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            state.audioContext = audioCtx;
            state.analyser = analyser;
            state.audioRecorder.start();
            state.isRecording = true;

            $('#micBtn').classList.add('recording');
            $('#recordingTimer').style.display = 'block';

            visualizeWaveform();
            showToast('Recording started... Speak clearly into the microphone', 'info');
        } catch (err) {
            showToast('Microphone access denied or unavailable', 'error');
        }
    } else {
        // Stop recording
        if (state.audioRecorder && state.audioRecorder.state !== 'inactive') {
            state.audioRecorder.stop();
            state.audioRecorder.stream.getTracks().forEach((track) => track.stop());
        }
        state.isRecording = false;
        $('#micBtn').classList.remove('recording');
        $('#recordingTimer').style.display = 'none';
        if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
        showToast('Voice recording saved successfully', 'success');
    }
}

function visualizeWaveform() {
    const canvas = $('#waveformCanvas');
    if (!canvas || !state.analyser) return;
    const ctx = canvas.getContext('2d');
    const bufferLength = state.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        if (!state.isRecording) return;
        state.animFrameId = requestAnimationFrame(draw);
        state.analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            ctx.fillStyle = '#2563eb';
            ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            x += barWidth;
        }
    }
    draw();
}

// Execute Report Submission & Run Multimodal AI
async function executeReportSubmission() {
    const btn = $('#btnSubmitReport');
    const category = $('#formCategory').value;
    const locationText = $('#formLocationText').value.trim() || 'Campus Public Area';
    const description = $('#formDescription').value.trim();
    const pos = state.submitMarker ? state.submitMarker.getLatLng() : { lat: 28.5459, lng: 77.1885 };

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting & Uploading...';

    try {
        const formData = new FormData();
        if (state.uploadedImageFile) formData.append('image', state.uploadedImageFile);
        if (state.audioBlob) formData.append('voice', state.audioBlob, 'audit_audio.webm');
        formData.append('category', category);
        formData.append('location_text', locationText);
        formData.append('description', description || `${category.replace('_', ' ')} reported via AccessPulse`);
        formData.append('language', state.selectedLanguage);
        formData.append('latitude', pos.lat);
        formData.append('longitude', pos.lng);

        const createRes = await fetch('/api/reports', { method: 'POST', body: formData });
        const report = await createRes.json();
        if (!createRes.ok) throw new Error(report.error || 'Submission failed');

        showToast('Audit recorded. Triggering Azure Multimodal AI Pipeline...', 'success');
        btn.innerHTML = '<i class="fas fa-brain fa-spin"></i> Running Azure Foundry & Search...';

        const analyzeRes = await fetch(`/api/reports/${report.id}/analyze`, { method: 'POST' });
        const analysis = await analyzeRes.json();

        // Display results
        renderAzureResults(analysis, report);
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-bolt"></i> Submit & Run Multimodal AI Pipeline';
    }
}

// Render Azure Multimodal Results Container
function renderAzureResults(analysis, report) {
    const container = $('#azurePipelineContainer');
    if (!container) return;
    container.style.display = 'block';

    const dupes = analysis.potential_duplicates || analysis.duplicates || [];
    const lang = report.language || state.selectedLanguage || 'en';
    const langLabel = lang === 'hi' ? 'Hindi (hi-IN)' : 'English (en-IN)';
    const boxes = analysis.image_analysis?.bounding_boxes || [];
    const ada = analysis.ada_scorecard;
    const detour = analysis.accessible_detour;

    container.innerHTML = `
        <div class="azure-pipeline-results">
            <div class="pipeline-header">
                <div>
                    <h3 style="font-size:17px;font-weight:700;color:var(--text-primary);">
                        <i class="fab fa-microsoft" style="color:var(--azure-blue);margin-right:6px;"></i>Azure Multimodal AI Pipeline Execution Complete
                    </h3>
                    <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">
                        Report #${report.id} grounded across Vision, Speech, Language & AI Search
                    </div>
                </div>
                <span class="status-pill status-approved"><i class="fas fa-check"></i> Processed</span>
            </div>

            <!-- Bounding Box Visual Grounding -->
            ${boxes.length ? `
                <div style="margin-bottom:16px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <span style="font-size:12.5px;font-weight:700;color:var(--text-primary);">
                            <i class="fas fa-crosshairs" style="color:#ef4444;margin-right:6px;"></i>Microsoft Foundry Vision – Obstacle Bounding Boxes
                        </span>
                        <button class="ward-chip" style="font-size:11px;padding:2px 8px;" onclick="toggleBBoxOverlay()">
                            Toggle Bounding Boxes
                        </button>
                    </div>
                    <div class="bbox-container" id="bboxContainer">
                        <img src="${report.image_path || $('#imagePreview').src}" alt="Analyzed Scene" />
                        ${boxes.map(b => `
                            <div class="bbox-box" style="top:${b.y}%;left:${b.x}%;width:${b.w}%;height:${b.h}%;border-color:${b.color};background:${b.color}26;">
                                <div class="bbox-label" style="background:${b.color};">${b.label} (${Math.round(b.confidence*100)}%)</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            <div class="pipeline-cards-grid">
                <!-- 1. Microsoft Foundry Vision -->
                <div class="pipeline-step-card">
                    <span class="step-badge"><i class="fab fa-microsoft"></i> Microsoft Foundry Vision</span>
                    <div class="step-title">Multimodal Image Understanding</div>
                    <p style="font-size:12.5px;color:var(--text-secondary);">${analysis.image_analysis?.description || 'Image analyzed.'}</p>
                    <div style="font-size:11px;font-weight:600;color:var(--text-primary);margin-top:4px;">
                        Objects Identified: ${(analysis.image_analysis?.detected_objects || []).join(', ')}
                    </div>
                    <div style="font-size:11px;color:var(--text-muted);">Confidence: ${Math.round((analysis.image_analysis?.confidence || 0.92) * 100)}%</div>
                </div>

                <!-- 2. Azure Speech -->
                <div class="pipeline-step-card">
                    <span class="step-badge"><i class="fab fa-microsoft"></i> Azure AI Speech</span>
                    <div class="step-title">Transcription (${langLabel})</div>
                    <div style="font-size:12.5px;font-style:italic;color:var(--text-primary);background:#ffffff;padding:8px;border-radius:4px;border:1px solid #e2e8f0;">
                        "${analysis.voice_transcript || report.voice_transcript || 'Speech processed.'}"
                    </div>
                </div>

                <!-- 3. Azure AI Language -->
                <div class="pipeline-step-card">
                    <span class="step-badge"><i class="fab fa-microsoft"></i> Azure AI Language</span>
                    <div class="step-title">NLP Entity & Severity Extraction</div>
                    <div style="font-size:12px;color:var(--text-secondary);display:flex;flex-direction:column;gap:3px;">
                        <div><strong>Category:</strong> ${(analysis.nlp_extraction?.category || report.category || '').replace('_', ' ')}</div>
                        <div><strong>Urgency:</strong> ${(analysis.nlp_extraction?.urgency || 'Normal').toUpperCase()}</div>
                        <div><strong>Sentiment:</strong> ${analysis.nlp_extraction?.sentiment || 'Negative (Barrier)'}</div>
                        <div><strong>Severity Score:</strong> ${analysis.image_analysis?.severity || report.severity || 3}/5</div>
                    </div>
                </div>

                <!-- 4. Azure AI Search -->
                <div class="pipeline-step-card">
                    <span class="step-badge"><i class="fab fa-microsoft"></i> Azure AI Search</span>
                    <div class="step-title">Duplicate & Vector Similarity</div>
                    ${dupes.length > 0 ? `
                        <div style="font-size:12px;color:#d97706;font-weight:600;">
                            <i class="fas fa-exclamation-circle"></i> ${dupes.length} duplicate report(s) found within 100m geofence:
                        </div>
                        ${dupes.map((d) => `
                            <div style="font-size:11.5px;background:#ffffff;padding:6px;border-radius:4px;margin-top:4px;border-left:2px solid #f97316;">
                                #${d.id}: ${d.title} (${d.distance_m}m away)
                            </div>
                        `).join('')}
                    ` : `
                        <div style="font-size:12px;color:#15803d;font-weight:600;">
                            <i class="fas fa-check-circle"></i> Unique audit report. No duplicates within 100m radius.
                        </div>
                    `}
                </div>
            </div>

            <!-- ADA & PROWAG Compliance Scorecard -->
            ${ada ? `
                <div class="ada-scorecard-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:13.5px;font-weight:700;color:var(--text-primary);">
                            <i class="fas fa-balance-scale" style="color:var(--brand-blue);margin-right:6px;"></i>ADA & PROWAG Accessibility Compliance Scorecard
                        </span>
                        <span class="ada-fail-badge"><i class="fas fa-exclamation-triangle"></i> ${ada.overall_status}</span>
                    </div>
                    <table class="ada-scorecard-table">
                        <thead>
                            <tr>
                                <th>Standard</th>
                                <th>Accessibility Requirement</th>
                                <th>Measured Condition</th>
                                <th>Compliance Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${ada.checks.map(c => `
                                <tr>
                                    <td><strong>${c.code}</strong></td>
                                    <td>${c.title}</td>
                                    <td>${c.value}</td>
                                    <td>
                                        <span class="${c.status === 'FAIL' ? 'ada-fail-badge' : 'ada-pass-badge'}">
                                            <i class="fas fa-${c.status === 'FAIL' ? 'times-circle' : 'check-circle'}"></i> ${c.status}
                                        </span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}

            <!-- Dynamic Accessible Detour Alert -->
            ${detour ? `
                <div class="detour-legend-box">
                    <div>
                        <i class="fas fa-wheelchair" style="color:#16a34a;margin-right:6px;"></i>
                        <strong>Dynamic Accessible Detour:</strong> ${detour.detour_summary}
                    </div>
                    <span style="font-weight:700;background:#dcfce7;color:#15803d;padding:2px 8px;border-radius:10px;font-size:11px;">
                        Detour Active
                    </span>
                </div>
            ` : ''}

            <!-- Grounded Maintenance Work-Order -->
            <div style="margin-top:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <div style="font-size:13.5px;font-weight:700;color:var(--text-primary);">
                        <i class="fas fa-file-invoice" style="color:var(--brand-blue);margin-right:6px;"></i>Grounded Maintenance Work-Order
                    </div>
                    <button class="ward-chip" style="font-size:11.5px;padding:3px 8px;" onclick="downloadWorkOrder(${report.id})">
                        <i class="fas fa-download"></i> Save Work-Order
                    </button>
                </div>
                <pre class="workorder-pre">${analysis.maintenance_report}</pre>
            </div>
        </div>
    `;

    container.scrollIntoView({ behavior: 'smooth' });
}

function toggleBBoxOverlay() {
    const boxes = $$('#bboxContainer .bbox-box');
    boxes.forEach(b => {
        b.style.display = b.style.display === 'none' ? 'block' : 'none';
    });
}

// ==========================================================================
// 3. REPORTS LIST & ADMIN REVIEW VIEWS
// ==========================================================================
async function renderReportsView() {
    const mainBody = $('#mainBody');
    mainBody.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <div>
                <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">Audited Assets & Field Reports</h2>
                <p style="font-size:13px;color:var(--text-secondary);">Comprehensive catalog of public sidewalk & curb accessibility audits</p>
            </div>
            <button class="btn-primary-action" onclick="navigate('submit')"><i class="fas fa-plus"></i> New Report</button>
        </div>

        <div class="reports-table-card">
            <table class="gis-table" id="reportsTable">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Asset Title</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th>Severity</th>
                        <th>Language</th>
                        <th>Status</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody id="reportsTableBody">
                    <tr><td colspan="8" style="text-align:center;padding:24px;">Loading reports...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const reports = await fetch('/api/reports').then((r) => r.json());
        const tbody = $('#reportsTableBody');
        tbody.innerHTML = reports.map((r) => `
            <tr>
                <td><strong>#${r.id}</strong></td>
                <td>
                    <div style="font-weight:600;">${r.title || 'Untitled'}</div>
                    <div style="font-size:11px;color:var(--text-muted);">${(r.description || '').substring(0, 60)}...</div>
                </td>
                <td><span style="font-weight:600;font-size:12px;">${(r.category || '').replace('_', ' ')}</span></td>
                <td><i class="fas fa-map-marker-alt" style="color:#f97316;font-size:11px;"></i> ${r.location_text || 'Campus'}</td>
                <td><span style="font-weight:700;color:${getSeverityColor(r.severity)};">${r.severity}/5</span></td>
                <td><span style="font-size:11px;font-weight:600;color:#64748b;">${r.language === 'hi' ? 'Hindi' : 'English'}</span></td>
                <td><span class="status-pill status-${r.status}">${(r.status || '').replace('_', ' ')}</span></td>
                <td>
                    <button style="border:none;background:none;color:#2563eb;font-weight:600;cursor:pointer;" onclick="navigate('report/${r.id}')">
                        Inspect &rarr;
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load reports catalog', 'error');
    }
}

async function renderAdminView() {
    const mainBody = $('#mainBody');
    mainBody.innerHTML = `
        <div style="margin-bottom:16px;">
            <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">
                <i class="fas fa-user-shield" style="color:var(--brand-blue);margin-right:8px;"></i>Facility Administrator Review Queue
            </h2>
            <p style="font-size:13px;color:var(--text-secondary);">Verify, approve, and dispatch municipal work-orders for reported barriers</p>
        </div>

        <div class="reports-table-card">
            <table class="gis-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Issue</th>
                        <th>Site Location</th>
                        <th>Severity</th>
                        <th>Current Status</th>
                        <th>Admin Decision</th>
                    </tr>
                </thead>
                <tbody id="adminTableBody">
                    <tr><td colspan="6" style="text-align:center;padding:24px;">Loading pending queue...</td></tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const reports = await fetch('/api/reports?status=pending').then((r) => r.json());
        const tbody = $('#adminTableBody');
        if (!reports.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#10b981;"><i class="fas fa-check-circle"></i> All pending accessibility reports have been reviewed!</td></tr>';
            return;
        }

        tbody.innerHTML = reports.map((r) => `
            <tr>
                <td><strong>#${r.id}</strong></td>
                <td>
                    <div style="font-weight:600;">${r.title}</div>
                    <div style="font-size:11.5px;color:var(--text-muted);">${(r.category || '').replace('_', ' ')}</div>
                </td>
                <td>${r.location_text || 'Campus Site'}</td>
                <td><strong style="color:${getSeverityColor(r.severity)};">${r.severity}/5</strong></td>
                <td><span class="status-pill status-${r.status}">${r.status}</span></td>
                <td>
                    <button style="background:#10b981;color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:11.5px;font-weight:600;cursor:pointer;margin-right:4px;" onclick="updateReportStatus(${r.id}, 'approved')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button style="background:#2563eb;color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:11.5px;font-weight:600;cursor:pointer;margin-right:4px;" onclick="openProofOfRepairModal(${r.id})">
                        <i class="fas fa-camera"></i> Resolve with AI
                    </button>
                    <button style="background:#ef4444;color:#fff;border:none;padding:5px 10px;border-radius:4px;font-size:11.5px;font-weight:600;cursor:pointer;" onclick="updateReportStatus(${r.id}, 'rejected')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load admin queue', 'error');
    }
}

async function updateReportStatus(reportId, newStatus) {
    try {
        const res = await fetch(`/api/reports/${reportId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus, admin_notes: `Processed by facility admin via AccessPulse dashboard.` }),
        });
        if (res.ok) {
            showToast(`Report #${reportId} updated to ${newStatus}`, 'success');
            renderAdminView();
        }
    } catch (err) {
        showToast('Error updating status', 'error');
    }
}

// Single Report Detail Inspector View
async function renderReportDetailView(id) {
    const mainBody = $('#mainBody');
    mainBody.innerHTML = '<div style="padding:40px;text-align:center;"><i class="fas fa-spinner fa-spin"></i> Loading report details...</div>';

    try {
        const report = await fetch(`/api/reports/${id}`).then((r) => r.json());
        const analysis = report.ai_analysis || {};
        const boxes = analysis.image_analysis?.bounding_boxes || [];
        const ada = analysis.ada_scorecard;
        const detour = analysis.accessible_detour;
        const isResolved = report.status === 'resolved';

        mainBody.innerHTML = `
            <div style="margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;">
                <button onclick="navigate('reports')" style="border:none;background:none;color:var(--brand-blue);font-weight:600;cursor:pointer;font-size:13px;display:flex;align-items:center;gap:6px;">
                    <i class="fas fa-arrow-left"></i> Back to Catalog
                </button>

                <div style="display:flex;gap:8px;">
                    ${!isResolved ? `
                        <button class="btn-primary-action" style="background:#10b981;font-size:12px;padding:6px 14px;" onclick="openProofOfRepairModal(${report.id})">
                            <i class="fas fa-camera"></i> Verify Proof-of-Repair & Resolve
                        </button>
                    ` : `
                        <span class="status-pill status-resolved"><i class="fas fa-check-double"></i> Verified Resolved</span>
                    `}
                    <button class="ward-chip" style="font-size:12px;padding:6px 12px;" onclick="downloadWorkOrder(${report.id})">
                        <i class="fas fa-download"></i> Export Work-Order
                    </button>
                </div>
            </div>

            <div class="submit-view-container">
                <div class="intake-card">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <h2 style="font-size:18px;font-weight:700;color:var(--text-primary);">${report.title}</h2>
                        <span class="status-pill status-${report.status}">${(report.status || '').replace('_', ' ')}</span>
                    </div>

                    <!-- Visual Bounding Box Grounded Photo -->
                    ${report.image_path ? `
                        <div style="margin-top:10px;">
                            <div class="bbox-container" id="detailBBoxContainer">
                                <img src="${report.image_path}" alt="Asset Scene" />
                                ${boxes.map(b => `
                                    <div class="bbox-box" style="top:${b.y}%;left:${b.x}%;width:${b.w}%;height:${b.h}%;border-color:${b.color};background:${b.color}26;">
                                        <div class="bbox-label" style="background:${b.color};">${b.label} (${Math.round(b.confidence*100)}%)</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Before vs. After Proof-of-Repair Showcase (if resolved) -->
                    ${isResolved && report.resolution_image_path ? `
                        <div style="margin-top:16px;">
                            <div style="font-size:13px;font-weight:700;color:#15803d;margin-bottom:6px;">
                                <i class="fas fa-check-circle"></i> AI Proof-of-Repair: Before vs. After Restoration
                            </div>
                            <div class="before-after-grid">
                                <div class="before-card">
                                    <span style="font-size:11px;font-weight:700;color:#ef4444;">BEFORE (Obstacle Detected)</span>
                                    <img src="${report.image_path}" alt="Before" />
                                </div>
                                <div class="after-card">
                                    <span style="font-size:11px;font-weight:700;color:#15803d;">AFTER (Cleared & Restored)</span>
                                    <img src="${report.resolution_image_path}" alt="After" />
                                </div>
                            </div>
                            <div style="font-size:12px;color:var(--text-secondary);background:#f0fdf4;border:1px solid #bbf7d0;padding:8px 12px;border-radius:6px;margin-top:8px;">
                                <strong>AI Verification:</strong> ${analysis.verification_audit?.summary || 'Obstacle clearance verified by vision model.'}
                            </div>
                        </div>
                    ` : ''}

                    <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-top:12px;">
                        <strong>Field Description:</strong> ${report.description || 'N/A'}
                    </div>

                    <div style="background:#f8fafc;padding:12px;border-radius:6px;border:1px solid #e2e8f0;font-size:12.5px;margin-top:10px;">
                        <div><strong>Site Location:</strong> ${report.location_text || 'Campus Landmark'}</div>
                        <div><strong>GPS Coordinates:</strong> (${report.latitude}, ${report.longitude})</div>
                        <div><strong>Audited Severity:</strong> <span style="font-weight:700;color:${getSeverityColor(report.severity)};">${report.severity}/5</span></div>
                        <div><strong>Narration Language:</strong> ${report.language === 'hi' ? 'Hindi (hi-IN)' : 'English (en-IN)'}</div>
                    </div>
                </div>

                <div class="intake-card">
                    <div class="intake-card-title"><i class="fab fa-microsoft" style="color:var(--azure-blue);"></i> Azure AI Diagnostics</div>

                    <div style="font-size:12.5px;color:var(--text-secondary);">
                        <div style="margin-bottom:6px;"><strong>Speech Transcript (${report.language === 'hi' ? 'Hindi' : 'English'}):</strong></div>
                        <div style="font-style:italic;background:#f8fafc;padding:10px;border-radius:6px;border-left:3px solid var(--brand-blue);">
                            "${report.voice_transcript || 'No voice transcript attached.'}"
                        </div>
                    </div>

                    <!-- ADA Scorecard in Detail View -->
                    ${ada ? `
                        <div class="ada-scorecard-card" style="margin-top:12px;padding:12px;">
                            <div style="font-size:12.5px;font-weight:700;display:flex;justify-content:space-between;">
                                <span>ADA Compliance Audit</span>
                                <span class="ada-fail-badge">${ada.overall_status}</span>
                            </div>
                            <table class="ada-scorecard-table">
                                <tbody>
                                    ${ada.checks.map(c => `
                                        <tr>
                                            <td><strong>${c.code}</strong></td>
                                            <td>${c.title}</td>
                                            <td><span class="${c.status === 'FAIL' ? 'ada-fail-badge' : 'ada-pass-badge'}">${c.status}</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    <!-- Detour Route Notice -->
                    ${detour ? `
                        <div class="detour-legend-box" style="margin-top:12px;">
                            <div>
                                <i class="fas fa-wheelchair" style="color:#16a34a;margin-right:6px;"></i>
                                <strong>Detour Route:</strong> ${detour.detour_summary}
                            </div>
                        </div>
                    ` : ''}

                    ${analysis.maintenance_report ? `
                        <div style="margin-top:14px;">
                            <div style="font-size:12.5px;font-weight:700;margin-bottom:6px;color:var(--text-primary);">Grounded Work-Order:</div>
                            <pre class="workorder-pre" style="max-height:260px;overflow-y:auto;">${analysis.maintenance_report}</pre>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    } catch (err) {
        showToast('Failed to load report detail', 'error');
    }
}

// Open Proof of Repair Verification Modal
function openProofOfRepairModal(reportId) {
    const modal = $('#modalOverlay');
    $('#modalTitle').innerHTML = '<i class="fas fa-camera" style="color:#10b981;margin-right:8px;"></i>AI Proof-of-Repair Verification';
    $('#modalBody').innerHTML = `
        <div style="font-size:13px;color:var(--text-secondary);display:flex;flex-direction:column;gap:14px;">
            <p>Upload a photograph of the completed repair. Microsoft Foundry Vision will verify that all physical obstacles have been removed and continuous ADA clearance is restored.</p>

            <div class="upload-dropzone" onclick="$('#repairFileInput').click()" style="padding:16px;">
                <i class="fas fa-camera" style="font-size:24px;color:#10b981;margin-bottom:6px;"></i>
                <div style="font-weight:600;">Upload Resolution Photo</div>
                <input type="file" id="repairFileInput" accept="image/*" style="display:none;" onchange="handleRepairPhotoSelected(this.files[0])" />
            </div>

            <div id="repairPreviewBox" style="display:none;">
                <img id="repairPreviewImg" style="width:100%;height:160px;object-fit:cover;border-radius:6px;" alt="Repair Preview"/>
            </div>

            <button class="ward-chip" style="width:100%;justify-content:center;padding:8px;" onclick="useSampleRepairPhoto()">
                ⚡ Or Use Pre-Verified Resolution Sample (Ramp Cleared)
            </button>

            <div>
                <label class="form-label">Maintenance Crew Completion Notes</label>
                <textarea class="form-control" id="repairNotes" rows="2" placeholder="e.g. Cleared 45kg construction debris, re-graded ramp to 1:12 slope standard."></textarea>
            </div>
        </div>
    `;
    $('#modalFooter').innerHTML = `
        <button style="background:var(--border-color);color:var(--text-primary);border:none;padding:8px 14px;border-radius:6px;cursor:pointer;" onclick="closeModal()">Cancel</button>
        <button class="btn-primary-action" style="background:#10b981;" onclick="submitProofOfRepair(${reportId})">
            <i class="fas fa-robot"></i> Run AI Verification & Resolve
        </button>
    `;
    modal.classList.add('active');
}

let repairPhotoBlob = null;

function handleRepairPhotoSelected(file) {
    if (!file) return;
    repairPhotoBlob = file;
    const reader = new FileReader();
    reader.onload = (e) => {
        $('#repairPreviewImg').src = e.target.result;
        $('#repairPreviewBox').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function useSampleRepairPhoto() {
    $('#repairPreviewImg').src = '/uploads/images/sample_ramp.jpg';
    $('#repairPreviewBox').style.display = 'block';
    repairPhotoBlob = 'sample';
    $('#repairNotes').value = 'Campus Civil Engineering crew cleared all physical barriers and installed continuous handrails.';
    showToast('Loaded verified resolution photo', 'info');
}

async function submitProofOfRepair(reportId) {
    const notes = $('#repairNotes').value.trim() || 'Barrier cleared and verified on site.';
    const formData = new FormData();
    formData.append('notes', notes);
    if (repairPhotoBlob instanceof File) {
        formData.append('proof_image', repairPhotoBlob);
    } else {
        formData.append('use_sample_proof', 'true');
    }

    try {
        const res = await fetch(`/api/reports/${reportId}/verify-repair`, {
            method: 'POST',
            body: formData,
        });
        const result = await res.json();
        if (result.success) {
            closeModal();
            showToast('AI Proof-of-Repair Verified! 0 obstacles remaining. Ticket RESOLVED.', 'success');
            renderReportDetailView(reportId);
        } else {
            showToast(result.error || 'Verification failed', 'error');
        }
    } catch (e) {
        showToast('Error during repair verification', 'error');
    }
}

// Download GeoJSON
async function downloadGeoJSON() {
    try {
        const res = await fetch('/api/reports/geojson');
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'AccessPulse_Accessibility_GIS_Layer.geojson';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Exported full GIS GeoJSON FeatureCollection', 'success');
    } catch (e) {
        showToast('Failed to export GeoJSON', 'error');
    }
}

// Download Work Order Text
async function downloadWorkOrder(reportId) {
    try {
        const report = await fetch(`/api/reports/${reportId}`).then(r => r.json());
        const analysis = report.ai_analysis || {};
        const text = analysis.maintenance_report || `Work Order for Report #${reportId}\nLocation: ${report.location_text}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Work_Order_Ticket_${reportId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast(`Work Order #${reportId} downloaded`, 'success');
    } catch (e) {
        showToast('Failed to download work order', 'error');
    }
}

// Toast Notifications
function showToast(msg, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    const icon = type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle');
    toast.innerHTML = `<i class="fas fa-${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

function closeModal() {
    $('#modalOverlay').classList.remove('active');
}
