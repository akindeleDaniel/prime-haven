import type { Metadata } from "next";
import { Suspense } from "react";

type PropertySmokeProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PropertySmokeProps): Promise<Metadata> {
  const { slug } = await params;
  const path = `/properties/${encodeURIComponent(slug)}`;

  return {
    title: "Property route smoke test",
    description: "Foundation verification only. This page is not a property listing.",
    robots: { index: false, follow: false },
    alternates: { canonical: path },
    openGraph: {
      title: "Property route smoke test | Prime Haven Properties",
      description: "Foundation verification only. This page is not a property listing.",
      type: "website",
      url: path,
    },
    twitter: {
      card: "summary",
      title: "Property route smoke test | Prime Haven Properties",
      description: "Foundation verification only. This page is not a property listing.",
    },
  };
}

async function PropertySmoke({ params }: PropertySmokeProps) {
  const { slug } = await params;

  return (
    <>
      <p>Requested slug: <code>{slug}</code></p>
      <p>This page is not a property listing. No property data is loaded.</p>
    </>
  );
}

export default function PropertySmokePage({ params }: PropertySmokeProps) {
  return (
    <main>
      <h1>Property route smoke test</h1>
      <p>Concept project: listings are fictional</p>
      <Suspense fallback={<p>Loading route parameters...</p>}>
        <PropertySmoke params={params} />
      </Suspense>
    </main>
  );
}
