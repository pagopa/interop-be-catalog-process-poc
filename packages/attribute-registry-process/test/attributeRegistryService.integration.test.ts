/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable functional/no-let */
import {
  beforeAll,
  afterEach,
  describe,
  expect,
  it,
  beforeEach,
  afterAll,
} from "vitest";
import {
  TEST_MONGO_DB_PORT,
  TEST_POSTGRES_DB_PORT,
  decodeProtobufPayload,
  getMockAttribute,
  mongoDBContainer,
  postgreSQLContainer,
} from "pagopa-interop-commons-test";
import {
  AttributeCollection,
  ReadModelRepository,
  TenantCollection,
  genericLogger,
  initDB,
} from "pagopa-interop-commons";
import { StartedTestContainer } from "testcontainers";
import { v4 as uuidv4 } from "uuid";
import { IDatabase } from "pg-promise";
import {
  Attribute,
  AttributeAddedV1,
  AttributeId,
  Tenant,
  attributeKind,
  generateId,
  toAttributeV1,
} from "pagopa-interop-models";
import { config } from "../src/utilities/config.js";
import {
  AttributeRegistryService,
  attributeRegistryServiceBuilder,
} from "../src/services/attributeRegistryService.js";
import {
  ReadModelService,
  readModelServiceBuilder,
} from "../src/services/readModelService.js";
import {
  OrganizationIsNotACertifier,
  attributeDuplicate,
  attributeNotFound,
  originNotCompliant,
  tenantNotFound,
} from "../src/model/domain/errors.js";
import {
  addOneAttribute,
  addOneTenant,
  getMockTenant,
  getMockAuthData,
  readLastAttributeEvent,
} from "./utils.js";

const mockAttribute = getMockAttribute();
const mockTenant = getMockTenant();

describe("database test", () => {
  let attributes: AttributeCollection;
  let tenants: TenantCollection;
  let readModelService: ReadModelService;
  let attributeRegistryService: AttributeRegistryService;
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
    ({ attributes, tenants } = readModelRepository);
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

    attributeRegistryService = attributeRegistryServiceBuilder(
      postgresDB,
      readModelService
    );
  });

  afterEach(async () => {
    await attributes.deleteMany({});
    await tenants.deleteMany({});
    await postgresDB.none("TRUNCATE TABLE attribute.events RESTART IDENTITY");
  });

  afterAll(async () => {
    await startedPostgreSqlContainer.stop();
    await startedMongodbContainer.stop();
  });

  describe("attributeRegistryService", () => {
    describe("declared attribute creation", () => {
      it("should write on event-store for the creation of a declared attribute", async () => {
        const attribute =
          await attributeRegistryService.createDeclaredAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(),
              correlationId: "",
              logger: genericLogger,
              serviceName: "",
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(
          attribute.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          kind: attributeKind.declared,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
        };

        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
      });
      it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
        expect(
          attributeRegistryService.createDeclaredAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: {
                ...getMockAuthData(),
                externalId: {
                  value: "123456",
                  origin: "not-allowed-origin",
                },
              },
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
      });
      it("should throw attributeDuplicate if an attribute with the same name already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createDeclaredAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              correlationId: "",
              logger: genericLogger,
              serviceName: "",
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });
    describe("verified attribute creation", () => {
      it("should write on event-store for the creation of a verified attribute", async () => {
        const attribute =
          await attributeRegistryService.createVerifiedAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(
          attribute.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          kind: attributeKind.verified,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
        };

        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
      });
      it("should throw originNotCompliant if the requester externalId origin is not allowed", async () => {
        expect(
          attributeRegistryService.createVerifiedAttribute(
            {
              name: mockAttribute.name,
              description: mockAttribute.description,
            },
            {
              authData: {
                ...getMockAuthData(),
                externalId: {
                  value: "123456",
                  origin: "not-allowed-origin",
                },
              },
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(originNotCompliant("not-allowed-origin"));
      });
      it("should throw attributeDuplicate if an attribute with the same name already exists", async () => {
        const attribute = {
          ...mockAttribute,
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createVerifiedAttribute(
            {
              name: attribute.name,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });
    describe("certified attribute creation", () => {
      it("should write on event-store for the creation of a certified attribute", async () => {
        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);

        const attribute =
          await attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(tenant.id),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(
          attribute.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });

        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          code: "code",
          kind: attributeKind.certified,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          origin: tenant.features[0].certifierId,
        };
        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
      });
      it("should throw attributeDuplicate if an attribute with the same name and code already exists", async () => {
        const attribute = {
          ...mockAttribute,
          code: "123456",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: attribute.name,
              code: attribute.code,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(tenant.id),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
      it("should throw OrganizationIsNotACertifier if the organization is not a certifier", async () => {
        await addOneTenant(mockTenant, tenants);
        await addOneAttribute(mockAttribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(mockTenant.id),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(OrganizationIsNotACertifier(mockTenant.id));
      });
      it("should throw tenantNotFound if the certifier is not found", async () => {
        await addOneAttribute(mockAttribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(mockTenant.id),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(tenantNotFound(mockTenant.id));
      });
    });
    describe("certified attribute internal creation", () => {
      it("should write on event-store for the internal creation of a certified attribute", async () => {
        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);

        const attribute =
          await attributeRegistryService.createInternalCertifiedAttribute(
            {
              name: mockAttribute.name,
              code: "code",
              origin: tenant.features[0].certifierId,
              description: mockAttribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          );
        expect(attribute).toBeDefined();

        const writtenEvent = await readLastAttributeEvent(
          attribute.id,
          postgresDB
        );
        expect(writtenEvent).toMatchObject({
          stream_id: attribute.id,
          version: "0",
          type: "AttributeAdded",
          event_version: 1,
        });
        const writtenPayload = decodeProtobufPayload({
          messageType: AttributeAddedV1,
          payload: writtenEvent.data,
        });

        const expectedAttribute: Attribute = {
          ...mockAttribute,
          id: attribute.id,
          code: "code",
          kind: attributeKind.certified,
          creationTime: new Date(writtenPayload.attribute!.creationTime),
          origin: tenant.features[0].certifierId,
        };
        expect(writtenPayload.attribute).toEqual(
          toAttributeV1(expectedAttribute)
        );
      });
      it("should throw attributeDuplicate if an attribute with the same name and code already exists", async () => {
        const attribute = {
          ...mockAttribute,
          code: "123456",
        };

        const tenant: Tenant = {
          ...mockTenant,
          features: [
            {
              type: "PersistentCertifier",
              certifierId: uuidv4(),
            },
          ],
        };

        await addOneTenant(tenant, tenants);
        await addOneAttribute(attribute, postgresDB, attributes);
        expect(
          attributeRegistryService.createInternalCertifiedAttribute(
            {
              name: attribute.name,
              code: attribute.code,
              origin: tenant.features[0].certifierId,
              description: attribute.description,
            },
            {
              authData: getMockAuthData(),
              logger: genericLogger,
              correlationId: "",
              serviceName: "",
            }
          )
        ).rejects.toThrowError(attributeDuplicate(attribute.name));
      });
    });

    describe("readModelService", () => {
      let attribute1: Attribute;
      let attribute2: Attribute;
      let attribute3: Attribute;
      let attribute4: Attribute;
      let attribute5: Attribute;
      let attribute6: Attribute;
      let attribute7: Attribute;

      beforeEach(async () => {
        attribute1 = {
          ...mockAttribute,
          id: generateId(),
          name: "attribute 001 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345A",
        };
        await addOneAttribute(attribute1, postgresDB, attributes);

        attribute2 = {
          ...mockAttribute,
          id: generateId(),
          name: "attribute 002 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345B",
        };
        await addOneAttribute(attribute2, postgresDB, attributes);

        attribute3 = {
          ...mockAttribute,
          id: generateId(),
          name: "attribute 003 test",
          kind: attributeKind.certified,
          origin: "IPA",
          code: "12345C",
        };
        await addOneAttribute(attribute3, postgresDB, attributes);

        attribute4 = {
          ...mockAttribute,
          id: generateId(),
          name: "attribute 004",
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute4, postgresDB, attributes);

        attribute5 = {
          ...mockAttribute,
          id: generateId(),
          name: "attribute 005",
          kind: attributeKind.declared,
        };
        await addOneAttribute(attribute5, postgresDB, attributes);

        attribute6 = {
          ...mockAttribute,
          id: generateId(),
          name: "attribute 006",
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute6, postgresDB, attributes);

        attribute7 = {
          ...mockAttribute,
          id: generateId(),
          name: "attribute 007",
          kind: attributeKind.verified,
        };
        await addOneAttribute(attribute7, postgresDB, attributes);
      });

      describe("getAttributesByIds", () => {
        it("should get the attributes if they exist", async () => {
          const result = await readModelService.getAttributesByIds(
            {
              ids: [attribute1.id, attribute2.id, attribute3.id],
              offset: 0,
              limit: 50,
            },
            genericLogger
          );

          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should not get the attributes if they don't exist", async () => {
          const result = await readModelService.getAttributesByIds(
            {
              ids: [generateId(), generateId()],
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
        it("should not get any attributes if the requested ids list is empty", async () => {
          const result = await readModelService.getAttributesByIds(
            {
              ids: [],
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });
      describe("getAttributesByKindsNameOrigin", () => {
        it("should get the attributes if they exist (parameters: kinds, name, origin)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [attributeKind.certified],
              name: "test",
              origin: "IPA",
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get the attributes if they exist (parameters: kinds only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [attributeKind.declared],
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(2);
          expect(result.results).toEqual([attribute4, attribute5]);
        });
        it("should get the attributes if they exist (parameters: name only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [],
              name: "test",
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get the attributes if they exist (parameters: origin only)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [],
              origin: "IPA",
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(3);
          expect(result.results).toEqual([attribute1, attribute2, attribute3]);
        });
        it("should get all the attributes if no parameter is passed", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [],
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(7);
          expect(result.results).toEqual([
            attribute1,
            attribute2,
            attribute3,
            attribute4,
            attribute5,
            attribute6,
            attribute7,
          ]);
        });
        it("should get the attributes if no parameter is passed (pagination: limit)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [],
              offset: 0,
              limit: 5,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(7);
          expect(result.results.length).toBe(5);
        });
        it("should get the attributes if no parameter is passed (pagination: offset, limit)", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [],
              offset: 5,
              limit: 5,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(7);
          expect(result.results.length).toBe(2);
        });
        it("should not get the attributes if they don't exist", async () => {
          const result = await readModelService.getAttributesByKindsNameOrigin(
            {
              kinds: [],
              name: "latest attribute",
              offset: 0,
              limit: 50,
            },
            genericLogger
          );
          expect(result.totalCount).toBe(0);
          expect(result.results).toEqual([]);
        });
      });
      describe("getAttributeById", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await attributeRegistryService.getAttributeById(
            attribute1.id,
            genericLogger
          );
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should throw attributeNotFound if the attribute doesn't exist", async () => {
          const id = generateId<AttributeId>();
          expect(
            attributeRegistryService.getAttributeById(id, genericLogger)
          ).rejects.toThrowError(attributeNotFound(id));
        });
      });
      describe("getAttributeByName", () => {
        it("should get the attribute if it exists", async () => {
          const attribute = await attributeRegistryService.getAttributeByName(
            attribute1.name,
            genericLogger
          );
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should throw attributeNotFound if the attribute doesn't exist", async () => {
          const name = "not-existing";
          expect(
            attributeRegistryService.getAttributeByName(name, genericLogger)
          ).rejects.toThrowError(attributeNotFound(name));
        });
      });
      describe("getAttributeByOriginAndCode", () => {
        it("should get the attribute if it exists", async () => {
          const attribute =
            await attributeRegistryService.getAttributeByOriginAndCode(
              {
                origin: "IPA",
                code: "12345A",
              },
              genericLogger
            );
          expect(attribute?.data).toEqual(attribute1);
        });
        it("should throw attributeNotFound if the attribute doesn't exist", async () => {
          expect(
            attributeRegistryService.getAttributeByOriginAndCode(
              {
                origin: "IPA",
                code: "12345D",
              },
              genericLogger
            )
          ).rejects.toThrowError(attributeNotFound("IPA/12345D"));
        });
      });
    });
  });
});
