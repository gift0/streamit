const BASE_URL = "http://127.0.0.1:8000/api";

// Generic API helper
async function api(path, options = {}) {
	const res = await fetch(`${BASE_URL}${path}`, {
		method: options.method || "GET",
		headers: { "Content-Type": "application/json", ...(options.headers || {}) },
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(text || `Request failed: ${res.status}`);
	}
	return res.json();
}

// Ensure bin exists
async function ensureBin(location, latitude, longitude) {
	return api("/bins", { method: "POST", body: { location, latitude, longitude } });
}

// Submit report
async function submitReport(location, latitude, longitude) {
	const bin = await ensureBin(location, latitude, longitude);
	return api("/reports", { method: "POST", body: { bin_id: bin.id, status: "full" } });
}

// Index page: handle form submission
function onIndexPage() {
	const form = document.getElementById("report-form");
	if (!form) return;

	const status = document.getElementById("status");
	const useLocationBtn = document.getElementById("use-location");
	const geoStatus = document.getElementById("geo-status");
	const latEl = document.getElementById("lat");
	const lngEl = document.getElementById("lng");

	useLocationBtn.addEventListener("click", async () => {
		geoStatus.textContent = "Fetching location...";
		try {
			if (!navigator.geolocation) throw new Error("Geolocation not supported");
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					const { latitude, longitude } = pos.coords;
					latEl.value = String(latitude);
					lngEl.value = String(longitude);
					geoStatus.textContent = `Attached coords: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
				},
				(err) => {
					geoStatus.textContent = `Location error: ${err.message}`;
				},
				{ enableHighAccuracy: true, timeout: 10000 }
			);
		} catch (err) {
			geoStatus.textContent = `Error: ${err.message || err}`;
		}
	});

	form.addEventListener("submit", async (e) => {
		e.preventDefault();
		status.textContent = "Submitting...";
		const locationInput = document.getElementById("location");

		const lat = latEl.value ? parseFloat(latEl.value) : null;
		const lng = lngEl.value ? parseFloat(lngEl.value) : null;

		if (lat === null || lng === null) {
			status.textContent = "Error: Please attach your current location before submitting.";
			return;
		}

		try {
			const location = locationInput.value.trim();
			if (!location) throw new Error("Location is required");

			await submitReport(location, lat, lng);

			status.textContent = "Report submitted. Thank you!";
			locationInput.value = "";
			latEl.value = "";
			lngEl.value = "";
			geoStatus.textContent = "";
		} catch (err) {
			status.textContent = `Error: ${err.message || err}`;
		}
	});
}

// Load reports and bins
async function loadReports() {
	const [reports, bins] = await Promise.all([
		api("/reports"),
		api("/bins"),
	]);
	const binIdToBin = new Map(bins.map(b => [b.id, b]));
	return { reports, binIdToBin };
}

// Mark a single report as cleared
async function clearReport(reportId) {
	try {
		await api(`/reports/${reportId}/clear`, { method: "PUT" });
		refreshDashboard();
	} catch (err) {
		alert("Error clearing report: " + err.message);
	}
}

// Clear all pending reports
async function clearAllReports(reports) {
	const pendingReports = reports.filter(r => r.status !== "done");
	for (const r of pendingReports) {
		await clearReport(r.id);
	}
	alert("All pending reports cleared!");
}

// Render table
function renderReportsTable(reports, binIdToBin) {
	const tableBody = document.querySelector("#reports-table tbody");
	if (!tableBody) return;
	tableBody.innerHTML = "";

	for (const r of reports) {
		const b = binIdToBin.get(r.bin_id) || {};
		const tr = document.createElement("tr");
		tr.innerHTML = `
			<td>${r.id}</td>
			<td>${r.bin_id}</td>
			<td>${b.location || "-"}</td>
			<td>${b.latitude ?? "-"}</td>
			<td>${b.longitude ?? "-"}</td>
			<td><span class="status ${r.status}">${r.status}</span></td>
			<td>${new Date(r.created_at).toLocaleString()}</td>
			<td>${r.cleared_at ? new Date(r.cleared_at).toLocaleString() : "-"}</td>
			<td>
				<button class="clear-btn" ${r.status === 'done' ? 'disabled' : ''} onclick="clearReport(${r.id})">Mark as Cleared</button>
			</td>
		`;
		tableBody.appendChild(tr);
	}

	if (reports.length === 0) {
		tableBody.innerHTML = "<tr><td colspan=9>No reports yet</td></tr>";
	}
}

// Map handling
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

// Render markers
function renderMapMarkers(reports, binIdToBin) {
	const map = ensureMap();
	if (!map || !markersLayer) return;
	markersLayer.clearLayers();

	for (const r of reports) {
		const b = binIdToBin.get(r.bin_id);
		if (!b || typeof b.latitude !== "number" || typeof b.longitude !== "number") continue;

		const binIcon = L.divIcon({
			html: `<div style="
				background-color:red;
				color:white;
				font-weight:bold;
				padding:2px 6px;
				border-radius:4px;
				text-align:center;
				box-shadow:0 0 3px #000;
			">Bin Full</div>`,
			className: '',
			iconSize: [60, 24],
			iconAnchor: [30, 12],
		});

		const marker = L.marker([b.latitude, b.longitude], { icon: binIcon });
		marker.bindTooltip(`${b.location || 'Unknown location'} - Bin Full`, {
			permanent: false,
			direction: 'top',
			offset: [0, -10]
		});
		markersLayer.addLayer(marker);
	}
}

// Refresh dashboard
async function refreshDashboard() {
	const tableBody = document.querySelector("#reports-table tbody");
	if (tableBody) tableBody.innerHTML = "<tr><td colspan=9>Loading...</td></tr>";
	try {
		const { reports, binIdToBin } = await loadReports();
		renderReportsTable(reports, binIdToBin);
		renderMapMarkers(reports, binIdToBin);

		// Add Clear All button dynamically
		const controls = document.querySelector(".controls");
		if (!document.getElementById("clear-all") && reports.some(r => r.status !== "done")) {
			const clearAllBtn = document.createElement("button");
			clearAllBtn.id = "clear-all";
			clearAllBtn.textContent = "Clear All";
			clearAllBtn.className = "clear-btn";
			clearAllBtn.addEventListener("click", () => clearAllReports(reports));
			controls.appendChild(clearAllBtn);
		}

	} catch (err) {
		if (tableBody) tableBody.innerHTML = `<tr><td colspan=9>Error: ${err.message || err}</td></tr>`;
	}
}

function onDashboardPage() {
	const refreshBtn = document.getElementById("refresh");
	if (!refreshBtn) return;
	refreshBtn.addEventListener("click", refreshDashboard);
	refreshDashboard();
}

// Init
window.addEventListener("DOMContentLoaded", () => {
	onIndexPage();
	onDashboardPage();
});
