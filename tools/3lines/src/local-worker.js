const MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC';
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/+esm';
const MODEL_REVISION = '8c14ce481d4c692769976ad52afea453a102df19';
const MODEL_URL = `https://huggingface.co/mlc-ai/${MODEL_ID}/resolve/${MODEL_REVISION}`;
const MODEL_LIB_REVISION = '025bcaf3780fa8254f5e5efd3bfea0a5397248f4';
const MODEL_LIB_URL = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${MODEL_LIB_REVISION}/web-llm-models/v0_2_80/Qwen3-0.6B-q4f16_1-ctx4k_cs1k-webgpu.wasm`;
let enginePromise;
let engineReady = false;
let taskQueue = Promise.resolve();

function post(type, payload = {}) { self.postMessage({ type, ...payload }); }

async function loadEngine() {
  if (!enginePromise) {
    enginePromise = import(WEBLLM_URL)
      .then(({ CreateMLCEngine }) => {
        if (typeof CreateMLCEngine !== 'function') throw new Error('WebLLMの初期化関数が見つかりません。');
        return CreateMLCEngine(MODEL_ID, {
          appConfig: {
            model_list: [{ model: MODEL_URL, model_id: MODEL_ID, model_lib: MODEL_LIB_URL, vram_required_MB: 1403.34, low_resource_required: true, overrides: { context_window_size: 4096 } }],
          },
          initProgressCallback: (progress) => post('progress', { progress: progress?.text || '', warm: engineReady }),
        });
      })
      .then((engine) => { engineReady = true; return engine; })
      .catch((error) => { enginePromise = undefined; engineReady = false; throw error; });
  }
  return enginePromise;
}

function baseInstruction(style) {
  return {
    gist: '1行目=何の話で何が示されたか。2行目=最大の分水嶺・条件。3行目=結局どうすべきか。',
    points: '記事全体から重複しない主要論点を3つ。別々のCOREまたはSUMMARYを優先する。',
    easy: '1行目=何の話か。2行目=大事な条件。3行目=結局どうすればよいか。専門用語は原文の意味を壊さない範囲で言い換える。',
    faithful: '1行目=中心結論。2行目=条件・否定・留保。3行目=実務上の意味。原文の立場を変えない。',
  }[style] || '記事全体の結論・条件・実務上の意味を3行にする。';
}

function promptFor(style, slate, repairFrom = '', repairReason = '') {
  const repairBlock = repairFrom
    ? `\n前回案は「${repairReason || '全体の意味を説明できていない'}」ため不合格でした。前回案の語順や選んだ細部に引きずられず、資料から作り直してください。\n前回案:\n${repairFrom}\n`
    : '';
  return `次の資料は原文を文書構造ごとに圧縮したものです。SUMMARYとCOREが本論、PRACTICALは実務、CONTEXTは背景です。\n${baseInstruction(style)}\n${repairBlock}\n絶対条件:\n- 3行だけ読んだ人が「何の話か・何が重要か・結局どうするか」を理解できるようにする。\n- 原文の文を3本抜き出すだけにしない。必要なら短く統合して言い換える。\n- 同じ節や同じ箇条書きの細部だけで3行を埋めない。\n- SUMMARY/COREの中心論点を最低2行に使う。\n- 外部知識・事実確認・原文にない数字や固有名詞は禁止。\n- 1行100文字以内。備考は本論の代わりに使わない。\n\n出力形式だけを返す:\n1. ...\n2. ...\n3. ...\n備考: ...（重要な例外が1つある時だけ）\n\n資料:\n${slate}`;
}

async function handleSummarize(data) {
  const { requestId, style, slate, repairFrom = '', repairReason = '' } = data;
  try {
    post('preparing', { requestId, modelId: MODEL_ID, warm: engineReady || Boolean(enginePromise), repair: Boolean(repairFrom) });
    const engine = await loadEngine();
    post('ready', { requestId, modelId: MODEL_ID, warm: true, repair: Boolean(repairFrom) });
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: 'あなたは日本語の3行要約器です。抜粋ではなく、文書全体の意味を3つの短い役割に再構成します。3行だけで初見の人にも意味が通るように書きます。指定形式だけを返します。' },
        { role: 'user', content: promptFor(style, slate, repairFrom, repairReason) },
      ],
      temperature: repairFrom ? 0.25 : 0.35,
      top_p: 0.8,
      max_tokens: 180,
    });
    const content = response?.choices?.[0]?.message?.content || '';
    post('result', { requestId, raw: content, modelId: MODEL_ID });
  } catch (error) {
    post('error', { requestId, message: error instanceof Error ? error.message : String(error) });
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'summarize') return;
  const data = event.data;
  taskQueue = taskQueue.then(() => handleSummarize(data), () => handleSummarize(data));
});
