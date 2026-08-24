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

function promptFor(style, slate) {
  const styleText = {
    gist: '記事全体の意味を3段で圧縮する。1行目=全体の結論・何が示されたか、2行目=最大の分水嶺・条件・理由、3行目=実務上の意味・次に取る行動',
    points: '記事全体から重複しない主要論点を3つ。別々のCOREまたはSUMMARYを優先する',
    easy: '記事全体の意味を、1行目=結論、2行目=大事な条件、3行目=実務上の意味、の順でやさしい言葉にする',
    faithful: '記事全体の結論・分水嶺・実務上の意味を3行にし、条件・否定・留保・書き手の立場を落とさない',
  }[style] || '記事全体の結論・条件・実務上の意味を3行にする';
  return `次の資料は、原文を文書構造ごとに圧縮したものです。ラベルの優先度は SUMMARY と CORE が最上位、PRACTICAL は補助、CONTEXT は背景です。\n${styleText}。\n\n絶対条件:\n- 3行とも記事全体を説明するための別々の役割を持たせる。\n- 同じ詳細節や同じ箇条書きから3本選ばない。\n- 「推奨項目の5番」「見送られた出力制限」など枝葉だけで3行を埋めない。\n- SUMMARY/COREにある中心論点を最低2行に使う。\n- 備考は本論の代わりに使わない。重要な例外が1つある時だけ。\n- 外部知識・事実確認・原文にない数字や固有名詞は禁止。\n- 候補ラベルや候補番号は出力しない。\n- 各項目は1文、100文字以内。\n\n出力形式だけを返す:\n1. ...\n2. ...\n3. ...\n備考: ...（必要な時だけ）\n\n資料:\n${slate}`;
}

async function handleSummarize(data) {
  const { requestId, style, slate } = data;
  try {
    post('preparing', { requestId, modelId: MODEL_ID, warm: engineReady || Boolean(enginePromise) });
    const engine = await loadEngine();
    post('ready', { requestId, modelId: MODEL_ID, warm: true });
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: 'あなたは日本語の3行要約器です。文書全体の中心を優先し、細部の抜粋3本ではなく、結論・分水嶺・実務上の意味を短く統合します。指定形式だけを返します。' },
        { role: 'user', content: promptFor(style, slate) },
      ],
      temperature: 0.05,
      top_p: 0.7,
      max_tokens: 220,
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
