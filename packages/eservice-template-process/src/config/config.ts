import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceTemplateProcessConfig = CommonHTTPServiceConfig.and(
  ReadModelDbConfig
)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(EventStoreConfig)
  .and(
    z
      .object({
        PRODUCER_ALLOWED_ORIGINS: z.string(),
        ESERVICE_TEMPLATE_DOCUMENTS_PATH: z.string(),
      })
      .transform((c) => ({
        producerAllowedOrigins: c.PRODUCER_ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
        eserviceTemplateDocumentsPath: c.ESERVICE_TEMPLATE_DOCUMENTS_PATH,
      }))
  );

export type EServiceTemplateProcessConfig = z.infer<
  typeof EServiceTemplateProcessConfig
>;

export const config: EServiceTemplateProcessConfig =
  EServiceTemplateProcessConfig.parse(process.env);
