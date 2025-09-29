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
	return api("/bins", {
		method: "POST",
		body: {
			location,
			latitude: String(latitude),  // Convert to string
			longitude: String(longitude) // Convert to string
		}
	});
}

// Submit report
async function submitReport(location, latitude, longitude) {
	const bin = await ensureBin(location, latitude, longitude);
	return api("/reports", {
		method: "POST",
		body: {
			bin_id: bin.id,
			status: "full"
		}
	});
}

// Clear a single report
async function clearReport(reportId) {
	return api(`/reports/${reportId}/clear`, { method: "PUT" });
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
			refreshDashboard(); // Refresh table and map
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

// Render table with individual "Clear" button
function renderReportsTable(reports, binIdToBin) {
	const tableBody = document.querySelector("#reports-table tbody");
	if (!tableBody) return;
	tableBody.innerHTML = "";

	for (const r of reports) {
		const b = binIdToBin.get(r.bin_id) || {};
		const tr = document.createElement("tr");

		const clearedDate = r.cleared_at ? new Date(r.cleared_at).toLocaleString() : "";

		tr.innerHTML = `
			<td>${r.id}</td>
			<td>${r.bin_id}</td>
			<td>${b.location || "-"}</td>
			<td>${b.latitude ?? "-"}</td>
			<td>${b.longitude ?? "-"}</td>
			<td>${r.status}</td>
			<td>${new Date(r.created_at).toLocaleString()}</td>
			<td>${clearedDate}</td>
			<td>${r.status !== "done" ? `<button class="clear-btn" data-id="${r.id}">Clear</button>` : ""}</td>
		`;

		tableBody.appendChild(tr);
	}

	// Attach clear button listeners
	document.querySelectorAll(".clear-btn").forEach(btn => {
		btn.addEventListener("click", async () => {
			const reportId = btn.dataset.id;
			try {
				await clearReport(reportId);
				refreshDashboard();
			} catch (err) {
				alert(`Error clearing report: ${err.message || err}`);
			}
		});
	});

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
		mapInstance = L.map("map").setView([6.5244, 3.3792], 11); // Lagos
		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
			attribution: '© OpenStreetMap'
		}).addTo(mapInstance);
		markersLayer = L.layerGroup().addTo(mapInstance);
	}
	return mapInstance;
}

// Render markers with dynamic color + tooltip
function renderMapMarkers(reports, binIdToBin) {
	const map = ensureMap();
	if (!map || !markersLayer) return;
	markersLayer.clearLayers();

	for (const r of reports) {
		const b = binIdToBin.get(r.bin_id);
		if (!b || typeof b.latitude !== "number" || typeof b.longitude !== "number") continue;

		const isDone = r.status === "done";
		const color = isDone ? "green" : "red";
		const label = isDone ? `Done: ${new Date(r.cleared_at).toLocaleString()}` : "Bin Full";

		const binIcon = L.divIcon({
			html: `<div style="
				background-color:${color};
				color:white;
				font-weight:bold;
				padding:2px 6px;
				border-radius:4px;
				text-align:center;
				box-shadow:0 0 3px #000;
			">${label}</div>`,
			className: '',
			iconSize: [80, 24],
			iconAnchor: [40, 12],
		});

		const marker = L.marker([b.latitude, b.longitude], { icon: binIcon });

		const tooltipText = isDone
			? `${b.location || 'Unknown'} - Done: ${new Date(r.cleared_at).toLocaleString()}`
			: `${b.location || 'Unknown'} - Bin Full`;

		marker.bindTooltip(tooltipText, {
			permanent: false,
			direction: 'top',
			offset: [0, -10]
		});

		markersLayer.addLayer(marker);
	}
}

// Refresh table + map
async function refreshDashboard() {
	const tableBody = document.querySelector("#reports-table tbody");
	if (tableBody) tableBody.innerHTML = "<tr><td colspan=9>Loading...</td></tr>";
	try {
		const { reports, binIdToBin } = await loadReports();
		renderReportsTable(reports, binIdToBin);
		renderMapMarkers(reports, binIdToBin);
	} catch (err) {
		if (tableBody) tableBody.innerHTML = `<tr><td colspan=9>Error loading data: ${err.message || err}</td></tr>`;
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
