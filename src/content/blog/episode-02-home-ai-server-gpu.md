---
title: 'VRAM matters more than GPU generation for local LLMs'
description: 'I bought a 16GB card first and learned it was the wrong axis to optimize. What running models on a 4070 Ti Super and then a 3090 taught me about what actually limits local inference.'
pubDate: 'Oct 04 2025'
series: 'AI Server Build'
seriesOrder: 2
---

In [the last episode](/blog/episode-01-home-ai-server-research) I put the machine together. EPYC 7702P, 256GB of RAM, Samsung 990 Pro. CPU, board, memory, storage, all working.

The GPU is where the actual constraint lives, and that took me two purchases and several months to understand properly.

## Buying the first card

Once the server was running Ubuntu the next step was obvious. Get a GPU, run a model.

Demand was high at the time. A modest 16GB card was going for close to $1,000 and availability was inconsistent. I spent a few weekends refreshing eBay and reading reviews trying to work out what a reasonable price actually was.

I ended up with a Gigabyte RTX 4070 Ti Super, 16GB, from eBay. I overpaid. But I had a card.

I picked the 4070 Ti Super because the 40-series had good community feedback and it seemed like a safe first GPU. That reasoning turned out to be based on the wrong criteria, which I'll get to.

## Getting Ubuntu to see it

Out of the box there were no NVIDIA drivers. The sequence:

1. Remove any existing or conflicting drivers
2. Install a driver version that supports the CUDA toolkit you want
3. Verify with `nvidia-smi`
4. Confirm CUDA is available to PyTorch

```bash
❯ nvcc --version
Cuda compilation tools, release 13.0, V13.0.88

❯ nvidia-smi --version
NVIDIA-SMI version  : 580.82.07
DRIVER version      : 580.82.07
CUDA Version        : 13.0

❯ nvidia-smi -L
GPU 0: NVIDIA GeForce RTX 4070 Ti SUPER (UUID: GPU-63533d8f-5752-2708-12f0-50d32404fb87)
```

Driver 580 supports CUDA 13.0. That's a clean baseline to work from.

This step is also the reason I eventually moved the whole machine to Proxmox, but that's a different series.

## The two tools I used

**llama.cpp** gives you more control. You can measure tokens per second, change quantization, and see exactly where VRAM runs out. This is what I used for benchmarking.

**Ollama** is simpler. One-line install, pull a model, run it. This is what I used once I knew which model I wanted and just needed it serving on the LAN.

Building llama.cpp with CUDA:

```bash
❯ cmake -B build -DGGML_CUDA=ON
❯ cmake --build build --config Release
```

## What 16GB actually gets you

The card was fine right up until I tried a model that didn't fit.

Trying to load QwQ-32B, which is about 33GB:

```bash
❯ llama-bench --model qwq-32b-q8_0.gguf -mg 0 -sm none -ngl 999
error: failed to load model 'qwq-32b-q8_0.gguf'
```

Not slow. It just doesn't load.

A 14B model that fits comfortably:

```
| model           | size      | backend | ngl | test  | t/s               |
| qwen3 14B Q8_0  | 14.61 GiB | CUDA    | 999 | pp512 | 3388.80 ± 14.35   |
| qwen3 14B Q8_0  | 14.61 GiB | CUDA    | 999 | tg128 | 39.47 ± 0.03      |
```

When the model fits entirely in VRAM the performance is genuinely good. 16GB is fine for 14B and under.

The lesson is that this isn't about having a GPU. It's about having enough VRAM to hold the whole model. The moment weights spill into system RAM, throughput falls off a cliff. Tokens per second dropped hard every time offloading kicked in.

I optimized for the wrong thing. I was comparing generations and reviews when the number that mattered was capacity.

Looking back I should have rented GPU time first, just to learn what model sizes actually demand. It would have cost me a fraction of what the card did and I'd have bought better.

## Adding a 3090

After a few months of running models on the LAN I knew which ones I actually wanted and how much memory they needed. So I went back to shopping with a real requirement instead of a guess.

I bought an RTX 3090, 24GB, from eBay for $800. Older generation than the card I already had, but more memory at a better price. That's the tradeoff I would not have understood six months earlier.

> Check your motherboard spec sheet supports multiple GPUs before you buy the second one.

With 40GB across both cards, the 33GB model that wouldn't load now does:

```bash
❯ llama-bench --model qwq-32b-q8_0.gguf -ngl 999
ggml_cuda_init: found 2 CUDA devices:
  Device 0: NVIDIA GeForce RTX 4070 Ti SUPER, compute capability 8.9
  Device 1: NVIDIA GeForce RTX 3090, compute capability 8.6

| model        | size      | backend | ngl | test  | t/s             |
| qwen2 32B Q8 | 32.42 GiB | CUDA    | 999 | pp512 | 1383.08 ± 5.46  |
| qwen2 32B Q8 | 32.42 GiB | CUDA    | 999 | tg128 | 20.76 ± 0.01    |
```

It runs. 1383 tokens/sec on prompt processing, 20.76 tokens/sec generating.

Those numbers are lower than the 14B on a single card, which did 3388 t/s prompt and 39.47 t/s generation. But I want to be careful about what that comparison actually shows, because it doesn't show much. The 32B model is more than twice the size, so I'm changing two things at once. To measure multi-GPU overhead properly I'd need to run the same model on one card and then on two, and I never did that.

What I can say is that splitting a model across cards is not free. Layer-based inference is sequential, so the cards spend time waiting on each other rather than working side by side, and activations crossing PCIe between them costs something. I don't have a clean number for how much.

Two GPUs solved my capacity problem. I wouldn't assume they solve a speed problem.

## What I'd tell someone starting now

Don't chase the newest GPU series. Look at VRAM capacity first.

For a home setup I'd start at 32GB on a single card if you can afford it. Two of those gets you 64GB, which covers most models you'd realistically run at home without splitting across a bus.

The 4070 Ti Super taught me the basics. The 3090 taught me what I should have been measuring in the first place.
