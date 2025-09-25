const BASE_URL = "http://127.0.0.1:8000/api";

// ---------------------------
// Generic API helper
// ---------------------------
async function api(path, options = {}) {
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: options.method || "GET",
            headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || JSON.stringify(data));
        return data;
    } catch (err) {
        console.error(`API call failed: ${path}`, err);
        throw err;
    }
}

// ---------------------------
// Bin & Report functions
// ---------------------------
async function ensureBin(location, latitude, longitude) {
    return api("/bins", { method: "POST", body: { location, latitude, longitude } });
}

async function submitReport(location, latitude, longitude) {
    const bin = await ensureBin(location, latitude, longitude);
    console.log("Bin created/found:", bin);
    return api("/reports", { method: "POST", body: { bin_id: bin.id, status: "full" } });
}

// ---------------------------
// Index page: reporting
// ---------------------------
function onIndexPage() {
    const form = document.getElementById("report-form");
    if (!form) return;

    const status = document.getElementById("status");
    const useLocationBtn = document.getElementById("use-location");
    const geoStatus = document.getElementById("geo-status");
    const latEl = document.getElementById("lat");
    const lngEl = document.getElementById("lng");

    // Attach geolocation
    useLocationBtn.addEventListener("click", async () => {
        geoStatus.textContent = "Fetching location...";
        try {
            if (!navigator.geolocation) throw new Error("Geolocation not supported");
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    latEl.value = latitude;
                    lngEl.value = longitude;
                    geoStatus.textContent = `Attached coords: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
                },
                (err) => {
                    geoStatus.textContent = `Location error: ${err.message}`;
                },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        } catch (err) {
            geoStatus.textContent = `Error: ${err.message}`;
        }
    });

    // Submit report form
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        status.textContent = "Submitting...";
        const locationInput = document.getElementById("location");
        try {
            const location = locationInput.value.trim();
            if (!location) throw new Error("Location is required");

            const lat = latEl.value ? parseFloat(latEl.value) : undefined;
            const lng = lngEl.value ? parseFloat(lngEl.value) : undefined;

            const report = await submitReport(location, lat, lng);
            console.log("Report submitted:", report);

            status.textContent = "Report submitted. Thank you!";
            locationInput.value = "";
            latEl.value = "";
            lngEl.value = "";
            geoStatus.textContent = "";
        } catch (err) {
            status.textContent = `Error: ${err.message}`;
        }
    });
}

// ---------------------------
// Load reports & bins
// ---------------------------
async function loadReports() {
    try {
        const [reports, bins] = await Promise.all([
            api("/reports"),
            api("/bins")
        ]);
        const binIdToBin = new Map(bins.map(b => [b.id, b]));
        console.log("Loaded reports:", reports);
        console.log("Loaded bins:", bins);
        return { reports, binIdToBin };
    } catch (err) {
        console.error("Error loading reports/bins:", err);
        return { reports: [], binIdToBin: new Map() };
    }
}

// ---------------------------
// Render tables
// ---------------------------
function renderReportsTable(reports, binIdToBin) {
    const tableBody = document.querySelector("#reports-table tbody");
    if (!tableBody) return;

    tableBody.innerHTML = "";
    if (reports.length === 0) {
        tableBody.innerHTML = "<tr><td colspan=7>No reports yet</td></tr>";
        return;
    }

    reports.forEach(r => {
        const b = binIdToBin.get(r.bin_id) || {};
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${r.id}</td>
            <td>${r.bin_id}</td>
            <td>${b.location || "-"}</td>
            <td>${b.latitude ?? "-"}</td>
            <td>${b.longitude ?? "-"}</td>
            <td>${r.status}</td>
            <td>${new Date(r.created_at).toLocaleString()}</td>
        `;
        tableBody.appendChild(tr);
    });
}

// ---------------------------
// Map
// ---------------------------
let mapInstance = null;
let markersLayer = null;

function ensureMap() {
    const mapEl = document.getElementById("map");
    if (!mapEl) return null;
    if (!mapInstance) {
        mapInstance = L.map("map").setView([6.5244, 3.3792], 11);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(mapInstance);
        markersLayer = L.layerGroup().addTo(mapInstance);
    }
    return mapInstance;
}

function renderMapMarkers(reports, binIdToBin) {
    const map = ensureMap();
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();

    reports.forEach(r => {
        const b = binIdToBin.get(r.bin_id);
        if (!b || typeof b.latitude !== "number" || typeof b.longitude !== "number") return;
        const marker = L.marker([b.latitude, b.longitude]);
        marker.bindPopup(`<strong>${b.location}</strong><br>Status: ${r.status}<br>${new Date(r.created_at).toLocaleString()}`);
        markersLayer.addLayer(marker);
    });
}

// ---------------------------
// Dashboard
// ---------------------------
async function refreshDashboard() {
    const tableBody = document.querySelector("#reports-table tbody");
    if (tableBody) tableBody.innerHTML = "<tr><td colspan=7>Loading...</td></tr>";

    try {
        const { reports, binIdToBin } = await loadReports();
        renderReportsTable(reports, binIdToBin);
        renderMapMarkers(reports, binIdToBin);
    } catch (err) {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan=7>Error: ${err.message}</td></tr>`;
    }
}

function onDashboardPage() {
    const refreshBtn = document.getElementById("refresh");
    if (!refreshBtn) return;
    refreshBtn.addEventListener("click", refreshDashboard);
    refreshDashboard();
}

// ---------------------------
// Typing effect
// ---------------------------
const typingText = "Smart Living";
const typingElement = document.getElementById("typing-effect");
let typingIndex = 0;
let typingSpeed = 120;
let erasingSpeed = 60;
let isErasing = false;

function typeEffectLoop() {
    if (!typingElement) return;

    if (!isErasing) {
        typingElement.textContent = typingText.substring(0, typingIndex);
        if (typingIndex < typingText.length) {
            typingIndex++;
            setTimeout(typeEffectLoop, typingSpeed);
        } else {
            isErasing = true;
            setTimeout(typeEffectLoop, 1000);
        }
    } else {
        typingElement.textContent = typingText.substring(0, typingIndex);
        if (typingIndex > 0) {
            typingIndex--;
            setTimeout(typeEffectLoop, erasingSpeed);
        } else {
            isErasing = false;
            setTimeout(typeEffectLoop, 500);
        }
    }
}

typingElement.textContent = "";
typeEffectLoop();

// ---------------------------
// Init
// ---------------------------
window.addEventListener("DOMContentLoaded", () => {
    onIndexPage();
    onDashboardPage();
});
