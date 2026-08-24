const MODEL_ID = 'Qwen3-1.7B-q4f16_1-MLC';
const WEBLLM_URL = 'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.82/+esm';
const MODEL_REVISION = '80b3abc23aacab805bc16d33cf619fa7c0dcf720';
const MODEL_URL = `https://huggingface.co/mlc-ai/${MODEL_ID}/resolve/${MODEL_REVISION}`;
const MODEL_LIB_REVISION = '025bcaf3780fa8254f5e5efd3bfea0a5397248f4';
const MODEL_LIB_URL = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/${MODEL_LIB_REVISION}/web-llm-models/v0_2_80/Qwen3-1.7B-q4f16_1-ctx4k_cs1k-webgpu.wasm`;
const VRAM_REQUIRED_MB = 2036.66;
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
            model_list: [{
              model: MODEL_URL,
              model_id: MODEL_ID,
              model_lib: MODEL_LIB_URL,
              vram_required_MB: VRAM_REQUIRED_MB,
              low_resource_required: true,
              overrides: { context_window_size: 4096 },
            }],
          },
          initProgressCallback: (progress) => post('progress', { progress: progress?.text || '', warm: engineReady }),
        });
      })
      .then((engine) => { engineReady = true; return engine; })
      .catch((error) => { enginePromise = undefined; engineReady = false; throw error; });
  }
  return enginePromise;
}

function instructionFor(style) {
  return {
    gist: '1行目は「何の話で、何が分かった・変わったのか」。2行目は「いちばん重要な条件・線引き・意味」。3行目は「結局、読者はどう理解・行動すればよいか」。',
    points: '文章全体で最重要の論点を、重複しない3点に分ける。細かい例を3つ並べず、全体像が分かる3点にする。',
    easy: '専門知識のない人向けに、1行目=何の話か、2行目=大事な条件、3行目=結局どうすればよいか、の順でやさしく説明する。',
    faithful: '原文の立場を変えず、1行目=中心結論、2行目=重要な条件・留保、3行目=実務上の意味をまとめる。',
  }[style] || '文章全体の意味を、初見の人にも分かる3行にする。';
}

function promptFor(style, slate) {
  return `以下は長文から抜き出した「題名・まとめ・主要論点」です。原文の一部をそのまま3本コピーするのではなく、文章全体の意味を短い日本語に言い直してください。\n\n${instructionFor(style)}\n\n必須:\n- 3行だけを読んだ人が、原文を読んでいなくても話の全体像を説明できること。\n- 抽象語や専門用語を置くだけにせず、その語が何を意味するかまで短く説明すること。\n- 見出し＋原文の長い引用をそのままつなげないこと。\n- 重要度の低い具体例や枝葉だけで3行を埋めないこと。\n- 原文にない事実・数字・固有名詞・評価を加えないこと。\n- 各行100文字以内。備考は本論の代わりに使わないこと。\n\n形式だけを返す:\n1. ...\n2. ...\n3. ...\n備考: ...（本当に必要な例外が1つある時だけ）\n\n資料:\n${slate}`;
}

async function handleSummarize(data) {
  const { requestId, style, slate } = data;
  try {
    post('preparing', { requestId, modelId: MODEL_ID, warm: engineReady || Boolean(enginePromise) });
    const engine = await loadEngine();
    post('ready', { requestId, modelId: MODEL_ID, warm: true });
    const response = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'あなたは日本語の3行要約器です。抜粋ではなく意味を要約します。初見の一般読者が3行だけで全体像を理解できる自然な日本語にしてください。指定形式以外は出力しません。',
        },
        { role: 'user', content: promptFor(style, slate) },
      ],
      temperature: 0.3,
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
