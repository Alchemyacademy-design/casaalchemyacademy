import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { staticPageMeta } from "./site";
import { applyHeadMeta, clearRouteMeta } from "./head";

/**
 * Keeps title, description and canonical correct after in-app navigation.
 * Ask the Expert LIVE pages set their own metadata once the session loads.
 */
export default function RouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith("/ask-the-expert/")) return;
    const meta = staticPageMeta(pathname);
    if (meta) applyHeadMeta(meta);
    else clearRouteMeta();
  }, [pathname]);
  return null;
}
