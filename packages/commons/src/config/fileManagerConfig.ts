import { z } from "zod";

const S3CustomServerConfig = z
  .discriminatedUnion("S3_CUSTOM_SERVER", [
    z.object({
      S3_CUSTOM_SERVER: z.literal("true"),
      S3_SERVER_HOST: z.string(),
      S3_SERVER_PORT: z.coerce.number().min(1001),
      S3_ACCESS_KEY_ID: z.string(),
      S3_SECRET_ACCESS_KEY: z.string(),
    }),
    z.object({
      S3_CUSTOM_SERVER: z.literal("false"),
    }),
  ])
  .transform((c) =>
    c.S3_CUSTOM_SERVER === "true"
      ? {
          s3CustomServer: true as const,
          s3ServerHost: c.S3_SERVER_HOST,
          s3ServerPort: c.S3_SERVER_PORT,
          s3AccessKeyId: c.S3_ACCESS_KEY_ID,
          s3SecretAccessKey: c.S3_SECRET_ACCESS_KEY,
        }
      : {
          s3CustomServer: false as const,
        }
  );

const S3Config = z
  .object({
    AWS_REGION: z.string(),
  })
  .transform((c) => ({
    s3Region: c.AWS_REGION,
  }));

export const FileManagerConfig = z.intersection(S3CustomServerConfig, S3Config);
export type FileManagerConfig = z.infer<typeof FileManagerConfig>;
