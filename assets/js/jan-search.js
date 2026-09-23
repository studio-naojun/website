(() => {
  const form = document.getElementById('jan-search-form');
  if (!form) return;

  const input = document.getElementById('jan-code');
  const error = document.getElementById('jan-error');
  const status = document.getElementById('search-status');
  const storeSearch = document.getElementById('store-search');
  const storeTabs = document.getElementById('store-tabs');
  const storeName = document.getElementById('store-name');
  const storeDescription = document.getElementById('store-description');
  const storeLink = document.getElementById('store-link');
  const currentQueryEl = document.getElementById('current-jan');
  const copyQueryButton = document.getElementById('copy-jan');
  const nextStoreButton = document.getElementById('next-store');
  const scannerDialog = document.getElementById('scanner-dialog');
  const scannerVideo = document.getElementById('scanner-video');
  const scannerStatus = document.getElementById('scanner-status');
  const scanButton = document.getElementById('scan-button');
  const scannerClose = document.getElementById('scanner-close');

  // Keep retailer URL builders in one place so future affiliate routing can be
  // introduced without changing the search UI or query handling.
  const stores = [
    {
      id: 'yodobashi',
      name: 'ヨドバシ',
      description: 'ヨドバシ.comで、このキーワードを検索します。',
      buildUrl: (query) => `https://www.yodobashi.com/?word=${encodeURIComponent(query)}`,
    },
    {
      id: 'biccamera',
      name: 'ビックカメラ',
      description: 'ビックカメラ.comで、このキーワードを検索します。',
      buildUrl: (query) => `https://www.biccamera.com/bc/category/?q=${encodeURIComponent(query)}`,
    },
    {
      id: 'yamada',
      name: 'ヤマダ',
      description: 'ヤマダウェブコムで、このキーワードを検索します。',
      buildUrl: (query) => `https://www.yamada-denkiweb.com/search/${encodeURIComponent(query)}/`,
    },
    {
      id: 'edion',
      name: 'エディオン',
      description: 'エディオン公式通販で、このキーワードを検索します。',
      buildUrl: (query) => `https://www.edion.com/item_list.html?keyword=${encodeURIComponent(query)}`,
    },
    {
      id: 'joshin',
      name: 'Joshin',
      description: 'Joshin webショップ全体から、このキーワードを検索します。',
      buildUrl: (query) => `https://joshinweb.jp/srhzs.html?KEY=ZS_ALL&KEY_M=ALL&QK=${encodeURIComponent(query)}&REQUEST_CODE=1`,
    },
    {
      id: 'sofmap',
      name: 'ソフマップ',
      description: 'ソフマップ・ドットコムで、このキーワードを検索します。',
      buildUrl: (query) => `https://www.sofmap.com/search_result.aspx?keyword=${encodeURIComponent(query)}`,
    },
    {
      id: 'surugaya',
      name: '駿河屋',
      description: '駿河屋で、新品・中古を含めてこのキーワードを検索します。',
      buildUrl: (query) => `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(query)}`,
    },
    {
      id: 'geo',
      name: 'ゲオ',
      description: 'ゲオオンラインストアで、このキーワードを検索します。',
      buildUrl: (query) => `https://ec.geo-online.co.jp/shop/goods/search.aspx?keyword=${encodeURIComponent(query)}`,
    },
    {
      id: 'toysrus',
      name: 'トイザらス',
      description: 'トイザらス オンラインストアで、このキーワードを検索します。',
      buildUrl: (query) => `https://www.toysrus.co.jp/search/?q=${encodeURIComponent(query)}`,
    },
    {
      id: 'pokemoncenter',
      name: 'ポケモンセンター',
      description: 'ポケモンセンターオンラインで、このキーワードを検索します。',
      buildUrl: (query) => `https://www.pokemoncenter-online.com/search/?q=${encodeURIComponent(query)}`,
    },
    {
      id: 'amiami',
      name: 'あみあみ',
      description: 'あみあみオンライン本店で、このキーワードを検索します。',
      buildUrl: (query) => `https://slist.amiami.jp/top/search/list?s_keywords=${encodeURIComponent(query)}&pagemax=60`,
    },
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'Amazon.co.jpで、このキーワードを検索します。',
      buildUrl: (query) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}`,
    },
    {
      id: 'rakuten',
      name: '楽天市場',
      description: '楽天市場で、このキーワードを検索します。',
      buildUrl: (query) => `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(query)}/`,
    },
    {
      id: 'yahoo',
      name: 'Yahoo!',
      description: 'Yahoo!ショッピングで、このキーワードを検索します。',
      buildUrl: (query) => `https://shopping.yahoo.co.jp/search/${encodeURIComponent(query)}/0/`,
    },
  ];

  let currentQuery = '';
  let activeStoreIndex = 0;
  let scannerControls = null;

  const normalizeQuery = (value) => String(value || '').trim().replace(/\s+/g, ' ');
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

  const buildTabs = () => {
    storeTabs.replaceChildren();

    stores.forEach((store, index) => {
      const link = document.createElement('a');
      link.className = 'jan-store-tab';
      link.id = `store-tab-${store.id}`;
      link.dataset.storeIndex = String(index);
      link.href = store.buildUrl(currentQuery);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('role', 'tab');
      link.setAttribute('aria-controls', 'store-panel');
      link.setAttribute('aria-selected', index === activeStoreIndex ? 'true' : 'false');
      link.tabIndex = index === activeStoreIndex ? 0 : -1;
      link.textContent = store.name;
      link.addEventListener('click', () => selectStore(index));
      link.addEventListener('keydown', handleTabKeydown);
      storeTabs.append(link);
    });
  };

  const renderStore = () => {
    const store = stores[activeStoreIndex];
    if (!store || !currentQuery) return;

    storeName.textContent = store.name;
    storeDescription.textContent = store.description;
    storeLink.href = store.buildUrl(currentQuery);
    storeLink.textContent = `${store.name}で検索する →`;

    storeTabs.querySelectorAll('[role="tab"]').forEach((tab, index) => {
      const selected = index === activeStoreIndex;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
  };

  const selectStore = (index, focus = false) => {
    activeStoreIndex = (index + stores.length) % stores.length;
    renderStore();
    if (focus) {
      storeTabs.querySelector(`[data-store-index="${activeStoreIndex}"]`)?.focus();
    }
  };

  function handleTabKeydown(event) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft' && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();

    if (event.key === 'Home') return selectStore(0, true);
    if (event.key === 'End') return selectStore(stores.length - 1, true);
    selectStore(activeStoreIndex + (event.key === 'ArrowRight' ? 1 : -1), true);
  }

  const showStoreSearch = (query) => {
    currentQuery = query;
    currentQueryEl.textContent = query;
    storeSearch.hidden = false;
    copyQueryButton.hidden = false;
    status.textContent = '店舗名を押すと、この検索語の結果を新しいWindowで開きます。';
    buildTabs();
    renderStore();

    const url = new URL(window.location.href);
    url.searchParams.set('q', query);
    url.searchParams.delete('jan');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const submitQuery = (value, shouldScroll = true) => {
    const query = normalizeQuery(value);
    input.value = query;

    if (!query) {
      showError('検索キーワードを入力してください。');
      return false;
    }

    showError('');
    showStoreSearch(query);
    if (shouldScroll) {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitQuery(input.value);
  });

  nextStoreButton.addEventListener('click', () => selectStore(activeStoreIndex + 1, true));

  copyQueryButton.addEventListener('click', async () => {
    if (!currentQuery) return;
    try {
      await navigator.clipboard.writeText(currentQuery);
      copyQueryButton.textContent = 'コピーしました';
      window.setTimeout(() => { copyQueryButton.textContent = '検索語をコピー'; }, 1400);
    } catch (_) {
      input.focus();
      input.select();
      status.textContent = '検索キーワードを選択しました。コピーしてください。';
    }
  });

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
      scannerStatus.textContent = 'このブラウザではカメラを利用できません。検索キーワードを入力してください。';
      return;
    }

    if (!window.ZXingBrowser?.BrowserMultiFormatReader) {
      scannerStatus.textContent = 'バーコード読取機能を読み込めませんでした。検索キーワードを入力してください。';
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
          closeScanner();
          submitQuery(jan);
        },
      );
      scannerStatus.textContent = '商品のJANコードを枠内に合わせてください。';
    } catch (scannerError) {
      console.error(scannerError);
      const denied = scannerError?.name === 'NotAllowedError';
      scannerStatus.textContent = denied
        ? 'カメラの使用が許可されていません。ブラウザの権限設定を確認してください。'
        : 'カメラを起動できませんでした。検索キーワードを入力してください。';
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

  const params = new URLSearchParams(window.location.search);
  const initialQuery = normalizeQuery(params.get('q'));
  const legacyJan = normalizeJan(params.get('jan'));
  const initialValue = initialQuery || (legacyJan && isValidJan(legacyJan) ? legacyJan : '');
  if (initialValue) {
    input.value = initialValue;
    submitQuery(initialValue, false);
  }
})();
