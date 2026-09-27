# FitPot ML

Two learning tracks, each in three stages: build from scratch → fine-tune → ship.
All training runs on free Google Colab GPUs.

## vision/ — food plate recognition
1. **Scratch CNN** on Food-101 (PyTorch). Write the conv layers, augmentation and training loop yourself.
2. **Fine-tune** a pretrained EfficientNet / small ViT on the same data; compare against stage 1.
3. **Ship**: export to TensorFlow.js / ONNX so it runs in the browser. Predicted dish → macros from Open Food Facts; user adjusts portions.

## language/ — nudges and tips
1. **Tiny GPT from scratch** (nanoGPT-style): tokenizer, attention, training loop.
2. **Fine-tune Gemma** with LoRA on a dataset of nudge messages.
3. **Ship**: run in the browser (MediaPipe LLM inference), with templated nudges as the fallback.

Notebooks land here phase by phase.
