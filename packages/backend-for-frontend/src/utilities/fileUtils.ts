/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable max-params */
import path from "path";
import { Readable } from "stream";
import crypto from "crypto";
import AdmZip from "adm-zip";
import { catalogApi } from "pagopa-interop-api-clients";
import { FileManager, Logger } from "pagopa-interop-commons";
import { DescriptorId, genericError } from "pagopa-interop-models";
import { missingInterface } from "../model/errors.js";
import { verifyExportEligibility } from "../services/validators.js";
import { retrieveEserviceDescriptor } from "../services/catalogService.js";
import { ConfigurationEservice } from "../model/types.js";

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

/*
  This function creates a FileDocumentsRegistry object that contains the following information:
  - occurrences: a map that contains the number of occurrences of a document name
    (the same document name can be used multiple times in the same descriptor)
  - uniqueNames: a map that contains the unique name for each document id
*/
export function buildFileDocumentRegistry(
  eserviceDocuments: catalogApi.EServiceDoc[]
): FileDocumentsRegistry {
  return eserviceDocuments.reduce(
    (fileRegistry: FileDocumentsRegistry, doc: catalogApi.EServiceDoc) => {
      const originalName = doc.name;
      const occurrence = fileRegistry.occurrences.get(doc.name) || 0;
      fileRegistry.occurrences.set(originalName, occurrence + 1);

      const parsedName = path.parse(originalName);
      const newName = occurrence
        ? `${parsedName.name}-${occurrence}${parsedName.ext}`
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
): ConfigurationEservice {
  return {
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology,
    mode: eservice.mode,
    isSignalHubEnabled: eservice.isSignalHubEnabled,
    isDelegable: eservice.isDelegable,
    isClientAccessDelegable: eservice.isClientAccessDelegable,
    descriptor: {
      interface: descriptor.interface && {
        prettyName: descriptor.interface.prettyName,
        path: descriptor.interface.name,
      },
      docs: descriptor.docs.map((doc) => {
        const uniqueName = getUniqueNameByDocumentId(
          fileDocumentRegistry,
          doc.id
        );
        return {
          prettyName: doc.prettyName,
          path: `documents/${uniqueName}`,
        };
      }),
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      description: descriptor.description,
      agreementApprovalPolicy: descriptor.agreementApprovalPolicy,
    },
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
  };
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
      |- documents
      |     |
      |     |- documentFile1.{fileExtension}
      |     |- documentFile2.{fileExtension}
      |     |- ...
      |
      |- configuration.json
      |- interfaceFile.{fileExtension}
*/
export async function createDescriptorDocumentZipFile(
  s3BucketName: string,
  fileManager: FileManager,
  logger: Logger,
  zipFolderName: string,
  eservice: catalogApi.EService,
  descriptorId: DescriptorId
): Promise<Uint8Array> {
  const descriptor = retrieveEserviceDescriptor(eservice, descriptorId);
  verifyExportEligibility(descriptor);

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

  const zip = new AdmZip();

  // Add interface file to the zip
  const interfaceFile = await fileManager.get(
    s3BucketName,
    interfaceDocument.path,
    logger
  );

  const interfaceFileContent: FileData = {
    id: interfaceDocument.id,
    file: interfaceFile,
  };
  zip.addFile(
    `${zipFolderName}/${interfaceDocument.name}`,
    Buffer.from(interfaceFileContent.file)
  );

  // Add descriptor's document files to the zip
  const documentFilesContent: FileData[] = await Promise.all(
    descriptor.docs.map(async (doc) => {
      const file = await fileManager.get(s3BucketName, doc.path, logger);
      return { id: doc.id, file };
    })
  );

  documentFilesContent.forEach((doc) => {
    const uniqueName = getUniqueNameByDocumentId(fileDocumentRegistry, doc.id);
    zip.addFile(
      `${zipFolderName}/documents/${uniqueName}`,
      Buffer.from(doc.file)
    );
  });

  // Add configuration File to the zip
  zip.addFile(
    `${zipFolderName}/configuration.json`,
    Buffer.from(JSON.stringify(configuration))
  );

  return zip.toBuffer();
}

export async function calculateChecksum(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
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
}
