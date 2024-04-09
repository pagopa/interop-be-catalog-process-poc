import { z } from "zod";

export const SelfCareConfig = z
  .object({
    SELFCARE_V2_URL: z.string(),
    SELFCARE_V2_API_KEY: z.string(),
  })
  .transform((c) => ({
    selfcare_baseUrl: c.SELFCARE_V2_URL,
    selfcare_apiKey: c.SELFCARE_V2_API_KEY,
  }));

export type SelfCareConfig = z.infer<typeof SelfCareConfig>;
