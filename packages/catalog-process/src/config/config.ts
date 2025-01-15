import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
  S3Config,
} from "pagopa-interop-commons";
import { z } from "zod";

const CatalogProcessConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(EventStoreConfig)
  .and(
    z
      .object({
        ESERVICE_DOCUMENTS_PATH: z.string(),
        PRODUCER_ALLOWED_ORIGINS: z.string(),
        FEATURE_FLAG_SIGNALHUB_WHITELIST: z
          .enum(["true", "false"])
          .transform((value) => value === "true"),
        SIGNALHUB_WHITELIST: z
          .string()
          .uuid()
          .transform((value) => value.split(","))
          .optional(),
      })
      .transform((c) => ({
        featureFlagSignalhubWhitelist: c.FEATURE_FLAG_SIGNALHUB_WHITELIST,
        signalhubWhitelist: c.SIGNALHUB_WHITELIST,
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
