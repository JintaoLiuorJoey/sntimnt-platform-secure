import { CognitoMfaService } from "./cognito-mfa.js";
import { CognitoService } from "./cognito.js";
import { loadConfig } from "./config.js";
import { KmsCipher } from "./kms-cipher.js";
import { AuthStore } from "./store.js";

export function createAuthRuntime() {
  const config = loadConfig();

  return {
    config,
    store: new AuthStore(config),
    cipher: new KmsCipher(config),
    cognito: new CognitoService(config),
    cognitoMfa: new CognitoMfaService(config),
  };
}

export type AuthRuntime =
  ReturnType<typeof createAuthRuntime>;
