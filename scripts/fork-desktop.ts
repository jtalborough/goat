// @effect-diagnostics nodeBuiltinImport:off globalConsole:off - interactive local build and install command.
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HostProcess from "@goat/shared/HostProcess";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeChildProcess from "node:child_process";
import * as NodeUtil from "node:util";
import * as NodeURL from "node:url";
import {
  FORK_APP_NAME,
  MAIN_FORK_APP_NAME,
  installForkApplication,
  installMainForkApplication,
  verifyForkApplication,
  verifyMainForkApplication,
} from "./lib/fork-desktop-install.ts";

import { forkDesktopBuildEnvironment } from "./lib/fork-desktop-environment.ts";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");

function main() {
  const { values } = NodeUtil.parseArgs({
    options: {
      "build-only": { type: "boolean", default: false },
      main: { type: "boolean", default: false },
      "install-built": { type: "string" },
    },
  });
  if (values["install-built"] && (values["build-only"] || !values.main))
    throw new Error("--install-built requires --main and cannot use --build-only.");
  const appName = values.main ? MAIN_FORK_APP_NAME : FORK_APP_NAME;
  const appId = values.main ? "si.goat.desktop" : "si.goat.desktop.fork";
  const verifyApp = values.main ? verifyMainForkApplication : verifyForkApplication;
  if (HostProcess.Platform.defaultValue() !== "darwin")
    throw new Error("Build and install GOAT Fork on a Mac.");
  const env = forkDesktopBuildEnvironment(process.env);
  const globalVp = NodePath.join(NodeOS.homedir(), ".local", "share", "vite-plus", "bin", "vp");
  const localVp = NodePath.join(root, "node_modules", ".bin", "vp");
  env.PATH = [
    NodePath.join(NodeOS.homedir(), ".local", "lib", "kache", "shims"),
    NodePath.join(NodeOS.homedir(), ".local", "bin"),
    NodePath.join(NodeOS.homedir(), ".cargo", "bin"),
    env.PATH,
  ].join(NodePath.delimiter);
  const run = (command: string, args: string[], capture = false): string => {
    const result = NodeChildProcess.spawnSync(command, args, {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: capture ? "pipe" : "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(
        `${NodePath.basename(command)} failed (${result.status ?? result.signal}).${capture ? " " + result.stderr : ""}`,
      );
    return result.stdout?.trim() ?? "";
  };
  const git = (...args: string[]) => run("git", args, true);
  const vp = (...args: string[]) => {
    const node = JSON.parse(NodeFS.readFileSync(NodePath.join(root, "package.json"), "utf8"))
      .engines.node as string;
    return run(globalVp, ["env", "exec", "--node", node, "--", localVp, ...args]);
  };
  const assertForkStopped = () => {
    if (
      run(
        "osascript",
        [
          "-l",
          "JavaScript",
          "-e",
          `ObjC.import('AppKit'); $.NSRunningApplication.runningApplicationsWithBundleIdentifier('${appId}').count > 0`,
        ],
        true,
      ) === "true"
    )
      throw new Error(
        `Quit ${appName.slice(0, -4)} before updating it. Run the command from a standalone Terminal.`,
      );
    if (values.main) {
      const runtime = NodePath.join(NodeOS.homedir(), ".goat/desktop/userdata/server-runtime.json");
      if (NodeFS.existsSync(runtime)) {
        const { pid } = JSON.parse(NodeFS.readFileSync(runtime, "utf8"));
        if (!Number.isSafeInteger(pid) || pid <= 0)
          throw new Error("Invalid main backend PID; refusing installation.");
        try {
          process.kill(pid, 0);
        } catch (cause) {
          if (
            typeof cause === "object" &&
            cause !== null &&
            "code" in cause &&
            cause.code === "ESRCH"
          )
            return;
          throw cause;
        }
        throw new Error(
          "The main GOAT backend is still running. Wait for GOAT to finish quitting, then retry.",
        );
      }
    }
  };
  if (!values["build-only"] && !values["install-built"]) {
    assertForkStopped();
    if (git("branch", "--show-current") !== "dev" || git("status", "--porcelain") !== "")
      throw new Error(
        "Run this on a clean fork dev branch; commit or preserve local changes first.",
      );
    const origin = git("remote", "get-url", "origin");
    if (
      !/^https:\/\/github\.com\/[^/]+\/goat(?:\.git)?$/.test(origin) ||
      /github\.com\/goat-si\//.test(origin)
    )
      throw new Error("origin must be your HTTPS GitHub fork of goat, not goat-si/goat.");
    run("git", ["fetch", "origin", "dev"]);
    run("git", ["merge", "--ff-only", "origin/dev"]);
    run("git", ["fetch", "https://github.com/goat-si/goat.git", "dev"]);
    run("git", ["merge", "--no-edit", "FETCH_HEAD"]);
    vp("install", "--frozen-lockfile");
    vp("run", "check:changed");
    run("git", ["push", "origin", "HEAD:dev"]);
  }
  let packaged = values["install-built"] ? NodePath.resolve(values["install-built"]) : undefined;
  if (packaged === undefined) {
    run("kache", ["doctor"]);
    const base = JSON.parse(
      NodeFS.readFileSync(NodePath.join(root, "apps", "desktop", "package.json"), "utf8"),
    ).version.split("-")[0];
    const now = Effect.runSync(DateTime.now);
    const date = DateTime.formatIsoDateUtc(now).replaceAll("-", "");
    const suffix = `${date}.${Math.floor(DateTime.toEpochMillis(now) / 1000)}`;
    const version = values.main
      ? `${base}-mainfork.${suffix}.g${git("rev-parse", "--short=12", "HEAD")}`
      : `${base}-fork.${suffix}`;
    const output = NodePath.join(root, "release", values.main ? "main-fork" : "fork", version);
    const annotations = NodePath.join(
      root,
      "apps/desktop/src/preview/AnnotationStyles.generated.ts",
    );
    const originalAnnotations = NodeFS.readFileSync(annotations, "utf8");
    try {
      vp(
        "run",
        "dist:desktop:artifact",
        "--platform",
        "mac",
        "--arch",
        HostProcess.Architecture.defaultValue(),
        "--target",
        "dir",
        "--build-version",
        version,
        "--output-dir",
        output,
        "--computer-use-helper",
      );
    } finally {
      if (
        !NodeFS.existsSync(annotations) ||
        NodeFS.readFileSync(annotations, "utf8") !== originalAnnotations
      )
        NodeFS.writeFileSync(annotations, originalAnnotations);
    }
    const apps = NodeFS.readdirSync(output)
      .filter((p) => p.startsWith("mac"))
      .map((p) => NodePath.join(output, p, appName));
    packaged = apps.find((p) => NodeFS.existsSync(p));
    if (!packaged) throw new Error(`No ${appName} was produced under ${output}.`);
  }
  verifyApp(packaged);
  run("codesign", ["--verify", "--deep", "--strict", packaged]);
  console.log(`Verified ${packaged}`);
  if (values["build-only"]) return;
  assertForkStopped();
  const destination = values.main
    ? NodePath.join("/Applications", MAIN_FORK_APP_NAME)
    : NodePath.join(NodeOS.homedir(), "Applications", FORK_APP_NAME);
  if (values.main) {
    const backups = NodePath.join(NodeOS.homedir(), ".goat/fork-main-backups");
    NodeFS.mkdirSync(backups, { recursive: true, mode: 0o700 });
    const snapshot = NodeFS.mkdtempSync(NodePath.join(backups, "before-update-"));
    for (const [name, source] of [
      ["userdata", NodePath.join(NodeOS.homedir(), ".goat/desktop/userdata")],
      [
        "chromium-profile",
        NodePath.join(NodeOS.homedir(), "Library/Application Support/goat-desktop"),
      ],
    ] as const) {
      if (NodeFS.existsSync(source))
        NodeFS.cpSync(source, NodePath.join(snapshot, name), {
          recursive: true,
          verbatimSymlinks: true,
          preserveTimestamps: true,
        });
    }
    console.log(`Main profile backup preserved at ${snapshot}`);
    assertForkStopped();
  }
  const backup = values.main
    ? installMainForkApplication(packaged, destination)
    : installForkApplication(packaged, destination);
  if (backup) console.log(`Previous app preserved at ${backup}`);
  run("codesign", ["--verify", "--deep", "--strict", destination]);
  run("open", [destination]);
  console.log(
    `Installed ${destination}; launch requested. Profile: ~/.goat/${values.main ? "desktop" : "desktop-fork"}. Secrets use Keychain.`,
  );
}

if (
  process.argv[1] &&
  NodePath.resolve(process.argv[1]) === NodeURL.fileURLToPath(import.meta.url)
) {
  try {
    main();
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : cause);
    process.exitCode = 1;
  }
}
