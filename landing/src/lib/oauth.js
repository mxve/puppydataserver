import { NodeOAuthClient } from "@atproto/oauth-client-node";
import { BASE_URL } from "../config.js";

export const CLIENT_METADATA = {
  client_id: `${BASE_URL}/verify/client-metadata.json`,
  client_name: "PuppyDataServer",
  client_uri: BASE_URL,
  redirect_uris: [`${BASE_URL}/verify/callback`],
  scope: "atproto transition:generic",
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  application_type: "web",
  token_endpoint_auth_method: "none",
  dpop_bound_access_tokens: true,
};

export const stateMap = new Map();
export const sessionMap = new Map();

export let oauth_client = null;

try {
  oauth_client = new NodeOAuthClient({
    clientMetadata: CLIENT_METADATA,
    stateStore: {
      set: async (key, val) => {
        stateMap.set(key, val);
      },
      get: async (key) => stateMap.get(key),
      del: async (key) => {
        stateMap.delete(key);
      },
    },
    sessionStore: {
      set: async (sub, val) => {
        sessionMap.set(sub, val);
      },
      get: async (sub) => sessionMap.get(sub),
      del: async (sub) => {
        sessionMap.delete(sub);
      },
    },
  });
} catch {
  console.warn("oauth disabled - BASE_URL invalid");
}
