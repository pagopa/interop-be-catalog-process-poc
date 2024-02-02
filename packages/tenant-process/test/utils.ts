import { MessageType } from "@protobuf-ts/runtime";
import {
  AgreementCollection,
  AuthData,
  EServiceCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  Agreement,
  Descriptor,
  EService,
  Tenant,
  TenantEvent,
  TenantRevoker,
  TenantVerifier,
  VerifiedTenantAttribute,
  agreementState,
  descriptorState,
  technology,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { IDatabase } from "pg-promise";
import { v4 as uuidv4 } from "uuid";
import { toTenantV1 } from "../src/model/domain/toEvent.js";

export const writeTenantInReadmodel = async (
  tenant: Tenant,
  tenants: TenantCollection
): Promise<void> => {
  await tenants.insertOne({
    data: tenant,
    metadata: {
      version: 0,
    },
  });
};

export const writeTenantInEventstore = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>
): Promise<void> => {
  const tenantEvent: TenantEvent = {
    type: "TenantCreated",
    data: { tenant: toTenantV1(tenant) },
  };
  const eventToWrite = {
    stream_id: tenantEvent.data.tenant?.id,
    version: 0,
    type: tenantEvent.type,
    data: Buffer.from(tenantEventToBinaryData(tenantEvent)),
  };
  await postgresDB.none(
    "INSERT INTO tenant.events(stream_id, version, type, data) VALUES ($1, $2, $3, $4)",
    [
      eventToWrite.stream_id,
      eventToWrite.version,
      eventToWrite.type,
      eventToWrite.data,
    ]
  );
};

export const getMockTenant = (): Tenant => ({
  name: "A tenant",
  id: uuidv4(),
  createdAt: new Date(),
  attributes: [],
  selfcareId: uuidv4(),
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  features: [],
  mails: [],
});

const verificationDate = new Date();
verificationDate.setDate(new Date().getDate() - 3);

export const getMockVerifiedBy = (): TenantVerifier => ({
  id: uuidv4(),
  verificationDate,
  expirationDate: new Date(),
  extensionDate: undefined,
});

const revocationDate = new Date();
revocationDate.setDate(new Date().getDate() + 3);

export const getMockRevokedBy = (): TenantRevoker => ({
  id: uuidv4(),
  verificationDate,
  revocationDate,
  expirationDate: new Date(),
  extensionDate: undefined,
});

export const getMockVerifiedTenantAttribute = (): VerifiedTenantAttribute => ({
  id: uuidv4(),
  type: "verified",
  assignmentTimestamp: new Date(),
  verifiedBy: [
    {
      ...getMockVerifiedBy(),
    },
  ],
  revokedBy: [
    {
      ...getMockRevokedBy(),
    },
  ],
});
export const getMockAuthData = (organizationId?: string): AuthData => ({
  organizationId: organizationId || uuidv4(),
  userId: uuidv4(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
});

export const getMockEService = (): EService => ({
  id: uuidv4(),
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId: uuidv4(),
  technology: technology.rest,
  descriptors: [],
  attributes: undefined,
});

export const getMockDescriptor = (): Descriptor => ({
  id: uuidv4(),
  version: "0",
  docs: [],
  state: descriptorState.draft,
  audience: [],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: [],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
});

export const getMockAgreement = ({
  eServiceId,
  descriptorId,
  producerId,
  consumerId,
}: {
  eServiceId: string;
  descriptorId: string;
  producerId: string;
  consumerId: string;
}): Agreement => ({
  id: uuidv4(),
  createdAt: new Date(),
  eserviceId: eServiceId,
  descriptorId,
  producerId,
  consumerId,
  state: agreementState.active,
  verifiedAttributes: [],
  certifiedAttributes: [],
  declaredAttributes: [],
  consumerDocuments: [],
  stamps: {
    submission: undefined,
    activation: undefined,
    rejection: undefined,
    suspensionByProducer: undefined,
    suspensionByConsumer: undefined,
    upgrade: undefined,
    archiving: undefined,
  },
});

export const writeAgreementInReadmodel = async (
  agreement: Agreement,
  agreements: AgreementCollection
): Promise<void> => {
  await agreements.insertOne({
    data: agreement,
    metadata: {
      version: 0,
    },
  });
};

export const writeEServiceInReadmodel = async (
  eService: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await eservices.insertOne({
    data: eService,
    metadata: {
      version: 0,
    },
  });
};

export const addOneAgreement = async (
  agreement: Agreement,
  agreements: AgreementCollection
): Promise<void> => {
  await writeAgreementInReadmodel(agreement, agreements);
};

export const addOneEService = async (
  eService: EService,
  eservices: EServiceCollection
): Promise<void> => {
  await writeEServiceInReadmodel(eService, eservices);
};

export const addOneTenant = async (
  tenant: Tenant,
  postgresDB: IDatabase<unknown>,
  tenants: TenantCollection
): Promise<void> => {
  await writeTenantInEventstore(tenant, postgresDB);
  await writeTenantInReadmodel(tenant, tenants);
};

export const readLastEventByStreamId = async (
  tenantId: string,
  postgresDB: IDatabase<unknown>
): Promise<any> => // eslint-disable-line @typescript-eslint/no-explicit-any
  await postgresDB.one(
    "SELECT * FROM tenant.events WHERE stream_id = $1 ORDER BY sequence_num DESC LIMIT 1",
    [tenantId]
  );

export function decodeProtobufPayload<I extends object>({
  messageType,
  payload,
}: {
  messageType: MessageType<I>;
  payload: Parameters<typeof Buffer.from>[0];
}): I {
  return messageType.fromBinary(Buffer.from(payload, "hex"));
}
