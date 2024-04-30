/* eslint-disable max-params */
import {
  AuthData,
  CreateEvent,
  Logger,
  WithLogger,
  ZodiosCtx,
} from "pagopa-interop-commons";
import {
  AgreementDocumentId,
  AgreementEvent,
  AgreementId,
} from "pagopa-interop-models";
import { ApiAgreementDocumentSeed } from "../model/types.js";
import {
  agreementDocumentAlreadyExists,
  agreementDocumentNotFound,
} from "../model/domain/errors.js";
import {
  toCreateEventAgreementConsumerDocumentAdded,
  toCreateEventAgreementConsumerDocumentRemoved,
} from "../model/domain/toEvent.js";
import { apiAgreementDocumentToAgreementDocument } from "../model/domain/apiConverter.js";
import {
  assertAgreementExist,
  assertCanWorkOnConsumerDocuments,
  assertRequesterIsConsumer,
} from "../model/domain/validators.js";
import { config } from "../utilities/config.js";
import { AgreementQuery } from "./readmodel/agreementQuery.js";

export async function addConsumerDocumentLogic(
  agreementId: AgreementId,
  payload: ApiAgreementDocumentSeed,
  agreementQuery: AgreementQuery,
  { authData, correlationId, logger }: WithLogger<ZodiosCtx>
): Promise<CreateEvent<AgreementEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId, logger);

  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);
  assertCanWorkOnConsumerDocuments(agreement.data.state);

  const existentDocument = agreement.data.consumerDocuments.find(
    (d) => d.id === payload.id
  );

  if (existentDocument) {
    throw agreementDocumentAlreadyExists(agreementId);
  }

  return toCreateEventAgreementConsumerDocumentAdded(
    agreementId,
    apiAgreementDocumentToAgreementDocument(payload),
    agreement.metadata.version,
    correlationId
  );
}

// eslint-disable-next-line max-params
export async function removeAgreementConsumerDocumentLogic(
  agreementId: AgreementId,
  documentId: AgreementDocumentId,
  agreementQuery: AgreementQuery,
  authData: AuthData,
  fileRemove: (bucket: string, path: string, logger: Logger) => Promise<void>,
  correlationId: string,
  logger: Logger
): Promise<CreateEvent<AgreementEvent>> {
  const agreement = await agreementQuery.getAgreementById(agreementId, logger);

  assertAgreementExist(agreementId, agreement);
  assertRequesterIsConsumer(agreement.data, authData);
  assertCanWorkOnConsumerDocuments(agreement.data.state);

  const existentDocument = agreement.data.consumerDocuments.find(
    (d) => d.id === documentId
  );

  if (!existentDocument) {
    throw agreementDocumentNotFound(documentId, agreementId);
  }

  await fileRemove(config.s3Bucket, existentDocument.path, logger);

  return toCreateEventAgreementConsumerDocumentRemoved(
    agreementId,
    documentId,
    agreement.metadata.version,
    correlationId
  );
}
