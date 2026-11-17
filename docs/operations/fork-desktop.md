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
