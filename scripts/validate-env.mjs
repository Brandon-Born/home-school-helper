import { getTutorConfig, resetTutorConfigCache } from "../src/server/config.js";

try {
  resetTutorConfigCache();
  const config = getTutorConfig(process.env);
  console.log(
    `Tutor environment valid. Model=${config.model}, PromptVersion=${config.promptVersion}`
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "Environment validation failed");
  process.exit(1);
}
