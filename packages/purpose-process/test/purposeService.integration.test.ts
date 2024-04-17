/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  EServiceCollection,
  PurposeCollection,
  ReadModelRepository,
  TenantCollection,
  initDB,
} from "pagopa-interop-commons";
import { IDatabase } from "pg-promise";

import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  getMockAuthData,
  getMockPurpose,
  getMockPurposeVersion,
  getMockPurposeVersionDocument,
  getMockTenant,
  mongoDBContainer,
  postgreSQLContainer,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { StartedTestContainer } from "testcontainers";
import {
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  PurposeVersionDocumentId,
  PurposeVersionId,
  TenantId,
  TenantKind,
  generateId,
  tenantKind,
  toReadModelEService,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "../src/services/purposeService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  eserviceNotFound,
  organizationNotAllowed,
  purposeNotFound,
  purposeVersionDocumentNotFound,
  purposeVersionNotFound,
  tenantKindNotFound,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import { addOnePurpose, getMockEService } from "./utils.js";

describe("database test", async () => {
  let purposes: PurposeCollection;
  let eservices: EServiceCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let purposeService: PurposeService;
  let postgresDB: IDatabase<unknown>;
  let startedPostgreSqlContainer: StartedTestContainer;
  let startedMongodbContainer: StartedTestContainer;

  beforeAll(async () => {
    startedPostgreSqlContainer = await postgreSQLContainer(config).start();
    startedMongodbContainer = await mongoDBContainer(config).start();

    config.eventStoreDbPort = startedPostgreSqlContainer.getMappedPort(
      TEST_POSTGRES_DB_PORT
    );
    config.readModelDbPort =
      startedMongodbContainer.getMappedPort(TEST_MONGO_DB_PORT);

    const readModelRepository = ReadModelRepository.init(config);
    purposes = readModelRepository.purposes;
    eservices = readModelRepository.eservices;
    tenants = readModelRepository.tenants;
    readModelService = readModelServiceBuilder(readModelRepository);
    postgresDB = initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    });
    purposeService = purposeServiceBuilder(postgresDB, readModelService);
  });

  afterEach(async () => {
    await purposes.deleteMany({});
    await eservices.deleteMany({});

    await postgresDB.none("TRUNCATE TABLE purpose.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("Purpose service", () => {
    const mockPurpose = getMockPurpose();
    const mockEService = getMockEService();
    const mockPurposeVersion = getMockPurposeVersion();
    describe("getPurposeById", () => {
      it("should get the purpose if it exists", async () => {
        const mockTenant = {
          ...getMockTenant(),
          kind: tenantKind.PA,
        };

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockTenant, tenants);

        const result = await purposeService.getPurposeById(
          mockPurpose1.id,
          mockTenant.id
        );
        expect(result).toMatchObject({
          purpose: mockPurpose1,
          isRiskAnalysisValid: false,
        });
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const notExistingId: PurposeId = generateId();
        await addOnePurpose(mockPurpose, postgresDB, purposes);

        expect(
          purposeService.getPurposeById(notExistingId, generateId())
        ).rejects.toThrowError(purposeNotFound(notExistingId));
      });
      it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
        const notExistingId: EServiceId = generateId();
        const mockTenant = {
          ...getMockTenant(),
          kind: tenantKind.PA,
        };

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: notExistingId,
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(mockTenant, tenants);

        expect(
          purposeService.getPurposeById(mockPurpose1.id, mockTenant.id)
        ).rejects.toThrowError(eserviceNotFound(notExistingId));
      });
      it("should throw tenantNotFound if the tenant doesn't exist", async () => {
        const notExistingId: TenantId = generateId();

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getPurposeById(mockPurpose1.id, notExistingId)
        ).rejects.toThrowError(tenantNotFound(notExistingId));
      });
      it("should throw tenantKindNotFound if the tenant doesn't exist", async () => {
        const mockTenant = getMockTenant();

        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);
        await writeInReadmodel(mockTenant, tenants);

        expect(
          purposeService.getPurposeById(mockPurpose1.id, mockTenant.id)
        ).rejects.toThrowError(tenantKindNotFound(mockTenant.id));
      });
    });

    describe("getRiskAnalysisDocument", () => {
      it("should get the purpose version document", async () => {
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        const result = await purposeService.getRiskAnalysisDocument({
          purposeId: mockPurpose1.id,
          versionId: mockPurposeVersion.id,
          documentId: mockDocument.id,
          organizationId: mockEService.producerId,
        });
        expect(result).toEqual(mockDocument);
      });
      it("should throw purposeNotFound if the purpose doesn't exist", async () => {
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };
        const mockPurpose2: Purpose = {
          ...getMockPurpose(),
          id: generateId(),
          title: "another purpose",
        };
        await addOnePurpose(mockPurpose2, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: mockDocument.id,
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(purposeNotFound(mockPurpose1.id));
      });
      it("should throw eserviceNotFound if the eservice doesn't exist", async () => {
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: mockDocument.id,
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(eserviceNotFound(mockEService.id));
      });
      it("should throw purposeVersionNotFound if the purpose version doesn't exist", async () => {
        const randomVersionId: PurposeVersionId = generateId();
        const randomDocumentId: PurposeVersionDocumentId = generateId();
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: randomVersionId,
            documentId: randomDocumentId,
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(
          purposeVersionNotFound(mockPurpose1.id, randomVersionId)
        );
      });
      it("should throw purposeVersionDocumentNotFound if the document doesn't exist", async () => {
        const mockDocument = getMockPurposeVersionDocument();
        const randomDocumentId: PurposeVersionDocumentId = generateId();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: randomDocumentId,
            organizationId: mockEService.producerId,
          })
        ).rejects.toThrowError(
          purposeVersionDocumentNotFound(
            mockPurpose1.id,
            mockPurposeVersion.id,
            randomDocumentId
          )
        );
      });
      it("should throw organizationNotAllowed if the requester is not the producer nor the consumer", async () => {
        const randomId: TenantId = generateId();
        const mockDocument = getMockPurposeVersionDocument();
        const mockPurpose1: Purpose = {
          ...mockPurpose,
          eserviceId: mockEService.id,
          versions: [{ ...mockPurposeVersion, riskAnalysis: mockDocument }],
        };

        await addOnePurpose(mockPurpose1, postgresDB, purposes);
        await writeInReadmodel(toReadModelEService(mockEService), eservices);

        expect(
          purposeService.getRiskAnalysisDocument({
            purposeId: mockPurpose1.id,
            versionId: mockPurposeVersion.id,
            documentId: mockDocument.id,
            organizationId: randomId,
          })
        ).rejects.toThrowError(organizationNotAllowed(randomId));
      });
    });
  });
});
