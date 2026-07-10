import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts } from "@/lib/pb";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Federal Workforce Research — LevelsGov",
  description:
    "Data-driven reporting on the federal workforce — pay, hiring, attrition, and STEM trends across U.S. government agencies.",
  alternates: { canonical: "/insights" },
};

function formatPublishedDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function InsightsPage() {
  const posts = await getPublishedPosts(50);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 sm:mb-10">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Federal Workforce Research
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Data-driven reporting on federal pay, hiring, attrition, and STEM
          trends — powered by OPM FedScope.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-muted-foreground">No research published yet.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {posts.map((post) => {
            const dateLabel = formatPublishedDate(post.published_at);
            return (
              <li key={post.slug}>
                <Link
                  href={`/insights/${post.slug}`}
                  className="block rounded-lg transition-colors hover:no-underline"
                >
                  <Card className="transition-colors hover:border-foreground/20 hover:bg-accent/40">
                    <CardHeader className="px-4 sm:px-6">
                      <CardTitle className="text-lg sm:text-xl">
                        {post.title}
                      </CardTitle>
                      {(post.byline || dateLabel) && (
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {post.byline}
                          {post.byline && dateLabel ? " · " : ""}
                          {dateLabel}
                        </p>
                      )}
                    </CardHeader>
                    {post.description && (
                      <CardContent className="px-4 sm:px-6">
                        <p className="text-sm text-muted-foreground">
                          {post.description}
                        </p>
                      </CardContent>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
