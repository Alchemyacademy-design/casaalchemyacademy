import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listCoursesTool from "./tools/list-courses";
import listMyCertificatesTool from "./tools/list-my-certificates";

// Construct the Supabase OAuth issuer from the project ref (Vite inlines this
// literal at build time, so the entry stays import-safe). NEVER use
// SUPABASE_URL — on Lovable Cloud that's the .lovable.cloud proxy, whose
// issuer discovery does not match the direct supabase.co issuer that mcp-js
// requires. The fallback keeps the string well-formed during the throwaway
// manifest-extract eval, where a token never actually verifies.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "alchemy-academy-mcp",
  title: "Alchemy Academy",
  version: "0.1.0",
  instructions:
    "Tools for Alchemy Academy, an online interior-design school by Casa Alchemy Studio. Callers act as the signed-in student. Use `whoami` to confirm identity, `list_courses` to browse the catalog, and `list_my_certificates` to fetch issued certificates and their public share links.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listCoursesTool, listMyCertificatesTool],
});