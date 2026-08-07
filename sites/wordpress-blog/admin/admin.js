(() => {
  const demoComments = [
    {
      id: 5001,
      parentId: null,
      author: 'Sample Reader',
      createdAt: '2024-04-12T10:30:00+09:00',
      body: 'これはUI確認専用の架空コメントです。実WordPressデータではありません。'
    },
    {
      id: 5002,
      parentId: 5001,
      author: 'Sample Admin',
      createdAt: '2024-04-12T12:00:00+09:00',
      body: '返信ツリーの表示確認用です。'
    }
  ];

  const list = document.querySelector('#comment-list');
  if (!list) return;

  const formatter = new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  for (const comment of demoComments) {
    const item = document.createElement('div');
    item.className = 'comment';
    const parent = comment.parentId ? ` / reply to ${comment.parentId}` : '';
    item.innerHTML = `
      <p class="meta">#${comment.id}${parent} / ${formatter.format(new Date(comment.createdAt))}</p>
      <strong></strong>
      <p class="comment-body"></p>
    `;
    item.querySelector('strong').textContent = comment.author;
    item.querySelector('.comment-body').textContent = comment.body;
    list.appendChild(item);
  }
})();
