// middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublic = createRouteMatcher([
  "/",
  "/discover(.*)",
  "/admin(.*)",
  "/recipes(.*)",
  "/creators(.*)",
  "/api/recipes",
  "/api/creators",
  "/api/creator-collections(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sitemap(.*)",
  "/robots(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) await auth.protect(); // gate /account, /admin, etc.
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/", "/(api|trpc)(.*)"],
};
