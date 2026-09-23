(async function () {
  const list = document.getElementById('admissions-report-list');
  if (!list) return;

  try {
    const response = await fetch('feed.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`feed fetch failed: ${response.status}`);

    const feed = await response.json();
    const entries = Array.isArray(feed.entries) ? feed.entries : [];

    if (!entries.length) return;

    list.innerHTML = '';
    for (const entry of entries) {
      const card = document.createElement('article');
      card.className = 'admissions-report-card';

      const meta = document.createElement('div');
      meta.className = 'report-meta';
      const type = entry.type === 'special' ? 'SPECIAL' : 'WEEKLY';
      meta.textContent = `${type} / ${entry.published_at || ''}`;

      const body = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = entry.title || 'Untitled report';
      const summary = document.createElement('p');
      summary.textContent = entry.summary || '';
      body.append(title, summary);

      const link = document.createElement('a');
      link.className = 'report-link';
      link.href = entry.path || '#';
      link.textContent = '読む';

      card.append(meta, body, link);
      list.append(card);
    }
  } catch (error) {
    console.error('Admissions feed could not be loaded.', error);
  }
})();
