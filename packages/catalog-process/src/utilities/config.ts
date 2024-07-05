import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const CataloProcessConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(EventStoreConfig)
  .and(
    z
      .object({
        ESERVICE_DOCUMENTS_PATH: z.string(),
        PRODUCER_ALLOWED_ORIGINS: z.string(),
      })
      .transform((c) => ({
        eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
        producerAllowedOrigins: c.PRODUCER_ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      }))
  );

export type CatalogProcessConfig = z.infer<typeof CataloProcessConfig>;

export const config: CatalogProcessConfig = {
  ...CataloProcessConfig.parse(process.env),
};
