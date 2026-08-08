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
  const currentJanEl = document.getElementById('current-jan');
  const copyJanButton = document.getElementById('copy-jan');
  const nextStoreButton = document.getElementById('next-store');
  const scannerDialog = document.getElementById('scanner-dialog');
  const scannerVideo = document.getElementById('scanner-video');
  const scannerStatus = document.getElementById('scanner-status');
  const scanButton = document.getElementById('scan-button');
  const scannerClose = document.getElementById('scanner-close');

  // Keep retailer URL builders in one place so future affiliate routing can be
  // introduced without changing the search UI or JAN handling.
  const stores = [
    {
      id: 'yodobashi',
      name: 'ヨドバシ',
      description: 'ヨドバシ.comで、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.yodobashi.com/?word=${encodeURIComponent(jan)}`,
    },
    {
      id: 'biccamera',
      name: 'ビックカメラ',
      description: 'ビックカメラ.comで、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.biccamera.com/bc/category/?q=${encodeURIComponent(jan)}`,
    },
    {
      id: 'yamada',
      name: 'ヤマダ',
      description: 'ヤマダウェブコムで、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.yamada-denkiweb.com/search/${encodeURIComponent(jan)}/`,
    },
    {
      id: 'edion',
      name: 'エディオン',
      description: 'エディオン公式通販で、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.edion.com/item_list.html?keyword=${encodeURIComponent(jan)}`,
    },
    {
      id: 'joshin',
      name: 'Joshin',
      description: 'Joshin webショップで、このJANコードを検索します。',
      buildUrl: (jan) => `https://joshinweb.jp/dps/srhzs.html?KEY=ZS_ALL&KEYWORD=${encodeURIComponent(jan)}&REQUEST_CODE=1`,
    },
    {
      id: 'sofmap',
      name: 'ソフマップ',
      description: 'ソフマップ・ドットコムで、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.sofmap.com/search_result.aspx?keyword=${encodeURIComponent(jan)}`,
    },
    {
      id: 'surugaya',
      name: '駿河屋',
      description: '駿河屋で、新品・中古を含めてこのJANコードを検索します。',
      buildUrl: (jan) => `https://www.suruga-ya.jp/search?category=&search_word=${encodeURIComponent(jan)}`,
    },
    {
      id: 'geo',
      name: 'ゲオ',
      description: 'ゲオオンラインストアで、このJANコードを検索します。',
      buildUrl: (jan) => `https://ec.geo-online.co.jp/shop/goods/search.aspx?keyword=${encodeURIComponent(jan)}`,
    },
    {
      id: 'toysrus',
      name: 'トイザらス',
      description: 'トイザらス オンラインストアで、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.toysrus.co.jp/search/?q=${encodeURIComponent(jan)}`,
    },
    {
      id: 'pokemoncenter',
      name: 'ポケモンセンター',
      description: 'ポケモンセンターオンラインで、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.pokemoncenter-online.com/search/?q=${encodeURIComponent(jan)}`,
    },
    {
      id: 'amiami',
      name: 'あみあみ',
      description: 'あみあみオンライン本店で、このJANコードを検索します。',
      buildUrl: (jan) => `https://slist.amiami.jp/top/search/list?s_keywords=${encodeURIComponent(jan)}&pagemax=60`,
    },
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'Amazon.co.jpで、このJANコードをキーワード検索します。',
      buildUrl: (jan) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(jan)}`,
    },
    {
      id: 'rakuten',
      name: '楽天市場',
      description: '楽天市場で、このJANコードを検索します。',
      buildUrl: (jan) => `https://search.rakuten.co.jp/search/mall/${encodeURIComponent(jan)}/`,
    },
    {
      id: 'yahoo',
      name: 'Yahoo!',
      description: 'Yahoo!ショッピングで、このJANコードを検索します。',
      buildUrl: (jan) => `https://shopping.yahoo.co.jp/search/${encodeURIComponent(jan)}/0/`,
    },
  ];

  let currentJan = '';
  let activeStoreIndex = 0;
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

  const buildTabs = () => {
    storeTabs.replaceChildren();

    stores.forEach((store, index) => {
      const link = document.createElement('a');
      link.className = 'jan-store-tab';
      link.id = `store-tab-${store.id}`;
      link.dataset.storeIndex = String(index);
      link.href = store.buildUrl(currentJan);
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
    if (!store || !currentJan) return;

    storeName.textContent = store.name;
    storeDescription.textContent = store.description;
    storeLink.href = store.buildUrl(currentJan);
    storeLink.textContent = `${store.name}で商品を見る →`;

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

  const showStoreSearch = (jan) => {
    currentJan = jan;
    currentJanEl.textContent = jan;
    storeSearch.hidden = false;
    copyJanButton.hidden = false;
    status.textContent = '店舗名を押すと、このJANコードの検索結果を新しいWindowで開きます。';
    buildTabs();
    renderStore();

    const url = new URL(window.location.href);
    url.searchParams.set('jan', jan);
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const submitJan = (jan, shouldScroll = true) => {
    const normalized = normalizeJan(jan);
    input.value = normalized;

    if (!/^\d{8}$|^\d{13}$/.test(normalized)) {
      showError('JANコードは8桁または13桁の数字で入力してください。');
      return false;
    }

    if (!isValidJan(normalized)) {
      showError('JANコードのチェックデジットが一致しません。入力内容を確認してください。');
      return false;
    }

    showError('');
    showStoreSearch(normalized);
    if (shouldScroll) {
      document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    return true;
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitJan(input.value);
  });

  nextStoreButton.addEventListener('click', () => selectStore(activeStoreIndex + 1, true));

  copyJanButton.addEventListener('click', async () => {
    if (!currentJan) return;
    try {
      await navigator.clipboard.writeText(currentJan);
      copyJanButton.textContent = 'コピーしました';
      window.setTimeout(() => { copyJanButton.textContent = 'JANをコピー'; }, 1400);
    } catch (_) {
      input.focus();
      input.select();
      status.textContent = 'JANコードを選択しました。コピーしてください。';
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
          closeScanner();
          submitJan(jan);
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

  const initialJan = normalizeJan(new URLSearchParams(window.location.search).get('jan'));
  if (initialJan && isValidJan(initialJan)) {
    input.value = initialJan;
    submitJan(initialJan, false);
  }
})();
