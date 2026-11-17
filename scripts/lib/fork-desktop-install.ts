// @effect-diagnostics nodeBuiltinImport:off - synchronous local installer; no server runtime.
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeCrypto from "node:crypto";
import Plist from "plist";
import { isForkDesktopVersion } from "@goat/shared/desktopAppServer";

export const FORK_APP_NAME = "GOAT (Fork).app";
const FORK_APP_ID = "si.goat.desktop.fork";

export function verifyForkApplication(app: string): string {
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
  const id = parsed.CFBundleIdentifier;
  const version = parsed.CFBundleShortVersionString;
  if (id !== FORK_APP_ID || typeof version !== "string" || !isForkDesktopVersion(version))
    throw new Error(
      "Refusing to install or replace an app without the GOAT Fork identity and version.",
    );
  if (!NodeFS.statSync(NodePath.join(app, "Contents", "Resources", "app.asar")).isFile())
    throw new Error("The packaged application is missing app.asar.");
  return version;
}

export function installForkApplication(source: string, destination: string): string | undefined {
  if (NodePath.basename(destination) !== FORK_APP_NAME)
    throw new Error("The install destination must be named GOAT (Fork).app.");
  verifyForkApplication(source);
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
  const oldVersion = exists ? verifyForkApplication(destination) : undefined;
  NodeFS.mkdirSync(NodePath.dirname(destination), { recursive: true });
  const staging = NodeFS.mkdtempSync(
    NodePath.join(NodePath.dirname(destination), ".goat-fork-install-"),
  );
  const staged = NodePath.join(staging, FORK_APP_NAME);
  let backup: string | undefined;
  try {
    NodeFS.cpSync(source, staged, {
      recursive: true,
      verbatimSymlinks: true,
      preserveTimestamps: true,
    });
    verifyForkApplication(staged);
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
