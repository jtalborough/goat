// @effect-diagnostics nodeBuiltinImport:off - synchronous local installer; no server runtime.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeCrypto from "node:crypto";
import Plist from "plist";
import { isForkDesktopVersion, isMainForkDesktopVersion } from "@goat/shared/desktopAppServer";

export const FORK_APP_NAME = "GOAT (Fork).app";
const FORK_APP_ID = "si.goat.desktop.fork";
export const MAIN_FORK_APP_NAME = "GOAT.app";

function verifyApplication(
  app: string,
  id: string,
  acceptsVersion: (version: string) => boolean,
): string {
  if (NodeFS.lstatSync(app).isSymbolicLink()) throw new Error("Refusing a symlinked app bundle.");
  const info = NodePath.join(app, "Contents", "Info.plist");
  if (!NodeFS.realpathSync(info).startsWith(NodeFS.realpathSync(app) + NodePath.sep))
    throw new Error("Refusing app metadata outside its bundle.");
  const parsed = Plist.parse(NodeFS.readFileSync(info, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    !("CFBundleIdentifier" in parsed) ||
    !("CFBundleShortVersionString" in parsed)
  )
    throw new Error("App metadata is not a dictionary.");
  const version = parsed.CFBundleShortVersionString;
  if (parsed.CFBundleIdentifier !== id || typeof version !== "string" || !acceptsVersion(version))
    throw new Error(
      "Refusing to install or replace an app without the expected GOAT Fork identity and version.",
    );
  if (!NodeFS.statSync(NodePath.join(app, "Contents", "Resources", "app.asar")).isFile())
    throw new Error("The packaged application is missing app.asar.");
  return version;
}

export const verifyForkApplication = (app: string) =>
  verifyApplication(app, FORK_APP_ID, isForkDesktopVersion);

export const verifyMainForkApplication = (app: string) =>
  verifyApplication(app, "si.goat.desktop", isMainForkDesktopVersion);

const verifyMainApplication = (app: string) =>
  verifyApplication(app, "si.goat.desktop", (version) =>
    /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?$/.test(version),
  );

function installApplication(
  source: string,
  destination: string,
  policy: {
    readonly name: string;
    readonly verifySource: (app: string) => string;
    readonly verifyDestination: (app: string) => string;
  },
): string | undefined {
  if (NodePath.basename(destination) !== policy.name)
    throw new Error(`The install destination must be named ${policy.name}.`);
  policy.verifySource(source);
  const exists =
    NodeFS.existsSync(destination) ||
    (() => {
      try {
        NodeFS.lstatSync(destination);
        return true;
      } catch (cause) {
        if (
          typeof cause === "object" &&
          cause !== null &&
          "code" in cause &&
          cause.code === "ENOENT"
        )
          return false;
        throw cause;
      }
    })();
  const oldVersion = exists ? policy.verifyDestination(destination) : undefined;
  NodeFS.mkdirSync(NodePath.dirname(destination), { recursive: true });
  const staging = NodeFS.mkdtempSync(
    NodePath.join(NodePath.dirname(destination), ".goat-fork-install-"),
  );
  const staged = NodePath.join(staging, policy.name);
  let backup: string | undefined;
  try {
    NodeFS.cpSync(source, staged, {
      recursive: true,
      verbatimSymlinks: true,
      preserveTimestamps: true,
    });
    policy.verifySource(staged);
    if (oldVersion !== undefined) {
      const backups = NodePath.join(NodePath.dirname(destination), ".goat-fork-backups");
      NodeFS.mkdirSync(backups, { recursive: true });
      backup = NodePath.join(backups, `${oldVersion}-${NodeCrypto.randomUUID()}.app`);
      NodeFS.renameSync(destination, backup);
    }
    try {
      NodeFS.renameSync(staged, destination);
    } catch (cause) {
      if (backup !== undefined) NodeFS.renameSync(backup, destination);
      throw cause;
    }
    return backup;
  } finally {
    NodeFS.rmSync(staging, { recursive: true, force: true });
  }
}

export const installForkApplication = (source: string, destination: string) =>
  installApplication(source, destination, {
    name: FORK_APP_NAME,
    verifySource: verifyForkApplication,
    verifyDestination: verifyForkApplication,
  });

/** Explicit opt-in replaces the main app's code; its profile and OS credentials stay in place. */
export const installMainForkApplication = (source: string, destination: string) =>
  installApplication(source, destination, {
    name: MAIN_FORK_APP_NAME,
    verifySource: verifyMainForkApplication,
    verifyDestination: verifyMainApplication,
  });
