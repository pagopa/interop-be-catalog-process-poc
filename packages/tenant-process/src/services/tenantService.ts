import { CreateEvent, eventRepository, initDB } from "pagopa-interop-commons";
import {
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantFeature,
  TenantKind,
  TenantMail,
  WithMetadata,
  tenantAttributeType,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { TenantProcessConfig } from "../utilities/config.js";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
} from "../model/types.js";
import {
  invalidAttributeStructure,
  tenantDuplicate,
} from "../model/domain/errors.js";
import { assertAttributeExists, assertTenantExists } from "./validators.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  config: TenantProcessConfig,
  readModelService: ReadModelService
) {
  const repository = eventRepository(
    initDB({
      username: config.eventStoreDbUsername,
      password: config.eventStoreDbPassword,
      host: config.eventStoreDbHost,
      port: config.eventStoreDbPort,
      database: config.eventStoreDbName,
      schema: config.eventStoreDbSchema,
      useSSL: config.eventStoreDbUseSSL,
    }),
    tenantEventToBinaryData
  );
  return {

}


export function createTenantLogic({
  tenant,
  apiTenantSeed,
  kind,
  attributes,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  apiTenantSeed:
    | ApiSelfcareTenantSeed
    | ApiM2MTenantSeed
    | ApiInternalTenantSeed;
  kind: TenantKind;
  attributes: Array<WithMetadata<Attribute>>;
}): CreateEvent<TenantEvent> {
  if (tenant) {
    throw tenantDuplicate(apiTenantSeed.name);
  }

  const tenantAttributes: TenantAttribute[] = attributes.map((attribute) => ({
    type: tenantAttributeType.CERTIFIED, // All attributes here are certified
    id: attribute.data.id,
    assignmentTimestamp: new Date(),
  }));

  const newTenant: Tenant = {
    id: uuidv4(),
    name: apiTenantSeed.name,
    attributes: tenantAttributes,
    externalId: apiTenantSeed.externalId,
    features: [],
    mails: [],
    createdAt: new Date(),
    kind,
  };

  return toCreateEventTenantAdded(newTenant);
}
