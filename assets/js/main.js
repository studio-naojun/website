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

  // Anonymous acquisition funnel. No cookies, fingerprinting or visitor IDs.
  // A tab-only source attribution may persist for 30 minutes across site pages.
  // Backend /e must be deployed with the funnel_events migration BEFORE this
  // client is enabled on the public site.
  const eventEndpoint = 'https://naojun-metrics.pages.dev/e';
  const token = (value, max = 48) => {
    const s = String(value ?? '').toLowerCase();
    return /^[a-z0-9_-]+$/.test(s) && s.length <= max ? s : 'unknown';
  };
  const path = location.pathname || '/';
  const now = Date.now();
  const storeKey = 'naojun-funnel-attribution-v1';
  const params = new URLSearchParams(location.search);
  const campaignSource = token(params.get('utm_source'), 32);
  const currentReferrer = (() => {
    try { return new URL(document.referrer).hostname.toLowerCase(); }
    catch (_) { return ''; }
  })();
  const internalReferrer = currentReferrer === 'naojun.jp' || currentReferrer === 'www.naojun.jp';
  let attribution;
  let firstLanding = false;

  try {
    const existing = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
    const valid = existing && typeof existing === 'object' &&
      Number.isFinite(existing.created) && now - existing.created >= 0 &&
      now - existing.created < 1800000 &&
      typeof existing.landing === 'string' && /^\/(?!\/)[^?#]{0,219}$/.test(existing.landing) &&
      existing.source === token(existing.source, 32) &&
      existing.medium === token(existing.medium, 32) &&
      existing.campaign === token(existing.campaign, 64);

    if (campaignSource !== 'unknown') {
      attribution = {
        source: campaignSource,
        medium: token(params.get('utm_medium'), 32),
        campaign: token(params.get('utm_campaign'), 64),
        landing: path, created: now
      };
      firstLanding = !valid || existing.source !== attribution.source ||
        existing.campaign !== attribution.campaign || existing.landing !== path;
    } else if (valid) {
      attribution = existing;
    }
    if (!attribution) {
      attribution = {
        source: currentReferrer && !internalReferrer ? 'referral' : internalReferrer ? 'unknown' : 'direct',
        medium: currentReferrer && !internalReferrer ? 'referral' : 'direct',
        campaign: 'unknown', landing: path, created: now
      };
      firstLanding = !internalReferrer;
    }
    sessionStorage.setItem(storeKey, JSON.stringify(attribution));
  } catch (_) {
    // Private-browsing storage restrictions must not prevent page navigation.
    attribution = { source: campaignSource !== 'unknown' ? campaignSource : 'unknown',
      medium: token(params.get('utm_medium'), 32), campaign: token(params.get('utm_campaign'), 64),
      landing: path };
    firstLanding = campaignSource !== 'unknown';
  }

  const emit = (action, destination = '') => {
    try {
      const payload = new URLSearchParams({
        action, path, landing: attribution.landing,
        source: attribution.source, medium: attribution.medium, campaign: attribution.campaign
      });
      if (destination) payload.set('destination', destination);
      if (navigator.sendBeacon && navigator.sendBeacon(eventEndpoint, payload)) return;
      fetch(eventEndpoint, {
        method: 'POST', body: payload, mode: 'cors', keepalive: true, credentials: 'omit'
      }).catch(() => {});
    } catch (_) {}
  };

  if (firstLanding) emit('landing');
  if (path === '/koechara/') emit('koechara_entry');
  document.addEventListener('click', (event) => {
    const target = event.target;
    const link = target && typeof target.closest === 'function' ? target.closest('a[href]') : null;
    if (!link) return;
    try {
      if (new URL(link.href).hostname === 'naojun-studios.stores.jp') emit('store_click', 'STORES');
    } catch (_) {}
  }, { capture: true });
})();
