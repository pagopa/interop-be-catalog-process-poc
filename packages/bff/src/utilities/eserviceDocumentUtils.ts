/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Readable } from "node:stream";
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";
import { bffApi, catalogApi } from "pagopa-interop-api-clients";
import { FileManager, WithLogger } from "pagopa-interop-commons";
import { ApiError } from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import YAML from "yaml";
import { z } from "zod";
import { config } from "../config/config.js";
import {
  ErrorCodes,
  interfaceExtractingInfoError,
  invalidInterfaceContentTypeDetected,
  invalidInterfaceFileDetected,
  openapiVersionNotRecognized,
} from "../model/domain/errors.js";
import { CatalogProcessClient } from "../providers/clientProvider.js";
import { BffAppContext } from "../utilities/context.js";

// eslint-disable-next-line max-params
export async function verifyAndCreateEServiceDocument(
  catalogProcessClient: CatalogProcessClient,
  fileManager: FileManager,
  eService: catalogApi.EService,
  doc: bffApi.createEServiceDocument_Body,
  descriptorId: string,
  documentId: string,
  ctx: WithLogger<BffAppContext>
): Promise<void> {
  const contentType = doc.doc.type;
  if (!contentType) {
    throw invalidInterfaceContentTypeDetected(
      eService.id,
      "invalid",
      eService.technology
    );
  }

  const serverUrls = await processFile(doc, eService.technology, eService.id);
  const filePath = await fileManager.storeBytes(
    config.s3Bucket,
    config.eserviceDocumentsPath,
    documentId,
    doc.doc.name,
    Buffer.from(await doc.doc.arrayBuffer()),
    ctx.logger
  );

  const calculateChecksum = async (stream: Readable): Promise<string> =>
    new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");

      stream.on("data", (data) => {
        hash.update(data);
      });

      stream.on("end", () => {
        resolve(hash.digest("hex"));
      });

      stream.on("error", (err) => {
        reject(err);
      });
    });

  const checksum = await calculateChecksum(Readable.from(doc.doc.stream()));
  try {
    await catalogProcessClient.createEServiceDocument(
      {
        documentId,
        prettyName: doc.prettyName,
        fileName: doc.doc.name,
        filePath,
        kind: doc.kind,
        contentType,
        checksum,
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

const getFileType = (
  name: string
): "json" | "yaml" | "wsdl" | "xml" | undefined =>
  match(name)
    .with(P.string.endsWith("json"), () => "json" as const)
    .with(
      P.string.endsWith("yaml"),
      P.string.endsWith("yml"),
      () => "yaml" as const
    )
    .with(P.string.endsWith("wsdl"), () => "wsdl" as const)
    .with(P.string.endsWith("xml"), () => "xml" as const)
    .otherwise(() => undefined);

function parseOpenApi(
  fileType: "json" | "yaml",
  file: string,
  eServiceId: string
) {
  try {
    return match(fileType)
      .with("json", () => JSON.parse(file))
      .with("yaml", () => YAML.parse(file))
      .exhaustive();
  } catch (error) {
    throw invalidInterfaceFileDetected(eServiceId);
  }
}

function handleOpenApiV2(openApi: Record<string, unknown>) {
  const { data: host, error: hostError } = z.string().safeParse(openApi.host);
  const { error: pathsError } = z.array(z.object({})).safeParse(openApi.paths);

  if (hostError || pathsError) {
    throw new Error();
  }

  return [host];
}

function handleOpenApiV3(openApi: Record<string, unknown>) {
  const { data: servers, error } = z
    .array(z.object({ url: z.string() }))
    .safeParse(openApi.servers);
  if (error) {
    throw new Error();
  }

  return servers.flatMap((s) => s.url);
}

function processRestInterface(
  fileType: "json" | "yaml",
  file: string,
  eServiceId: string
) {
  const openApi = parseOpenApi(fileType, file, eServiceId);
  const { data: version, error } = z.string().safeParse(openApi.openapi);

  if (error) {
    throw openapiVersionNotRecognized("nd");
  }
  return match(version)
    .with("2.0", () => handleOpenApiV2(openApi))
    .with(P.string.startsWith("3."), () => handleOpenApiV3(openApi))
    .otherwise(() => {
      throw openapiVersionNotRecognized(version);
    });
}

function processSoapInterface(file: string) {
  const xml = new XMLParser({
    ignoreDeclaration: true,
    removeNSPrefix: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    isArray: (name: string) => ["operation"].indexOf(name) !== -1,
  }).parse(file);

  const address = xml.definitions?.service?.port?.address?.location;
  if (!address) {
    throw interfaceExtractingInfoError();
  }

  const endpoints = xml.definitions?.binding?.operation;
  if (endpoints.length === 0) {
    throw interfaceExtractingInfoError();
  }

  return [address];
}

async function processFile(
  doc: bffApi.createEServiceDocument_Body,
  technology: catalogApi.EServiceTechnology,
  eServiceId: string
) {
  const file = await doc.doc.text();
  try {
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
        (f) => processRestInterface(f.fileType, file, eServiceId)
      )
      .with(
        {
          kind: "INTERFACE",
          technology: "SOAP",
          fileType: P.union("xml", "wsdl"),
        },
        () => processSoapInterface(file)
      )
      .with(
        {
          kind: "DOCUMENT",
        },
        () => []
      )
      .otherwise(() => {
        throw new Error();
      });
  } catch (error) {
    throw match(error)
      .with(P.instanceOf(ApiError<ErrorCodes>), () => error)
      .otherwise(() => invalidInterfaceFileDetected(eServiceId));
  }
}
