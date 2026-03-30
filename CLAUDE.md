# Cheaper2 — Project Notes for Claude

## Git Push
The local proxy blocks pushes. To push to GitHub, use the token stored in `~/.github_token`:

```bash
git remote set-url origin https://$(cat /home/user/.github_token)@github.com/amitre/Cheaper2.git
git push origin main
```

Always push to `main` — Vercel auto-deploys from `main`.
