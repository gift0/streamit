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

// Load reports and bins
async function loadReports() {
	const [reports, bins] = await Promise.all([api("/reports"), api("/bins")]);
	const binIdToBin = new Map(bins.map(b => [b.id, b]));
	return { reports, binIdToBin };
}

// Table rendering with individual clear button
function renderReportsTable(reports, binIdToBin) {
	const tableBody = document.querySelector("#reports-table tbody");
	if (!tableBody) return;
	tableBody.innerHTML = "";

	for (const r of reports) {
		const b = binIdToBin.get(r.bin_id) || {};
		const tr = document.createElement("tr");

		const clearedDate = r.cleared_at ? new Date(r.cleared_at).toLocaleString() : "-";

		tr.innerHTML = `
			<td>${r.id}</td>
			<td>${r.bin_id}</td>
			<td>${b.location || "-"}</td>
			<td>${b.latitude ?? "-"}</td>
			<td>${b.longitude ?? "-"}</td>
			<td>${r.status}</td>
			<td>${new Date(r.created_at).toLocaleString()}</td>
			<td>${r.status === "done" ? clearedDate : `<button class="clear-btn" data-id="${r.id}">Clear</button>`}</td>
		`;
		tableBody.appendChild(tr);
	}

	// Attach click listeners for clear buttons
	document.querySelectorAll(".clear-btn").forEach(btn => {
		btn.addEventListener("click", async () => {
			const reportId = btn.dataset.id;
			try {
				await api(`/reports/${reportId}/clear`, { method: "PUT" });
				await refreshDashboard();
			} catch (err) {
				alert("Error clearing report: " + err.message);
			}
		});
	});

	if (reports.length === 0) {
		tableBody.innerHTML = "<tr><td colspan=8>No reports yet</td></tr>";
	}
}

// Map handling
let mapInstance = null;
let markersLayer = null;

function ensureMap() {
	const mapEl = document.getElementById("map");
	if (!mapEl) return null;
	if (!mapInstance) {
		mapInstance = L.map("map").setView([6.5244, 3.3792], 11); // Lagos
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '© OpenStreetMap'
		}).addTo(mapInstance);
		markersLayer = L.layerGroup().addTo(mapInstance);
	}
	return mapInstance;
}

// Updated marker rendering: Red → Green + tooltip
function renderMapMarkers(reports, binIdToBin) {
	const map = ensureMap();
	if (!map || !markersLayer) return;
	markersLayer.clearLayers();

	for (const r of reports) {
		const b = binIdToBin.get(r.bin_id);
		if (!b || b.latitude == null || b.longitude == null) continue;

		const lat = parseFloat(b.latitude);
		const lng = parseFloat(b.longitude);
		if (isNaN(lat) || isNaN(lng)) continue;

		const isDone = r.status === "done";
		const tooltipText = isDone
			? `${b.location || "Unknown location"} - Done: ${r.cleared_at ? new Date(r.cleared_at).toLocaleString() : ""}`
			: `${b.location || "Unknown location"} - Bin Full`;

		const binIcon = L.divIcon({
			html: `<div style="
				background-color:${isDone ? "green" : "red"};
				color:white;
				font-weight:bold;
				padding:2px 6px;
				border-radius:4px;
				text-align:center;
				box-shadow:0 0 3px #000;
			">${isDone ? `Done` : "Bin Full"}</div>`,
			className: '',
			iconSize: [60, 24],
			iconAnchor: [30, 12],
		});

		const marker = L.marker([lat, lng], { icon: binIcon });
		marker.bindTooltip(tooltipText, { permanent: false, direction: 'top', offset: [0, -10] });
		markersLayer.addLayer(marker);
	}
}

// Refresh dashboard: table + map
async function refreshDashboard() {
	const tableBody = document.querySelector("#reports-table tbody");
	if (tableBody) tableBody.innerHTML = "<tr><td colspan=8>Loading...</td></tr>";
	try {
		const { reports, binIdToBin } = await loadReports();
		renderReportsTable(reports, binIdToBin);
		renderMapMarkers(reports, binIdToBin);
	} catch (err) {
		if (tableBody) tableBody.innerHTML = `<tr><td colspan=8>Error: ${err.message}</td></tr>`;
	}
}

// Initialize dashboard
function onDashboardPage() {
	const refreshBtn = document.getElementById("refresh");
	if (!refreshBtn) return;
	refreshBtn.addEventListener("click", refreshDashboard);
	refreshDashboard();
}

// Init
window.addEventListener("DOMContentLoaded", () => {
	onDashboardPage();
});
