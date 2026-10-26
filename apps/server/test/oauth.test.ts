import { describe, expect, it, vi } from "vitest";
import { TwitchOAuth } from "../src/twitch/oauth.js";

const validation = (overrides: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      client_id: "client-id",
      user_id: "12345",
      login: "forge_owner",
      user_name: "Forge Owner",
      scopes: ["user:read:chat"],
      expires_in: 3600,
      ...overrides,
    }),
    { status: 200 },
  );

function makeOAuth(fetcher: typeof fetch, now = 100_000) {
  let next = 0;
  return new TwitchOAuth({
    clientId: "client-id",
    clientSecret: "private-secret",
    redirectUri: "http://localhost:3001/auth/twitch/callback",
    enabled: true,
    now: () => now,
    fetch: fetcher,
    random: () => `random-${++next}-with-sufficient-entropy-placeholder`,
  });
}

describe("local Twitch OAuth", () => {
  it("creates a state-bound authorization URL with only user:read:chat", () => {
    const oauth = makeOAuth(vi.fn());
    const start = oauth.begin();
    const authorize = new URL(start.authorizeUrl);
    expect(authorize.origin + authorize.pathname).toBe("https://id.twitch.tv/oauth2/authorize");
    expect(authorize.searchParams.get("redirect_uri")).toBe(
      "http://localhost:3001/auth/twitch/callback",
    );
    expect(authorize.searchParams.get("scope")).toBe("user:read:chat");
    expect(start.stateCookie.startsWith(`${authorize.searchParams.get("state")}.`)).toBe(true);
    oauth.close();
  });

  it("exchanges a single-use code and validates client, scope and numeric identity", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/token"))
        return new Response(
          JSON.stringify({
            access_token: "access-test",
            refresh_token: "refresh-test",
            expires_in: 3600,
          }),
          { status: 200 },
        );
      return validation();
    }) as typeof fetch;
    const oauth = makeOAuth(fetcher);
    const start = oauth.begin();
    const state = new URL(start.authorizeUrl).searchParams.get("state")!;
    const login = await oauth.complete(state, start.stateCookie, "authorization-code");
    expect(login.identity).toEqual({
      id: "12345",
      login: "forge_owner",
      displayName: "Forge Owner",
    });
    expect(oauth.identityFor(login.sessionCookie)).toEqual(login.identity);
    expect(calls[0]?.url).toBe("https://id.twitch.tv/oauth2/token");
    expect(String(calls[0]?.init?.body)).toContain("client_secret=private-secret");
    expect(calls[1]?.url).toBe("https://id.twitch.tv/oauth2/validate");
    expect((calls[1]?.init?.headers as Record<string, string>).authorization).toBe(
      "OAuth access-test",
    );
    await expect(oauth.complete(state, start.stateCookie, "replayed-code")).rejects.toThrow(
      "OAuth state validation failed",
    );
    oauth.close();
  });

  it("rejects mismatched browser state, replayed state, wrong identity and missing scope", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/token"))
        return new Response(
          JSON.stringify({ access_token: "access", refresh_token: "refresh", expires_in: 3600 }),
        );
      return validation({ scopes: [] });
    }) as typeof fetch;
    const oauth = makeOAuth(fetcher);
    const first = oauth.begin();
    const firstState = new URL(first.authorizeUrl).searchParams.get("state")!;
    await expect(oauth.complete(firstState, "other.state", "code")).rejects.toThrow(
      "state validation",
    );
    const second = oauth.begin();
    const secondState = new URL(second.authorizeUrl).searchParams.get("state")!;
    await expect(oauth.complete(secondState, second.stateCookie, "code")).rejects.toThrow(
      "identity or required scope",
    );
    expect(oauth.identityFor(undefined)).toBeUndefined();
    oauth.close();
  });

  it("fails closed when opt-in or required configuration is missing", () => {
    const oauth = new TwitchOAuth({
      clientId: "client-id",
      clientSecret: "secret",
      redirectUri: "http://localhost:3001/auth/twitch/callback",
      enabled: false,
    });
    expect(oauth.configured).toBe(false);
    expect(() => oauth.begin()).toThrow("not configured");
    oauth.close();
  });

  it("refreshes expiring tokens under the server session and revokes on logout", async () => {
    let now = 100_000;
    const urls: string[] = [];
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      urls.push(url);
      if (url.endsWith("/token")) {
        const body = String(init?.body);
        return new Response(
          JSON.stringify(
            body.includes("grant_type=refresh_token")
              ? {
                  access_token: "rotated-access",
                  refresh_token: "rotated-refresh",
                  expires_in: 3600,
                }
              : { access_token: "access", refresh_token: "refresh", expires_in: 3600 },
          ),
        );
      }
      if (url.endsWith("/revoke")) return new Response(null, { status: 204 });
      return validation();
    }) as typeof fetch;
    const oauth = new TwitchOAuth({
      clientId: "client-id",
      clientSecret: "private-secret",
      redirectUri: "http://localhost:3001/auth/twitch/callback",
      enabled: true,
      now: () => now,
      fetch: fetcher,
    });
    const start = oauth.begin();
    const state = new URL(start.authorizeUrl).searchParams.get("state")!;
    const login = await oauth.complete(state, start.stateCookie, "code");
    now += 3_550_000;
    expect(await oauth.accessToken(login.sessionCookie)).toBe("rotated-access");
    await oauth.logout(login.sessionCookie);
    expect(oauth.identityFor(login.sessionCookie)).toBeUndefined();
    expect(urls).toContain("https://id.twitch.tv/oauth2/revoke");
    oauth.close();
  });
});
