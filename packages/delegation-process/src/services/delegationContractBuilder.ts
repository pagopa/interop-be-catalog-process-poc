import { fileURLToPath } from "url";
import path from "path";
import {
  dateAtRomeZone,
  FileManager,
  formatDateyyyyMMddHHmmss,
  Logger,
  PDFGenerator,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  Delegation,
  DelegationContractDocument,
  DelegationContractId,
  EService,
  generateId,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
} from "pagopa-interop-models";
import { DelegationProcessConfig } from "../config/config.js";
import {
  DelegationActivationPDFPayload,
  DelegationRevocationPDFPayload,
} from "../model/domain/models.js";
import { assertStampExists } from "./validators.js";

const CONTENT_TYPE_PDF = "application/pdf";

const createDelegationContractPrettyName = (
  eServiceName: string,
  documentType: "activation" | "revocation" // turn these into const in models
): string => {
  const prettyName = `${
    documentType === "activation" ? "Delega" : "Revoca_Delega" // turn these into const in models
  }_${eServiceName}`;
  return prettyName.length > 45 ? prettyName.slice(0, 45) : prettyName;
};

const getIpaCode = (tenant: Tenant): string | undefined =>
  tenant.externalId.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER
    ? tenant.externalId.value
    : undefined;

const createDelegationDocumentName = (
  documentCreatedAt: Date,
  documentType: "activation" | "revocation" // same as above
): string =>
  `${formatDateyyyyMMddHHmmss(
    documentCreatedAt
  )}_delegation_${documentType}_contract.pdf`;

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = {
  createActivationContract: async ({
    delegation,
    delegator,
    delegate,
    eservice,
    pdfGenerator,
    fileManager,
    config,
    logger,
  }: {
    delegation: Delegation;
    delegator: Tenant;
    delegate: Tenant;
    eservice: EService;
    pdfGenerator: PDFGenerator;
    fileManager: FileManager;
    config: DelegationProcessConfig;
    logger: Logger;
  }): Promise<DelegationContractDocument> => {
    const templateFilePath = path.resolve(
      dirname,
      "..",
      "resources/templates",
      "delegationApprovedTemplate.html"
    );
    const documentCreatedAt = new Date();
    const todayDate = dateAtRomeZone(documentCreatedAt);
    const todayTime = timeAtRomeZone(documentCreatedAt);

    const documentId = generateId<DelegationContractId>();
    const documentName = createDelegationDocumentName(
      documentCreatedAt,
      "activation" // use the new model
    );

    assertStampExists(delegation.stamps, "activation"); // use the new model

    const submissionDate = dateAtRomeZone(delegation.stamps.submission.when);
    const submissionTime = timeAtRomeZone(delegation.stamps.submission.when);
    const activationDate = dateAtRomeZone(delegation.stamps.activation.when);
    const activationTime = timeAtRomeZone(delegation.stamps.activation.when);
    const activationContractPayload: DelegationActivationPDFPayload = {
      todayDate,
      todayTime,
      delegationId: delegation.id,
      delegatorName: delegator.name,
      delegatorIpaCode: getIpaCode(delegator),
      delegateName: delegate.name,
      delegateIpaCode: getIpaCode(delegate),
      eserviceId: eservice.id,
      eserviceName: eservice.name,
      submitterId: delegation.stamps.submission.who,
      submissionDate,
      submissionTime,
      activatorId: delegation.stamps.activation.who,
      activationDate,
      activationTime,
    };
    const pdfBuffer = await pdfGenerator.generate(
      templateFilePath,
      activationContractPayload
    );

    const documentPath = await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: `${config.delegationDocumentPath}/${delegation.id}`,
        resourceId: documentId,
        name: documentName,
        content: pdfBuffer,
      },
      logger
    );

    return {
      id: documentId,
      name: documentName,
      prettyName: createDelegationContractPrettyName(
        eservice.name,
        "activation" // use the new model
      ),
      contentType: CONTENT_TYPE_PDF,
      path: documentPath,
      createdAt: documentCreatedAt,
    };
  },
  createRevocationContract: async ({
    delegation,
    delegator,
    delegate,
    eservice,
    pdfGenerator,
    fileManager,
    config,
    logger,
  }: {
    delegation: Delegation;
    delegator: Tenant;
    delegate: Tenant;
    eservice: EService;
    pdfGenerator: PDFGenerator;
    fileManager: FileManager;
    config: DelegationProcessConfig;
    logger: Logger;
  }): Promise<DelegationContractDocument> => {
    const templateFilePath = path.resolve(
      dirname,
      "..",
      "resources/templates",
      "delegationRevokedTemplate.html"
    );
    const documentCreatedAt = new Date();
    const todayDate = dateAtRomeZone(documentCreatedAt);
    const todayTime = timeAtRomeZone(documentCreatedAt);

    const documentId = generateId<DelegationContractId>();
    const documentName = createDelegationDocumentName(
      documentCreatedAt,
      "revocation" // use the new model
    );

    assertStampExists(delegation.stamps, "revocation"); // use the new model
    const revocationDate = dateAtRomeZone(delegation.stamps.revocation.when);
    const revocationTime = timeAtRomeZone(delegation.stamps.revocation.when);

    const revocationContractPayload: DelegationRevocationPDFPayload = {
      todayDate,
      todayTime,
      delegationId: delegation.id,
      delegatorName: delegator.name,
      delegatorIpaCode: getIpaCode(delegator),
      delegateName: delegate.name,
      delegateIpaCode: getIpaCode(delegate),
      eserviceId: eservice.id,
      eserviceName: eservice.name,
      submitterId: delegation.stamps.submission.who,
      revokerId: delegation.stamps.revocation.who,
      revocationDate,
      revocationTime,
    };
    const pdfBuffer = await pdfGenerator.generate(
      templateFilePath,
      revocationContractPayload
    );

    const documentPath = await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: `${config.delegationDocumentPath}/${delegation.id}`,
        resourceId: documentId,
        name: documentName,
        content: pdfBuffer,
      },
      logger
    );

    return {
      id: documentId,
      name: documentName,
      prettyName: createDelegationContractPrettyName(
        eservice.name,
        "revocation" // use the new model
      ),
      contentType: CONTENT_TYPE_PDF,
      path: documentPath,
      createdAt: documentCreatedAt,
    };
  },
};
