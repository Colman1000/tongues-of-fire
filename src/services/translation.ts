import * as deepl from "deepl-node";

const authKey = process.env.DEEPL_KEY;
if (!authKey) {
  throw new Error("DEEPL_KEY environment variable is not set.");
}

export const translator = new deepl.Translator(authKey);
