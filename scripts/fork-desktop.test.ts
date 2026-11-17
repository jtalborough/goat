import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { createBuildConfig } from "./build-desktop-artifact.ts";

const version = "1.2.3-fork.20261117.1";

describe("packaged fork isolation", () => {
  it.effect("has its own app identity and rejects an inherited upstream update feed", () =>
    Effect.gen(function* () {
      for (const [buildVersion, appId, productName] of [
        [version, "si.goat.desktop.fork", "GOAT (Fork)"],
        ["1.2.3-mainfork.20261117.1.g012345abcdef", "si.goat.desktop", "GOAT"],
      ] as const) {
        const config = yield* createBuildConfig(
          "mac",
          "dir",
          buildVersion,
          false,
          false,
          undefined,
          undefined,
        );
        assert.equal(config.appId, appId);
        assert.equal(config.productName, productName);
        assert.strictEqual(config.publish, null);
      }
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          NodeServices.layer,
          ConfigProvider.layer(
            ConfigProvider.fromEnv({
              env: {
                GOAT_DESKTOP_UPDATE_FEED_ENABLED: "true",
                GOAT_DESKTOP_UPDATE_REPOSITORY: "goat-si/goat-releases",
              },
            }),
          ),
        ),
      ),
    ),
  );
});
