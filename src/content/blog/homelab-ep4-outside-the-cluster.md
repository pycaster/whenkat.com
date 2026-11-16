---
title: 'What should not run inside your Kubernetes cluster'
description: 'DNS and OpenTofu state both have to exist before Kubernetes does. Putting either one inside the cluster creates a dependency loop with no way out, so they run as LXC containers on Proxmox instead.'
pubDate: 'Sep 05 2026'
series: 'Building the Homelab'
seriesOrder: 4
---

Almost everything I run is in Kubernetes now. Immich, Grafana, Home Assistant, this blog. ArgoCD deploys all of it and I mostly don't think about it.

Two things are not in there, and they never will be.

## AdGuard

AdGuard is the DNS server for my network, and that includes the Kubernetes nodes themselves.

Here is the Talos machine config every node gets:

```hcl
machine = {
  network = {
    nameservers = var.dns_servers
  }
}
```

Those nameservers point at AdGuard. So a node needs AdGuard to resolve anything, and the first thing it has to resolve is the container registry it pulls images from.

If AdGuard were a pod, starting it would mean pulling its image. Pulling the image means resolving a registry hostname. Resolving anything means reaching AdGuard, which hasn't started, because its image hasn't been pulled.

The cluster can't bootstrap out of that. It isn't a race you can retry past or an ordering problem you can solve with init containers. The dependency is circular.

So AdGuard sits outside the cluster, on the LAN, running before Kubernetes is.

## MinIO

MinIO stores the OpenTofu state file.

That state is what describes the cluster. Which VMs exist, what their IDs are, which GPU is mapped to which worker, what the Talos secrets are. `tofu apply` reads it before it does anything.

If I put the state inside the cluster, then the thing that creates the cluster depends on the cluster already existing. Same loop as DNS, different shape. And it fails at the worst possible time, which is when you're trying to rebuild after something went wrong.

State backends need to outlive the infrastructure they describe. That's the whole point of them.

## Why LXC and not a VM

Both of these are small. AdGuard uses about 256MB. MinIO isn't much bigger for what I ask of it. Neither needs its own kernel, GPU access, or anything else that would justify the overhead of a full VM.

An LXC container on Proxmox gets its own process namespace, its own IP on the LAN, and starts in about a second. It behaves like a small always-on machine on the network without pretending to be one.

That's the shape of both services. They're infrastructure, not workloads. They come up before everything else and they stay up.

## The general version of this

The rule I've landed on is that anything the cluster needs in order to start cannot run in the cluster.

That sounds obvious written down. It's less obvious in the moment, because Kubernetes is good enough at running things that the default answer to "where should this go" becomes "in the cluster" without much thought. DNS and state both look like ordinary services right up until you try to cold start everything and find out they aren't.

Both of mine are one hop outside. Same physical machine, same network, managed by the same OpenTofu. Just not dependent on the thing that depends on them.

## Next

The cluster is running, networking works, and the two things that have to exist first are outside it. What's left is the part that puts everything else in. Next episode: ArgoCD, and how a YAML file in a git repo turns into a running service.
