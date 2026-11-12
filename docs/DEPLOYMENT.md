# Publishing PACU Hub (Firebase Hosting)

PACU Hub is published at **https://pacuhub.web.app** by GitHub Actions:

| When | What happens |
|---|---|
| Any push / pull request | **Checks** run: types, lint, all tests, the build, and the security-rule tests |
| A pull request is opened or updated | A private **preview link** is posted on the PR (expires after 7 days) |
| Changes are merged into `main` | The **live site** is updated |

## One-time setup: the deployment key

GitHub needs a key that is allowed to publish to Firebase Hosting, and nothing else. Firebase's CLI creates it and stores it in GitHub for you. You need a computer with **Node.js 20+** (nodejs.org).

```bash
git clone https://github.com/Hussein-zreik/pacuhub.git
cd pacuhub
npx firebase-tools@14 login
npx firebase-tools@14 init hosting:github
```

Answer the questions like this:

| Question | Answer |
|---|---|
| Sign in to GitHub | Approve in the browser window that opens |
| For which GitHub repository…? | `Hussein-zreik/pacuhub` |
| Set up the workflow to run a build script before every deploy? | **No** (our workflow already builds and tests) |
| Set up automatic deployment to your site's live channel when a PR is merged? | **No** (our workflow already does this) |

It prints a message like **"Uploaded service account JSON to GitHub as secret FIREBASE_SERVICE_ACCOUNT_PACUHUB"**. That's the only part we need.

If it created files under `.github/workflows/`, **don't commit them**. The repository already has the right workflows. You can delete the `pacuhub` folder on your computer afterwards.

Check it worked: GitHub → `pacuhub` → **Settings → Secrets and variables → Actions** should list `FIREBASE_SERVICE_ACCOUNT_PACUHUB`.

## Security notes

- The key can publish the website. It can't read the database, and it isn't used for the security rules.
- Rules are published deliberately: paste them, or run `npx firebase-tools@14 deploy --only firestore:rules` after `npm run test:rules` passes.
- `firebase.json` adds security headers (no framing, HTTPS-only, strict referrer, no camera/mic/location) and long-term caching for built files.
