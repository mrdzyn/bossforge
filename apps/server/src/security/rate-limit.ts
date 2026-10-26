import type { FastifyReply, FastifyRequest } from "fastify";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
}

export function createRateLimit(options: RateLimitOptions) {
  const now = options.now ?? Date.now;
  const clients = new Map<string, { count: number; resetAt: number }>();

  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const currentTime = now();
    const client = clients.get(request.ip);
    const window =
      !client || currentTime >= client.resetAt
        ? { count: 0, resetAt: currentTime + options.windowMs }
        : client;

    if (window.count >= options.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((window.resetAt - currentTime) / 1000));
      reply.header("retry-after", String(retryAfterSeconds));
      reply.code(429).send({ error: "Too many local simulation requests" });
      return;
    }

    window.count += 1;
    clients.set(request.ip, window);
  };
}
