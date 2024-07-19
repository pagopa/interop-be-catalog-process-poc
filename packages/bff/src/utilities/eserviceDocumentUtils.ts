/* eslint-disable @typescript-eslint/explicit-function-return-type */
import crypto from "crypto";
import { Readable } from "node:stream";
import { XMLParser } from "fast-xml-parser";
import { bffApi, catalogApi } from "pagopa-interop-api-clients";
import { FileManager, WithLogger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import YAML from "yaml";
import { z } from "zod";
import { config } from "../config/config.js";
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
    throw new Error("Invalid content type"); // TODO handle error
  }

  const serverUrls = await processFile(doc, eService.technology);
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
  const { data: version, error } = z.string().safeParse(openApi.openapi);

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
