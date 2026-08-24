import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for
  // - files with an extension (e.g. .js, .css, .png)
  // - api routes
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};