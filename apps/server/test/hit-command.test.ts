import { describe, expect, it } from "vitest";
import { parseHitCommand } from "../src/battle/hit-command.js";

describe("strict !hit grammar", () => {
  it.each([
    ["!hit", { element: null }],
    ["!hit water", { element: "water" }],
    ["!hit light", { element: "light" }],
    ["!hit earth", { element: "earth" }],
    ["!hit wind", { element: "wind" }],
  ])("accepts %s", (input, output) => expect(parseHitCommand(input)).toEqual(output));

  it.each([
    "!hit fire",
    "!hit water extra",
    "!hit  water",
    " !hit",
    "!hit ",
    "!hit <script>",
    "!hit water\n!hit",
    "!hit\u0000",
    `!hit ${"x".repeat(40)}`,
  ])("rejects malformed input", (input) => expect(parseHitCommand(input)).toBeUndefined());
});
