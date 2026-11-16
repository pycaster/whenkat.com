---
title: 'Talos Linux at home: genuine thoughts after running it'
description: 'Talos Linux has no SSH, no shell, and no package manager. That sounded like a downgrade until I understood it was the fix for the problem that pushed me off Ubuntu.'
pubDate: 'Sep 05 2026'
series: 'Building the Homelab'
seriesOrder: 2
---

In the last episode I said security patches on Ubuntu kept breaking my NVIDIA drivers. That was the thing that finally pushed me to rebuild everything.

So when it came time to pick an OS for the Kubernetes nodes, I had one hard requirement. A patch should never be able to break my GPU stack again.

That requirement rules out most of the obvious choices.

## The obvious choices

**Ubuntu plus kubeadm** is what most homelab guides recommend. It works. It's familiar. It also means every node is a full server that I have to keep patched, and I already knew how that story ends for me.

**k3s** is great and I nearly went with it. It's light, it installs in one command, and plenty of people run it happily at home. But k3s bundles its own CNI, its own load balancer, and its own opinions about how networking should work. I wanted to pick those pieces myself. That's a preference, not a criticism.

**Talos Linux** was the one that actually matched my requirement.

## What Talos is

Talos is an operating system built for exactly one job: running Kubernetes. Nothing else.

There is no SSH. No shell. No package manager. The filesystem is read only. You cannot log into a Talos node because there is nothing to log into.

The first time I read that I thought it sounded like a downgrade. How do you fix anything if you can't get a shell?

Then I sat with it for a while and realized that was the entire point.

## Why no shell is the answer

Every time my NVIDIA setup broke on Ubuntu, the root cause was the same. The OS updated something underneath a driver that was installed separately. Two things that were managed independently drifted apart.

Talos removes the possibility. There is no separate driver install. The drivers are compiled into the OS image before the node ever boots. If I want different drivers, I build a different image and reboot into it. The OS and the drivers ship as one unit or not at all.

The same logic applies to everything else on the node. There is no way to make an untracked change, because there is no way to make a change at all except by changing the config and applying it.

I lost the ability to SSH in and fix something at 11pm. I also lost the ability to SSH in and break something at 11pm without remembering I did it. That trade was worth making.

## The image factory

Since there's no package manager, anything a node needs has to be in the image. Talos handles this with a service called the Image Factory. You give it a list of extensions and it hands back a custom image with those extensions built in.

This has one consequence I did not anticipate. My control plane and my GPU workers need completely different images.

```
Control plane image:
  qemu-guest-agent

GPU worker image:
  qemu-guest-agent
  nonfree-kmod-nvidia
  nvidia-container-toolkit
```

The control plane only needs the guest agent so Proxmox can see the VM. A worker that runs GPU workloads needs the NVIDIA kernel modules and the container toolkit baked in. Boot a worker on the wrong image and it has no GPU support, and there is nothing you can do about it after the fact except boot the right one.

OpenTofu handles both. It calls the Image Factory, gets back a schematic ID for each variant, and Proxmox downloads the right image per VM.

```hcl
resource "talos_image_factory_schematic" "gpu_worker" {
  schematic = yamlencode({
    customization = {
      systemExtensions = {
        officialExtensions = [
          "siderolabs/qemu-guest-agent",
          "siderolabs/nonfree-kmod-nvidia",
          "siderolabs/nvidia-container-toolkit",
        ]
      }
    }
  })
}
```

This is the part that fixes my original problem. The NVIDIA driver version is declared in code. It changes when I change it and at no other time. A Proxmox host update cannot touch it.

## Machine config

A freshly booted Talos node does nothing. It sits and waits to be told what it is. OpenTofu tells it.

The config carries the cluster name, the API endpoint, the certificates, the install disk, and a few decisions worth calling out.

**CNI is set to none.** Talos ships with flannel by default. I turned it off because I wanted Cilium, and I'd rather start with nothing than rip something out.

**kube-proxy is disabled.** Cilium replaces it with eBPF. Leaving kube-proxy running would mean two things trying to do the same job.

Both of those mean the cluster comes up with no pod networking at all. That felt wrong the first time I saw it. Nodes ready, nothing able to talk to anything. It's correct. Cilium fills it in and that's the next episode.

**Workers declare their kernel modules.** The NVIDIA modules load at boot, before Kubernetes starts.

```hcl
machine = {
  kernel = {
    modules = [
      { name = "nvidia" },
      { name = "nvidia_uvm" },
      { name = "nvidia_drm" },
      { name = "nvidia_modeset" },
    ]
  }
}
```

## Bootstrap

After config is applied, one more step brings up etcd on the control plane. OpenTofu does that too, then pulls down two files.

```
talosconfig   to operate the OS
kubeconfig    to operate Kubernetes
```

Those two files are the only way I interact with any of this. There is no third way. No SSH key, no console, no fallback.

## The whole sequence

```
tofu apply
  │
  ├── Image Factory returns schematic IDs
  ├── Proxmox downloads both images
  ├── Proxmox creates the VMs
  ├── VMs boot Talos and wait
  ├── OpenTofu applies machine config
  ├── OpenTofu bootstraps etcd
  ├── Workers join
  └── kubeconfig and talosconfig written to disk
```

One command. No SSH. No join tokens copied by hand.

## What I gave up

Talos is not friendlier than Ubuntu. It's stricter. Debugging is different because your instincts are wrong. You can't `cat` a file or `systemctl status` something. You use `talosctl` and read the docs more than you'd like.

The upside is that nothing on a node happens by accident anymore. My GPU drivers have not broken once since I moved.

Next: Cilium, and why a bare metal cluster can't hand out LoadBalancer IPs without help.
