import type { Metadata } from "next";
import type { ReactNode } from "react";
export const metadata: Metadata = { title: "Safe Cat 07 Harness" };
export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><head><link rel="icon" href="data:," /></head><body>{children}</body></html>;
}
