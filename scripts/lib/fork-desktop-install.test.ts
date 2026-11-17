// @effect-diagnostics nodeBuiltinImport:off - exercises installation against temporary app bundles.
import { assert, describe, it } from "@effect/vitest";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import Plist from "plist";
import {
  FORK_APP_NAME,
  MAIN_FORK_APP_NAME,
  installForkApplication,
  installMainForkApplication,
  verifyForkApplication,
  verifyMainForkApplication,
} from "./fork-desktop-install.ts";

function app(path: string, version: string, id = "si.goat.desktop.fork") {
  NodeFS.mkdirSync(NodePath.join(path, "Contents", "Resources"), { recursive: true });
  NodeFS.writeFileSync(
    NodePath.join(path, "Contents", "Info.plist"),
    Plist.build({
      CFBundleIdentifier: id,
      CFBundleShortVersionString: version,
    }),
  );
  NodeFS.writeFileSync(NodePath.join(path, "Contents", "Resources", "app.asar"), version);
}

function withDirectory(run: (root: string) => void) {
  const root = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "goat-fork-install-test-"));
  try {
    run(root);
  } finally {
    NodeFS.rmSync(root, { recursive: true, force: true });
  }
}

describe("fork app installation", () => {
  it("explicit main installation preserves the regular app and its existing profile", () =>
    withDirectory((root) => {
      const source = NodePath.join(root, "build", MAIN_FORK_APP_NAME);
      const destination = NodePath.join(root, "Applications", MAIN_FORK_APP_NAME);
      const version = "1.2.3-mainfork.20261117.1.g012345abcdef";
      app(source, version, "si.goat.desktop");
      app(destination, "1.2.3", "si.goat.desktop");
      const profile = NodePath.join(root, "existing-profile");
      NodeFS.writeFileSync(profile, "existing configuration");
      const backup = installMainForkApplication(source, destination);
      if (backup === undefined) throw new Error("The regular app was not backed up.");
      assert.equal(verifyMainForkApplication(destination), version);
      assert.equal(
        NodeFS.readFileSync(NodePath.join(backup, "Contents/Resources/app.asar"), "utf8"),
        "1.2.3",
      );
      assert.equal(NodeFS.readFileSync(profile, "utf8"), "existing configuration");
    }));

  it("refuses a published stable package as the main fork installation source", () =>
    withDirectory((root) => {
      const source = NodePath.join(root, "build", MAIN_FORK_APP_NAME);
      const destination = NodePath.join(root, "Applications", MAIN_FORK_APP_NAME);
      app(source, "1.2.3", "si.goat.desktop");
      assert.throws(() => installMainForkApplication(source, destination), /GOAT Fork identity/);
      assert.isFalse(NodeFS.existsSync(destination));
    }));

  it("preserves the previous app and leaves profile data outside the app untouched", () =>
    withDirectory((root) => {
      const source = NodePath.join(root, "build", FORK_APP_NAME);
      const destination = NodePath.join(root, "Applications", FORK_APP_NAME);
      app(source, "1.2.3-fork.20261117.2");
      app(destination, "1.2.3-fork.20261117.1");
      const profile = NodePath.join(root, "profile-data");
      NodeFS.writeFileSync(profile, "existing state");
      const backup = installForkApplication(source, destination);
      if (backup === undefined) throw new Error("The previous fork app was not backed up.");
      assert.equal(verifyForkApplication(backup), "1.2.3-fork.20261117.1");
      assert.equal(verifyForkApplication(destination), "1.2.3-fork.20261117.2");
      assert.equal(verifyForkApplication(source), "1.2.3-fork.20261117.2");
      assert.equal(NodeFS.readFileSync(profile, "utf8"), "existing state");
    }));

  it("refuses a stable app even when it is renamed to the fork destination", () =>
    withDirectory((root) => {
      const source = NodePath.join(root, "build", FORK_APP_NAME);
      const destination = NodePath.join(root, "Applications", FORK_APP_NAME);
      app(source, "1.2.3-fork.20261117.2");
      app(destination, "1.2.3", "si.goat.desktop");
      assert.throws(() => installForkApplication(source, destination), /GOAT Fork identity/);
      assert.equal(
        NodeFS.readFileSync(
          NodePath.join(destination, "Contents", "Resources", "app.asar"),
          "utf8",
        ),
        "1.2.3",
      );
      assert.isFalse(NodeFS.existsSync(NodePath.join(root, "Applications", ".goat-fork-backups")));
    }));

  it("refuses a symlink at the install destination", () =>
    withDirectory((root) => {
      const source = NodePath.join(root, "build", FORK_APP_NAME);
      const other = NodePath.join(root, "other.app");
      const destination = NodePath.join(root, FORK_APP_NAME);
      app(source, "1.2.3-fork.20261117.2");
      app(other, "1.2.3-fork.20261117.1");
      NodeFS.symlinkSync(other, destination);
      assert.throws(() => installForkApplication(source, destination), /symlinked/);
      assert.equal(verifyForkApplication(other), "1.2.3-fork.20261117.1");
      assert.isTrue(NodeFS.lstatSync(destination).isSymbolicLink());
    }));
});
