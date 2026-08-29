export function isProtectedPath(pathname: string) {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/onboarding" ||
    pathname.startsWith("/onboarding/")
  );
}
