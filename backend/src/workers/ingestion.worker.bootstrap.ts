import { Worker } from "bullmq";
import type { IngestionJobData } from "../dto/match.dto.js";
import { INGESTION_QUEUE } from "../queues/definitions.js";
import { redis } from "../redis/client.js";
import { riotConfig } from "../riot-gateway/config/riotConfig.js";
import { processIngestionJob } from "./ingestion.worker.js";

/**
 * Bootstrap du worker d'ingestion : isole le SEUL effet de bord (connexion Redis /
 * BullMQ) hors du module de logique `ingestion.worker.ts`. Importer ce dernier
 * n'ouvre donc aucune connexion, ce qui rend `runAggregationTransaction` et les
 * upserts testables (unitaires + intégration) sans mocker Redis ni BullMQ.
 */
export const ingestionWorker = new Worker<IngestionJobData>(
  INGESTION_QUEUE,
  (job) => processIngestionJob(job),
  {
    connection: redis,
    concurrency: riotConfig.ingestionWorkerConcurrency,
  },
);
