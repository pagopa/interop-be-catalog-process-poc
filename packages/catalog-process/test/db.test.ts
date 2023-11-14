/* eslint-disable functional/no-let */
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  AgreementCollection,
  EServiceCollection,
  ReadModelRepository,
  getMongodbContainer,
  getPostgreSqlContainer,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";
import { config } from "../src/utilities/config.js";
// import { ReadModelService } from "../src/services/readModelService.js";
// import { CatalogService } from "../src/services/catalogService.js";

describe("database test", async () => {
  let eservices: EServiceCollection;
  let agreements: AgreementCollection;
  // let readModelService: ReadModelService;
  // let catalogService: CatalogService;
  let postgresDB: IDatabase<unknown>;

  beforeAll(async () => {
    const postgreSqlContainer = await getPostgreSqlContainer({
      dbName: config.eventStoreDbName,
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
    }).start();

    const mongodbContainer = await getMongodbContainer({
      dbName: config.readModelDbName,
      username: config.readModelDbUsername,
      password: config.readModelDbPassword,
    }).start();

    config.readModelDbPort = mongodbContainer.getMappedPort(27017);
    eservices = ReadModelRepository.init(config).eservices;
    agreements = ReadModelRepository.init(config).agreements;
    // readModelService = new ReadModelService(eservices, agreements);
    // catalogService = new CatalogService(
    //   readModelService,
    //   postgreSqlContainer.getMappedPort(5432)
    // );

    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: postgreSqlContainer.getMappedPort(5432),
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
  });

  afterEach(async () => {
    await eservices.deleteMany({});
    await agreements.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE catalog.events RESTART IDENTITY");
    await postgresDB.none("TRUNCATE TABLE agreement.events RESTART IDENTITY");
  });

  describe("TO DO", () => {
    it("TO DO", () => {
      expect(1).toBe(1);
    });
  });
});
