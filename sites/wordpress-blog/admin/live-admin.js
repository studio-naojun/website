(function(){
  const config = window.WORDPRESS_BLOG_SUPABASE_CONFIG;
  const client = window.supabase.createClient(config.url, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const status = document.querySelector('#live-status');
  const note = document.querySelector('#connection-note');
  const loginPanel = document.querySelector('#login-panel');
  const loginForm = document.querySelector('#login-form');
  const loginEmail = document.querySelector('#login-email');
  const loginPassword = document.querySelector('#login-password');
  const loginMessage = document.querySelector('#login-message');
  const workspace = document.querySelector('#workspace');
  const liveUser = document.querySelector('#live-user');
  const reloadBtn = document.querySelector('#reload-btn');
  const logoutBtn = document.querySelector('#logout-btn');
  const filterInput = document.querySelector('#filter-input');
  const commentList = document.querySelector('#comment-list');
  const summary = document.querySelector('#result-summary');
  const loadMoreBtn = document.querySelector('#load-more-btn');

  const PAGE_SIZE = 100;
  let rows = [];
  let offset = 0;
  let exhausted = false;
  let currentUser = null;

  function isAdmin(user){
    return user?.app_metadata?.wordpress_blog_role === 'admin';
  }

  function setStatus(label, message){
    status.textContent = label;
    note.textContent = message;
  }

  function resetData(){
    rows = [];
    offset = 0;
    exhausted = false;
    render();
  }

  function makeText(tag, className, value){
    const node = document.createElement(tag);
    if(className) node.className = className;
    node.textContent = value || '';
    return node;
  }

  function render(){
    const term = (filterInput.value || '').trim().toLowerCase();
    const filtered = term ? rows.filter(row => {
      return [row.post_slug, row.author_display_name, row.comment_body, row.wordpress_status]
        .some(value => String(value || '').toLowerCase().includes(term));
    }) : rows;

    commentList.replaceChildren();
    for(const row of filtered){
      const card = document.createElement('div');
      card.className = 'comment';
      const meta = `#${row.legacy_comment_id} / post ${row.legacy_post_id} / ${row.post_slug || ''} / ${row.wordpress_status || ''} / ${row.created_at || ''}`;
      card.appendChild(makeText('p', 'meta', meta));
      card.appendChild(makeText('strong', '', row.author_display_name || '(no display name)'));
      card.appendChild(makeText('p', 'comment-body', row.comment_body || ''));
      if(row.parent_legacy_comment_id && Number(row.parent_legacy_comment_id) !== 0){
        card.appendChild(makeText('p', 'private-note', `reply to #${row.parent_legacy_comment_id}`));
      }
      commentList.appendChild(card);
    }
    summary.textContent = `${filtered.length}件表示 / ${rows.length}件読込済み${exhausted ? ' / 全件読込済み' : ''}`;
    loadMoreBtn.disabled = exhausted || !currentUser;
  }

  async function loadNextPage({reset=false} = {}){
    if(reset) resetData();
    if(exhausted) return;
    loadMoreBtn.disabled = true;
    const from = offset;
    const to = offset + PAGE_SIZE - 1;
    const { data, error } = await client
      .from('wp_legacy_comments')
      .select('legacy_comment_id,legacy_post_id,post_slug,parent_legacy_comment_id,author_display_name,comment_body,created_at,wordpress_status,comment_type')
      .order('created_at', {ascending:false})
      .range(from, to);

    if(error){
      setStatus('ERROR', `Private Archiveの読込に失敗しました: ${error.message}`);
      loadMoreBtn.disabled = false;
      return;
    }
    const page = data || [];
    rows.push(...page);
    offset += page.length;
    exhausted = page.length < PAGE_SIZE;
    render();
  }

  async function applySession(session){
    currentUser = session?.user || null;
    if(!currentUser){
      workspace.hidden = true;
      loginPanel.hidden = false;
      setStatus('AUTH REQUIRED', '管理者ログインが必要です。未認証状態ではDatabaseからコメントを取得しません。');
      return;
    }
    if(!isAdmin(currentUser)){
      workspace.hidden = true;
      loginPanel.hidden = false;
      loginMessage.textContent = 'このAccountには旧コメントArchiveのAdmin権限がありません。';
      setStatus('NOT ADMIN', '認証済みですがAdmin roleがありません。Database RLSも読取を拒否します。');
      return;
    }

    loginPanel.hidden = true;
    workspace.hidden = false;
    liveUser.textContent = currentUser.email || currentUser.id;
    setStatus('LIVE DB', '認証済みAdminとしてPrivate Archiveへ接続しています。');
    await loadNextPage({reset:true});
  }

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    loginMessage.textContent = 'ログイン中…';
    const { data, error } = await client.auth.signInWithPassword({
      email: loginEmail.value,
      password: loginPassword.value
    });
    loginPassword.value = '';
    if(error){
      loginMessage.textContent = `ログイン失敗: ${error.message}`;
      return;
    }
    loginMessage.textContent = '';
    await applySession(data.session);
  });

  logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    resetData();
    await applySession(null);
  });
  reloadBtn.addEventListener('click', () => loadNextPage({reset:true}));
  loadMoreBtn.addEventListener('click', () => loadNextPage());
  filterInput.addEventListener('input', render);

  client.auth.onAuthStateChange((_event, session) => {
    if((session?.user?.id || null) !== (currentUser?.id || null)) applySession(session);
  });

  (async () => {
    const { data, error } = await client.auth.getSession();
    if(error){
      setStatus('ERROR', `Auth Session確認に失敗しました: ${error.message}`);
      loginPanel.hidden = false;
      return;
    }
    await applySession(data.session);
  })();
})();
