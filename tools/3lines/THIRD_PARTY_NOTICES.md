# Third-party notices — 究極の3行

This product uses or is informed by the following open-source works.

## LLM-jp-3-150m-instruct3

- Upstream: `llm-jp/llm-jp-3-150m-instruct3`
- Browser export: `onnx-community/llm-jp-3-150m-instruct3-ONNX`
- Developer: LLM-jp / National Institute of Informatics
- License: Apache License 2.0
- Product use: browser-local Japanese text generation through the pinned ONNX export.

The product does not send user text to a hosted inference provider. Network use is limited to downloading static model/runtime assets.

## Transformers.js

- Upstream: `huggingface/transformers.js`
- Release pinned by the product: `@huggingface/transformers@4.2.0`
- License: Apache License 2.0
- Product use: browser-side ONNX Runtime Web / WebAssembly inference.

## TinySummarizer

- Upstream: `hitoshin/tiny_summarizer`
- License: Apache License 2.0
- Product use: Stage A sentence-selection design is informed by TinySummarizer's client-side Japanese term-frequency / important-sentence scoring approach.

The D3 implementation is adapted for this product and combines term-frequency scoring with the product's own heading/structure, condition/negation/action cues, and diversity selection. The original TinySummarizer source is not shipped verbatim.

Apache License 2.0 text: https://www.apache.org/licenses/LICENSE-2.0
