import type { Metadata } from "next";
import type { ComponentPropsWithoutRef, JSX } from "react";
import { notFound } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getPublishedPost } from "@/lib/pb";

function formatPublishedDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) {
    return { title: "Article not found" };
  }
  return {
    title: post.title,
    description: post.description ?? undefined,
    alternates: { canonical: `/insights/${post.slug}` },
  };
}

// react-markdown passes an internal `node` prop to every component. Strip it so
// it never leaks onto the DOM element (it is not a valid HTML attribute).
type MdProps<Tag extends keyof JSX.IntrinsicElements> = ComponentPropsWithoutRef<Tag> & {
  node?: unknown;
};

function domProps<Tag extends keyof JSX.IntrinsicElements>(
  props: MdProps<Tag>
): ComponentPropsWithoutRef<Tag> {
  const clean = { ...props };
  delete clean.node;
  return clean as ComponentPropsWithoutRef<Tag>;
}

const markdownComponents: Components = {
  h1: (props: MdProps<"h1">) => (
    <h1 className="mt-8 mb-4 text-2xl font-bold tracking-tight sm:text-3xl" {...domProps(props)} />
  ),
  h2: (props: MdProps<"h2">) => (
    <h2 className="mt-8 mb-3 text-xl font-bold tracking-tight sm:text-2xl" {...domProps(props)} />
  ),
  h3: (props: MdProps<"h3">) => (
    <h3 className="mt-6 mb-2 text-lg font-semibold tracking-tight sm:text-xl" {...domProps(props)} />
  ),
  p: (props: MdProps<"p">) => (
    <p className="my-4 leading-7 text-foreground/90" {...domProps(props)} />
  ),
  a: (props: MdProps<"a">) => (
    <a className="font-medium text-primary underline underline-offset-4 hover:text-primary/80" {...domProps(props)} />
  ),
  ul: (props: MdProps<"ul">) => (
    <ul className="my-4 ml-6 list-disc space-y-2 text-foreground/90" {...domProps(props)} />
  ),
  ol: (props: MdProps<"ol">) => (
    <ol className="my-4 ml-6 list-decimal space-y-2 text-foreground/90" {...domProps(props)} />
  ),
  li: (props: MdProps<"li">) => (
    <li className="leading-7" {...domProps(props)} />
  ),
  blockquote: (props: MdProps<"blockquote">) => (
    <blockquote className="my-6 border-l-2 border-border pl-6 italic text-muted-foreground" {...domProps(props)} />
  ),
  hr: (props: MdProps<"hr">) => (
    <hr className="my-8 border-border" {...domProps(props)} />
  ),
  code: (props: MdProps<"code">) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm" {...domProps(props)} />
  ),
  pre: (props: MdProps<"pre">) => (
    <pre className="my-6 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-sm" {...domProps(props)} />
  ),
  table: (props: MdProps<"table">) => (
    <div className="my-6 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...domProps(props)} />
    </div>
  ),
  thead: (props: MdProps<"thead">) => (
    <thead className="border-b border-border" {...domProps(props)} />
  ),
  th: (props: MdProps<"th">) => (
    <th className="border border-border px-3 py-2 text-left font-semibold" {...domProps(props)} />
  ),
  td: (props: MdProps<"td">) => (
    <td className="border border-border px-3 py-2 align-top" {...domProps(props)} />
  ),
  img: (props: MdProps<"img">) => (
    // alt flows through the markdown source at render time via {...domProps}.
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img className="my-6 rounded-lg" {...domProps(props)} />
  ),
};

export default async function InsightArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) {
    notFound();
  }

  const dateLabel = formatPublishedDate(post.published_at);

  return (
    <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>
        {(post.byline || dateLabel) && (
          <p className="mt-3 text-sm text-muted-foreground">
            {post.byline}
            {post.byline && dateLabel ? " · " : ""}
            {dateLabel}
          </p>
        )}
      </header>

      <div className="text-base">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {post.markdown}
        </ReactMarkdown>
      </div>
    </article>
  );
}
