const YAHOO_ENDPOINT = 'https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch';
const RAKUTEN_ENDPOINT = 'https://openapi.rakuten.co.jp/productsearch/api/ProductSearch/20250801';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const allowedOrigin = env.ALLOWED_ORIGIN || 'https://naojun.jp';
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204, origin, allowedOrigin);
    }

    if (request.method !== 'GET' || url.pathname !== '/search') {
      return corsResponse({ error: 'not_found' }, 404, origin, allowedOrigin);
    }

    if (origin && origin !== allowedOrigin) {
      return new Response(JSON.stringify({ error: 'origin_not_allowed' }), {
        status: 403,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    const jan = normalizeJan(url.searchParams.get('jan'));
    if (!isValidJan(jan)) {
      return corsResponse({ error: 'invalid_jan' }, 400, origin, allowedOrigin);
    }

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/search?jan=${jan}`, { method: 'GET' });
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached, origin, allowedOrigin);

    const providers = [
      fetchYahoo(jan, env),
      fetchRakuten(jan, env),
    ];

    const settled = await Promise.allSettled(providers);
    const providerResults = settled
      .filter((entry) => entry.status === 'fulfilled')
      .map((entry) => entry.value)
      .filter(Boolean);

    const results = providerResults.flatMap((provider) => provider.results || []);
    const product = providerResults.map((provider) => provider.product).find((item) => item?.name) || null;
    const providerStatus = providerResults.map((provider) => ({
      provider: provider.provider,
      ok: true,
      count: provider.results?.length || 0,
    }));

    settled.forEach((entry, index) => {
      if (entry.status === 'rejected') {
        providerStatus.push({
          provider: index === 0 ? 'yahoo' : 'rakuten',
          ok: false,
        });
        console.error(entry.reason);
      }
    });

    if (!providerResults.length) {
      return corsResponse({
        error: 'providers_unavailable',
        jan,
        providers: providerStatus,
      }, 503, origin, allowedOrigin);
    }

    const body = {
      jan,
      product,
      results,
      providers: providerStatus,
      checkedAt: new Date().toISOString(),
    };

    const response = new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=300',
      },
    });

    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return withCors(response, origin, allowedOrigin);
  },
};

async function fetchYahoo(jan, env) {
  if (!env.YAHOO_CLIENT_ID) return null;

  const url = new URL(YAHOO_ENDPOINT);
  url.searchParams.set('appid', env.YAHOO_CLIENT_ID);
  url.searchParams.set('jan_code', jan);
  url.searchParams.set('condition', 'new');
  url.searchParams.set('sort', '+price');
  url.searchParams.set('results', '50');

  const response = await fetchWithTimeout(url, 4500);
  if (!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);

  const data = await response.json();
  const hits = Array.isArray(data.hits) ? data.hits : [];
  const checkedAt = new Date().toISOString();

  return {
    provider: 'yahoo',
    product: hits[0]?.name ? { name: hits[0].name } : null,
    results: hits.map((hit) => ({
      store: hit.seller?.name ? `${hit.seller.name}（Yahoo!ショッピング）` : 'Yahoo!ショッピング',
      price: toNumberOrNull(hit.price),
      shipping: shippingFromYahoo(hit.shipping),
      stock: hit.inStock === true ? 'in_stock' : 'out_of_stock',
      url: hit.url || null,
      checkedAt,
      note: hit.priceLabel?.taxable === false ? '表示価格は税込とは限りません' : '',
      source: 'yahoo',
    })),
  };
}

async function fetchRakuten(jan, env) {
  if (!env.RAKUTEN_APPLICATION_ID || !env.RAKUTEN_ACCESS_KEY) return null;

  const url = new URL(RAKUTEN_ENDPOINT);
  url.searchParams.set('applicationId', env.RAKUTEN_APPLICATION_ID);
  url.searchParams.set('accessKey', env.RAKUTEN_ACCESS_KEY);
  url.searchParams.set('productCode', jan);
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatVersion', '2');
  url.searchParams.set('hits', '1');
  if (env.RAKUTEN_AFFILIATE_ID) url.searchParams.set('affiliateId', env.RAKUTEN_AFFILIATE_ID);

  const response = await fetchWithTimeout(url, 4500);
  if (!response.ok) throw new Error(`Rakuten HTTP ${response.status}`);

  const data = await response.json();
  const products = Array.isArray(data.products)
    ? data.products
    : Array.isArray(data.Items)
      ? data.Items
      : Array.isArray(data.items)
        ? data.items
        : [];

  const raw = products[0]?.product || products[0] || null;
  if (!raw) {
    return { provider: 'rakuten', product: null, results: [] };
  }

  const salesCount = toNumberOrNull(raw.salesItemCount ?? raw.usedExcludeSalesItemCount);
  const minPrice = toNumberOrNull(raw.usedExcludeSalesMinPrice ?? raw.salesMinPrice);
  const targetUrl = raw.affiliateUrl || raw.productUrlPC || raw.searchUrl || null;
  const checkedAt = new Date().toISOString();

  return {
    provider: 'rakuten',
    product: raw.productName ? { name: raw.productName } : null,
    results: minPrice != null && targetUrl ? [{
      store: '楽天市場',
      price: minPrice,
      shipping: null,
      stock: salesCount === 0 ? 'out_of_stock' : salesCount > 0 ? 'in_stock' : 'unknown',
      url: targetUrl,
      checkedAt,
      note: salesCount != null ? `購入可能 ${salesCount}件の最低価格` : '楽天市場内の最低価格',
      source: 'rakuten',
    }] : [],
  };
}

function shippingFromYahoo(shipping) {
  if (!shipping) return null;
  const label = String(shipping.name || '');
  if (label.includes('無料')) return 0;
  return null;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeJan(value) {
  return String(value || '').replace(/\D/g, '');
}

function isValidJan(code) {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false;
  const payload = code.slice(0, -1);
  const expected = Number(code.at(-1));
  let sum = 0;

  for (let i = payload.length - 1, position = 0; i >= 0; i -= 1, position += 1) {
    sum += Number(payload[i]) * (position % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === expected;
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function corsResponse(body, status, origin, allowedOrigin) {
  const headers = { 'content-type': 'application/json; charset=utf-8' };
  if (origin === allowedOrigin) {
    headers['access-control-allow-origin'] = allowedOrigin;
    headers['access-control-allow-methods'] = 'GET, OPTIONS';
    headers['access-control-allow-headers'] = 'Accept, Content-Type';
    headers.vary = 'Origin';
  }
  return new Response(body === null ? null : JSON.stringify(body), { status, headers });
}

function withCors(response, origin, allowedOrigin) {
  if (origin !== allowedOrigin) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', allowedOrigin);
  headers.set('access-control-allow-methods', 'GET, OPTIONS');
  headers.set('access-control-allow-headers', 'Accept, Content-Type');
  headers.set('vary', 'Origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
