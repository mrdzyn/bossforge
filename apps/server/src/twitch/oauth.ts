import { randomBytes, timingSafeEqual } from "node:crypto";

const REQUIRED_SCOPE = "user:read:chat";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const VALIDATE_URL = "https://id.twitch.tv/oauth2/validate";
const REVOKE_URL = "https://id.twitch.tv/oauth2/revoke";

export interface TwitchIdentity {
  id: string;
  login: string;
  displayName: string;
}

interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  identity: TwitchIdentity;
  lastValidatedAt: number;
}

interface OAuthTransaction {
  browserBinding: string;
  expiresAt: number;
}

export interface TwitchOAuthOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: "http://localhost:3001/auth/twitch/callback";
  enabled: boolean;
  now?: () => number;
  fetch?: typeof fetch;
  random?: (size: number) => string;
  onSessionInvalidated?: (identity: TwitchIdentity) => void;
}

export interface OAuthStart {
  authorizeUrl: string;
  stateCookie: string;
}

export interface OAuthLogin {
  sessionCookie: string;
  identity: TwitchIdentity;
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Local OAuth code grant. Tokens and login sessions exist only in this process. */
export class TwitchOAuth {
  private readonly now: () => number;
  private readonly fetcher: typeof fetch;
  private readonly random: (size: number) => string;
  private readonly transactions = new Map<string, OAuthTransaction>();
  private readonly sessions = new Map<string, TokenSet>();
  private validationTimer: ReturnType<typeof setInterval> | undefined;
  private readonly refreshInFlight = new Map<string, Promise<TokenSet | undefined>>();

  constructor(private readonly options: TwitchOAuthOptions) {
    this.now = options.now ?? Date.now;
    this.fetcher = options.fetch ?? fetch;
    this.random = options.random ?? ((size) => randomBytes(size).toString("base64url"));
  }

  get configured(): boolean {
    return (
      this.options.enabled &&
      this.options.clientId.length > 0 &&
      this.options.clientSecret.length > 0 &&
      this.options.redirectUri === "http://localhost:3001/auth/twitch/callback"
    );
  }

  begin(): OAuthStart {
    if (!this.configured) throw new Error("Twitch integration is not configured");
    this.pruneTransactions();
    const state = this.random(32);
    const browserBinding = this.random(32);
    this.transactions.set(state, { browserBinding, expiresAt: this.now() + 5 * 60_000 });
    const authorize = new URL("https://id.twitch.tv/oauth2/authorize");
    authorize.search = new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: this.options.redirectUri,
      response_type: "code",
      scope: REQUIRED_SCOPE,
      state,
      force_verify: "true",
    }).toString();
    return { authorizeUrl: authorize.toString(), stateCookie: `${state}.${browserBinding}` };
  }

  cancel(state: string): void {
    this.transactions.delete(state);
  }

  async complete(state: string, browserCookie: string, code: string): Promise<OAuthLogin> {
    const transaction = this.transactions.get(state);
    this.transactions.delete(state); // State is single-use, including failed attempts.
    const [cookieState, binding, extra] = browserCookie.split(".");
    if (
      !transaction ||
      transaction.expiresAt < this.now() ||
      extra !== undefined ||
      cookieState !== state ||
      !binding ||
      !constantTimeEqual(binding, transaction.browserBinding)
    )
      throw new Error("OAuth state validation failed");
    if (!code || code.length > 2048) throw new Error("OAuth authorization was denied");

    const tokenResponse = await this.requestJson(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.options.redirectUri,
      }),
    });
    const token = object(tokenResponse);
    if (
      typeof token?.access_token !== "string" ||
      typeof token.refresh_token !== "string" ||
      typeof token.expires_in !== "number" ||
      token.expires_in < 60
    )
      throw new Error("Twitch token response was invalid");
    let validated: Record<string, unknown>;
    try {
      validated = await this.validateToken(token.access_token);
    } catch {
      await this.revoke(token.access_token);
      throw new Error("Twitch identity validation failed");
    }
    if (
      validated.client_id !== this.options.clientId ||
      typeof validated.user_id !== "string" ||
      !/^\d{1,32}$/u.test(validated.user_id) ||
      typeof validated.login !== "string" ||
      !Array.isArray(validated.scopes) ||
      !validated.scopes.includes(REQUIRED_SCOPE)
    ) {
      await this.revoke(token.access_token);
      throw new Error("Twitch identity or required scope was not authorized");
    }
    const identity = {
      id: validated.user_id,
      login: validated.login,
      displayName: typeof validated.user_name === "string" ? validated.user_name : validated.login,
    };
    const sessionCookie = this.random(32);
    this.sessions.set(sessionCookie, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: this.now() + token.expires_in * 1000,
      identity,
      lastValidatedAt: this.now(),
    });
    this.startHourlyValidation();
    return { sessionCookie, identity };
  }

  identityFor(sessionCookie: string | undefined): TwitchIdentity | undefined {
    return sessionCookie ? this.sessions.get(sessionCookie)?.identity : undefined;
  }

  async accessToken(sessionCookie: string): Promise<string | undefined> {
    const current = this.sessions.get(sessionCookie);
    if (!current) return undefined;
    if (current.expiresAt - this.now() < 60_000) {
      const refreshed = await this.refreshSingleFlight(sessionCookie, current);
      return refreshed?.accessToken;
    }
    return current.accessToken;
  }

  async refreshAccessToken(sessionCookie: string): Promise<string | undefined> {
    const current = this.sessions.get(sessionCookie);
    if (!current) return undefined;
    return (await this.refreshSingleFlight(sessionCookie, current))?.accessToken;
  }

  async validateAll(): Promise<void> {
    await Promise.all(
      [...this.sessions.keys()].map(async (cookie) => this.validateSession(cookie)),
    );
  }

  async logout(sessionCookie: string | undefined): Promise<void> {
    if (!sessionCookie) return;
    const token = this.sessions.get(sessionCookie);
    this.sessions.delete(sessionCookie);
    if (token) await this.revoke(token.accessToken);
    if (!this.sessions.size && this.validationTimer) {
      clearInterval(this.validationTimer);
      this.validationTimer = undefined;
    }
  }

  close(): void {
    if (this.validationTimer) clearInterval(this.validationTimer);
    this.validationTimer = undefined;
    this.transactions.clear();
    this.sessions.clear();
  }

  private async validateSession(cookie: string): Promise<void> {
    const current = this.sessions.get(cookie);
    if (!current) return;
    try {
      const validated = await this.validateToken(current.accessToken);
      if (
        validated.client_id !== this.options.clientId ||
        validated.user_id !== current.identity.id ||
        !Array.isArray(validated.scopes) ||
        !validated.scopes.includes(REQUIRED_SCOPE)
      ) {
        this.sessions.delete(cookie);
        this.options.onSessionInvalidated?.(current.identity);
        return;
      }
      current.lastValidatedAt = this.now();
    } catch {
      await this.refreshSingleFlight(cookie, current);
    }
  }

  private refreshSingleFlight(cookie: string, current: TokenSet): Promise<TokenSet | undefined> {
    const existing = this.refreshInFlight.get(cookie);
    if (existing) return existing;
    const pending = (async () => {
      try {
        const result = object(
          await this.requestJson(TOKEN_URL, {
            method: "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: this.options.clientId,
              client_secret: this.options.clientSecret,
              grant_type: "refresh_token",
              refresh_token: current.refreshToken,
            }),
          }),
        );
        if (
          typeof result?.access_token !== "string" ||
          typeof result.refresh_token !== "string" ||
          typeof result.expires_in !== "number"
        )
          throw new Error("Invalid refresh result");
        const validated = await this.validateToken(result.access_token);
        if (
          validated.client_id !== this.options.clientId ||
          validated.user_id !== current.identity.id ||
          !Array.isArray(validated.scopes) ||
          !validated.scopes.includes(REQUIRED_SCOPE)
        )
          throw new Error("Refreshed Twitch identity was invalid");
        const refreshed = {
          ...current,
          accessToken: result.access_token,
          refreshToken: result.refresh_token,
          expiresAt: this.now() + result.expires_in * 1000,
          lastValidatedAt: this.now(),
        };
        this.sessions.set(cookie, refreshed);
        return refreshed;
      } catch {
        this.sessions.delete(cookie);
        this.options.onSessionInvalidated?.(current.identity);
        return undefined;
      } finally {
        this.refreshInFlight.delete(cookie);
      }
    })();
    this.refreshInFlight.set(cookie, pending);
    return pending;
  }

  private async validateToken(accessToken: string): Promise<Record<string, unknown>> {
    return (
      object(
        await this.requestJson(VALIDATE_URL, {
          headers: { authorization: `OAuth ${accessToken}` },
        }),
      ) ?? {}
    );
  }

  private async revoke(accessToken: string): Promise<void> {
    try {
      await this.requestJson(REVOKE_URL, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: this.options.clientId, token: accessToken }),
      });
    } catch {
      // Local memory is already cleared; revocation is best-effort on logout.
    }
  }

  private async requestJson(url: string, init: RequestInit): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await this.fetcher(url, {
        ...init,
        signal: controller.signal,
        redirect: "error",
      });
      if (!response.ok) throw new Error("Twitch request failed");
      return await response.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private startHourlyValidation(): void {
    if (this.validationTimer) return;
    this.validationTimer = setInterval(() => void this.validateAll(), 60 * 60 * 1000);
    this.validationTimer.unref?.();
  }

  private pruneTransactions(): void {
    for (const [state, transaction] of this.transactions)
      if (transaction.expiresAt < this.now()) this.transactions.delete(state);
    while (this.transactions.size > 16) {
      const oldest = this.transactions.keys().next().value as string | undefined;
      if (oldest) this.transactions.delete(oldest);
    }
  }
}
