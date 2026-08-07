(() => {
  const form = document.getElementById('jan-search-form');
  if (!form) return;

  const input = document.getElementById('jan-code');
  const error = document.getElementById('jan-error');
  const status = document.getElementById('search-status');
  const results = document.getElementById('jan-results');
  const productSummary = document.getElementById('product-summary');
  const sortSelect = document.getElementById('sort-results');
  const scannerDialog = document.getElementById('scanner-dialog');
  const scannerVideo = document.getElementById('scanner-video');
  const scannerStatus = document.getElementById('scanner-status');
  const scanButton = document.getElementById('scan-button');
  const scannerClose = document.getElementById('scanner-close');
  const apiEndpoint = (document.documentElement.dataset.janApi || '').trim();

  const yen = new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  });

  let currentResults = [];
  let scannerControls = null;

  const normalizeJan = (value) => String(value || '').replace(/\D/g, '');

  const isValidJan = (code) => {
    if (!/^\d{8}$|^\d{13}$/.test(code)) return false;

    const payload = code.slice(0, -1);
    const expected = Number(code.at(-1));
    let sum = 0;

    for (let i = payload.length - 1, position = 0; i >= 0; i -= 1, position += 1) {
      sum += Number(payload[i]) * (position % 2 === 0 ? 3 : 1);
    }

    return (10 - (sum % 10)) % 10 === expected;
  };

  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
  };

  const clearOutput = () => {
    currentResults = [];
    results.replaceChildren();
    productSummary.hidden = true;
    productSummary.replaceChildren();
  };

  const stockLabel = (stock) => {
    if (stock === 'in_stock') return '在庫あり';
    if (stock === 'low_stock') return '残りわずか';
    return '在庫状況不明';
  };

  const sortItems = (items) => {
    const sorted = [...items];
    const mode = sortSelect.value;

    if (mode === 'price-desc') {
      sorted.sort((a, b) => Number(b.price ?? Infinity) - Number(a.price ?? Infinity));
    } else if (mode === 'store') {
      sorted.sort((a, b) => String(a.store || '').localeCompare(String(b.store || ''), 'ja'));
    } else {
      sorted.sort((a, b) => Number(a.price ?? Infinity) - Number(b.price ?? Infinity));
    }

    return sorted;
  };

  const renderResults = () => {
    results.replaceChildren();
    const visible = sortItems(currentResults.filter((item) => item.stock !== 'out_of_stock'));

    if (!visible.length) {
      status.textContent = '在庫のある販売店は見つかりませんでした。';
      return;
    }

    status.textContent = `${visible.length}件の販売店が見つかりました。`;

    visible.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'jan-result-card';

      const storeBox = document.createElement('div');
      const store = document.createElement('div');
      store.className = 'jan-result-store';
      store.textContent = item.store || '販売店';

      const note = document.createElement('div');
      note.className = 'jan-result-note';
      note.textContent = item.note || (item.checkedAt ? `確認: ${item.checkedAt}` : '');

      const stock = document.createElement('span');
      stock.className = 'jan-stock';
      stock.textContent = stockLabel(item.stock);

      storeBox.append(store, note, stock);

      const price = document.createElement('div');
      price.className = 'jan-price';
      price.textContent = Number.isFinite(Number(item.price)) ? yen.format(Number(item.price)) : '価格不明';
      if (item.shipping != null) {
        const shipping = document.createElement('small');
        shipping.textContent = Number(item.shipping) === 0 ? '送料無料' : `送料 ${yen.format(Number(item.shipping))}`;
        price.append(shipping);
      }

      const link = document.createElement('a');
      link.className = 'jan-result-link';
      link.href = item.url || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '販売店で見る';
      if (!item.url) {
        link.removeAttribute('href');
        link.setAttribute('aria-disabled', 'true');
      }

      card.append(storeBox, price, link);
      results.append(card);
    });
  };

  const renderProduct = (product, jan) => {
    productSummary.replaceChildren();

    const name = document.createElement('strong');
    name.textContent = product?.name || '商品';

    const code = document.createElement('span');
    code.textContent = `JAN: ${jan}`;

    productSummary.append(name, code);
    productSummary.hidden = false;
  };

  const search = async (jan) => {
    clearOutput();

    if (!apiEndpoint) {
      status.textContent = '価格比較APIがまだ接続されていません。公開前に検索APIの接続が必要です。';
      return;
    }

    status.textContent = '販売店を検索しています…';

    try {
      const url = new URL(apiEndpoint, window.location.href);
      url.searchParams.set('jan', jan);
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      currentResults = Array.isArray(data.results) ? data.results : [];
      renderProduct(data.product, data.jan || jan);
      renderResults();
    } catch (fetchError) {
      console.error(fetchError);
      status.textContent = '検索に失敗しました。時間をおいて、もう一度お試しください。';
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const jan = normalizeJan(input.value);
    input.value = jan;

    if (!/^\d{8}$|^\d{13}$/.test(jan)) {
      showError('JANコードは8桁または13桁の数字で入力してください。');
      return;
    }

    if (!isValidJan(jan)) {
      showError('JANコードのチェックデジットが一致しません。入力内容を確認してください。');
      return;
    }

    showError('');
    search(jan);
    document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  sortSelect.addEventListener('change', renderResults);

  const stopScanner = () => {
    if (scannerControls) {
      try { scannerControls.stop(); } catch (_) { /* no-op */ }
      scannerControls = null;
    }
    if (scannerVideo.srcObject) {
      scannerVideo.srcObject.getTracks().forEach((track) => track.stop());
      scannerVideo.srcObject = null;
    }
  };

  const closeScanner = () => {
    stopScanner();
    scannerDialog.hidden = true;
    document.body.style.overflow = '';
    scanButton.focus();
  };

  const openScanner = async () => {
    showError('');
    scannerDialog.hidden = false;
    document.body.style.overflow = 'hidden';
    scannerStatus.textContent = 'カメラを起動しています…';

    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      scannerStatus.textContent = 'このブラウザではカメラを利用できません。JANコードを入力してください。';
      return;
    }

    if (!window.ZXingBrowser?.BrowserMultiFormatReader) {
      scannerStatus.textContent = 'バーコード読取機能を読み込めませんでした。JANコードを入力してください。';
      return;
    }

    try {
      const reader = new window.ZXingBrowser.BrowserMultiFormatReader();
      scannerControls = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        scannerVideo,
        (result) => {
          if (!result) return;
          const jan = normalizeJan(result.getText());
          if (!isValidJan(jan)) {
            scannerStatus.textContent = 'JANコード以外のバーコードを検出しました。商品バーコードを枠内に合わせてください。';
            return;
          }

          input.value = jan;
          scannerStatus.textContent = `JAN ${jan} を読み取りました。`;
          closeScanner();
          form.requestSubmit();
        },
      );
      scannerStatus.textContent = '商品のバーコードを枠内に合わせてください。';
    } catch (scannerError) {
      console.error(scannerError);
      const denied = scannerError?.name === 'NotAllowedError';
      scannerStatus.textContent = denied
        ? 'カメラの使用が許可されていません。ブラウザの権限設定を確認してください。'
        : 'カメラを起動できませんでした。JANコードを入力してください。';
    }
  };

  scanButton.addEventListener('click', openScanner);
  scannerClose.addEventListener('click', closeScanner);
  scannerDialog.addEventListener('click', (event) => {
    if (event.target === scannerDialog) closeScanner();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !scannerDialog.hidden) closeScanner();
  });
})();
