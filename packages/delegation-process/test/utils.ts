import {
  ReadEvent,
  readEventByStreamIdAndVersion,
  readLastEventByStreamId,
  setupTestContainersVitest,
  StoredEvent,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import {
  Delegation,
  DelegationEvent,
  DelegationId,
  EService,
  Tenant,
  toDelegationV2,
  toReadModelEService,
  toReadModelTenant,
} from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { delegationProducerServiceBuilder } from "../src/services/delegationProducerService.js";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );
afterEach(cleanup);

export const delegations = readModelRepository.delegations;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const delegationProducerService = delegationProducerServiceBuilder(
  postgresDB,
  readModelService
);

export const delegationService = delegationServiceBuilder(readModelService);

export const writeSubmitDelegationInEventstore = async (
  delegation: Delegation
): Promise<void> => {
  const createProducerDelegationEvent: DelegationEvent = {
    type: "DelegationSubmitted",
    event_version: 2,
    data: {
      delegation: toDelegationV2(delegation),
    },
  };

  const eventToWrite: StoredEvent<DelegationEvent> = {
    stream_id: delegation.id,
    version: 0,
    event: createProducerDelegationEvent,
  };

  await writeInEventstore(eventToWrite, "delegation", postgresDB);
};

export const readLastDelegationEvent = async (
  delegationId: DelegationId
): Promise<ReadEvent<DelegationEvent>> =>
  await readLastEventByStreamId(delegationId, "delegation", postgresDB);

export const readDelegationEventByVersion = async (
  delegationId: DelegationId,
  version: number
): Promise<ReadEvent<DelegationEvent>> =>
  await readEventByStreamIdAndVersion(
    delegationId,
    version,
    "delegation",
    postgresDB
  );

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeSubmitDelegationInEventstore(delegation);
  await writeInReadmodel(delegation, delegations);
};

export const addOneTenant = async (tenant: Tenant): Promise<void> => {
  await writeInReadmodel(toReadModelTenant(tenant), tenants);
};
export const addOneEservice = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};
