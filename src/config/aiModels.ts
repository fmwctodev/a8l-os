export const CLARA_MODEL = "gpt-5.1";
export const CLARA_TEMPERATURE = 0.2;

if (CLARA_MODEL !== "gpt-5.1") {
  throw new Error("Clara model mismatch. Must use gpt-5.1.");
}
