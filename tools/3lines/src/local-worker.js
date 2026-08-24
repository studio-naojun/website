const MODEL_ID = 'onnx-community/llm-jp-3-150m-instruct3-ONNX';
const MODEL_REVISION = '762812c8ba117b760d31d537b0bbeb2f3b2b01ee';
const MODEL_DTYPE = 'q8';
const MODEL_ARTIFACT_SHA256 = '12b5772a9f242607774d19f75e8395ab05ca33f6c7071303158ba4380dce7ad9';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';

let generatorPromise;
let generatorReady = false;
let taskQueue = Promise.resolve();

function post(type, payload = {}) { self.postMessage({ type, ...payload }); }

function progressText(progress) {
  const status = progress?.status || '';
  const file = progress?.file || '';
  const percent = Number.isFinite(progress?.progress) ? `${Math.max(0, Math.min(100, Math.round(progress.progress)))}%` : '';
  if (status === 'progress') return `要約モデルを準備中 ${percent}`.trim();
  if (status === 'download') return `要約モデルをダウンロード中 ${file}`.trim();
  if (status === 'ready') return '要約モデルの準備ができました';
  return '初回のみ約160MBの要約モデルを準備しています…';
}

async function loadGenerator() {
  if (!generatorPromise) {
    generatorPromise = import(TRANSFORMERS_URL)
      .then(async ({ pipeline }) => {
        if (typeof pipeline !== 'function') throw new Error('Transformers.jsの初期化関数が見つかりません。');
        return pipeline('text-generation', MODEL_ID, {
          revision: MODEL_REVISION,
          device: 'wasm',
          dtype: MODEL_DTYPE,
          progress_callback: (progress) => post('progress', {
            progress: progressText(progress),
            warm: generatorReady,
            loaded: progress?.loaded,
            total: progress?.total,
          }),
        });
      })
      .then((generator) => { generatorReady = true; return generator; })
      .catch((error) => { generatorPromise = undefined; generatorReady = false; throw error; });
  }
  return generatorPromise;
}

function instructionFor(style) {
  return {
    gist: '1行目=何についての文章で何が示されたか。2行目=理解を左右する最重要の条件・線引き。3行目=読者が結局どう理解・行動すればよいか。',
    points: '文章全体の重要論点を、互いに重ならない3点として整理する。枝葉の具体例3つではなく、全体像が分かる3点にする。',
    easy: '専門知識のない人向けに、1行目=何の話か、2行目=大事な条件、3行目=結局どうすればよいか、を平易な日本語で説明する。',
    faithful: '原文の立場・条件・留保を変えず、中心結論、重要条件、実務上の意味の3点にまとめる。',
  }[style] || '文章全体を、初見の人にも分かる3つの意味単位にまとめる。';
}

function promptFor(style, digest) {
  return `以下は長文から重要部分を選んだ内部ダイジェストです。抜粋をそのまま3本並べず、文章全体の意味を初見の人にも分かる自然な日本語へ言い直してください。\n\n${instructionFor(style)}\n\n必須条件:\n- 3行だけを読めば、元の長文を読んでいない人でも何の話か説明できる。\n- 抽象語・専門用語を置くだけで終わらず、それが何を意味するか短く説明する。\n- 同じ節の細部だけで3行を埋めない。\n- 原文にない事実、数字、固有名詞、評価を加えない。\n- 原文の否定、条件、例外を逆転させない。\n- 各行120文字以内。\n\n次の形式だけを返す:\n1. ...\n2. ...\n3. ...\n備考: ...（重大な例外が本当に必要な場合だけ）\n\n内部ダイジェスト:\n${digest}`;
}

function extractGeneratedText(result) {
  const generated = result?.[0]?.generated_text;
  if (typeof generated === 'string') return generated.trim();
  if (Array.isArray(generated)) {
    const assistant = [...generated].reverse().find((message) => message?.role === 'assistant');
    return String(assistant?.content || '').trim();
  }
  return '';
}

async function handleSummarize(data) {
  const { requestId, style, digest } = data;
  try {
    post('preparing', { requestId, modelId: MODEL_ID, warm: generatorReady || Boolean(generatorPromise) });
    const generator = await loadGenerator();
    post('ready', { requestId, modelId: MODEL_ID, warm: true });

    const messages = [
      { role: 'system', content: '以下は、タスクを説明する指示です。要求を適切に満たす応答を書きなさい。' },
      { role: 'user', content: promptFor(style, digest) },
    ];
    const result = await generator(messages, {
      max_new_tokens: 180,
      do_sample: false,
      repetition_penalty: 1.08,
    });
    const raw = extractGeneratedText(result);
    if (!raw) throw new Error('要約モデルが空の結果を返しました。');
    post('result', { requestId, raw, modelId: MODEL_ID });
  } catch (error) {
    post('error', { requestId, message: error instanceof Error ? error.message : String(error) });
  }
}

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'summarize') return;
  const data = event.data;
  taskQueue = taskQueue.then(() => handleSummarize(data), () => handleSummarize(data));
});

export { MODEL_ID, MODEL_REVISION, MODEL_DTYPE, MODEL_ARTIFACT_SHA256, TRANSFORMERS_URL };
