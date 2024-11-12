/* eslint-disable max-params */
import path from "path";
import { fileURLToPath } from "url";
import {
  FileManager,
  Logger,
  PDFGenerator,
  dateAtRomeZone,
  formatDateyyyyMMddHHmmss,
  timeAtRomeZone,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementContractPDFPayload,
  AgreementDocumentId,
  Attribute,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  EService,
  SelfcareId,
  Tenant,
  TenantAttributeType,
  TenantId,
  VerifiedTenantAttribute,
  UserId,
  generateId,
  tenantAttributeType,
  unsafeBrandId,
  AgreementDocument,
  CorrelationId,
  Delegation,
} from "pagopa-interop-models";
import {
  selfcareV2ClientApi,
  SelfcareV2UsersClient,
} from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import { isAxiosError } from "axios";
import {
  agreementMissingUserInfo,
  agreementSelfcareIdNotFound,
  agreementStampNotFound,
  attributeNotFound,
  tenantNotFound,
  userNotFound,
} from "../model/domain/errors.js";
import { AgreementProcessConfig } from "../config/config.js";
import { ReadModelService } from "./readModelService.js";

const CONTENT_TYPE_PDF = "application/pdf";
const AGREEMENT_CONTRACT_PRETTY_NAME = "Richiesta di fruizione";

export type DelegationData = {
  delegation: Delegation;
  delegator: Tenant;
  delegate: Tenant;
};

const retrieveUser = async (
  selfcareV2Client: SelfcareV2UsersClient,
  selfcareId: SelfcareId,
  id: UserId,
  correlationId: CorrelationId
): Promise<selfcareV2ClientApi.UserResponse> => {
  const user = await selfcareV2Client.getUserInfoUsingGET({
    queries: { institutionId: selfcareId },
    params: { id },
    headers: {
      "X-Correlation-Id": correlationId,
    },
  });

  if (!user) {
    throw userNotFound(selfcareId, id);
  }
  return user;
};

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

const createAgreementDocumentName = (
  consumerId: TenantId,
  producerId: TenantId,
  documentCreatedAt: Date
): string =>
  `${consumerId}_${producerId}_${formatDateyyyyMMddHHmmss(
    documentCreatedAt
  )}_agreement_contract.pdf`;

const getAttributesData = async (
  consumer: Tenant,
  agreement: Agreement,
  readModelService: ReadModelService
): Promise<{
  certified: Array<{
    attribute: Attribute;
    tenantAttribute: CertifiedTenantAttribute;
  }>;
  declared: Array<{
    attribute: Attribute;
    tenantAttribute: DeclaredTenantAttribute;
  }>;
  verified: Array<{
    attribute: Attribute;
    tenantAttribute: VerifiedTenantAttribute;
  }>;
}> => {
  const getAttributesDataByType = async <
    T extends
      | CertifiedTenantAttribute
      | DeclaredTenantAttribute
      | VerifiedTenantAttribute
  >(
    type: TenantAttributeType
  ): Promise<
    Array<{
      attribute: Attribute;
      tenantAttribute: T;
    }>
  > => {
    const seedAttributes = match(type)
      .with(
        tenantAttributeType.CERTIFIED,
        () => agreement.certifiedAttributes || []
      )
      .with(
        tenantAttributeType.DECLARED,
        () => agreement.declaredAttributes || []
      )
      .with(
        tenantAttributeType.VERIFIED,
        () => agreement.verifiedAttributes || []
      )
      .exhaustive()
      .map((attribute) => attribute.id);

    const tenantAttributes = consumer.attributes.filter(
      (a) => a.type === type && seedAttributes.includes(a.id)
    );

    return Promise.all(
      tenantAttributes.map(async (tenantAttribute) => {
        const attribute = await readModelService.getAttributeById(
          tenantAttribute.id
        );
        if (!attribute) {
          throw attributeNotFound(tenantAttribute.id);
        }
        return {
          attribute,
          tenantAttribute: tenantAttribute as T,
        };
      })
    );
  };

  const certified = await getAttributesDataByType<CertifiedTenantAttribute>(
    tenantAttributeType.CERTIFIED
  );
  const declared = await getAttributesDataByType<DeclaredTenantAttribute>(
    tenantAttributeType.DECLARED
  );
  const verified = await getAttributesDataByType<VerifiedTenantAttribute>(
    tenantAttributeType.VERIFIED
  );

  return {
    certified,
    declared,
    verified,
  };
};

const getSubmissionInfo = async (
  selfcareV2Client: SelfcareV2UsersClient,
  consumer: Tenant,
  agreement: Agreement,
  correlationId: CorrelationId
): Promise<[string, Date]> => {
  const submission = agreement.stamps.submission;
  if (!submission) {
    throw agreementStampNotFound("submission");
  }

  if (!consumer.selfcareId) {
    throw agreementSelfcareIdNotFound(consumer.id);
  }

  const consumerSelfcareId: SelfcareId = unsafeBrandId(consumer.selfcareId);

  const consumerUser: selfcareV2ClientApi.UserResponse = await retrieveUser(
    selfcareV2Client,
    consumerSelfcareId,
    submission.who,
    correlationId
  );
  if (consumerUser.name && consumerUser.surname && consumerUser.taxCode) {
    return [
      `${consumerUser.name} ${consumerUser.surname} (${consumerUser.taxCode})`,
      submission.when,
    ];
  }

  throw agreementMissingUserInfo(submission.who);
};

const getActivationInfo = async (
  selfcareV2Client: SelfcareV2UsersClient,
  producer: Tenant,
  consumer: Tenant,
  agreement: Agreement,
  correlationId: CorrelationId
): Promise<[string, Date]> => {
  const activation = agreement.stamps.activation;
  if (!activation) {
    throw agreementStampNotFound("activation");
  }

  if (!producer.selfcareId) {
    throw agreementSelfcareIdNotFound(producer.id);
  }
  if (!consumer.selfcareId) {
    throw agreementSelfcareIdNotFound(consumer.id);
  }

  const producerSelfcareId: SelfcareId = unsafeBrandId(producer.selfcareId);
  const consumerSelfcareId: SelfcareId = unsafeBrandId(consumer.selfcareId);

  /**
   * The user that activated the agreement, the one in the activation.who stamp, could both belong to the producer institution or the consumer institution.
   * In case the user is not found with the producer institutionId, we try to retrieve it from the consumer selfcare.
   */

  // eslint-disable-next-line functional/no-let, @typescript-eslint/no-non-null-assertion
  let user: selfcareV2ClientApi.UserResponse = undefined!;

  try {
    user = await retrieveUser(
      selfcareV2Client,
      producerSelfcareId,
      activation.who,
      correlationId
    );
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 404) {
      user = await retrieveUser(
        selfcareV2Client,
        consumerSelfcareId,
        activation.who,
        correlationId
      );
    } else {
      throw e;
    }
  }

  if (user.name && user.surname && user.taxCode) {
    return [`${user.name} ${user.surname} (${user.taxCode})`, activation.when];
  }

  throw agreementMissingUserInfo(activation.who);
};

const getPdfPayload = async (
  agreement: Agreement,
  eservice: EService,
  consumer: Tenant,
  producer: Tenant,
  readModelService: ReadModelService,
  selfcareV2Client: SelfcareV2UsersClient,
  correlationId: CorrelationId,
  delegationData: DelegationData | undefined
): Promise<AgreementContractPDFPayload> => {
  const getTenantText = (name: string, origin: string, value: string): string =>
    origin === "IPA" ? `${name} (codice IPA: ${value})` : name;

  const today = new Date();
  const producerText = getTenantText(
    producer.name,
    producer.externalId.origin,
    producer.externalId.value
  );

  const consumerText = getTenantText(
    consumer.name,
    consumer.externalId.origin,
    consumer.externalId.value
  );
  const [submitter, submissionTimestamp] = await getSubmissionInfo(
    selfcareV2Client,
    consumer,
    agreement,
    correlationId
  );
  const [activator, activationTimestamp] = await getActivationInfo(
    selfcareV2Client,
    producer,
    consumer,
    agreement,
    correlationId
  );

  const { certified, declared, verified } = await getAttributesData(
    consumer,
    agreement,
    readModelService
  );

  // Nel template c'è un riferimento alla version del descriptor,
  // è necessario recuperare l'ultima versione attiva del descriptor?
  // in caso affermativo va sempre cercato in stato publish?
  // ma i controlli per l'activate agreement supporta diversi stati
  // const latestActiveDescriptor = getActiveDescriptor(eservice);
  return {
    todayDate: dateAtRomeZone(today),
    todayTime: timeAtRomeZone(today),
    agreementId: agreement.id,
    submitter,
    submissionDate: dateAtRomeZone(submissionTimestamp),
    submissionTime: timeAtRomeZone(submissionTimestamp),
    activator,
    activationDate: dateAtRomeZone(activationTimestamp),
    activationTime: timeAtRomeZone(activationTimestamp),
    eServiceName: eservice.name,
    eServiceId: eservice.id,
    producerText,
    consumerText,
    certifiedAttributes: certified.map(({ attribute, tenantAttribute }) => ({
      assignmentDate: dateAtRomeZone(tenantAttribute.assignmentTimestamp),
      assignmentTime: timeAtRomeZone(tenantAttribute.assignmentTimestamp),
      attributeName: attribute.name,
      attributeId: attribute.id,
    })),
    // eslint-disable-next-line sonarjs/no-identical-functions
    declaredAttributes: declared.map(({ attribute, tenantAttribute }) => ({
      assignmentDate: dateAtRomeZone(tenantAttribute.assignmentTimestamp),
      assignmentTime: timeAtRomeZone(tenantAttribute.assignmentTimestamp),
      attributeName: attribute.name,
      attributeId: attribute.id,
    })),
    verifiedAttributes: verified.map(({ attribute, tenantAttribute }) => {
      const expirationDate = getVerifiedAttributeExpirationDate(
        tenantAttribute,
        producer.id
      );
      return {
        assignmentDate: dateAtRomeZone(tenantAttribute.assignmentTimestamp),
        assignmentTime: timeAtRomeZone(tenantAttribute.assignmentTimestamp),
        attributeName: attribute.name,
        attributeId: attribute.id,
        expirationDate: expirationDate
          ? dateAtRomeZone(expirationDate)
          : undefined,
      };
    }),
    delegationId: delegationData?.delegation.id,
    delegatorText:
      delegationData?.delegator &&
      getTenantText(
        delegationData?.delegator.name,
        delegationData?.delegator.externalId.origin,
        delegationData?.delegator.externalId.value
      ),
    delegateText:
      delegationData?.delegate &&
      getTenantText(
        delegationData?.delegate.name,
        delegationData?.delegate.externalId.origin,
        delegationData?.delegate.externalId.value
      ),
  };
};

function getVerifiedAttributeExpirationDate(
  tenantAttribute: VerifiedTenantAttribute,
  producerId: TenantId
): Date | undefined {
  const activeProducerVerification = tenantAttribute.verifiedBy
    .filter((verification) => verification.id === producerId)
    .sort((a, b) => a.verificationDate.getTime() - b.verificationDate.getTime())
    .find(
      (verification) =>
        !tenantAttribute.revokedBy.find(
          (revocation) => revocation.id === verification.id
        )
    );

  return (
    activeProducerVerification?.extensionDate ??
    activeProducerVerification?.expirationDate
  );
}

const buildDelegationData = async (
  delegation: Delegation,
  readModelService: ReadModelService
): Promise<DelegationData> => {
  const delegator = await retrieveTenant(
    delegation.delegatorId,
    readModelService
  );
  const delegate = await retrieveTenant(
    delegation.delegateId,
    readModelService
  );

  return {
    delegation,
    delegator,
    delegate,
  };
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const contractBuilder = (
  readModelService: ReadModelService,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  selfcareV2Client: SelfcareV2UsersClient,
  config: AgreementProcessConfig,
  logger: Logger,
  correlationId: CorrelationId
) => {
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);
  const templateFilePath = path.resolve(
    dirname,
    "..",
    "resources/templates/documents",
    "agreementContractTemplate.html"
  );

  return {
    createContract: async (
      agreement: Agreement,
      eservice: EService,
      consumer: Tenant,
      producer: Tenant,
      delegation: Delegation | undefined
    ): Promise<AgreementDocument> => {
      const delegationdData =
        delegation && (await buildDelegationData(delegation, readModelService));

      const pdfPayload = await getPdfPayload(
        agreement,
        eservice,
        consumer,
        producer,
        readModelService,
        selfcareV2Client,
        correlationId,
        delegationdData
      );

      const pdfBuffer: Buffer = await pdfGenerator.generate(
        templateFilePath,
        pdfPayload
      );

      const documentId = generateId<AgreementDocumentId>();
      const documentCreatedAt = new Date();
      const documentName = createAgreementDocumentName(
        agreement.consumerId,
        agreement.producerId,
        documentCreatedAt
      );

      const documentPath = await fileManager.storeBytes(
        {
          bucket: config.s3Bucket,
          path: `${config.agreementContractsPath}/${agreement.id}`,
          resourceId: documentId,
          name: documentName,
          content: pdfBuffer,
        },
        logger
      );

      return {
        id: documentId,
        name: documentName,
        contentType: CONTENT_TYPE_PDF,
        prettyName: AGREEMENT_CONTRACT_PRETTY_NAME,
        path: documentPath,
        createdAt: documentCreatedAt,
      };
    },
  };
};

export type ContractBuilder = ReturnType<typeof contractBuilder>;
