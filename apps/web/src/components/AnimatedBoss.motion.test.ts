import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const stylesheet = readFile(new URL("../styles.css", import.meta.url), "utf8");

describe("AnimatedBoss presentation motion", () => {
  it("assigns distinct bounded idle motion to each original character", async () => {
    const css = await stylesheet;
    for (const [body, animation] of [
      ["wraith", "boss-wraith-drift"],
      ["golem", "boss-golem-breathe"],
      ["drake", "boss-drake-flight"],
      ["mimic", "boss-mimic-twitch"],
    ]) {
      expect(css).toContain(`.phase-ready.body-${body} .animated-boss-image`);
      expect(css).toContain(`animation: ${animation}`);
      expect(css).toContain(`@keyframes ${animation}`);
    }
    expect(css).toContain("inset: 3% 5%;");
    expect(css).toContain("max-height: 100%;");
    expect(css).toContain("max-width: 100%;");
  });

  it("uses authoritative impact classes and retires idle motion for terminal states", async () => {
    const css = await stylesheet;
    expect(css).toContain(".animated-boss.is-hit .animated-boss-image");
    expect(css).toContain(".animated-boss.is-weakness-impact .animated-boss-image");
    expect(css).toContain("@keyframes boss-impact");
    expect(css).toContain("@keyframes boss-weakness-impact");
    expect(css).toContain(".animated-boss.phase-cancelled .animated-boss-image");
    expect(css).toContain(".animated-boss.phase-expired .animated-boss-image");
    expect(css).toContain(".animated-boss.phase-victory .animated-boss-image");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".animated-boss *,");
    expect(css).toContain("animation: none !important;");
  });
});
