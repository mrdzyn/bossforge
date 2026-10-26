import { describe, expect, it } from "vitest";
import {
  getAllowedViteOrigins,
  isAllowedViteOrigin,
  isLoopbackAddress,
} from "../src/security/local-access.js";

describe("local development access policy", () => {
  it("recognizes IPv4, IPv6, and IPv4-mapped loopback addresses", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.42.1.2")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
  });

  it("does not trust remote or missing source addresses", () => {
    expect(isLoopbackAddress("192.0.2.20")).toBe(false);
    expect(isLoopbackAddress("::ffff:192.0.2.20")).toBe(false);
    expect(isLoopbackAddress(undefined)).toBe(false);
  });

  it("allows only explicit loopback Vite origins at the configured port", () => {
    const origins = getAllowedViteOrigins("5175");
    expect(origins).toEqual(
      new Set(["http://localhost:5175", "http://127.0.0.1:5175", "http://[::1]:5175"]),
    );
    expect(isAllowedViteOrigin("http://localhost:5175", origins)).toBe(true);
    expect(isAllowedViteOrigin("http://localhost:5174", origins)).toBe(false);
    expect(isAllowedViteOrigin("https://localhost:5175", origins)).toBe(false);
    expect(isAllowedViteOrigin("https://foreign.example", origins)).toBe(false);
    expect(isAllowedViteOrigin("null", origins)).toBe(false);
    expect(isAllowedViteOrigin("http://localhost:5175/", origins)).toBe(false);
  });

  it("permits origin-less local non-browser clients and rejects invalid Vite ports", () => {
    expect(isAllowedViteOrigin(undefined, getAllowedViteOrigins("5173"))).toBe(true);
    expect(getAllowedViteOrigins("70000")).toEqual(new Set());
    expect(isAllowedViteOrigin("http://localhost:5173", getAllowedViteOrigins("70000"))).toBe(
      false,
    );
  });
});
