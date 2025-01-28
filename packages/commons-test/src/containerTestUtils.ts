import {
  EventStoreConfig,
  ReadModelDbConfig,
  S3Config,
} from "pagopa-interop-commons";
import { GenericContainer } from "testcontainers";

export const TEST_MONGO_DB_PORT = 27017;
export const TEST_MONGO_DB_IMAGE = "mongo:4.0";

export const TEST_POSTGRES_DB_PORT = 5432;
export const TEST_POSTGRES_DB_IMAGE = "postgres:14";

export const TEST_DYNAMODB_PORT = 8000;
export const TEST_DYNAMODB_IMAGE = "amazon/dynamodb-local:latest";

export const TEST_MINIO_PORT = 9000;
export const TEST_MINIO_IMAGE =
  "quay.io/minio/minio:RELEASE.2024-02-06T21-36-22Z";

export const TEST_MAILPIT_HTTP_PORT = 8025;
export const TEST_MAILPIT_SMTP_PORT = 465;
export const TEST_MAILPIT_IMAGE = "axllent/mailpit:v1.19";

export const TEST_REDIS_IMAGE = "redis:7.2.5-alpine3.20";
export const TEST_REDIS_PORT = 6379;

export const TEST_NODE_IMAGE = "node:20";
export const TEST_AWS_SES_PORT = 8021;

/**
 * Starts a MongoDB container for testing purposes.
 *
 * @param config - The configuration for the MongoDB container.
 * @returns A promise that resolves to the started test container.
 */
export const mongoDBContainer = (config: ReadModelDbConfig): GenericContainer =>
  new GenericContainer(TEST_MONGO_DB_IMAGE)
    .withEnvironment({
      MONGO_INITDB_DATABASE: config.readModelDbName,
      MONGO_INITDB_ROOT_USERNAME: config.readModelDbUsername,
      MONGO_INITDB_ROOT_PASSWORD: config.readModelDbPassword,
    })
    .withExposedPorts(TEST_MONGO_DB_PORT);

/**
 * Starts a PostgreSQL container for testing purposes.
 *
 * @param config - The configuration for the PostgreSQL container.
 * @returns A promise that resolves to the started test container.
 */
export const postgreSQLContainer = (
  config: EventStoreConfig
): GenericContainer =>
  new GenericContainer(TEST_POSTGRES_DB_IMAGE)
    .withEnvironment({
      POSTGRES_DB: config.eventStoreDbName,
      POSTGRES_USER: config.eventStoreDbUsername,
      POSTGRES_PASSWORD: config.eventStoreDbPassword,
    })
    .withCopyFilesToContainer([
      {
        source: "../../docker/event-store-init.sql",
        target: "/docker-entrypoint-initdb.d/01-init.sql",
      },
    ])
    .withExposedPorts(TEST_POSTGRES_DB_PORT);

/**
 * Starts a DynamoDB container for testing purposes.
 *
 * @param config - The configuration for the DynamoDB container.
 * @returns A promise that resolves to the started test container.
 */
export const dynamoDBContainer = (): GenericContainer =>
  new GenericContainer(TEST_DYNAMODB_IMAGE)
    // .withCommand(["-jar DynamoDBLocal.jar -inMemory -sharedDb"])
    .withExposedPorts(TEST_DYNAMODB_PORT);

/**
 * Starts a MinIO container for testing purposes.
 *
 * @param config - The configuration for the MinIO container.
 * @returns A promise that resolves to the started test container.
 */
export const minioContainer = (config: S3Config): GenericContainer =>
  new GenericContainer(TEST_MINIO_IMAGE)
    .withEnvironment({
      MINIO_ROOT_USER: "testawskey",
      MINIO_ROOT_PASSWORD: "testawssecret",
      MINIO_SITE_REGION: "eu-south-1",
    })
    .withEntrypoint(["sh", "-c"])
    .withCommand([
      `mkdir -p /data/${config.s3Bucket} &&
       mkdir -p /data/test-bucket-1 &&
       mkdir -p /data/test-bucket-2 &&
       /usr/bin/minio server /data`,
    ])
    .withExposedPorts(TEST_MINIO_PORT);

export const mailpitContainer = (): GenericContainer =>
  new GenericContainer(TEST_MAILPIT_IMAGE)
    .withCopyFilesToContainer([
      {
        source: "../../docker/self-signed-certs/cert.pem",
        target: "/cert.pem",
      },
      {
        source: "../../docker/self-signed-certs/key.pem",
        target: "/key.pem",
      },
    ])
    .withEnvironment({
      MP_SMTP_TLS_CERT: "/cert.pem",
      MP_SMTP_TLS_KEY: "/key.pem",
      MP_SMTP_AUTH: "user1:password1",
      MP_SMTP_REQUIRE_TLS: "true",
      MP_SMTP_BIND_ADDR: `0.0.0.0:${TEST_MAILPIT_SMTP_PORT}`,
    })
    .withExposedPorts(TEST_MAILPIT_HTTP_PORT, TEST_MAILPIT_SMTP_PORT);

export const redisContainer = (): GenericContainer =>
  new GenericContainer(TEST_REDIS_IMAGE).withExposedPorts(TEST_REDIS_PORT);

/**
 * Starts a container that exposes an AWS SES v2 compatible API.
 *
 * This container is used to test the email sending functionality of the
 * AWS SES services.
 *
 * @returns A promise that resolves to the started test container.
 */
export const awsSESContainer = (): GenericContainer =>
  new GenericContainer(TEST_NODE_IMAGE)
    .withEntrypoint(["bash", "-c"])
    .withCommand([
      `npm install -g aws-ses-v2-local; aws-ses-v2-local --port=${TEST_AWS_SES_PORT} --host=0.0.0.0`,
    ])
    .withExposedPorts(TEST_AWS_SES_PORT);
