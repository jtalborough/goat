import { isForkDesktopVersion, isMainForkDesktopVersion } from "@goat/shared/desktopAppServer";
import { resolveDesktopUpdateChannel } from "./desktop-release-channel.ts";

export const DESKTOP_APP_ID = "si.goat.desktop";

export function isDesktopPreviewVersion(version: string): boolean {
  return (
    isForkDesktopVersion(version) ||
    isMainForkDesktopVersion(version) ||
    /-pr\./.test(version) ||
    /-preview\.\d{8}\.\d+$/.test(version)
  );
}

export function resolveDesktopProductName(version: string): string {
  if (isForkDesktopVersion(version)) return "GOAT (Fork)";
  return resolveDesktopUpdateChannel(version) === "nightly" ? "GOAT (Nightly)" : "GOAT";
}

export function resolveDesktopAppId(version: string): string {
  if (isForkDesktopVersion(version)) return `${DESKTOP_APP_ID}.fork`;
  return resolveDesktopUpdateChannel(version) === "nightly"
    ? `${DESKTOP_APP_ID}.nightly`
    : DESKTOP_APP_ID;
}
