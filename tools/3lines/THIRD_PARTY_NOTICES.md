# Third-party notices — 究極の3行

## TinySummarizer

- Upstream: `hitoshin/tiny_summarizer`
- Upstream source reference: `TinySummarizer.js` blob `7fa35b2d51c6e8afb99a040319e05c426812811f`
- License: Apache License 2.0
- Product use: the local module `vendor/tiny-summarizer-tf.js` adapts TinySummarizer's term-frequency sentence-scoring idea.

The product combines that term-frequency signal with its own sentence centrality, document-heading/structure signals, condition/negation cues, and diversity selection. The final three-line semantic composer is product-specific code.

No third-party generative model or hosted inference runtime is part of the normal summarization route.

Apache License 2.0 text: https://www.apache.org/licenses/LICENSE-2.0
