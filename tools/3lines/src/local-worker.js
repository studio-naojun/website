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
    gist: '1行目は「何の話で、何が示されたか」。2行目は「一番重要な条件・線引き」。3行目は「結局どう理解・行動するか」。',
    points: '文章全体の重要論点を、重ならない3点にする。細かい例を3つ並べない。',
    easy: '専門知識がない人にも分かる言葉で、何の話か・大事な条件・結局どうするかの3行にする。',
    faithful: '原文の立場や条件を変えず、中心結論・重要条件・実務上の意味の3行にする。',
  }[style] || '文章全体の意味が初見の人にも分かる3行にする。';
}

function promptFor(style, digest) {
  return `次の「要点メモ」を、元の文章を読んでいない人にも分かる3行に言い換えてください。\n${instructionFor(style)}\n要点メモの見出し語をそのまま繰り返すだけにせず、意味が通る短い文にしてください。原文にない事実は足さないでください。\n出力は必ず次の3行だけです。\n1. ...\n2. ...\n3. ...\n\n要点メモ:\n${digest}`;
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
      max_new_tokens: 120,
      do_sample: true,
      top_p: 0.95,
      temperature: 0.7,
      repetition_penalty: 1.05,
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
