import { assert, it } from "@effect/vitest";
import { forkDesktopBuildEnvironment } from "./fork-desktop-environment.ts";

it("removes legacy launch and plaintext-storage overrides without changing its caller", () => {
  const original = {
    T3CODE_HOME: "/other/profile",
    T3_SERVICE_LAUNCHER_CONTEXT: "legacy-launcher",
    T3CODE_DEV_INSECURE_SECRET_STORAGE: "1",
    GOAT_HOME: "/current/profile",
    GOAT_DESKTOP_UPDATE_FEED_ENABLED: "true",
    PATH: "/usr/bin",
  };
  const sanitized = forkDesktopBuildEnvironment(original);
  for (const key of [
    "T3CODE_HOME",
    "T3_SERVICE_LAUNCHER_CONTEXT",
    "T3CODE_DEV_INSECURE_SECRET_STORAGE",
    "GOAT_HOME",
    "GOAT_SERVICE_LAUNCHER_CONTEXT",
    "GOAT_DEV_INSECURE_SECRET_STORAGE",
  ])
    assert.isUndefined(sanitized[key]);
  assert.equal(sanitized.PATH, "/usr/bin");
  assert.equal(sanitized.GOAT_DESKTOP_UPDATE_FEED_ENABLED, "false");
  assert.equal(original.GOAT_HOME, "/current/profile");
  assert.equal(original.T3CODE_HOME, "/other/profile");
});
