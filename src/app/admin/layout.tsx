// app/admin/layout.tsx
import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings, Users, FolderTree, BookOpenText, Home } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Gate admin area
  try {
    await requireAdmin();
  } catch {
    // Not an admin: send away
    redirect("/");
  }

  const nav = [
    { label: "Dashboard", href: "/admin", icon: Settings },
    { label: "Creators", href: "/admin/creators", icon: Users },
    { label: "Collections", href: "/admin/collections", icon: FolderTree },
    { label: "Recipes", href: "/admin/recipes", icon: BookOpenText },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Admin</Badge>
          <h1 className="text-xl font-semibold">SourKimchi Admin</h1>
        </div>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "gap-2"
          )}
        >
          <Home className="h-4 w-4" />
          Back to site
        </Link>
      </header>

      {/* Layout */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_1fr]">
        <aside className="h-max rounded-xl border p-2">
          <nav className="flex flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "justify-start gap-2"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
