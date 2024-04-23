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
import { IDatabase } from "pg-promise";
import {
  AttributeCollection,
  AuthData,
  TenantCollection,
} from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";
import {
  ReadEvent,
  StoredEvent,
  readLastEventByStreamId,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";

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
  userId: uuidv4(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
});

export const writeAttributeInEventstore = async (
  attribute: Attribute,
  postgresDB: IDatabase<unknown>
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

export const addOneAttribute = async (
  attribute: Attribute,
  postgresDB: IDatabase<unknown>,
  attributes: AttributeCollection
): Promise<void> => {
  await writeAttributeInEventstore(attribute, postgresDB);
  await writeInReadmodel(toReadModelAttribute(attribute), attributes);
};

export const addOneTenant = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await writeInReadmodel(tenant, tenants);
};

export const readLastAttributeEvent = async (
  attributeId: AttributeId,
  postgresDB: IDatabase<unknown>
): Promise<ReadEvent<AttributeEvent>> =>
  await readLastEventByStreamId(attributeId, "attribute", postgresDB);
