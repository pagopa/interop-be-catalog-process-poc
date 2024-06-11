/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable functional/immutable-data */
/* eslint-disable functional/no-let */

import { config as dotenv } from "dotenv-flow";
import { StartedTestContainer } from "testcontainers";
import type { GlobalSetupContext } from "vitest/node";
import type {} from "vitest";
import {
  EventStoreConfig,
  FileManagerConfig,
  LoggerConfig,
  EmailManagerConfig,
  ReadModelDbConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";
import {
  TEST_MINIO_PORT,
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  minioContainer,
  mongoDBContainer,
  postgreSQLContainer,
  mailpitContainer,
  TEST_MAILPIT_SMTP_PORT,
  TEST_MAILPIT_HTTP_PORT,
} from "./containerTestUtils.js";

const EmailManagerConfigTest = EmailManagerConfig.and(
  z.object({
    smtpHTTPPort: z.number().optional(),
  })
);
type EmailManagerConfigTest = z.infer<typeof EmailManagerConfigTest>;

declare module "vitest" {
  export interface ProvidedContext {
    readModelConfig?: ReadModelDbConfig;
    eventStoreConfig?: EventStoreConfig;
    fileManagerConfig?: FileManagerConfig & LoggerConfig & S3Config;
    emailManagerConfig?: EmailManagerConfigTest;
  }
}

/**
 * This function is a global setup for vitest that starts and stops test containers for PostgreSQL, MongoDB and Minio.
 * It must be called in a file that is used as a global setup in the vitest configuration.
 *
 * It provides the `config` object to the tests, via the `provide` function.
 *
 * @see https://vitest.dev/config/#globalsetup).
 */
export function setupTestContainersVitestGlobal() {
  dotenv();
  const eventStoreConfig = EventStoreConfig.safeParse(process.env);
  const readModelConfig = ReadModelDbConfig.safeParse(process.env);
  const fileManagerConfig = FileManagerConfig.and(S3Config)
    .and(LoggerConfig)
    .safeParse(process.env);
  const emailManagerConfig = EmailManagerConfigTest.safeParse(process.env);

  return async function ({
    provide,
  }: GlobalSetupContext): Promise<() => Promise<void>> {
    let startedPostgreSqlContainer: StartedTestContainer | undefined;
    let startedMongodbContainer: StartedTestContainer | undefined;
    let startedMinioContainer: StartedTestContainer | undefined;
    let startedMailpitContainer: StartedTestContainer | undefined;

    // Setting up the EventStore PostgreSQL container if the config is provided
    if (eventStoreConfig.success) {
      startedPostgreSqlContainer = await postgreSQLContainer(
        eventStoreConfig.data
      ).start();

      /**
       * Since testcontainers exposes to the host on a random port, in order to avoid port
       * collisions, we need to get the port through `getMappedPort` to connect to the databases.
       *
       * @see https://node.testcontainers.org/features/containers/#exposing-container-ports
       *
       * The comment applies to the other containers setup after this one as well.
       */
      eventStoreConfig.data.eventStoreDbPort =
        startedPostgreSqlContainer.getMappedPort(TEST_POSTGRES_DB_PORT);

      /**
       * Vitest global setup functions are executed in a separate process, vitest provides a way to
       * pass serializable data to the tests via the `provide` function.
       * In this case, we provide the `config` object to the tests, so that they can connect to the
       * started containers.
       *
       * The comment applies to the other containers setup after this one as well.
       */
      provide("eventStoreConfig", eventStoreConfig.data);
    }

    // Setting up the MongoDB container if the config is provided
    if (readModelConfig.success) {
      startedMongodbContainer = await mongoDBContainer(
        readModelConfig.data
      ).start();

      readModelConfig.data.readModelDbPort =
        startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

      provide("readModelConfig", readModelConfig.data);
    }

    // Setting up the Minio container if the config is provided
    if (fileManagerConfig.success) {
      startedMinioContainer = await minioContainer(
        fileManagerConfig.data
      ).start();

      fileManagerConfig.data.s3ServerPort =
        startedMinioContainer?.getMappedPort(TEST_MINIO_PORT);

      provide("fileManagerConfig", fileManagerConfig.data);
    }

    if (emailManagerConfig.success) {
      startedMailpitContainer = await mailpitContainer().start();
      emailManagerConfig.data.smtpPort = startedMailpitContainer.getMappedPort(
        TEST_MAILPIT_SMTP_PORT
      );
      emailManagerConfig.data.smtpHTTPPort =
        startedMailpitContainer.getMappedPort(TEST_MAILPIT_HTTP_PORT);
      emailManagerConfig.data.smtpAddress = startedMailpitContainer.getHost();
      provide("emailManagerConfig", emailManagerConfig.data);
    }

    return async (): Promise<void> => {
      await startedPostgreSqlContainer?.stop();
      await startedMongodbContainer?.stop();
      await startedMinioContainer?.stop();
      await startedMailpitContainer?.stop();
    };
  };
}
