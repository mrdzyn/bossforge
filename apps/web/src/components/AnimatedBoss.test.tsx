import { act } from "react";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BossAttributes } from "@bossforge/shared";
import { AnimatedBoss } from "./AnimatedBoss.js";

const attributes: BossAttributes = {
  body: "golem",
  element: "fire",
  special: "ember-burst",
  weakness: "water",
};

function props(overrides: Partial<React.ComponentProps<typeof AnimatedBoss>> = {}) {
  return {
    attributes,
    phase: "active" as const,
    authorityIdentity: "server-1|epoch-1|mock|forge-1|enc-1",
    acceptedHitCount: 1,
    weaknessHitCount: 0,
    currentHp: 92,
    maxHp: 100,
    ...overrides,
  };
}

describe("AnimatedBoss", () => {
  let renderer: ReactTestRenderer | undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
  });
  afterEach(() => {
    act(() => renderer?.unmount());
    renderer = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it.each([
    ["golem", "/assets/bosses/golem.svg"],
    ["wraith", "/assets/bosses/wraith.svg"],
    ["drake", "/assets/bosses/drake.svg"],
    ["mimic", "/assets/bosses/mimic.svg"],
  ] as const)("maps original %s art", (body, src) => {
    act(() => {
      renderer = TestRenderer.create(
        <AnimatedBoss {...props({ attributes: { ...attributes, body } })} />,
      );
    });
    expect(renderer!.root.findByType("img").props.src).toBe(src);
  });

  it("does not show a finished character before an authoritative reveal", () => {
    act(() => {
      renderer = TestRenderer.create(
        <AnimatedBoss
          {...props({ attributes: null, authorityIdentity: null, phase: "forging" })}
        />,
      );
    });
    expect(renderer!.root.findAllByType("img")).toHaveLength(0);
    expect(renderer!.root.findByProps({ className: "animated-boss-forging-mark" })).toBeTruthy();
  });

  it("supports every strict trait vocabulary without unsafe class values", () => {
    for (const element of ["fire", "ice", "storm", "void"] as const) {
      for (const special of [
        "ember-burst",
        "frost-chain",
        "thunder-dash",
        "shadow-pulse",
      ] as const) {
        for (const weakness of ["water", "light", "earth", "wind"] as const) {
          act(() => {
            renderer = TestRenderer.create(
              <AnimatedBoss
                {...props({ attributes: { body: "drake", element, special, weakness } })}
              />,
            );
          });
          expect(renderer!.root.findByType("figure").props.className).toContain(
            `element-${element}`,
          );
          act(() => renderer!.unmount());
        }
      }
    }
    renderer = undefined;
  });

  it("animates only a fresh accepted-hit increment and does not replay an initial snapshot", () => {
    act(() => {
      renderer = TestRenderer.create(<AnimatedBoss {...props({ acceptedHitCount: 8 })} />);
    });
    expect(renderer!.root.findByType("figure").props.className).not.toContain("is-hit");
    act(() => renderer!.update(<AnimatedBoss {...props({ acceptedHitCount: 9 })} />));
    expect(renderer!.root.findByType("figure").props.className).toContain("is-hit");
    act(() =>
      renderer!.update(<AnimatedBoss {...props({ acceptedHitCount: 10, weaknessHitCount: 1 })} />),
    );
    expect(renderer!.root.findByType("figure").props.className).toContain("is-weakness-impact");
  });

  it("retires animation state across epoch and encounter replacement", () => {
    act(() => {
      renderer = TestRenderer.create(
        <AnimatedBoss
          {...props({ acceptedHitCount: 1, authorityIdentity: "server-1|epoch-1|mock|f1|e1" })}
        />,
      );
    });
    act(() =>
      renderer!.update(
        <AnimatedBoss
          {...props({ acceptedHitCount: 2, authorityIdentity: "server-1|epoch-1|mock|f1|e1" })}
        />,
      ),
    );
    expect(renderer!.root.findByType("figure").props.className).toContain("is-hit");
    act(() =>
      renderer!.update(
        <AnimatedBoss
          {...props({ acceptedHitCount: 1, authorityIdentity: "server-2|epoch-2|mock|f2|e2" })}
        />,
      ),
    );
    expect(renderer!.root.findByType("figure").props.className).not.toContain("is-hit");
    act(() =>
      renderer!.update(
        <AnimatedBoss {...props({ phase: "unavailable", authorityIdentity: null })} />,
      ),
    );
    expect(renderer!.root.findByType("figure").props.className).not.toContain("is-weakness-impact");
    act(() => vi.advanceTimersByTime(1000));
    expect(renderer!.root.findByType("figure").props.className).not.toContain("is-hit");
  });

  it("clears attack accents at victory while allowing only the bounded defeat effect", () => {
    act(() => {
      renderer = TestRenderer.create(
        <AnimatedBoss
          {...props({ acceptedHitCount: 1, authorityIdentity: "server-1|epoch-1|mock|f1|e1" })}
        />,
      );
    });
    act(() =>
      renderer!.update(
        <AnimatedBoss
          {...props({
            acceptedHitCount: 2,
            weaknessHitCount: 1,
            authorityIdentity: "server-1|epoch-1|mock|f1|e1",
          })}
        />,
      ),
    );
    act(() =>
      renderer!.update(
        <AnimatedBoss
          {...props({
            acceptedHitCount: 2,
            weaknessHitCount: 1,
            phase: "victory",
            authorityIdentity: "server-1|epoch-1|mock|f1|e1",
          })}
        />,
      ),
    );
    const className = renderer!.root.findByType("figure").props.className as string;
    expect(className).not.toContain("is-hit");
    expect(className).not.toContain("is-weakness-impact");
    expect(className).toContain("is-defeating");
    act(() => vi.advanceTimersByTime(1100));
    expect(renderer!.root.findByType("figure").props.className).not.toContain("is-defeating");
  });

  it("honors reduced-motion preferences", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: true }) });
    act(() => {
      renderer = TestRenderer.create(<AnimatedBoss {...props({ acceptedHitCount: 1 })} />);
    });
    act(() =>
      renderer!.update(<AnimatedBoss {...props({ acceptedHitCount: 2, weaknessHitCount: 1 })} />),
    );
    expect(renderer!.root.findByType("figure").props.className).not.toContain("is-hit");
    expect(renderer!.root.findByType("figure").props.className).not.toContain("is-weakness-impact");
  });
});
