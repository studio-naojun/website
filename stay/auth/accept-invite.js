(async function () {
  const $ = (selector) => document.querySelector(selector);
  const cfg = window.STAY_ATLAS_AUTH_CONFIG || {};
  const status = $('#status');
  const message = $('#message');
  const detail = $('#detail');
  const form = $('#passwordForm');
  const complete = $('#complete');
  let client = null;

  function setStatus(text) {
    status.textContent = text;
  }

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle('error', isError);
  }

  function configured() {
    return cfg.enabled === true && /^https:\/\//.test(cfg.url || '') && Boolean(cfg.publishableKey);
  }

  function paramsFromHash() {
    return new URLSearchParams(window.location.hash.replace(/^#/, ''));
  }

  function paramsFromQuery() {
    return new URLSearchParams(window.location.search);
  }

  function redirectError() {
    const hash = paramsFromHash();
    const query = paramsFromQuery();
    return hash.get('error_description') || query.get('error_description') || hash.get('error') || query.get('error') || '';
  }

  function loadSupabase() {
    if (window.supabase?.createClient) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Supabase library could not be loaded'));
      document.head.appendChild(script);
    });
  }

  async function resolveSession() {
    const query = paramsFromQuery();
    const hash = paramsFromHash();
    const code = query.get('code');

    if (code) {
      const exchanged = await client.auth.exchangeCodeForSession(code);
      if (exchanged.error) throw exchanged.error;
      if (exchanged.data?.session) return exchanged.data.session;
    }

    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    if (accessToken && refreshToken) {
      const restored = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (restored.error) throw restored.error;
      if (restored.data?.session) return restored.data.session;
    }

    const existing = await client.auth.getSession();
    if (existing.error) throw existing.error;
    if (existing.data?.session) return existing.data.session;

    return null;
  }

  const authError = redirectError();
  if (authError) {
    setStatus('INVITE ERROR');
    setMessage('招待リンクを確認できませんでした。新しい招待メールを発行してください。', true);
    detail.textContent = authError;
    return;
  }

  if (!configured()) {
    setStatus('NOT CONFIGURED');
    setMessage('この招待ページはまだSupabase接続前です。Project URLとPublishable Keyの設定後に新しい招待メールを発行してください。');
    detail.textContent = 'Secret key / service_role key はこのページには設定しません。';
    return;
  }

  try {
    setStatus('CONNECTING');
    await loadSupabase();
    client = window.supabase.createClient(cfg.url, cfg.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const session = await resolveSession();
    if (!session?.user) {
      setStatus('INVITE REQUIRED');
      setMessage('有効な招待Sessionを確認できませんでした。新しく発行した招待メールからこのページを開いてください。', true);
      return;
    }

    setStatus('INVITE VERIFIED');
    setMessage(`${session.user.email || '招待ユーザー'} の確認が完了しました。新しいPasswordを設定してください。`);
    form.hidden = false;
  } catch (error) {
    console.error(error);
    setStatus('AUTH ERROR');
    setMessage('招待Sessionの確認中にエラーが発生しました。', true);
    detail.textContent = error.message || String(error);
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const password = $('#password').value;
    const confirmation = $('#passwordConfirm').value;

    if (password.length < 12) {
      detail.textContent = 'Passwordは12文字以上にしてください。';
      return;
    }
    if (password !== confirmation) {
      detail.textContent = '2つのPasswordが一致していません。';
      return;
    }

    setStatus('SAVING');
    detail.textContent = 'Passwordを設定しています。';

    try {
      const updated = await client.auth.updateUser({ password });
      if (updated.error) throw updated.error;
      if (!updated.data?.user) throw new Error('Password update did not return a user');

      await client.auth.signOut();
      form.hidden = true;
      complete.hidden = false;
      setStatus('COMPLETE');
      setMessage('管理者アカウントのPassword設定が完了しました。');
      detail.textContent = 'Stay AtlasのDB編集権限は別途 app_metadata.stay_atlas_role = admin で付与します。';
      history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error(error);
      setStatus('SAVE ERROR');
      setMessage('Passwordを設定できませんでした。', true);
      detail.textContent = error.message || String(error);
    }
  });
})();
