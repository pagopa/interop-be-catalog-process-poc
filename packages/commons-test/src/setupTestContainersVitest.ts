/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/no-let */
/* eslint-disable functional/immutable-data */

import {
  ReadModelRepository,
  initDB,
  initFileManager,
} from "pagopa-interop-commons";
import { TestContainersConfig } from "./containerTestUtils.js";

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
 *
 */
export function setupTestContainersVitest(config: TestContainersConfig) {
  const s3OriginalBucket = config.s3Bucket;

  const readModelRepository = ReadModelRepository.init(config);

  const postgresDB = initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  });

  const fileManager = initFileManager(config);

  return {
    readModelRepository,
    postgresDB,
    fileManager,
    cleanup: async (): Promise<void> => {
      await readModelRepository.agreements.deleteMany({});
      await readModelRepository.eservices.deleteMany({});
      await readModelRepository.tenants.deleteMany({});
      await readModelRepository.purposes.deleteMany({});
      await readModelRepository.attributes.deleteMany({});

      await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE attribute.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE tenant.events RESTART IDENTITY");
      await postgresDB.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");

      // Some tests change the bucket name, so we need to reset it
      if (s3OriginalBucket) {
        config.s3Bucket = s3OriginalBucket;
      }
    },
  };
}
