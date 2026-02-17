import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./supabase-config.js";

let cachedServiceClient;
let cachedAnonClient;

const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
};

export function getServiceSupabaseClient() {
  if (cachedServiceClient) {
    return cachedServiceClient;
  }

  const config = getSupabaseConfig();
  cachedServiceClient = createClient(config.url, config.serviceRoleKey, CLIENT_OPTIONS);
  return cachedServiceClient;
}

export function getAnonSupabaseClient() {
  if (cachedAnonClient) {
    return cachedAnonClient;
  }

  const config = getSupabaseConfig();
  cachedAnonClient = createClient(config.url, config.anonKey, CLIENT_OPTIONS);
  return cachedAnonClient;
}

export function resetSupabaseClientCache() {
  cachedServiceClient = undefined;
  cachedAnonClient = undefined;
}
