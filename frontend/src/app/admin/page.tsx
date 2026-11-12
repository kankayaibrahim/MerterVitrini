import { redirect } from "next/navigation";

interface AdminRootPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminRootPage({ searchParams }: AdminRootPageProps) {
  const resolvedParams = await searchParams;
  const query = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(resolvedParams)) {
    if (typeof rawValue === "string") {
      query.append(key, rawValue);
    } else if (Array.isArray(rawValue)) {
      for (const item of rawValue) {
        query.append(key, item);
      }
    }
  }

  const queryString = query.toString();
  redirect(queryString ? `/admin/dashboard?${queryString}` : "/admin/dashboard");
}
