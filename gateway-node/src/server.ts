import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables before any other imports
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import Fastify from "fastify";
import cors from "@fastify/cors";
import pino from "pino";
import { apiRoutes } from "./routes/apiRoutes";
import { socketHub } from "./ws/socketHub";
import { meshGrpcClient } from "./grpc/meshGrpcClient";

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOST = process.env.HOST || "0.0.0.0";

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    transport:
      process.env.NODE_ENV !== "production"
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname"
            }
          }
        : undefined
  }
});

async function startServer() {
  try {
    // 1. Register Cross-Origin Resource Sharing (CORS)
    await fastify.register(cors, {
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      credentials: true
    });

    // Flexible content-type parser allowing empty or text POST bodies
    fastify.removeAllContentTypeParsers();
    fastify.addContentTypeParser(
      ["application/json", "text/plain", "application/x-www-form-urlencoded"],
      { parseAs: "string" },
      (req, body, done) => {
        if (!body || body === "") {
          done(null, {});
          return;
        }
        try {
          done(null, JSON.parse(body as string));
        } catch {
          done(null, {});
        }
      }
    );

    // 2. Register REST API routes under /api
    await fastify.register(apiRoutes, { prefix: "/api" });

    // 3. Register compatibility alias for /api/v1
    await fastify.register(apiRoutes, { prefix: "/api/v1" });

    // Root status route
    fastify.get("/", async () => {
      return {
        service: "VektorMesh Edge Gateway & Real-Time Streamer",
        status: "RUNNING",
        version: "1.0.0",
        ports: {
          httpAndWs: PORT
        },
        endpoints: {
          health: "/api/health",
          topology: "/api/topology",
          audit: "/api/audit",
          slo: "/api/slo",
          chaos: "/api/chaos/inject",
          weights: "/api/control/weights"
        }
      };
    });

    // 4. Attach Socket.io Hub to Fastify HTTP server
    socketHub.initialize(fastify);

    // 5. Start listening on network port
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`VektorMesh Edge Gateway is listening on http://${HOST}:${PORT}`);
    fastify.log.info(`Socket.io Real-Time Telemetry Hub listening on ws://${HOST}:${PORT}`);

    // 6. Connect persistent gRPC multiplexed stream to Java Engine
    fastify.log.info("Initiating background gRPC telemetry stream to Java Engine...");
    meshGrpcClient.startSystemStateStream();

  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful termination handling
const shutdown = async (signal: string) => {
  fastify.log.info(`Received ${signal}, initiating graceful shutdown...`);
  try {
    await fastify.close();
    fastify.log.info("HTTP server closed cleanly.");
    process.exit(0);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();
