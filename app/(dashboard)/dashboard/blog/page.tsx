import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const MOCK_POSTS = [
  {
    id: "post-1",
    title: "How we deliver standout service",
    excerpt: "A behind-the-scenes look at our process and people.",
    status: "Published",
    date: "Jan 12, 2026"
  },
  {
    id: "post-2",
    title: "3 quick wins for better customer experience",
    excerpt: "Simple adjustments that have a big impact.",
    status: "Draft",
    date: "Jan 05, 2026"
  }
];

export default function BlogDashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Blog</p>
          <h2 className="text-3xl font-semibold">Manage your posts</h2>
          <p className="text-sm text-white/60">Draft, publish, and organize posts from one place.</p>
        </div>
        <Button variant="outline" type="button">
          Create post
        </Button>
      </div>

      <Card>
        <div className="space-y-4">
          {MOCK_POSTS.map((post) => (
            <div key={post.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">{post.title}</p>
                  <p className="mt-1 text-xs text-white/60">{post.excerpt}</p>
                </div>
                <Badge variant={post.status === "Published" ? "success" : "warning"}>{post.status}</Badge>
              </div>
              <p className="mt-2 text-xs text-white/40">{post.date}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-white/40">
          CMS management is coming soon. These posts are mock content until the editor is connected.
        </p>
      </Card>
    </div>
  );
}
