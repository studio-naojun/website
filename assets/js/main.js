document.querySelectorAll('[data-year]').forEach((el) => {
  el.textContent = new Date().getFullYear();
});

(() => {
  const isProduction = location.hostname === 'naojun.jp' || location.hostname === 'www.naojun.jp';
  if (!isProduction) return;

  try {
    const payload = new URLSearchParams({
      path: location.pathname || '/',
      ref: document.referrer || ''
    });
    const endpoint = 'https://naojun-metrics.pages.dev/v';
    if (navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, payload);
    } else {
      fetch(endpoint, {
        method: 'POST',
        body: payload,
        mode: 'cors',
        keepalive: true,
        credentials: 'omit'
      }).catch(() => {});
    }
  } catch (_) {}

  const footer = document.querySelector('.site-footer .footer-inner');
  if (footer && !footer.querySelector('[data-naojun-stats]')) {
    const link = document.createElement('a');
    link.href = 'https://naojun-metrics.pages.dev/s-7d4a9c2e';
    link.textContent = '.';
    link.setAttribute('aria-label', 'Access stats');
    link.setAttribute('data-naojun-stats', '');
    link.style.opacity = '0.22';
    link.style.textDecoration = 'none';
    footer.appendChild(link);
  }
})();
