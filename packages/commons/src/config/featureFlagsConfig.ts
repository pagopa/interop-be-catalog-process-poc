import { z } from "zod";

export const FeatureFlagsConfig = z
  .object({
    FEATURE_FLAG_SIGNALHUB_WHITELIST: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SIGNALHUB_WHITELIST: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.array(z.string().uuid()))
      .optional(),
  })
  .transform((c) => ({
    featureFlagSignalhubWhitelist: c.FEATURE_FLAG_SIGNALHUB_WHITELIST,
    signalhubWhitelist: c.SIGNALHUB_WHITELIST,
  }));

export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfig>;
