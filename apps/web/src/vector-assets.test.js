import { describe, expect, it } from "vitest";
import {
  assertSafeSvg,
  optimizeOriginalSvg,
  prepareProductionAssets,
} from "../../../tools/prepare-vector-assets.mjs";

const safeSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0h20v20z" fill="#fff"/></svg>',
);

describe("VecSynIQ production SVG assets", () => {
  it("rejects active content, handlers and external references", () => {
    for (const source of [
      "<svg><script>alert(1)</script></svg>",
      '<!DOCTYPE svg [<!ENTITY x "y">]><svg/>',
      '<svg onload="alert(1)"/>',
      "<svg><foreignObject/></svg>",
      '<svg><use href="https://example.invalid/icon.svg#x"/></svg>',
      '<svg><path style="fill:url(https://example.invalid/x)"/></svg>',
    ])
      expect(() => assertSafeSvg(source)).toThrow();
  });

  it("adds viewBox, retains safe vector output and optimizes deterministically", () => {
    const first = optimizeOriginalSvg(safeSvg, "fixture.svg");
    const second = optimizeOriginalSvg(safeSvg, "fixture.svg");
    expect(first.equals(second)).toBe(true);
    expect(first.toString()).toContain("viewBox=");
    expect(first.toString()).toContain("<path");
    expect(() => assertSafeSvg(first.toString())).not.toThrow();
  });

  it("verifies all five supplied original checksums and returns reproducible production copies", () => {
    const first = prepareProductionAssets();
    const second = prepareProductionAssets();
    expect(first.map(({ name, content }) => [name, content.toString("hex")])).toEqual(
      second.map(({ name, content }) => [name, content.toString("hex")]),
    );
    const manifest = JSON.parse(
      first.find((asset) => asset.name === "asset-manifest.json").content.toString(),
    );
    expect(manifest.assets.filter(({ name }) => name !== "Bossforge-logo-mark.svg")).toHaveLength(
      5,
    );
    expect(
      manifest.assets.every(
        ({ originalSha256, optimizedSha256 }) => originalSha256 && optimizedSha256,
      ),
    ).toBe(true);
    expect(
      first.find(({ name }) => name === "Bossforge-logo-mark.svg").content.length,
    ).toBeLessThan(first.find(({ name }) => name === "Bossforge-logo.svg").content.length);
  });
});
