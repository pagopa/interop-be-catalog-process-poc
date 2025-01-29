import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
  S3Config,
  FeatureFlagsConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const CatalogProcessConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(EventStoreConfig)
  .and(FeatureFlagsConfig)
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

export type CatalogProcessConfig = z.infer<typeof CatalogProcessConfig>;

export const config: CatalogProcessConfig = CatalogProcessConfig.parse(
  process.env
);
