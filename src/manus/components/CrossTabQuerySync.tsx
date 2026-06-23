import { useQueryClient } from "@tanstack/react-query";
import { useCrossTabQueryInvalidation } from "@/manus/lib/cross-tab-query-sync";

/**
 * Mount once at the QueryClientProvider boundary. Listens for cross-tab
 * invalidation events and forwards them to the local QueryClient.
 */
export default function CrossTabQuerySync() {
  const client = useQueryClient();
  useCrossTabQueryInvalidation(client);
  return null;
}
