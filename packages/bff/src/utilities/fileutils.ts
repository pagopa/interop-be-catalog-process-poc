/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import path from "path";
import { Readable } from "stream";
import JSZip from "jszip";
import { catalogApi } from "pagopa-interop-api-clients";
import { FileManager, Logger } from "pagopa-interop-commons";
import { genericError } from "pagopa-interop-models";
import { missingInterface } from "../model/domain/errors.js";
import { retrieveEserviceDescriptor } from "../model/modelMappingUtils.js";
/* 
  FileDocumentsRegistry is a map that contains the following information:
  - occurrences: a map that contains the number of occurrences of a document name
    (the same document name can be used multiple times in the same descriptor)
  - uniqueNames: a map that contains the unique name for each document id
*/
export type FileDocumentsRegistry = {
  occurrences: Map<string, number>;
  uniqueNames: Map<string, string>;
};

export type FileData = {
  id: string;
  file: Uint8Array;
};

function getUniqueNameByDocumentId(
  fileDocumentRegistry: FileDocumentsRegistry,
  documentId: string
): string {
  const uniqueName = fileDocumentRegistry.uniqueNames.get(documentId);
  if (!uniqueName) {
    throw genericError(`Unique name not found for document id ${documentId}`);
  }
  return uniqueName;
}

export function buildFileDocumentRegistry(
  eserviceDocuments: catalogApi.EServiceDoc[]
): FileDocumentsRegistry {
  return eserviceDocuments.reduce(
    (fileRegistry: FileDocumentsRegistry, doc: catalogApi.EServiceDoc) => {
      const originalName = doc.name;
      const occurrence = fileRegistry.occurrences.get(doc.name) || 0;
      fileRegistry.occurrences.set(originalName, occurrence + 1);

      const newName = occurrence
        ? `${path.basename(originalName)}-${occurrence}${path.extname(
            originalName
          )}`
        : originalName;

      fileRegistry.uniqueNames.set(doc.id, newName);
      return fileRegistry;
    },
    {
      occurrences: new Map(),
      uniqueNames: new Map(),
    }
  );
}

export function buildJsonConfig(
  fileDocumentRegistry: FileDocumentsRegistry,
  eservice: catalogApi.EService,
  descriptor: catalogApi.EServiceDescriptor
) {
  return {
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    descriptor: {
      interface: descriptor.interface && {
        prettyName: descriptor.interface.prettyName,
        path: descriptor.interface.path,
      },
      docs: descriptor.docs.map((doc) => {
        const uniqueName = getUniqueNameByDocumentId(
          fileDocumentRegistry,
          doc.id
        );
        return {
          prettyname: doc.prettyName,
          path: `documents/${uniqueName}`,
        };
      }),
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      description: descriptor.description,
      agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
      riskAnalysis: eservice.riskAnalysis.map((ra) => ({
        name: ra.name,
        riskAnalysisForm: {
          version: ra.riskAnalysisForm.version,
          singleAnswers: ra.riskAnalysisForm.singleAnswers.map((sa) => ({
            key: sa.key,
            value: sa.value,
          })),
          multiAnswers: ra.riskAnalysisForm.multiAnswers.map((ma) => ({
            key: ma.key,
            values: ma.values,
          })),
        },
      })),
    },
  };
}

async function readableToInt8Array(readable: Readable): Promise<Uint8Array> {
  // Collect the data from the stream
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(chunk);
  }

  // Combine all chunks into a single buffer
  const buffer = Buffer.concat(chunks);

  // Create and return an Int8Array from the buffer
  return new Uint8Array(buffer);
}

/* 
  This function creates a zip file fetched from the S3 bucket 
  using FileManager, the zip file containing the following files:
  - descriptor's interface file
  - descriptor's documents file
  - configuration file

  The zip folder structure in output is the following:
  - zipFolderName
      |
      |- interface
      |     |
      |     |- interfaceFile.{fileExtension}
      |
      |- documents
      |     |
      |     |- documentFile1.{fileExtension}
      |     |- documentFile2.{fileExtension}
      |     |- ...
      |
      |- configuration.json
*/
export async function createdescriptorDocumentZipFile(
  s3BucketName: string,
  fileManager: FileManager,
  logger: Logger,
  zipFolderName: string,
  eservice: catalogApi.EService,
  descriptorId: string
): Promise<Uint8Array> {
  const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);
  const interfaceDocument = descriptor.interface;
  if (!interfaceDocument) {
    throw missingInterface(eservice.id, descriptorId);
  }

  const fileDocumentRegistry = buildFileDocumentRegistry(descriptor.docs);
  const configuration = buildJsonConfig(
    fileDocumentRegistry,
    eservice,
    descriptor
  );

  const zip = new JSZip();

  // Add interface file to the zip

  const interfaceFile: Readable = await fileManager.get(
    s3BucketName,
    "/" + interfaceDocument.path,
    logger
  );

  const interfaceFileContent: FileData = {
    id: interfaceDocument.id,
    file: await readableToInt8Array(interfaceFile),
  };
  zip.file(
    `${zipFolderName}/${interfaceDocument.name}`,
    interfaceFileContent.file
  );

  // Add descriptor's document files to the zip
  const documentFilesContent: FileData[] = await Promise.all(
    descriptor.docs.map(async (doc) => {
      const file = await fileManager.get(s3BucketName, doc.path, logger);
      return { id: doc.id, file: await readableToInt8Array(file) };
    })
  );

  documentFilesContent.forEach((doc) => {
    const uniqueName = getUniqueNameByDocumentId(fileDocumentRegistry, doc.id);
    zip.file(`${zipFolderName}/documents/${uniqueName}`, doc.file);
  });

  // Add configuration File to the zip
  zip.file(
    `${zipFolderName}/configuration.json`,
    JSON.stringify(configuration)
  );

  return zip.generateAsync({ type: "uint8array" });
}
