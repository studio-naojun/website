(() => {
  const byId = (id) => document.getElementById(id);
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

  function renderState(state) {
    if (!state || typeof state !== 'object') return;

    const regime = byId('regime-title');
    if (regime && state.regime?.name) regime.textContent = state.regime.name;

    const confidence = byId('regime-confidence');
    if (confidence) {
      const bits = [];
      if (state.regime?.confidence) bits.push(`Confidence: ${state.regime.confidence}`);
      if (state.as_of) bits.push(`As of ${state.as_of}`);
      confidence.textContent = bits.join(' · ');
    }

    const scenarioRoot = byId('scenario-bars');
    if (scenarioRoot) {
      scenarioRoot.replaceChildren();
      for (const scenario of state.scenarios || []) {
        const row = document.createElement('div');
        row.className = 'scenario-row';

        const label = document.createElement('div');
        label.className = 'scenario-label';
        label.textContent = scenario.label || scenario.id || 'Scenario';

        const value = document.createElement('div');
        value.className = 'scenario-value';
        value.textContent = `${number(scenario.probability)}%`;

        const track = document.createElement('div');
        track.className = 'scenario-track';
        const fill = document.createElement('div');
        fill.className = 'scenario-fill';
        fill.style.width = `${Math.max(0, Math.min(100, number(scenario.probability)))}%`;
        track.appendChild(fill);

        row.append(label, value, track);
        scenarioRoot.appendChild(row);
      }
    }

    const forecastRoot = byId('forecast-grid');
    if (forecastRoot) {
      forecastRoot.replaceChildren();
      const forecasts = state.forecasts || [];
      if (!forecasts.length) {
        const empty = document.createElement('div');
        empty.className = 'forecast-card';
        empty.textContent = '最初の月次予想を準備しています。';
        forecastRoot.appendChild(empty);
      }
      for (const item of forecasts) {
        const card = document.createElement('article');
        card.className = 'forecast-card';

        const label = document.createElement('div');
        label.className = 'forecast-label';
        label.textContent = item.label || item.id || '';

        const value = document.createElement('div');
        value.className = 'forecast-value';
        value.textContent = item.value ?? '—';

        const range = document.createElement('div');
        range.className = 'forecast-range';
        range.textContent = item.range ? `Range ${item.range}` : (item.note || '');

        card.append(label, value, range);
        forecastRoot.appendChild(card);
      }
    }

    const updated = byId('state-updated');
    if (updated && state.updated_note) updated.textContent = state.updated_note;
  }

  function renderFeed(feed) {
    const root = byId('article-list');
    if (!root) return;
    root.replaceChildren();

    const entries = Array.isArray(feed?.entries) ? feed.entries : [];
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '最初の記事を準備しています。';
      root.appendChild(empty);
      return;
    }

    for (const entry of entries) {
      const link = document.createElement('a');
      link.className = 'article-entry';
      link.href = entry.path || '#';

      const kicker = document.createElement('div');
      kicker.className = 'article-kicker';
      const type = String(entry.type || 'article').toUpperCase();
      kicker.textContent = entry.published_at ? `${type} · ${entry.published_at}` : type;

      const content = document.createElement('div');
      const title = document.createElement('div');
      title.className = 'article-title';
      title.textContent = entry.title || 'Untitled';
      const summary = document.createElement('p');
      summary.className = 'article-summary';
      summary.textContent = entry.summary || '';
      content.append(title, summary);

      const arrow = document.createElement('div');
      arrow.className = 'article-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';

      link.append(kicker, content, arrow);
      root.appendChild(link);
    }
  }

  Promise.all([
    fetch('state.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).catch(() => null),
    fetch('feed.json', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).catch(() => null)
  ]).then(([state, feed]) => {
    renderState(state);
    renderFeed(feed);
  });
})();
