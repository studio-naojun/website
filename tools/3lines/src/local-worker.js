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
    gist: '結論・中心主張を最優先し、枝葉を落とす',
    points: '重複しない主な論点を3つ選ぶ',
    easy: '意味と条件を変えず、平易な言葉に言い換える',
    faithful: '条件・否定・留保・書き手の立場を特に落とさない',
  }[style] || '結論・中心主張を最優先する';
  return `次の原文由来の候補だけを使い、${styleText}要約を作ってください。外部知識や事実確認は禁止です。候補番号は出力しません。同じ内容を言い換えて3回繰り返さず、別々の重要点を1つずつ選びます。思考過程は出力せず、次の形式を厳守してください。\n1. 1つ目\n2. 2つ目\n3. 3つ目\n備考: 重要な条件・例外がある時だけ1行。なければ備考行は省略。\n各項目は1文、100文字以内。\n\n候補:\n${slate}`;
}

async function handleSummarize(data) {
  const { requestId, style, slate } = data;
  try {
    post('preparing', { requestId, modelId: MODEL_ID, warm: engineReady || Boolean(enginePromise) });
    const engine = await loadEngine();
    post('ready', { requestId, modelId: MODEL_ID, warm: true });
    const response = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: 'あなたは日本語の3行要約器です。原文候補だけを根拠に、短く、重複せず、条件や否定を壊さず、指定形式だけを返します。' },
        { role: 'user', content: promptFor(style, slate) },
      ],
      temperature: 0.1,
      top_p: 0.8,
      max_tokens: 240,
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
