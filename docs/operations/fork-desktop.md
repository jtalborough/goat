# Update a personal Mac fork

From a clean `dev` checkout whose `origin` is your GitHub fork, run
`node scripts/fork-desktop.ts` with the Node version in `package.json`.
Vite+ and `kache doctor` must work on the Mac first.

The command fast-forwards from your fork, merges upstream `dev`, installs the
locked dependencies, runs the changed-file checks and pushes your fork. A merge
conflict or failed check stops the command for review. It then builds the host's
Mac architecture, verifies the packaged app and installs it in
`~/Applications/GOAT (Fork).app`. Quit an already-running Fork app before installing.
Previous installations are preserved in `~/Applications/.goat-fork-backups`.

Fork versions have the form `X.Y.Z-fork.YYYYMMDD.N`. They use the app ID
`si.goat.desktop.fork` and state under `~/.goat/desktop-fork`, with normal macOS
Keychain protection. They start with their own profile and do not copy stable's
database or credentials. Provider CLIs keep their existing sign-ins.

Run the command again to update. Fork builds omit the upstream update feed so
upstream's installer cannot replace the custom build. `--build-only` builds and
verifies the current checkout without syncing, pushing, installing or launching.
Local packages are ad-hoc signed, rather than Apple-notarized releases; macOS may
ask for Keychain or privacy access when the new app first uses those capabilities.

## Use the fork as the main app

Add `--main` to replace `/Applications/GOAT.app` with your fork while keeping the
regular app's existing backend home, Chromium profile and Keychain identity.
The previous app is archived before replacement. Main fork versions include
`-mainfork.DATE.EPOCH.gCOMMIT` and omit the upstream update feed.
Before replacement, the stopped app's userdata and Chromium profile are backed
up under `~/.goat/fork-main-backups`.

Quit regular GOAT and run updates from a standalone Terminal: GOAT cannot safely
replace the app hosting the update command. To prepare before quitting, use
`node scripts/fork-desktop.ts --main --build-only`. After quitting, install that
verified bundle with `node scripts/fork-desktop.ts --main --install-built /path/to/GOAT.app`.
This mode uses the regular profile directly; it does not merge anything created
in the isolated GOAT (Fork) profile. Do not run two main builds against that profile.
