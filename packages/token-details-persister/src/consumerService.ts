import {
  FileManager,
  formatDateyyyyMMdd,
  formatTimehhmmss,
  Logger,
} from "pagopa-interop-commons";
import { GeneratedTokenAuditDetails, generateId } from "pagopa-interop-models";
import { config } from "./config/config.js";

export async function handleMessages(
  messages: GeneratedTokenAuditDetails[],
  fileManager: FileManager,
  logger: Logger
): Promise<void> {
  const fileContent = messages
    .map((auditingEntry) => JSON.stringify(auditingEntry))
    .join("\n");

  const date = new Date();
  const ymdDate = formatDateyyyyMMdd(date);
  const hmsTime = formatTimehhmmss(date);

  const fileName = `${ymdDate}_${hmsTime}_${generateId()}.ndjson`;
  const filePath = `token-details/${ymdDate}`;
  try {
    await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: filePath,
        name: fileName,
        content: Buffer.from(fileContent),
      },
      logger
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "generic error";
    throw Error(`Write operation failed - ${message}`);
  }
}
