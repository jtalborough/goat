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
  installForkApplication,
  verifyForkApplication,
} from "./lib/fork-desktop-install.ts";

import { forkDesktopBuildEnvironment } from "./lib/fork-desktop-environment.ts";

const root = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");

function main() {
  const { values } = NodeUtil.parseArgs({
    options: { "build-only": { type: "boolean", default: false } },
  });
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
          "ObjC.import('AppKit'); $.NSRunningApplication.runningApplicationsWithBundleIdentifier('si.goat.desktop.fork').count > 0",
        ],
        true,
      ) === "true"
    )
      throw new Error("Quit GOAT (Fork) before updating it.");
  };
  if (!values["build-only"]) {
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
  run("kache", ["doctor"]);
  const base = JSON.parse(
    NodeFS.readFileSync(NodePath.join(root, "apps", "desktop", "package.json"), "utf8"),
  ).version.split("-")[0];
  const now = Effect.runSync(DateTime.now);
  const date = DateTime.formatIsoDateUtc(now).replaceAll("-", "");
  const version = `${base}-fork.${date}.${Math.floor(DateTime.toEpochMillis(now) / 1000)}`;
  const output = NodePath.join(root, "release", "fork", version);
  const annotations = NodePath.join(root, "apps/desktop/src/preview/AnnotationStyles.generated.ts");
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
    .map((p) => NodePath.join(output, p, FORK_APP_NAME));
  const packaged = apps.find((p) => NodeFS.existsSync(p));
  if (!packaged) throw new Error(`No ${FORK_APP_NAME} was produced under ${output}.`);
  verifyForkApplication(packaged);
  run("codesign", ["--verify", "--deep", "--strict", packaged]);
  console.log(`Built ${packaged}`);
  if (values["build-only"]) return;
  assertForkStopped();
  const destination = NodePath.join(NodeOS.homedir(), "Applications", FORK_APP_NAME);
  const backup = installForkApplication(packaged, destination);
  if (backup) console.log(`Previous app preserved at ${backup}`);
  run("open", [destination]);
  console.log(
    `Installed ${destination}; launch requested. Profile: ~/.goat/desktop-fork. Secrets use Keychain.`,
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
