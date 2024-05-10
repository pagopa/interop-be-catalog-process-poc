import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import { afterEach, inject } from "vitest";
import {
  Attribute,
  AttributeEvent,
  AttributeId,
  Tenant,
  TenantId,
  generateId,
  toAttributeV1,
  toReadModelAttribute,
} from "pagopa-interop-models";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import { AuthData } from "pagopa-interop-commons";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { attributeRegistryServiceBuilder } from "../src/services/attributeRegistryService.js";

export const { readModelRepository, postgresDB, fileManager, cleanup } =
  setupTestContainersVitest(inject("config"));

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;

export const readModelService = readModelServiceBuilder(readModelRepository);
export const attributeRegistryService = attributeRegistryServiceBuilder(
  postgresDB,
  readModelService
);

export const writeAttributeInEventstore = async (
  attribute: Attribute
): Promise<void> => {
  const attributeEvent: AttributeEvent = {
    type: "AttributeAdded",
    event_version: 1,
    data: { attribute: toAttributeV1(attribute) },
  };
  const eventToWrite: StoredEvent<AttributeEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: attributeEvent.data.attribute!.id,
    version: 0,
    event: attributeEvent,
  };

  await writeInEventstore(eventToWrite, "attribute", postgresDB);
};

export const addOneAttribute = async (attribute: Attribute): Promise<void> => {
  await writeAttributeInEventstore(attribute);
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(tenant, tenants);
};

export const readLastAttributeEvent = async (
  attributeId: AttributeId
): Promise<ReadEvent<AttributeEvent>> =>
  await readLastEventByStreamId(attributeId, "attribute", postgresDB);

export const getMockTenant = (): Tenant => ({
  name: "tenant_Name",
  id: generateId(),
  createdAt: new Date(),
  attributes: [],
  externalId: {
    value: "1234",
    origin: "IPA",
  },
  features: [],
  mails: [],
});

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
  userId: generateId(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  selfcareId: generateId(),
});
