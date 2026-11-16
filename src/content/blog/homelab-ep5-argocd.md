---
title: 'ArgoCD in a homelab: what GitOps actually buys you'
description: 'I picked ArgoCD because I saw it working at my company and wanted to try it, not because I evaluated it against anything. Here is what running it at home actually changed.'
pubDate: 'Sep 05 2026'
series: 'Building the Homelab'
seriesOrder: 5
---

I should be upfront about how I chose this.

I saw ArgoCD running at my company, on a scale far past anything I have at home. It looked like the right way to do things and I wanted to try it myself. I never got the chance there, so I used my own cluster as the excuse.

That's the whole evaluation. I have not run Flux. I can't tell you what I'm missing, and I'd rather say that than write a comparison I haven't earned.

## What I was actually trying to fix

The first episode in this series was about drift. I had Docker Compose stacks I couldn't reproduce, mount paths I'd typed once and forgotten, and no way to answer what changed last week. My rule going into the rebuild was that everything had to be in code.

Writing things in code is the easy half. The hard half is making sure what's running actually matches what's written down. Nothing stops you from fixing something by hand at 11pm and never committing it. Six months later the file and the cluster disagree and you have no idea which one is right.

That gap is the thing GitOps closes. Git holds the desired state, a controller continuously compares it to reality, and reality loses.

## The app-of-apps pattern

There's one Application that matters more than the rest:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: cluster-services
  namespace: argocd
spec:
  source:
    repoURL: git@github.com:pycaster/proxmox-k8s.git
    path: gitops/apps
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

It watches a directory of other Application definitions. Every file in `gitops/apps` becomes an ArgoCD app, and each of those points at its own manifests or an upstream Helm chart.

The practical effect is that adding a service to my cluster is adding one file to a directory. I wrote `gitops/apps/blog.yaml`, pushed it, and ArgoCD created the namespace, pulled the image, and started the pods. I never ran `kubectl apply`.

Fifteen files in that directory right now. Immich, Grafana, cert-manager, the GPU operator, the CSI driver, the gateway, this blog. All of them arrived the same way.

## What prune and selfHeal actually do

Those two lines in the sync policy are doing most of the work.

**selfHeal** means ArgoCD continuously compares live state to git and reverts anything that differs. If I edit a deployment by hand, it gets undone. That sounds annoying and occasionally it is, but it's exactly the property I wanted. My cluster cannot drift from the repo, because drift gets corrected within minutes.

**prune** means deleting a file deletes the resource. Without it, removing a manifest just orphans whatever it created, and you accumulate resources nobody remembers creating. With it, git is the complete picture rather than an append-only log.

Together they mean the repo isn't documentation of the cluster. It is the cluster.

## Upstream charts with my own values

Most of what I run is somebody else's Helm chart. I don't want to fork those, but I do want my configuration in my own repo where I can see it in a diff.

ArgoCD handles this with multiple sources:

```yaml
sources:
  - repoURL: git@github.com:pycaster/proxmox-k8s.git
    targetRevision: HEAD
    ref: values
  - chart: cert-manager
    repoURL: https://charts.jetstack.io
    targetRevision: v1.*
    helm:
      valueFiles:
        - $values/gitops/values/cert-manager-values.yaml
```

The first source is my repo, labelled `values`. The second is Jetstack's chart registry. The `$values` prefix in the file path reaches back into my repo.

So the chart comes from upstream and stays current, while every setting I've changed sits in a file I own and review. That was not obvious to me when I started and it's the pattern I use for every third-party chart now.

## Who deploys ArgoCD

This is the part I find genuinely funny.

ArgoCD deploys everything in my cluster. Nothing deploys ArgoCD. It goes in by hand, through Helm, from a Makefile target:

```bash
helm install argocd argo/argo-cd --namespace argocd
```

The last episode was about services that can't live in the cluster that depends on them. This is the same problem one layer up. The thing that installs everything has to be installed by something that isn't itself.

Every GitOps setup has this seam somewhere. Mine is two commands in a Makefile, run once, and then never again unless I rebuild from scratch.

## What I don't know yet

I've been running this for months and it does what I wanted. The cluster matches the repo, adding a service is a file, and I haven't hand-edited a live resource since I set it up.

What I can't tell you is whether Flux would have been better, or what I'd hit at a scale where sync ordering and dependencies between apps actually matter. At fifteen apps with no strict ordering requirements, I'm not stressing anything.

That's the honest state of it. I picked the tool I'd seen work, it works, and I haven't yet run into the problem that would teach me its limits.
