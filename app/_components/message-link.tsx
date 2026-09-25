"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

const pagePaths = new Set(["/", "/home", "/home/chat", "/category", "/profile", "/login", "/forgot-password"]);

function pageHref(href: string, base: string) {
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return null;
  }
  const pathname = url.pathname.replace(/\/$/, "") || "/";
  if (url.origin !== new URL(base).origin) return null;
  // API document URLs and other downloadable resources are not App Router pages.
  if (!pagePaths.has(pathname) && !/^\/category\/[^/]+$/.test(pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function MessageLink({ href, children }: { href?: string; children?: ReactNode }) {
  const router = useRouter();
  if (href?.startsWith("/") && !href.startsWith("//") && pageHref(href, "https://app.invalid")) {
    return <Link href={href}>{children}</Link>;
  }

  return <a href={href} target="_blank" rel="noreferrer" onClick={(event) => {
    if (!href || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    // Absolute same-origin links in an answer also use the router. Resolve on
    // activation so server rendering never depends on the browser's origin.
    const destination = pageHref(href, window.location.href);
    if (destination && !href.startsWith("#")) {
      event.preventDefault();
      router.push(destination);
    }
  }}>{children}</a>;
}
