import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Link as RouterLink, matchPath, useLocation as useRouterLocation, useNavigate, useParams as useRouterParams } from "react-router-dom";

export function Link({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (isValidElement(children) && (children as ReactElement).type === "a") {
    return cloneElement(children as ReactElement<any>, { href, className: className ?? (children as ReactElement<any>).props.className });
  }
  return <RouterLink to={href} className={className}>{children}</RouterLink>;
}

export function useLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const location = useRouterLocation();
  const navigate = useNavigate();
  return [location.pathname + location.search + location.hash, (to, options) => navigate(to, { replace: options?.replace })];
}

export function useRoute(pattern: string): [boolean, Record<string, string> | null] {
  const location = useRouterLocation();
  const match = matchPath({ path: pattern, end: true }, location.pathname);
  return [Boolean(match), match?.params as Record<string, string> | null];
}

export const useParams = useRouterParams;
