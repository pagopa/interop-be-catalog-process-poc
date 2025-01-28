/* eslint-disable fp/no-delete */
import crypto from "crypto";
import { fail } from "assert";
import { generateMock } from "@anatine/zod-mock";
import {
  Agreement,
  AgreementState,
  Attribute,
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  Descriptor,
  DescriptorId,
  EService,
  EServiceAttribute,
  EServiceId,
  Purpose,
  PurposeVersion,
  PurposeVersionDocument,
  PurposeVersionState,
  Tenant,
  TenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  attributeKind,
  agreementState,
  descriptorState,
  generateId,
  purposeVersionState,
  Document,
  AgreementAttribute,
  tenantMailKind,
  TenantMailKind,
  Client,
  clientKind,
  keyUse,
  Key,
  technology,
  AttributeKind,
  itemState,
  ClientId,
  PurposeId,
  TokenGenerationStatesConsumerClient,
  makeGSIPKConsumerIdEServiceId,
  makeGSIPKClientIdPurposeId,
  makeGSIPKEServiceIdDescriptorId,
  TokenGenerationStatesClientKidPurposePK,
  makeTokenGenerationStatesClientKidPurposePK,
  clientKindTokenGenStates,
  AgreementId,
  PurposeVersionId,
  ProducerKeychain,
  Delegation,
  DelegationId,
  DelegationContractDocument,
  DelegationContractId,
  DelegationState,
  TenantFeatureCertifier,
  TenantFeature,
  DescriptorState,
  PlatformStatesAgreementEntry,
  PlatformStatesAgreementPK,
  makeGSIPKClientIdKid,
  TokenGenerationStatesClientKidPK,
  TokenGenerationStatesApiClient,
  makeTokenGenerationStatesClientKidPK,
  PlatformStatesClientPK,
  PlatformStatesClientEntry,
  makePlatformStatesClientPK,
  AgreementStamps,
  DelegationKind,
  unsafeBrandId,
  UserId,
  delegationState,
  delegationKind,
} from "pagopa-interop-models";
import { AuthData, dateToSeconds } from "pagopa-interop-commons";
import { z } from "zod";
import * as jose from "jose";
import { match } from "ts-pattern";

export function expectPastTimestamp(timestamp: bigint): boolean {
  return (
    new Date(Number(timestamp)) && new Date(Number(timestamp)) <= new Date()
  );
}

export function randomArrayItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

export function randomBoolean(): boolean {
  return Math.random() < 0.5;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const getTenantCertifierFeatures = (
  tenant: Tenant
): TenantFeatureCertifier[] =>
  tenant.features.reduce(
    (acc: TenantFeatureCertifier[], feature: TenantFeature) =>
      match(feature.type)
        .with("PersistentCertifier", () => [
          ...acc,
          feature as TenantFeatureCertifier,
        ])
        .with("DelegatedProducer", () => acc)
        .with("DelegatedConsumer", () => acc)
        .exhaustive(),
    []
  );

export const getTenantOneCertifierFeature = (
  tenant: Tenant
): TenantFeatureCertifier => {
  const certifiedFeatures = getTenantCertifierFeatures(tenant);
  if (certifiedFeatures.length === 0) {
    fail("Expected certifier feature not found in Tenant");
  }
  return certifiedFeatures[0];
};

export const getRandomAuthData = (
  organizationId: TenantId = generateId<TenantId>()
): AuthData => ({
  ...generateMock(AuthData),
  userRoles: ["admin"],
  organizationId,
});

export const getMockDescriptorPublished = (
  descriptorId: DescriptorId = generateId<DescriptorId>(),
  certifiedAttributes: EServiceAttribute[][] = [],
  declaredAttributes: EServiceAttribute[][] = [],
  verifiedAttributes: EServiceAttribute[][] = []
): Descriptor => ({
  ...generateMock(Descriptor),
  id: descriptorId,
  state: descriptorState.published,
  attributes: {
    certified: certifiedAttributes,
    declared: declaredAttributes,
    verified: verifiedAttributes,
  },
  rejectionReasons: undefined,
});

export const getMockEServiceAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): EServiceAttribute => ({
  ...generateMock(EServiceAttribute),
  id: attributeId,
});

export const getMockAgreementAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): AgreementAttribute => ({
  id: attributeId,
});

export const getMockEServiceAttributes = (num: number): EServiceAttribute[] =>
  new Array(num).map(() => getMockEServiceAttribute());

export const getMockEService = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  producerId: TenantId = generateId<TenantId>(),
  descriptors: Descriptor[] = []
): EService => ({
  id: eserviceId,
  name: "eService name",
  description: "eService description",
  createdAt: new Date(),
  producerId,
  technology: technology.rest,
  descriptors,
  attributes: undefined,
  riskAnalysis: [],
  mode: "Deliver",
});

export const getMockVerifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): VerifiedTenantAttribute => ({
  ...generateMock(VerifiedTenantAttribute),
  id: attributeId,
});

export const getMockCertifiedTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): CertifiedTenantAttribute => ({
  ...generateMock(CertifiedTenantAttribute),
  id: attributeId,
});

export const getMockDeclaredTenantAttribute = (
  attributeId: AttributeId = generateId<AttributeId>()
): DeclaredTenantAttribute => ({
  ...generateMock(DeclaredTenantAttribute),
  id: attributeId,
});

export const getMockTenant = (
  tenantId: TenantId = generateId<TenantId>(),
  attributes: TenantAttribute[] = []
): Tenant => ({
  name: "A tenant",
  id: tenantId,
  createdAt: new Date(),
  attributes,
  selfcareId: generateId(),
  onboardedAt: new Date(),
  externalId: {
    value: generateId(),
    origin: "IPA",
  },
  features: [],
  mails: [],
});

export const getMockTenantMail = (
  kind: TenantMailKind = tenantMailKind.ContactEmail
): Tenant["mails"][number] => ({
  id: generateId(),
  createdAt: new Date(),
  kind,
  description: generateMock(z.string()),
  address: generateMock(z.string().email()),
});

export const getMockAgreementStamps = (): AgreementStamps => {
  const stamps = generateMock(AgreementStamps);
  delete stamps.submission?.delegationId;
  delete stamps.activation?.delegationId;
  delete stamps.rejection?.delegationId;
  delete stamps.suspensionByConsumer?.delegationId;
  delete stamps.suspensionByProducer?.delegationId;
  delete stamps.upgrade?.delegationId;
  delete stamps.archiving?.delegationId;
  return stamps;
};

export const getMockAgreement = (
  eserviceId: EServiceId = generateId<EServiceId>(),
  consumerId: TenantId = generateId<TenantId>(),
  state: AgreementState = agreementState.draft
): Agreement => ({
  ...generateMock(Agreement),
  eserviceId,
  consumerId,
  state,
  stamps: getMockAgreementStamps(),
});

export const getMockAttribute = (
  kind: AttributeKind = attributeKind.certified,
  id: AttributeId = generateId()
): Attribute => ({
  id,
  name: "attribute name",
  kind,
  description: "attribute description",
  creationTime: new Date(),
  code: undefined,
  origin: undefined,
});

export const getMockPurpose = (versions?: PurposeVersion[]): Purpose => ({
  id: generateId(),
  eserviceId: generateId(),
  consumerId: generateId(),
  versions: versions ?? [],
  title: "Purpose 1 - test",
  description: "Test purpose - description",
  createdAt: new Date(),
  isFreeOfCharge: true,
  freeOfChargeReason: "test",
});

export const getMockPurposeVersion = (
  state?: PurposeVersionState
): PurposeVersion => ({
  id: generateId(),
  state: state || purposeVersionState.draft,
  riskAnalysis: {
    id: generateId(),
    contentType: "json",
    path: "path",
    createdAt: new Date(),
  },
  dailyCalls: 10,
  createdAt: new Date(),
  ...(state !== purposeVersionState.draft
    ? { updatedAt: new Date(), firstActivationAt: new Date() }
    : {}),
  ...(state === purposeVersionState.suspended
    ? { suspendedAt: new Date() }
    : {}),
  ...(state === purposeVersionState.rejected
    ? { rejectionReason: "test" }
    : {}),
});

export const getMockPurposeVersionDocument = (): PurposeVersionDocument => ({
  path: "path",
  id: generateId(),
  contentType: "json",
  createdAt: new Date(),
});

export const getMockDescriptor = (state?: DescriptorState): Descriptor => ({
  id: generateId(),
  version: "1",
  docs: [],
  state: state || descriptorState.draft,
  audience: [],
  voucherLifespan: 60,
  dailyCallsPerConsumer: 10,
  dailyCallsTotal: 1000,
  createdAt: new Date(),
  serverUrls: ["pagopa.it"],
  agreementApprovalPolicy: "Automatic",
  attributes: {
    certified: [],
    verified: [],
    declared: [],
  },
  rejectionReasons: undefined,
});

export const getMockDescriptorList = (length?: number): Descriptor[] => {
  const arrayLength = length ?? Math.floor(Math.random() * 10) + 1;
  return Array.from({ length: arrayLength }, () => getMockDescriptor());
};

export const getMockDocument = (): Document => ({
  name: "fileName",
  path: "filePath",
  id: generateId(),
  prettyName: "prettyName",
  contentType: "json",
  checksum: "checksum",
  uploadDate: new Date(),
});

export const getMockClient = (): Client => ({
  id: generateId(),
  consumerId: generateId(),
  name: "Test client",
  purposes: [],
  description: "Client description",
  users: [],
  kind: clientKind.consumer,
  createdAt: new Date(),
  keys: [],
});

export const getMockProducerKeychain = (): ProducerKeychain => ({
  id: generateId(),
  producerId: generateId(),
  name: "Test producer keychain",
  eservices: [],
  description: "producer keychain description",
  users: [],
  createdAt: new Date(),
  keys: [],
});

export const getMockKey = (): Key => ({
  userId: generateId(),
  name: "test key",
  createdAt: new Date(),
  kid: `kid ${Math.random()}`,
  encodedPem: "encodedPem",
  algorithm: "",
  use: keyUse.sig,
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

export const getMockDelegation = ({
  kind,
  id = generateId<DelegationId>(),
  delegatorId = generateId<TenantId>(),
  delegateId = generateId<TenantId>(),
  eserviceId = generateId<EServiceId>(),
  state = "WaitingForApproval",
  submitterId = generateId<UserId>(),
  activationContract = undefined,
  revocationContract = undefined,
}: {
  kind: DelegationKind;
  id?: DelegationId;
  delegatorId?: TenantId;
  delegateId?: TenantId;
  eserviceId?: EServiceId;
  state?: DelegationState;
  submitterId?: UserId;
  activationContract?: DelegationContractDocument;
  revocationContract?: DelegationContractDocument;
}): Delegation => {
  const creationTime = new Date();

  return {
    id,
    delegatorId,
    delegateId,
    eserviceId,
    createdAt: creationTime,
    submittedAt: creationTime,
    state,
    activationContract,
    revocationContract,
    kind,
    stamps: {
      submission: {
        who: submitterId,
        when: creationTime,
      },
    },
  };
};

export const getMockDelegationDocument = (
  id?: DelegationContractId
): DelegationContractDocument => ({
  id: id ?? generateId(),
  name: "Test document",
  prettyName: "Test document",
  contentType: "json",
  path: "path",
  createdAt: new Date(),
});

export const getMockTokenGenStatesConsumerClient = (
  tokenGenStatesEntryPK?:
    | TokenGenerationStatesClientKidPurposePK
    | TokenGenerationStatesClientKidPK
): TokenGenerationStatesConsumerClient => {
  const clientId = tokenGenStatesEntryPK
    ? unsafeBrandId<ClientId>(tokenGenStatesEntryPK.split("#")[1])
    : generateId<ClientId>();
  const purposeId = generateId<PurposeId>();
  const consumerId = generateId<TenantId>();
  const eserviceId = generateId<EServiceId>();
  const descriptorId = generateId<DescriptorId>();
  const agreementId = generateId<AgreementId>();
  const purposeVersionId = generateId<PurposeVersionId>();
  const kid = `kid ${Math.random()}`;

  if (
    !tokenGenStatesEntryPK ||
    TokenGenerationStatesClientKidPurposePK.safeParse(tokenGenStatesEntryPK)
      .success
  ) {
    return {
      PK:
        tokenGenStatesEntryPK ||
        makeTokenGenerationStatesClientKidPurposePK({
          clientId,
          kid,
          purposeId,
        }),
      descriptorState: itemState.active,
      descriptorAudience: ["pagopa.it/test1", "pagopa.it/test2"],
      descriptorVoucherLifespan: 60,
      updatedAt: new Date().toISOString(),
      consumerId,
      agreementId,
      purposeVersionId,
      GSIPK_consumerId_eserviceId: makeGSIPKConsumerIdEServiceId({
        consumerId,
        eserviceId,
      }),
      clientKind: clientKindTokenGenStates.consumer,
      publicKey: "PEM",
      GSIPK_clientId: clientId,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
      agreementState: itemState.active,
      GSIPK_eserviceId_descriptorId: makeGSIPKEServiceIdDescriptorId({
        eserviceId,
        descriptorId,
      }),
      GSIPK_purposeId: purposeId,
      purposeState: itemState.active,
      GSIPK_clientId_purposeId: makeGSIPKClientIdPurposeId({
        clientId,
        purposeId,
      }),
    };
  } else {
    return {
      PK: tokenGenStatesEntryPK,
      updatedAt: new Date().toISOString(),
      consumerId,
      clientKind: clientKindTokenGenStates.consumer,
      publicKey: "PEM",
      GSIPK_clientId: clientId,
      GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
    };
  }
};

export const getMockPlatformStatesAgreementEntry = (
  primaryKey: PlatformStatesAgreementPK,
  agreementId: AgreementId
): PlatformStatesAgreementEntry => ({
  PK: primaryKey,
  state: itemState.inactive,
  version: 1,
  updatedAt: new Date().toISOString(),
  agreementId,
  agreementTimestamp: new Date().toISOString(),
  agreementDescriptorId: generateId<DescriptorId>(),
});

export const getMockTokenGenStatesApiClient = (
  tokenGenStatesEntryPK?: TokenGenerationStatesClientKidPK
): TokenGenerationStatesApiClient => {
  const clientId = tokenGenStatesEntryPK
    ? unsafeBrandId<ClientId>(tokenGenStatesEntryPK.split("#")[1])
    : generateId<ClientId>();

  const consumerId = generateId<TenantId>();
  const kid = `kid ${Math.random()}`;

  return {
    PK:
      tokenGenStatesEntryPK ||
      makeTokenGenerationStatesClientKidPK({
        clientId,
        kid,
      }),
    updatedAt: new Date().toISOString(),
    consumerId,
    clientKind: clientKindTokenGenStates.api,
    publicKey: "PEM",
    GSIPK_clientId: clientId,
    GSIPK_clientId_kid: makeGSIPKClientIdKid({ clientId, kid }),
  };
};

export const getMockPlatformStatesClientEntry = (
  pk?: PlatformStatesClientPK
): PlatformStatesClientEntry => ({
  PK: pk || makePlatformStatesClientPK(generateId<ClientId>()),
  version: 0,
  state: "ACTIVE",
  updatedAt: new Date().toISOString(),
  clientKind: "CONSUMER",
  clientConsumerId: generateId<TenantId>(),
  clientPurposesIds: [],
});

export const getMockClientAssertion = async (props?: {
  standardClaimsOverride?: Partial<jose.JWTPayload>;
  customClaims?: { [k: string]: unknown };
  customHeader?: { [k: string]: unknown };
}): Promise<{
  jws: string;
  clientAssertion: {
    payload: jose.JWTPayload;
    header: jose.JWTHeaderParameters;
  };
  publicKeyEncodedPem: string;
}> => {
  const { keySet, publicKeyEncodedPem } = generateKeySet();

  const threeHourLater = new Date();
  threeHourLater.setHours(threeHourLater.getHours() + 3);

  const clientId = generateId<ClientId>();
  const defaultPayload: jose.JWTPayload = {
    iss: clientId,
    sub: clientId,
    aud: ["test.interop.pagopa.it", "dev.interop.pagopa.it"],
    exp: dateToSeconds(threeHourLater),
    jti: generateId(),
    iat: dateToSeconds(new Date()),
  };

  const actualPayload: jose.JWTPayload = {
    ...defaultPayload,
    ...props?.standardClaimsOverride,
    ...props?.customClaims,
  };

  const headers: jose.JWTHeaderParameters = {
    alg: "RS256",
    kid: "kid",
    ...props?.customHeader,
  };

  const jws = await signClientAssertion({
    payload: actualPayload,
    headers,
    keySet,
  });

  return {
    jws,
    clientAssertion: {
      payload: actualPayload,
      header: headers,
    },
    publicKeyEncodedPem,
  };
};

export const generateKeySet = (): {
  keySet: crypto.KeyPairKeyObjectResult;
  publicKeyEncodedPem: string;
} => {
  const keySet: crypto.KeyPairKeyObjectResult = crypto.generateKeyPairSync(
    "rsa",
    {
      modulusLength: 2048,
    }
  );

  const pemPublicKey = keySet.publicKey
    .export({
      type: "spki",
      format: "pem",
    })
    .toString();

  const publicKeyEncodedPem = Buffer.from(pemPublicKey).toString("base64");
  return {
    keySet,
    publicKeyEncodedPem,
  };
};

const signClientAssertion = async ({
  payload,
  headers,
  keySet,
}: {
  payload: jose.JWTPayload;
  headers: jose.JWTHeaderParameters;
  keySet: crypto.KeyPairKeyObjectResult;
}): Promise<string> => {
  const pemPrivateKey = keySet.privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  const privateKey = crypto.createPrivateKey(pemPrivateKey);
  return await new jose.SignJWT(payload)
    .setProtectedHeader(headers)
    .sign(privateKey);
};

export const addSomeRandomDelegations = async <
  T extends { eserviceId: EServiceId }
>(
  domainObject: T,
  addOneDelegation: (delegation: Delegation) => Promise<void>
): Promise<void> => {
  const states = [delegationState.rejected, delegationState.revoked];
  const kinds = [
    delegationKind.delegatedProducer,
    delegationKind.delegatedConsumer,
  ];

  for (const state of states) {
    for (const kind of kinds) {
      await addOneDelegation(
        getMockDelegation({
          eserviceId: domainObject.eserviceId,
          kind,
          state,
        })
      );
    }
  }
};
