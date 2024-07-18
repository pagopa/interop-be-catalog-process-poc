/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { randomUUID } from "crypto";
import { XMLParser } from "fast-xml-parser";
import {
  attributeRegistryApi,
  bffApi,
  catalogApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { DescriptorId, EServiceId } from "pagopa-interop-models";
import { FileManager,WithLogger } from "pagopa-interop-commons";
import {
  toBffCatalogApiDescriptorAttributes,
  toBffCatalogApiDescriptorDoc,
  toBffCatalogApiEService,
  toBffCatalogApiEserviceRiskAnalysis,
  toBffCatalogApiProducerDescriptorEService,
} from "../model/api/converters/catalogClientApiConverter.js";

import { eserviceDescriptorNotFound } from "../model/domain/errors.js";
import { getLatestActiveDescriptor } from "../model/modelMappingUtils.js";
import {
  assertRequesterIsProducer,
  catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied,
} from "../model/validators.js";
import { P, match } from "ts-pattern";
import YAML from "yaml";
import { z } from "zod";
import { CreatedResource } from "../../../api-clients/dist/bffApi.js";
import { config } from "../config/config.js";
import { toBffCatalogApiEServiceResponse } from "../model/api/apiConverter.js";
import { catalogApiDescriptorState } from "../model/api/apiTypes.js";
import {
  AgreementProcessClient,
  AttributeProcessClient,
  CatalogProcessClient,
  TenantProcessClient,
} from "../providers/clientProvider.js";
import { BffAppContext, Headers } from "../utilities/context.js";
import { getLatestAgreement } from "./agreementService.js";

export type CatalogService = ReturnType<typeof catalogServiceBuilder>;

const enhanceCatalogEService =
  (
    tenantProcessClient: TenantProcessClient,
    agreementProcessClient: AgreementProcessClient,
    headers: Headers,
    requesterId: string
  ): ((eservice: catalogApi.EService) => Promise<bffApi.CatalogEService>) =>
  async (eservice: catalogApi.EService): Promise<bffApi.CatalogEService> => {
    const producerTenant = await tenantProcessClient.tenant.getTenant({
      headers,
      params: {
        id: eservice.producerId,
      },
    });

    const requesterTenant: tenantApi.Tenant =
      requesterId !== eservice.producerId
        ? await tenantProcessClient.tenant.getTenant({
            headers,
            params: {
              id: requesterId,
            },
          })
        : producerTenant;

    const latestActiveDescriptor = getLatestActiveDescriptor(eservice);

    const latestAgreement = await getLatestAgreement(
      agreementProcessClient,
      requesterId,
      eservice,
      headers
    );

    const isRequesterEqProducer = requesterId === eservice.producerId;
    const hasCertifiedAttributes =
      latestActiveDescriptor !== undefined &&
      catalogProcessApiEServiceDescriptorCertifiedAttributesSatisfied(
        latestActiveDescriptor,
        requesterTenant
      );

    return toBffCatalogApiEService(
      eservice,
      producerTenant,
      hasCertifiedAttributes,
      isRequesterEqProducer,
      latestActiveDescriptor,
      latestAgreement
    );
  };

const getBulkAttributes = async (
  attributeProcessClient: AttributeProcessClient,
  headers: Headers,
  descriptorAttributeIds: string[]
) => {
  // Fetch all attributes in a recursive way
  const attributesBulk = async (
    offset: number,
    result: attributeRegistryApi.Attribute[]
  ): Promise<attributeRegistryApi.Attribute[]> => {
    const attributes = await attributeProcessClient.getBulkedAttributes(
      descriptorAttributeIds,
      {
        headers,
        queries: {
          limit: 50,
          offset,
        },
      }
    );

    if (attributes.totalCount <= 50) {
      return result.concat(attributes.results);
    } else {
      return await attributesBulk(offset + 50, result);
    }
  };

  return await attributesBulk(0, []);
};

const retrieveEserviceDescriptor = (
  eservice: catalogApi.EService,
  descriptorId: DescriptorId
): catalogApi.EServiceDescriptor => {
  const descriptor = eservice.descriptors.find((e) => e.id === descriptorId);

  if (!descriptor) {
    throw eserviceDescriptorNotFound(eservice.id, descriptorId);
  }

  return descriptor;
};

const getAttributeIds = (
  descriptor: catalogApi.EServiceDescriptor
): string[] => [
  ...descriptor.attributes.certified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.declared.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
  ...descriptor.attributes.verified.flatMap((atts) =>
    atts.map((att) => att.id)
  ),
];

export function catalogServiceBuilder(
  catalogProcessClient: CatalogProcessClient,
  tenantProcessClient: TenantProcessClient,
  agreementProcessClient: AgreementProcessClient,
  attributeProcessClient: AttributeProcessClient,
  fileManager: FileManager
) {
  return {
    getCatalog: async (
      context: WithLogger<BffAppContext>,
      queries: catalogApi.GetCatalogQueryParam
    ): Promise<bffApi.CatalogEServices> => {
      const requesterId = context.authData.organizationId;
      const { offset, limit } = queries;
      const eservicesResponse: catalogApi.EServices =
        await catalogProcessClient.getEServices({
          headers: context.headers,
          queries: {
            ...queries,
            eservicesIds: queries.eservicesIds,
            producersIds: queries.producersIds,
            states: queries.states,
            attributesIds: queries.attributesIds,
            agreementStates: queries.agreementStates,
          },
        });

      const results = await Promise.all(
        eservicesResponse.results.map(
          enhanceCatalogEService(
            tenantProcessClient,
            agreementProcessClient,
            context.headers,
            requesterId
          )
        )
      );
      const response: bffApi.CatalogEServices = {
        results,
        pagination: {
          offset,
          limit,
          totalCount: eservicesResponse.totalCount,
        },
      };
      return response;
    },
    getProducerEServiceDescriptor: async (
      eserviceId: EServiceId,
      descriptorId: DescriptorId,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDescriptor> => {
      const requesterId = context.authData.organizationId;
      const headers = context.headers;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId: eserviceId,
          },
          headers,
        });

      assertRequesterIsProducer(requesterId, eservice);

      const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);

      const descriptorAttributeIds = getAttributeIds(descriptor);

      const attributes = await getBulkAttributes(
        attributeProcessClient,
        headers,
        descriptorAttributeIds
      );

      const descriptorAttributes = toBffCatalogApiDescriptorAttributes(
        attributes,
        descriptor
      );

      const requesterTenant = await tenantProcessClient.tenant.getTenant({
        headers,
        params: {
          id: requesterId,
        },
      });

      return {
        id: descriptor.id,
        version: descriptor.version,
        description: descriptor.description,
        interface:
          descriptor.interface &&
          toBffCatalogApiDescriptorDoc(descriptor.interface),
        docs: descriptor.docs.map(toBffCatalogApiDescriptorDoc),
        state: descriptor.state,
        audience: descriptor.audience,
        voucherLifespan: descriptor.voucherLifespan,
        dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
        dailyCallsTotal: descriptor.dailyCallsTotal,
        agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
        attributes: descriptorAttributes,
        eservice: toBffCatalogApiProducerDescriptorEService(
          eservice,
          requesterTenant
        ),
      };
    },
    getProducerEServiceDetails: async (
      eServiceId: string,
      context: WithLogger<BffAppContext>
    ): Promise<bffApi.ProducerEServiceDetails> => {
      const requesterId = context.authData.organizationId;
      const headers = context.headers;

      const eservice: catalogApi.EService =
        await catalogProcessClient.getEServiceById({
          params: {
            eServiceId,
          },
          headers,
        });

      assertRequesterIsProducer(requesterId, eservice);

      return {
        id: eservice.id,
        name: eservice.name,
        description: eservice.description,
        technology: eservice.technology,
        mode: eservice.mode,
        riskAnalysis: eservice.riskAnalysis.map(
          toBffCatalogApiEserviceRiskAnalysis
        ),
      };
    },
    updateEServiceDescription: async (
      headers: Headers,
      eServiceId: EServiceId,
      updateSeed: bffApi.EServiceDescriptionSeed
    ): Promise<bffApi.CreatedResource> => {
      const updatedEservice =
        await catalogProcessClient.updateEServiceDescription(updateSeed, {
          headers,
          params: {
            eServiceId,
          },
        });

      return {
        id: updatedEservice.id,
      };
      },
    createEServiceDocument: async (
      eServiceId: string,
      descriptorId: string,
      doc: bffApi.createEServiceDocument_Body,
      ctx: WithLogger<BffAppContext>
    ): Promise<CreatedResource> => {
      const eService = await catalogProcessClient.getEServiceById({
        params: { eServiceId },
        headers: ctx.headers,
      });

      const descriptor = eService.descriptors.find(
        (d) => d.id === descriptorId
      );
      if (!descriptor) {
        throw eserviceDescriptorNotFound(eServiceId, descriptorId);
      }

      const documentId = randomUUID();

      await verifyAndCreateEServiceDocument(
        catalogProcessClient,
        fileManager,
        eService,
        doc,
        descriptorId,
        documentId,
        ctx
      );

      return { id: documentId };
    },
  };
}

// eslint-disable-next-line max-params
async function verifyAndCreateEServiceDocument(
  catalogProcessClient: CatalogProcessClient,
  fileManager: FileManager,
  eService: catalogApi.EService,
  doc: bffApi.createEServiceDocument_Body,
  descriptorId: string,
  documentId: string,
  ctx: WithLogger<BffAppContext>
): Promise<void> {
  const serverUrls = await processFile(doc, eService.technology);
  const filePath = await fileManager.storeBytes(
    config.s3Bucket,
    config.eserviceDocumentsPath,
    documentId,
    doc.doc.name,
    Buffer.from(await doc.doc.arrayBuffer()),
    ctx.logger
  );
  try {
    await catalogProcessClient.createEServiceDocument(
      {
        documentId,
        prettyName: doc.prettyName,
        fileName: doc.doc.name,
        filePath,
        kind: doc.kind,
        contentType: "application/json", // TODO handle media type
        checksum: "", // TODO handle checksum
        serverUrls,
      },
      {
        headers: ctx.headers,
        params: {
          eServiceId: eService.id,
          descriptorId,
        },
      }
    );
  } catch (error) {
    await fileManager.delete(config.s3Bucket, filePath, ctx.logger);
    throw error;
  }
}

const getFileType = (name: string): "json" | "yaml" | "wsdl" | "xml" =>
  match(name)
    .with(P.string.endsWith("json"), () => "json" as const)
    .with(
      P.string.endsWith("yaml"),
      P.string.endsWith("yml"),
      () => "yaml" as const
    )
    .with(P.string.endsWith("wsdl"), () => "wsdl" as const)
    .with(P.string.endsWith("xml"), () => "xml" as const)
    .otherwise(() => {
      throw new Error("Invalid file type"); // TODO handle error
    });

function parseOpenApi(fileType: "json" | "yaml", file: string) {
  return match(fileType)
    .with("json", () => JSON.parse(file)) // TODO handle error
    .with("yaml", () => YAML.parse(file)) // TODO handle error
    .exhaustive();
}

function handleOpenApiV2(openApi: Record<string, unknown>) {
  const { data: host, error: hostError } = z.string().safeParse(openApi.host);
  const { error: pathsError } = z.array(z.object({})).safeParse(openApi.paths); // TODO not sure

  if (hostError) {
    throw new Error("Invalid OpenAPI host"); // TODO handle error
  }
  if (pathsError) {
    throw new Error("Invalid OpenAPI paths"); // TODO handle error
  }

  return [host];
}

function handleOpenApiV3(openApi: Record<string, unknown>) {
  const { data: servers, error } = z
    .array(z.object({ url: z.string() }))
    .safeParse(openApi.servers);
  if (error) {
    throw new Error("Invalid OpenAPI servers"); // TODO handle error
  }

  return servers.flatMap((s) => s.url);
}

function processRestInterface(fileType: "json" | "yaml", file: string) {
  const openApi = parseOpenApi(fileType, file);
  const { data: version, error } = z.string().safeParse(openApi.version);

  if (error) {
    throw new Error("Invalid OpenAPI version"); // TODO handle error
  }

  return match(version)
    .with("2.0", () => handleOpenApiV2(openApi))
    .with(P.string.startsWith("3."), () => handleOpenApiV3(openApi))
    .otherwise(() => {
      throw new Error("Invalid OpenAPI version"); // TODO handle error
    });
}

function processSoapInterface(_fileType: "xml" | "wsdl", file: string) {
  const xml = new XMLParser({
    ignoreDeclaration: true,
    removeNSPrefix: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name: string) => ["operation"].indexOf(name) !== -1,
  }).parse(file);

  const address = xml.definitions?.service?.port?.address?.location;
  if (!address) {
    throw new Error("Invalid WSDL"); // TODO handle error
  }

  const endpoints = xml.definitions?.binding?.operation;
  if (endpoints.length === 0) {
    throw new Error("Invalid WSDL"); // TODO handle error
  }

  return [address];
}

async function processFile(
  doc: bffApi.createEServiceDocument_Body,
  technology: "REST" | "SOAP"
) {
  const file = await doc.doc.text();
  return match({
    fileType: getFileType(doc.doc.name),
    technology,
    kind: doc.kind,
  })
    .with(
      {
        kind: "INTERFACE",
        technology: "REST",
        fileType: P.union("json", "yaml"),
      },
      (f) => processRestInterface(f.fileType, file)
    )
    .with(
      {
        kind: "INTERFACE",
        technology: "SOAP",
        fileType: P.union("xml", "wsdl"),
      },
      (f) => processSoapInterface(f.fileType, file)
    )
    .with(
      {
        kind: "DOCUMENT",
      },
      () => []
    )
    .otherwise(() => {
      throw new Error("Invalid file type for technology");
    });
}
