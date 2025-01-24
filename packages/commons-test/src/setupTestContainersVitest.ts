/* eslint-disable max-params */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */

import {
  DB,
  EventStoreConfig,
  FileManager,
  FileManagerConfig,
  LoggerConfig,
  RateLimiter,
  ReadModelDbConfig,
  ReadModelRepository,
  RedisRateLimiterConfig,
  S3Config,
  genericLogger,
  initDB,
  initPecEmailManager,
  initFileManager,
  initRedisRateLimiter,
  EmailManagerPEC,
  EmailManagerSES,
  AWSSesConfig,
  initSesMailManager,
} from "pagopa-interop-commons";
import axios from "axios";
import { PecEmailManagerConfigTest } from "./testConfig.js";

/**
 * This function is a setup for vitest that initializes the read model repository, the postgres
 * database and the file manager and returns their instances along with a cleanup function.
 * The cleanup function deletes all the data from the read model repository and the event store
 * database and must be called at the end of each test (`afterEach`), to ensure that the tests are isolated.
 *
 * @param config The configuration object containing the connection parameters. It must be retrieved from the `config` object provided by the `setupTestContainersVitestGlobal` function with the vitest's `inject` function.
 *
 * @example
 * ```typescript
 * import { setupTestContainersVitest } from "pagopa-interop-commons-test";
 * import { inject, afterEach } from "vitest";
 *
 * export const { readModelRepository, postgresDB, fileManager, cleanup } =
 *   setupTestContainersVitest(inject("config"));
 *
 * afterEach(cleanup);
 * ```
 */
export async function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config & LoggerConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config & LoggerConfig,
  emailManagerConfig?: PecEmailManagerConfigTest
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  cleanup: () => Promise<void>;
}>;
export function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config & LoggerConfig,
  emailManagerConfig?: PecEmailManagerConfigTest,
  RedisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig
): Promise<{
  readModelRepository: ReadModelRepository;
  postgresDB: DB;
  fileManager: FileManager;
  pecEmailManager: EmailManagerPEC;
  sesEmailManager: EmailManagerSES;
  redisRateLimiter: RateLimiter;
  cleanup: () => Promise<void>;
}>;
export async function setupTestContainersVitest(
  readModelDbConfig?: ReadModelDbConfig,
  eventStoreConfig?: EventStoreConfig,
  fileManagerConfig?: FileManagerConfig & S3Config & LoggerConfig,
  emailManagerConfig?: PecEmailManagerConfigTest,
  redisRateLimiterConfig?: RedisRateLimiterConfig,
  awsSESConfig?: AWSSesConfig
): Promise<{
  readModelRepository?: ReadModelRepository;
  postgresDB?: DB;
  fileManager?: FileManager;
  pecEmailManager?: EmailManagerPEC;
  sesEmailManager?: EmailManagerSES;
  redisRateLimiter?: RateLimiter;
  cleanup: () => Promise<void>;
}> {
  const s3OriginalBucket = fileManagerConfig?.s3Bucket;

  let readModelRepository: ReadModelRepository | undefined;
  let postgresDB: DB | undefined;
  let fileManager: FileManager | undefined;
  let pecEmailManager: EmailManagerPEC | undefined;
  let sesEmailManager: EmailManagerSES | undefined;
  let redisRateLimiter: RateLimiter | undefined;
  const redisRateLimiterGroup = "TEST";

  if (readModelDbConfig) {
    readModelRepository = ReadModelRepository.init(readModelDbConfig);
  }

  if (eventStoreConfig) {
    postgresDB = initDB({
      username: eventStoreConfig.eventStoreDbUsername,
      password: eventStoreConfig.eventStoreDbPassword,
      host: eventStoreConfig.eventStoreDbHost,
      port: eventStoreConfig.eventStoreDbPort,
      database: eventStoreConfig.eventStoreDbName,
      schema: eventStoreConfig.eventStoreDbSchema,
      useSSL: eventStoreConfig.eventStoreDbUseSSL,
    });
  }

  if (fileManagerConfig) {
    fileManager = initFileManager(fileManagerConfig);
  }

  if (emailManagerConfig) {
    pecEmailManager = initPecEmailManager(emailManagerConfig, false);
  }

  if (awsSESConfig) {
    sesEmailManager = initSesMailManager(awsSESConfig);
  }

  if (redisRateLimiterConfig) {
    redisRateLimiter = await initRedisRateLimiter({
      limiterGroup: redisRateLimiterGroup,
      maxRequests: redisRateLimiterConfig.rateLimiterMaxRequests,
      rateInterval: redisRateLimiterConfig.rateLimiterRateInterval,
      burstPercentage: redisRateLimiterConfig.rateLimiterBurstPercentage,
      redisHost: redisRateLimiterConfig.rateLimiterRedisHost,
      redisPort: redisRateLimiterConfig.rateLimiterRedisPort,
      timeout: redisRateLimiterConfig.rateLimiterTimeout,
    });
  }

  return {
    readModelRepository,
    postgresDB,
    fileManager,
    pecEmailManager,
    sesEmailManager,
    redisRateLimiter,
    cleanup: async (): Promise<void> => {
      await readModelRepository?.agreements.deleteMany({});
      await readModelRepository?.eservices.deleteMany({});
      await readModelRepository?.tenants.deleteMany({});
      await readModelRepository?.purposes.deleteMany({});
      await readModelRepository?.attributes.deleteMany({});
      await readModelRepository?.clients.deleteMany({});
      await readModelRepository?.keys.deleteMany({});
      await readModelRepository?.producerKeychains.deleteMany({});
      await readModelRepository?.producerKeys.deleteMany({});
      await readModelRepository?.delegations.deleteMany({});

      await postgresDB?.none(
        "TRUNCATE TABLE agreement.events RESTART IDENTITY"
      );
      await postgresDB?.none(
        "TRUNCATE TABLE attribute.events RESTART IDENTITY"
      );
      await postgresDB?.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
      await postgresDB?.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
      await postgresDB?.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");
      await postgresDB?.none(
        'TRUNCATE TABLE "authorization".events RESTART IDENTITY'
      );
      await postgresDB?.none(
        "TRUNCATE TABLE delegation.events RESTART IDENTITY"
      );

      if (s3OriginalBucket && fileManagerConfig && fileManager) {
        const files = await fileManager.listFiles(
          s3OriginalBucket,
          genericLogger
        );
        await Promise.all(
          files.map(async (file) => {
            if (fileManager) {
              await fileManager.delete(s3OriginalBucket, file, genericLogger);
            }
          })
        );
        // Some tests change the bucket name, so we need to reset it
        fileManagerConfig.s3Bucket = s3OriginalBucket;
      }

      if (
        emailManagerConfig?.smtpAddress &&
        emailManagerConfig?.mailpitAPIPort
      ) {
        await axios.delete(
          `http://${emailManagerConfig?.smtpAddress}:${emailManagerConfig?.mailpitAPIPort}/api/v1/messages`
        );
      }

      if (awsSESConfig?.awsSesEndpoint) {
        await axios.post(`${awsSESConfig?.awsSesEndpoint}/clear-store`);
      }
    },
  };
}
