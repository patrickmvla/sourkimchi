import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    MONGODB_URL: z.string().url(),
    SECRET: z.string().min(1)
  },
  runtimeEnv: process.env,
});
