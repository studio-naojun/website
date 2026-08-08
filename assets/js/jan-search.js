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
  const storeFrame = document.getElementById('store-frame');
  const frameNote = document.getElementById('frame-note');
  const currentJanEl = document.getElementById('current-jan');
  const copyJanButton = document.getElementById('copy-jan');
  const openAllButton = document.getElementById('open-all-stores');
  const nextStoreButton = document.getElementById('next-store');
  const scannerDialog = document.getElementById('scanner-dialog');
  const scannerVideo = document.getElementById('scanner-video');
  const scannerStatus = document.getElementById('scanner-status');
  const scanButton = document.getElementById('scan-button');
  const scannerClose = document.getElementById('scanner-close');

  const stores = [
    {
      id: 'yodobashi',
      name: 'ヨドバシ',
      description: 'ヨドバシ.comで、このJANコードを検索します。',
      buildUrl: (jan) => `https://www.yodobashi.com/?word=${encodeURIComponent(jan)}`,
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
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'jan-store-tab';
      button.id = `store-tab-${store.id}`;
      button.dataset.storeIndex = String(index);
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'store-panel');
      button.setAttribute('aria-selected', index === activeStoreIndex ? 'true' : 'false');
      button.tabIndex = index === activeStoreIndex ? 0 : -1;
      button.textContent = store.name;
      button.addEventListener('click', () => selectStore(index));
      button.addEventListener('keydown', handleTabKeydown);
      storeTabs.append(button);
    });
  };

  const renderStore = () => {
    const store = stores[activeStoreIndex];
    if (!store || !currentJan) return;

    const url = store.buildUrl(currentJan);
    storeName.textContent = store.name;
    storeDescription.textContent = store.description;
    storeLink.href = url;
    storeLink.textContent = `${store.name}で商品を見る →`;
    storeFrame.src = url;
    storeFrame.title = `${store.name}の検索結果`;
    frameNote.textContent = `${store.name}側の設定により、この枠内に表示できない場合があります。その場合は「${store.name}で商品を見る」から新しいWindowで開いてください。`;

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
    openAllButton.hidden = false;
    status.textContent = '販売店タブを切り替えると、下の表示も同じJANコードで切り替わります。';
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

  openAllButton.addEventListener('click', () => {
    if (!currentJan) return;
    let blocked = 0;

    stores.forEach((store) => {
      const popup = window.open(store.buildUrl(currentJan), '_blank', 'noopener,noreferrer');
      if (!popup) blocked += 1;
    });

    status.textContent = blocked
      ? `一部または全部の新しいWindowがブラウザにブロックされました。ポップアップを許可して、もう一度お試しください。`
      : `${stores.length}サイトを新しいWindowで開きました。`;
  });

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
