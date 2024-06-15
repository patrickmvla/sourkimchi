import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    MONGODB_URL: z.string().url(),
    NODE_ENV: z.string().min(1),
    SECRET: z.string().min(1)
  },
  runtimeEnv: process.env,
});
