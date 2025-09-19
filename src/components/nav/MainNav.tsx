// components/nav/MainNav.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { SignedIn, SignedOut, UserButton, SignInButton } from "@clerk/nextjs";
import { Menu, ChevronDown, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type NavItem = {
  label: string;
  href: string;
  exact?: boolean;
  children?: { label: string; href: string }[];
};

const NAV_LINKS: NavItem[] = [
  { label: "Recipes", href: "/recipes" },
  {
    label: "Discover",
    href: "/discover",
    children: [
      { label: "YouTube Channels", href: "/discover/youtube" },
      { label: "Instagram Accounts", href: "/discover/instagram" },
    ],
  },
];

export default function MainNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        {/* Mobile: menu trigger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon" aria-label="Toggle menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>SourKimchi</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 flex flex-col gap-1">
              {NAV_LINKS.map((item) =>
                item.children ? (
                  <div key={item.href} className="flex flex-col">
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "px-2 py-2 text-sm font-medium",
                        isActive(pathname, item.href, item.exact)
                          ? "text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </Link>
                    <div className="ml-3 flex flex-col">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className="rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-md px-2 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                      isActive(pathname, item.href, item.exact)
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                )
              )}
              <div className="pt-2">
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setOpen(false)}
                    >
                      Sign in
                    </Button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "mt-1 w-full justify-start"
                    )}
                  >
                    My account
                  </Link>
                </SignedIn>
              </div>
            </nav>
          </SheetContent>
        </Sheet>

        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span
            className="inline-block h-6 w-6 rounded bg-amber-500"
            aria-hidden="true"
          />
          <span>SourKimchi</span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-6 hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) =>
            item.children ? (
              <DropdownMenu key={item.href}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={
                      isActive(pathname, item.href, item.exact)
                        ? "default"
                        : "ghost"
                    }
                    className="gap-1"
                  >
                    {item.label}
                    <ChevronDown className="h-4 w-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[240px]">
                  <DropdownMenuLabel>Explore</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {item.children.map((child) => (
                    <DropdownMenuItem asChild key={child.href}>
                      <Link href={child.href}>{child.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  buttonVariants({
                    variant: isActive(pathname, item.href, item.exact)
                      ? "default"
                      : "ghost",
                  })
                )}
                aria-current={
                  isActive(pathname, item.href, item.exact) ? "page" : undefined
                }
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Search */}
        <QuickSearch />

        {/* Auth */}
        <div className="ml-2 flex items-center gap-2">
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline">Sign in</Button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/account" className="hidden sm:inline-flex">
              <Button variant="outline">My account</Button>
            </Link>
            <UserButton
              appearance={{ elements: { avatarBox: "h-8 w-8" } }}
              afterSignOutUrl="/"
            />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}

function QuickSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const qs = q.trim();
        router.push(qs ? `/recipes?q=${encodeURIComponent(qs)}` : "/recipes");
      }}
      className="hidden items-center gap-2 sm:flex"
    >
      <div className="relative">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search recipes…"
          className="w-56 pr-8"
        />
        <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </form>
  );
}

/* Utils */

function isActive(pathname: string | null, href: string, exact?: boolean) {
  if (!pathname) return false;
  return exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");
}
