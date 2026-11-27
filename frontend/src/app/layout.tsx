import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // SITE_URL is the public origin; localhost is only the local development fallback.
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Prime Haven Properties",
    template: "%s | Prime Haven Properties",
  },
  description:
    "Prime Haven Properties is a fictional Nigerian property portfolio project. Concept project: listings are fictional.",
  alternates: { canonical: "./" },
  openGraph: {
    title: "Prime Haven Properties",
    description: "A fictional Nigerian property portfolio project.",
    siteName: "Prime Haven Properties",
    type: "website",
    url: "./",
  },
  twitter: {
    card: "summary",
    title: "Prime Haven Properties",
    description: "A fictional Nigerian property portfolio project.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <footer>Concept project: listings are fictional</footer>
      </body>
    </html>
  );
}
