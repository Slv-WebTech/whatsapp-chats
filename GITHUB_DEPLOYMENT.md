# GitHub Deployment Guide

Repository:

- Owner: Slv-WebTech
- Name: whatsapp-chats
- Default branch: main
- Active working branch: development

## Push Current Branch

```bash
git add .
git commit -m "Update docs and app architecture notes"
git push -u origin development
```

## Open Pull Request

Create PR:

- base: main
- compare: development

Recommended checks before merge:

```bash
npm install
npm run build
```

## Recommended Branch Rules

- Require PR reviews
- Require passing build checks
- Prevent direct pushes to main

## Suggested CI Steps

- Install dependencies
- Run production build
- Optional: lint and test jobs

## Release Flow

1. Merge development into main via PR
2. Tag release
3. Publish release notes

Example:

```bash
git checkout main
git pull
git tag v1.0.0
git push origin v1.0.0
```
