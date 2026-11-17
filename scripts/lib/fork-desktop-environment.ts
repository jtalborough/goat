import { normalizeLegacyEnv } from "@goat/contracts/legacyT3Names";

export function forkDesktopBuildEnvironment(input: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env = normalizeLegacyEnv({ ...input });
  for (const key of [
    "GOAT_DEV_INSECURE_SECRET_STORAGE",
    "GOAT_HOME",
    "GOAT_PORT",
    "GOAT_HOST",
    "GOAT_SERVICE_LAUNCHER_CONTEXT",
    "GOAT_BOOT_SERVICE_UNIT",
    "ELECTRON_RUN_AS_NODE",
    "VITE_DEV_SERVER_URL",
    "VITE_HTTP_URL",
    "VITE_WS_URL",
    "GOAT_DESKTOP_DEV",
  ])
    delete env[key];
  env.GOAT_DESKTOP_UPDATE_FEED_ENABLED = "false";
  env.NO_COLOR = "1";
  return env;
}
