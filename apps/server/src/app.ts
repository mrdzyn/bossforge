import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { NormalizedChatEventSchema } from "@bossforge/shared";
import { MockChatAdapter } from "./adapters/mock-chat-adapter.js";
import { EventHub } from "./events/event-hub.js";
import {
  getAllowedViteOrigins,
  isAllowedViteOrigin,
  isLoopbackAddress,
} from "./security/local-access.js";
import { createRateLimit } from "./security/rate-limit.js";

const packageVersion = "0.1.0";
const bodyLimitBytes = 8 * 1024;

function processMode(value: string | undefined): NonNullable<AppOptions["mode"]> {
  if (value === "development" || value === "production" || value === "test") return value;
  return "test";
}

export interface AppOptions {
  mode?: "development" | "production" | "test";
  simulationEnabled?: boolean;
  now?: () => Date;
}

export interface BossForgeApp {
  app: FastifyInstance;
  close(): Promise<void>;
}

export async function createBossForgeApp(options: AppOptions = {}): Promise<BossForgeApp> {
  const mode = options.mode ?? processMode(process.env.NODE_ENV);
  const developmentMode = mode === "development";
  const simulationEnabled = developmentMode && options.simulationEnabled !== false;
  const now = options.now ?? (() => new Date());
  const mockAdapter = new MockChatAdapter(now);
  const hub = new EventHub();
  const app = Fastify({ logger: false, bodyLimit: bodyLimitBytes });
  const allowedViteOrigins = getAllowedViteOrigins();

  const requireLocalDevelopmentRequest = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!developmentMode || !isLoopbackAddress(request.raw.socket.remoteAddress)) {
      reply.code(403).send({ error: "Local development access only" });
    }
  };

  const requireLocalWebSocketOrigin = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!developmentMode || !isLoopbackAddress(request.raw.socket.remoteAddress)) {
      reply.code(403).send({ error: "Local development access only" });
      return;
    }
    if (!isAllowedViteOrigin(request.headers.origin, allowedViteOrigins)) {
      reply.code(403).send({ error: "WebSocket origin is not allowed" });
    }
  };

  await app.register(websocket, { options: { maxPayload: bodyLimitBytes } });

  app.get("/health", async () => ({
    status: "ok",
    service: "bossforge-server",
    version: packageVersion,
    timestamp: now().toISOString(),
    connections: { websocketClients: hub.clientCount, mockAdapter: mockAdapter.status },
  }));

  app.get("/events", { websocket: true, onRequest: requireLocalWebSocketOrigin }, (socket) => {
    hub.addClient(socket);
    hub.publish({ kind: "connection.status", source: "mock", status: mockAdapter.status });
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.warn({ err: error }, "Request rejected");
    let statusCode = 500;
    if (
      error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400
    ) {
      statusCode = error.statusCode;
    }
    void reply
      .status(statusCode)
      .send({ error: statusCode >= 500 ? "Internal server error" : "Invalid request" });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: "Not found" });
  });

  if (simulationEnabled) {
    await mockAdapter.connect();
    const simulationRateLimit = createRateLimit({
      limit: 20,
      windowMs: 60_000,
      now: () => now().getTime(),
    });
    app.post(
      "/dev/simulation/next",
      { onRequest: requireLocalDevelopmentRequest, preHandler: simulationRateLimit },
      async (_request, reply) => {
        const event = mockAdapter.nextEvent();
        if (!event) return reply.status(204).send();
        hub.publish(event);
        return reply.status(202).send({ accepted: true, kind: event.kind });
      },
    );

    app.post(
      "/dev/simulation/events",
      { onRequest: requireLocalDevelopmentRequest, preHandler: simulationRateLimit },
      async (request, reply) => {
        const parsed = NormalizedChatEventSchema.safeParse(request.body);
        if (!parsed.success || parsed.data.provider !== "mock") {
          return reply.status(400).send({ error: "Invalid mock simulation event" });
        }
        hub.publish(parsed.data);
        return reply.status(202).send({ accepted: true, kind: parsed.data.kind });
      },
    );
  }

  return {
    app,
    close: async () => {
      await mockAdapter.disconnect();
      await app.close();
    },
  };
}
