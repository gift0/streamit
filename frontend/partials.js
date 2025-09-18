async function loadPartial(selector, url) {
	const host = document.querySelector(selector);
	if (!host) return;
	try {
		const res = await fetch(url, { cache: 'no-store' });
		if (!res.ok) return;
		host.outerHTML = await res.text();
		if (selector === 'footer') {
			const yearEl = document.getElementById('year');
			if (yearEl) yearEl.textContent = new Date().getFullYear();
		}
	} catch {}
}

window.addEventListener('DOMContentLoaded', () => {
	loadPartial('header', './partials/header.html');
	loadPartial('footer', './partials/footer.html');
});


