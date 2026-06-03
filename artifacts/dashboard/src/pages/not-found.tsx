import { Link } from "wouter";

export default function NotFoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link href="/" className="text-primary underline underline-offset-4">
        Back to Overview
      </Link>
    </div>
  );
}
