---
title: 'Leaving Medium to self-host my blog with Astro'
description: 'After years on Medium, I moved my writing to a site I actually own. The stack is Astro, the workflow is a git push, and the reason is simpler than you might think.'
pubDate: 'Sep 04 2026'
series: 'Own Your Platform'
seriesOrder: 1
---

I've been writing on Medium for a couple of years. It's fine. The editor is clean, the reading experience is good, and getting started takes about four minutes. But I kept stopping. Drafts would sit for weeks. Publishing felt like dropping something into a void I didn't own.

Part of it was the platform. Medium owns the URL. Medium decides who sees it. If it shuts down tomorrow, my writing goes with it unless I remembered to export it last week.

But honestly, the bigger problem was motivation. Writing on someone else's platform, with someone else's editor, pointing at someone else's domain. It never felt like mine. There was no skin in the game. No reason to push through a draft when it was just going to live at `medium.com/@whenkat` next to content I had nothing to do with.

Building my own stack changed that. Now when I write, I'm also running a Kubernetes cluster, managing a GitOps pipeline, and learning how the pieces fit together. The blog became part of the homelab. That made it interesting enough to keep doing.

## The actual trigger

A friend asked me for the link to one of my AI server posts. I sent them:

```
medium.com/@whenkat/building-my-home-ai-server-episode-1-research-3af72874c497
```

A URL I don't control. On a domain I don't own. That was it. I was done.

## What I actually wanted

Nothing fancy:

- **My domain.** `whenkat.com`, not `medium.com/me`.
- **Markdown.** I write in it anyway. An editor that converts it to something else is just friction.
- **No database.** A personal blog does not need PostgreSQL running next to it. It needs HTML files.
- **Fast.** Static HTML is as fast as it gets. There's nothing to compute when a reader arrives.
- **Portable.** If I ever want to move it, it's just files on a disk.

## Why Astro

I looked at Ghost, Hugo, and Jekyll. Ghost is beautiful but it's a full Node app with a database. That's a lot of infrastructure for a blog you update once a month. Hugo is fast but the templating made my eyes cross. Jekyll is Ruby and I didn't have the energy.

Astro does one thing well: it takes your Markdown and your templates and spits out a folder full of HTML. That's the whole pitch. I was sold in about twenty minutes.

Content lives in `src/content/blog/` as `.md` files. Each file has frontmatter: title, date, description. I added `series` and `seriesOrder` fields to group related posts together, so readers can follow a thread instead of hunting for individual posts.

## The writing workflow

1. Write a Markdown file.
2. `git commit` and `git push`.
3. It's live.

GitHub Actions builds the site, packages it into a Docker image, and pushes it to a registry. ArgoCD picks it up and deploys it. I never open a browser to publish. I never log into an admin panel. The git push is the deploy.

The whole pipeline takes about two to three minutes. By the time I've closed my laptop, the post is live.

## What I gave up

Medium has an audience. Writing there meant some chance of someone stumbling across my post organically. Here, if I want people to read it, I have to share it myself.

That's a real tradeoff. I'm okay with it. I'd rather write for fewer people who actually sought it out than optimize for an algorithm I don't control.

## What's next

The part I haven't told you yet: this blog runs on a server in my home office. Not a VPS. Not a cloud instance. My actual server, behind a residential internet connection, with no open ports and no static IP.

That's episode 2.
