import {
  EServiceV2,
  EServiceId,
  Descriptor,
  missingKafkaMessageDataError,
  EService,
  fromEServiceV2,
  AgreementV2,
  Agreement,
  fromAgreementV2,
  agreementState,
  PurposeV2,
  Purpose,
  fromPurposeV2,
  PurposeId,
  PurposeVersion,
  ClientV2,
  Client,
  fromClientV2,
  KeyUse,
  keyUse,
  ClientKind,
  clientKind,
  DescriptorState,
  descriptorState,
  PurposeVersionState,
  purposeVersionState,
  AgreementState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
  ApiClientComponentState,
  ApiClientComponent,
  ApiKeyUse,
  ApiClientKind,
} from "./model/models.js";

export const getDescriptorFromEvent = (
  msg: {
    data: {
      descriptorId: string;
      eservice?: EServiceV2;
    };
  },
  eventType: string
): {
  eserviceId: EServiceId;
  descriptor: Descriptor;
} => {
  if (!msg.data.eservice) {
    throw missingKafkaMessageDataError("eservice", eventType);
  }

  const eservice: EService = fromEServiceV2(msg.data.eservice);
  const descriptor = eservice.descriptors.find(
    (d) => d.id === msg.data.descriptorId
  );

  if (!descriptor) {
    throw missingKafkaMessageDataError("descriptor", eventType);
  }

  return { eserviceId: eservice.id, descriptor };
};

export const getAgreementFromEvent = (
  msg: {
    data: {
      agreement?: AgreementV2;
    };
  },
  eventType: string
): Agreement => {
  if (!msg.data.agreement) {
    throw missingKafkaMessageDataError("agreement", eventType);
  }

  return fromAgreementV2(msg.data.agreement);
};

export const agreementStateToClientState = (
  state: AgreementState
): ApiClientComponentState =>
  match(state)
    .with(agreementState.active, () => ApiClientComponent.Values.ACTIVE)
    .otherwise(() => ApiClientComponent.Values.INACTIVE);

export const getPurposeFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
    };
  },
  eventType: string
): Purpose => {
  if (!msg.data.purpose) {
    throw missingKafkaMessageDataError("purpose", eventType);
  }

  return fromPurposeV2(msg.data.purpose);
};

export const getPurposeVersionFromEvent = (
  msg: {
    data: {
      purpose?: PurposeV2;
      versionId: string;
    };
  },
  eventType: string
): { purposeId: PurposeId; purposeVersion: PurposeVersion } => {
  const purpose = getPurposeFromEvent(msg, eventType);
  const purposeVersion = purpose.versions.find(
    (v) => v.id === msg.data.versionId
  );

  if (!purposeVersion) {
    throw missingKafkaMessageDataError("purposeVersion", eventType);
  }

  return { purposeId: purpose.id, purposeVersion };
};

export const getClientFromEvent = (
  msg: {
    data: {
      client?: ClientV2;
    };
  },
  eventType: string
): Client => {
  if (!msg.data.client) {
    throw missingKafkaMessageDataError("client", eventType);
  }

  return fromClientV2(msg.data.client);
};

export const clientKindToApiClientKind = (kid: ClientKind): ApiClientKind =>
  match<ClientKind, ApiClientKind>(kid)
    .with(clientKind.consumer, () => "CONSUMER")
    .with(clientKind.api, () => "API")
    .exhaustive();

export const keyUseToApiKeyUse = (kid: KeyUse): ApiKeyUse =>
  match<KeyUse, ApiKeyUse>(kid)
    .with(keyUse.enc, () => "ENC")
    .with(keyUse.sig, () => "SIG")
    .exhaustive();

export const descriptorStateToClientState = (
  state: DescriptorState
): ApiClientComponentState =>
  state === descriptorState.published || state === descriptorState.deprecated
    ? ApiClientComponent.Values.ACTIVE
    : ApiClientComponent.Values.INACTIVE;

export const purposeStateToClientState = (
  state: PurposeVersionState
): ApiClientComponentState =>
  state === purposeVersionState.active
    ? ApiClientComponent.Values.ACTIVE
    : ApiClientComponent.Values.INACTIVE;
