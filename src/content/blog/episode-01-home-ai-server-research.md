---
title: 'Building a home AI server: the hardware I picked and why'
description: 'What it costs and what it takes to build a machine for running LLMs at home. EPYC 7702P, 256GB of RAM, and a lot of used server hardware from eBay.'
pubDate: 'Mar 11 2025'
series: 'AI Server Build'
seriesOrder: 1
---

Most of the interesting language models sit behind cloud APIs. That's fine until you start thinking about what you're sending, what it costs over time, and how little control you have over either.

I wanted to know what it would take to run them at home instead.

## Why build instead of rent

Renting GPU time is cheaper to start with and I know that. Nobody needs to own hardware to use a model.

But I learn more from running the thing myself. I wanted to understand where the actual bottlenecks are, and you don't find those on a managed endpoint that either responds or doesn't. I'm a software engineer, not a hardware person, so this was going to be a learning exercise as much as a build.

## The parts

| Component | Part |
|-----------|------|
| Motherboard | Gigabyte MZ31-AR0 |
| Processor | AMD EPYC 7702P (64 cores / 128 threads) |
| Cooler | Noctua NH-U14S TR4-SP3 |
| Memory | Micron 256GB DDR4-3200 LRDIMM (2×128GB) |
| Storage | Samsung 990 PRO 2TB NVMe |
| PSU | Corsair RM1200x Fully Modular |
| Thermal paste | ARCTIC MX-4 |
| Case | Fractal Design North XL |

## Why these parts

**EPYC 7702P.** 64 cores and 128 threads, built for sustained load rather than burst. It handles preprocessing and running several things at once. The GPU comes later and does the inference work.

**Gigabyte MZ31-AR0.** 16 DIMM slots across 8 channels, up to 2TB of memory, 7 PCIe slots and 128 lanes. I wanted headroom more than I wanted a current-generation board.

**256GB of RAM.** Models are memory hungry and this was the single largest cost in the build. I went back and forth on it. Starting here means I'm not swapping to disk on day one.

**RM1200x and the North XL.** Both sized for GPUs I haven't bought yet. Adding one later shouldn't mean rebuilding the machine.

## How I chose

I want to be honest about this because the process wasn't rigorous.

I started on YouTube watching build guides. That gave me a rough sense of what a server-grade build looks like and what people regret buying. I understood maybe half of it.

Then I read spec sheets. Gigabyte's documentation for the board, AMD's for the CPU, Samsung's for the drive. I checked socket compatibility, RAM support, and power draw.

One thing I found in the process: the MZ31-AR0 is PCIe 3.0 only, while most new hardware has moved to 4.0 and beyond. I decided the price was worth the limitation. If PCIe bandwidth turns out to be the bottleneck, the board is the piece I replace.

I also asked GPT to sanity check the combination. Whether the Noctua cooler clears the socket, whether the memory was actually supported. It was faster than searching forums at midnight and it was right, though I'd probably have caught the same things eventually.

## What it cost

The board and CPU came together on eBay for $1,133.50. A 64-core CPU and a server board at that price is the reason this build is possible at all.

Used server hardware is a good deal if you accept that you're a generation or two behind. That tradeoff is the whole basis of this build.

Everything else came from Amazon, a mix of new and open box.

## How I'll know it worked

Two checks.

First, BIOS. Power on and confirm that 64 cores, 256GB of memory, and the NVMe are all detected. If something is missing it's a seating problem, a dead stick, or a bad eBay purchase.

Second, Ubuntu. Install to the NVMe and log in from a terminal. If that works, the hardware is fine and everything after this is software.

I don't know yet whether I've bought the right things. That's the next episode.
