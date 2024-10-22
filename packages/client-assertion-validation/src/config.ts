import { z } from "zod";

const ClientAssertionValidationConfig = z
  .object({
    CLIENT_ASSERTION_AUDIENCE: z.string(),
  })
  .transform((c) => ({
    clientAssertionAudience: c.CLIENT_ASSERTION_AUDIENCE.split(",").map(
      (audienceEntry) => audienceEntry.trim()
    ),
  }));

export const config = ClientAssertionValidationConfig.parse(process.env);
