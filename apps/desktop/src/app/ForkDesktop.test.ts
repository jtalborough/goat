import { assert, describe, it } from "@effect/vitest";
import * as Option from "effect/Option";
import { resolveDesktopBaseDir } from "./DesktopStatePaths.ts";
import { resolveChannelStateMigration } from "./DesktopChannelStateMigration.ts";
import {
  desktopChannel,
  desktopRuntimeAppName,
  resolveDesktopAppBranding,
} from "./DesktopEnvironment.ts";
import { computerUseHelperBundleIdForChannel } from "@goat/shared/cuaDriverRelease";

describe("packaged fork profile", () => {
  it("separates its profile and Keychain name from stable without migrating stable data", () => {
    const version = "1.2.3-fork.20261117.1";
    const base = {
      homeDirectory: "/home/user",
      joinPath: (...parts: string[]) => parts.join("/"),
      goatHome: Option.none<string>(),
      isDevelopment: false,
      appVersion: version,
    };
    assert.equal(resolveDesktopBaseDir(base), "/home/user/.goat/desktop-fork");
    assert.equal(
      resolveDesktopBaseDir({ ...base, appVersion: "1.2.3" }),
      "/home/user/.goat/desktop",
    );
    assert.equal(resolveDesktopBaseDir({ ...base, goatHome: Option.some("/chosen") }), "/chosen");
    assert.isNull(
      resolveChannelStateMigration({
        homeDirectory: "/home/user",
        appVersion: version,
        isPackaged: true,
        isDevelopment: false,
        goatHome: undefined,
      }),
    );
    const branding = resolveDesktopAppBranding({ isDevelopment: false, appVersion: version });
    assert.equal(branding.displayName, "GOAT (Fork)");
    assert.equal(desktopRuntimeAppName(branding.stageLabel, version), "GOAT Fork");
    assert.equal(desktopRuntimeAppName("Alpha", "1.2.3"), "GOAT Alpha");
    assert.equal(
      computerUseHelperBundleIdForChannel(
        desktopChannel({ isDevelopment: false, appVersion: version }),
      ),
      "si.goat.desktop.fork.computer-use",
    );
  });
});
