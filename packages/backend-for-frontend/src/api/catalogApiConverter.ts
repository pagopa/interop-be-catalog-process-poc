/* eslint-disable functional/immutable-data */
/* eslint-disable max-params */
import {
  agreementApi,
  attributeRegistryApi,
  bffApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import {
  Descriptor,
  EServiceAttribute,
  unsafeBrandId,
} from "pagopa-interop-models";
import { attributeNotExists } from "../model/errors.js";
import {
  getLatestActiveDescriptor,
  getLatestTenantContactEmail,
  getValidDescriptor,
} from "../model/modelMappingUtils.js";
import { ConfigurationRiskAnalysis } from "../model/types.js";
import {
  hasCertifiedAttributes,
  isAgreementSubscribed,
  isAgreementUpgradable,
  isInvalidDescriptor,
  isRequesterEserviceProducer,
  isValidDescriptor,
} from "../services/validators.js";
import { toBffCompactAgreement } from "./agreementApiConverter.js";

export function toEserviceCatalogProcessQueryParams(
  queryParams: bffApi.BffGetCatalogQueryParam
): catalogApi.GetEServicesQueryParams {
  return {
    ...queryParams,
    eservicesIds: [],
    name: queryParams.q,
  };
}

export function toBffCatalogApiEService(
  eservice: catalogApi.EService,
  producerTenant: tenantApi.Tenant,
  isRequesterEqProducer: boolean,
  activeDescriptor?: catalogApi.EServiceDescriptor,
  agreement?: agreementApi.Agreement
): bffApi.CatalogEService {
  const partialEnhancedEservice = {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    producer: {
      id: eservice.producerId,
      name: producerTenant.name,
    },
    isMine: isRequesterEqProducer,
  };

  return {
    ...partialEnhancedEservice,
    ...(activeDescriptor
      ? {
          activeDescriptor: {
            id: activeDescriptor.id,
            version: activeDescriptor.version,
            audience: activeDescriptor.audience,
            state: activeDescriptor.state,
          },
        }
      : {}),
    ...(agreement
      ? {
          agreement: {
            id: agreement.id,
            state: agreement.state,
            canBeUpgraded: isAgreementUpgradable(eservice, agreement),
          },
        }
      : {}),
  };
}

export function toBffCatalogDescriptorEService(
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor,
  producerTenant: tenantApi.Tenant,
  agreement: agreementApi.Agreement | undefined,
  requesterTenant: tenantApi.Tenant,
  consumerDelegators: tenantApi.Tenant[]
): bffApi.CatalogDescriptorEService {
  const activeDescriptor = getLatestActiveDescriptor(eservice);
  return {
    id: eservice.id,
    name: eservice.name,
    producer: {
      id: producerTenant.id,
      name: producerTenant.name,
      kind: producerTenant.kind,
    },
    description: eservice.description,
    technology: eservice.technology,
    descriptors: getValidDescriptor(eservice).map(toCompactDescriptor),
    agreement: agreement && toBffCompactAgreement(agreement, eservice),
    isMine: isRequesterEserviceProducer(requesterTenant.id, eservice),
    hasCertifiedAttributes: [requesterTenant, ...consumerDelegators].some(
      (t) => hasCertifiedAttributes(descriptor, t)
      /* True in case:
      - the requester has the certified attributes required to consume the eservice, or
      - the requester is the delegated consumer for the eservice and
        the delegator has the certified attributes required to consume the eservice */
    ),
    isSubscribed: isAgreementSubscribed(agreement),
    activeDescriptor: activeDescriptor
      ? toCompactDescriptor(activeDescriptor)
      : undefined,
    mail: getLatestTenantContactEmail(producerTenant),
    mode: eservice.mode,
    riskAnalysis: eservice.riskAnalysis.map(
      toBffCatalogApiEserviceRiskAnalysis
    ),
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isDelegable: eservice.isDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
  };
}

export function toBffCatalogApiDescriptorAttribute(
  attributes: attributeRegistryApi.Attribute[],
  attribute: catalogApi.Attribute
): bffApi.DescriptorAttribute {
  const foundAttribute = attributes.find((att) => att.id === attribute.id);
  if (!foundAttribute) {
    throw attributeNotExists(unsafeBrandId(attribute.id));
  }

  return {
    id: attribute.id,
    name: foundAttribute.name,
    description: foundAttribute.description,
    explicitAttributeVerification: attribute.explicitAttributeVerification,
  };
}

export function toBffCatalogApiDescriptorDoc(
  document: catalogApi.EServiceDoc
): bffApi.EServiceDoc {
  return {
    id: document.id,
    name: document.name,
    contentType: document.contentType,
    prettyName: document.prettyName,
  };
}

export function toBffCatalogApiEserviceRiskAnalysis(
  riskAnalysis: catalogApi.EServiceRiskAnalysis
): bffApi.EServiceRiskAnalysis {
  const answers: bffApi.RiskAnalysisForm["answers"] =
    riskAnalysis.riskAnalysisForm.singleAnswers
      .concat(
        riskAnalysis.riskAnalysisForm.multiAnswers.flatMap((multiAnswer) =>
          multiAnswer.values.map((answerValue) => ({
            id: multiAnswer.id,
            value: answerValue,
            key: multiAnswer.key,
          }))
        )
      )
      .reduce((answers: bffApi.RiskAnalysisForm["answers"], answer) => {
        const key = answer.key;
        if (!answers[key]) {
          answers[key] = [];
        }

        if (answer.value) {
          answers[key] = [...answers[key], answer.value];
        } else {
          answers[key] = [];
        }

        return answers;
      }, {});

  const riskAnalysisForm: bffApi.RiskAnalysisForm = {
    riskAnalysisId: riskAnalysis.id,
    version: riskAnalysis.riskAnalysisForm.version,
    answers,
  };

  return {
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt,
    riskAnalysisForm,
  };
}

export function toBffCatalogApiEserviceRiskAnalysisSeed(
  riskAnalysis: ConfigurationRiskAnalysis
): bffApi.EServiceRiskAnalysisSeed {
  const answers: bffApi.RiskAnalysisForm["answers"] =
    riskAnalysis.riskAnalysisForm.singleAnswers
      .concat(
        riskAnalysis.riskAnalysisForm.multiAnswers.flatMap((multiAnswer) =>
          multiAnswer.values.map((answerValue) => ({
            value: answerValue,
            key: multiAnswer.key,
          }))
        )
      )
      // eslint-disable-next-line sonarjs/no-identical-functions
      .reduce((answers: bffApi.RiskAnalysisForm["answers"], answer) => {
        const key = answer.key;
        if (!answers[key]) {
          answers[key] = [];
        }

        if (answer.value) {
          answers[key] = [...answers[key], answer.value];
        } else {
          answers[key] = [];
        }

        return answers;
      }, {});

  const riskAnalysisForm: bffApi.RiskAnalysisForm = {
    version: riskAnalysis.riskAnalysisForm.version,
    answers,
  };

  return {
    name: riskAnalysis.name,
    riskAnalysisForm,
  };
}

export function toBffCatalogApiProducerDescriptorEService(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.ProducerDescriptorEService {
  const producerMail = getLatestTenantContactEmail(producer);

  const notDraftDecriptors = eservice.descriptors
    .filter(isValidDescriptor)
    .map(toCompactDescriptor);

  const draftDescriptor = eservice.descriptors.find(isInvalidDescriptor);

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    producer: {
      id: producer.id,
      tenantKind: producer.kind,
    },
    mode: eservice.mode,
    mail: producerMail && {
      address: producerMail.address,
      description: producerMail.description,
    },
    draftDescriptor: draftDescriptor
      ? toCompactDescriptor(draftDescriptor)
      : undefined,
    riskAnalysis: eservice.riskAnalysis.map(
      toBffCatalogApiEserviceRiskAnalysis
    ),
    descriptors: notDraftDecriptors,
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isDelegable: eservice.isDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
  };
}

export function toEserviceAttribute(
  attributes: catalogApi.Attribute[]
): EServiceAttribute[] {
  return attributes.map((attribute) => ({
    ...attribute,
    id: unsafeBrandId(attribute.id),
  }));
}

export function descriptorAttributesFromApi(
  catalogApiDescriptorAttributes: catalogApi.EServiceDescriptor["attributes"]
): Descriptor["attributes"] {
  return {
    certified:
      catalogApiDescriptorAttributes.certified.map(toEserviceAttribute),
    declared: catalogApiDescriptorAttributes.declared.map(toEserviceAttribute),
    verified: catalogApiDescriptorAttributes.verified.map(toEserviceAttribute),
  };
}

function toBffCatalogApiDescriptorAttributeGroups(
  attributes: attributeRegistryApi.Attribute[],
  descriptorAttributesGroups: catalogApi.Attribute[][]
): bffApi.DescriptorAttribute[][] {
  return descriptorAttributesGroups.map((attributeGroup) =>
    attributeGroup.map((attribute) =>
      toBffCatalogApiDescriptorAttribute(attributes, attribute)
    )
  );
}

export function toBffCatalogApiDescriptorAttributes(
  attributes: attributeRegistryApi.Attribute[],
  descriptor: catalogApi.EServiceDescriptor
): bffApi.DescriptorAttributes {
  return {
    certified: toBffCatalogApiDescriptorAttributeGroups(
      attributes,
      descriptor.attributes.certified
    ),
    declared: toBffCatalogApiDescriptorAttributeGroups(
      attributes,
      descriptor.attributes.declared
    ),
    verified: toBffCatalogApiDescriptorAttributeGroups(
      attributes,
      descriptor.attributes.verified
    ),
  };
}

export function toCatalogCreateEServiceSeed(
  eServiceSeed: bffApi.EServiceSeed
): catalogApi.EServiceSeed {
  return {
    ...eServiceSeed,
    descriptor: {
      audience: [],
      voucherLifespan: 60,
      dailyCallsPerConsumer: 1,
      dailyCallsTotal: 1,
      agreementApprovalPolicy:
        catalogApi.AgreementApprovalPolicy.Values.AUTOMATIC,
    },
  };
}

export function toCompactEservice(
  eservice: catalogApi.EService,
  producer: tenantApi.Tenant
): bffApi.CompactEService {
  return {
    id: eservice.id,
    name: eservice.name,
    producer: {
      id: producer.id,
      name: producer.name,
      kind: producer.kind,
    },
  };
}

export function toCompactDescriptor(
  descriptor: catalogApi.EServiceDescriptor
): bffApi.CompactDescriptor {
  return {
    id: descriptor.id,
    audience: descriptor.audience,
    state: descriptor.state,
    version: descriptor.version,
  };
}

export function toCompactProducerDescriptor(
  descriptor: catalogApi.EServiceDescriptor,
  isRequesterProducerDelegate: boolean
): bffApi.CompactProducerDescriptor {
  return {
    id: descriptor.id,
    audience: descriptor.audience,
    state: descriptor.state,
    version: descriptor.version,
    requireCorrections:
      isRequesterProducerDelegate &&
      // The WAITING_FOR_APPROVAL state is not relevant for the producer descriptor's requireCorrections field,
      // so we don't consider it when determining whether corrections are required.
      descriptor.state === catalogApi.EServiceDescriptorState.Values.DRAFT &&
      descriptor.rejectionReasons &&
      descriptor.rejectionReasons.length > 0,
  };
}
