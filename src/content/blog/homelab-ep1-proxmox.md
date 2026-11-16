---
title: 'Ubuntu updates kept breaking my NVIDIA drivers, so I moved to Proxmox'
description: 'I was running several Docker Compose stacks on a single Ubuntu server with no IaC and no plan. Here is what pushed me to rebuild it properly with Proxmox and OpenTofu.'
pubDate: 'Sep 04 2026'
series: 'Building the Homelab'
seriesOrder: 1
---

> If you haven't read the AI Server Build series, that's where the hardware story lives. This series starts where that one ends. The server is built, Ubuntu is installed, and things are running. Sort of.

## What was actually breaking

I knew about Proxmox before any of this. I just didn't think I needed it yet.

Running everything on bare Ubuntu felt fine at first. Docker Compose stacks for Immich, Home Assistant, AdGuard, Grafana. Managed through Dockage. Easy to see what was running, easy to restart things.

Then Ubuntu would get a security patch. NVIDIA drivers would break. The container toolkit would break with it. Immich ML stopped working. My local AI setup stopped working. I'd spend time tracking down which version of the driver was now incompatible with which version of the toolkit, find a fix, apply it, and move on.

Then it would happen again.

I lost count of how many times the lights in my house stopped responding because Home Assistant was down. My family couldn't find photos in Immich because the ML model couldn't load. These aren't critical systems but when they stop working repeatedly, it stops being a hobby and starts being a chore.

The problem wasn't Docker. The problem was running everything on a general-purpose OS that I had to keep patching. Every patch was a risk. NVIDIA on Linux does not forgive you for that.

Proxmox with Talos was exactly what I needed. Proxmox as the hypervisor never touches the GPUs directly. Talos bakes NVIDIA drivers into the node image at build time. A security update to the Proxmox host doesn't reach the GPU or the container toolkit at all. The stack that runs my AI workloads is isolated from the OS that owns the hardware.

That's why I moved. Not for the architecture diagram. Because I was tired of the lights not working.

## What I was running

One server. Several Docker Compose stacks, managed through Dockage.

- **Immich**: family photo library, NFS-backed from a Synology NAS
- **Home Assistant**: home automation
- **AdGuard**: DNS and ad blocking for the whole network
- **Grafana + ClickHouse**: dashboards for a trading setup
- **Nginx**: reverse proxy for everything above

Nothing was IaC. That was a choice I made, or rather didn't make. Dockage was easy and I was lazy. Click, deploy, done. No thought given to how I'd recreate any of it six months later. Secrets lived in `.env` files. No audit trail. No memory.

At work we use Terraform for everything. Every piece of infrastructure is declared, reviewed, and tracked. I kept thinking: why am I not doing this for my own server?

When I decided to move to Kubernetes, I made a rule. Do it right this time. Everything IaC. Proper secret management. If I have to rebuild it, I run one command and it comes back exactly as it was.

## Why Proxmox before Kubernetes

You can run Kubernetes directly on bare Ubuntu. Plenty of people do. But I had two GPUs, a mix of heavyweight and lightweight services, and I wanted snapshots before risky changes. Proxmox gives me a layer to manage all of that before Kubernetes even starts.

## What Proxmox gave me

```
┌─────────────────────────────────────────────┐
│              Physical Host                   │
│         EPYC 7702P · 256GB RAM               │
│         RTX 3090  ·  RTX 4070 Ti Super       │
├─────────────────────────────────────────────┤
│                  Proxmox VE                  │
├────────────────┬────────────────────────────┤
│  LXC Containers│         VMs                │
│                │                            │
│  ┌──────────┐  │  ┌─────────┐ ┌──────────┐ │
│  │ AdGuard  │  │  │  k8s    │ │  k8s     │ │
│  │  (DNS)   │  │  │  ctrl   │ │ worker   │ │
│  └──────────┘  │  │  plane  │ │ + GPU    │ │
│                │  └─────────┘ └──────────┘ │
│  ┌──────────┐  │                            │
│  │  MinIO   │  │  ┌──────────────────────┐ │
│  │ (state)  │  │  │   Kubernetes cluster  │ │
│  └──────────┘  │  │  Cilium · NGF · ArgoCD│ │
│                │  └──────────────────────┘ │
└────────────────┴────────────────────────────┘
```

**LXC for infra services.** AdGuard runs as an LXC container. Its own process namespace, its own IP on the LAN, about 256MB RAM. Not a VM, not a Docker container. Starts in seconds, always on. Proxmox manages it independently of everything else. Same for MinIO, which stores OpenTofu state.

**VMs for Kubernetes.** The cluster runs as Proxmox VMs with Talos Linux inside each one. More on that in the next episode. The VMs get CPU and memory allocations and Proxmox enforces them. If Kubernetes loses its mind, Proxmox is untouched. I can rebuild the cluster without touching DNS or storage.

**GPU passthrough via VFIO.** Both GPUs sit on separate PCIe root buses, so each lands in its own IOMMU group. No ACS override patch needed. At boot:

```bash
# /etc/default/grub
GRUB_CMDLINE_LINUX_DEFAULT="quiet amd_iommu=on iommu=pt"

# /etc/modprobe.d/vfio.conf
options vfio-pci ids=10de:2204,10de:1aef,10de:2705,10de:22bb
```

After reboot the host never sees the GPUs. Each Kubernetes worker VM gets one GPU passed through directly. From inside the VM it looks like bare metal. NVIDIA drivers live inside the VM, not on the Proxmox host.

**Snapshots.** Before any risky change, Talos upgrade, kernel change, anything I'm not confident about, I snapshot the VM. Takes 30 seconds. I've used them more than I'd like to admit.

## What's managed by OpenTofu

Proxmox itself was installed manually. You have to start somewhere. Everything after that is OpenTofu.

The first thing OpenTofu does is create a least-privilege API user and token for itself. It doesn't use the root account after bootstrap:

```hcl
resource "proxmox_virtual_environment_user" "infra" {
  user_id = "infra@pve"
}
```

VMs, LXC containers, GPU hardware mappings, network config. All declared in code. Rebuilding the cluster is `tofu apply`. No clicking around in the Proxmox UI for anything that matters.

## What stayed outside Kubernetes

Two services live in LXC and will stay there.

**AdGuard.** DNS has to work before Kubernetes starts. Running it inside k8s would create a circular dependency: k8s needs DNS to pull images, DNS is inside k8s. LXC breaks that loop.

**MinIO.** Stores the OpenTofu state that creates the cluster. Same logic. It has to exist before the cluster does.

Everything else moved to k8s. Immich, Grafana, Home Assistant, the reverse proxy. All managed by ArgoCD now.

## What the migration actually felt like

Easier than I expected. My family can live without Immich or Home Assistant for a weekend. No SLA, no on-call, no pressure.

To be fair, they'd already gotten used to it. The Ubuntu days had trained them well.

Next: why Talos Linux instead of Ubuntu + kubeadm, and what that means for how the cluster actually runs.
