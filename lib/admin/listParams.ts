/** Server-side list state from URL search params: page, limit, search, sort and filters. */
export interface ListParams<S extends string> {
  page: number;
  limit: number;
  skip: number;
  search: string;
  sort: S;
  filters: Record<string, string>;
}

type RawParams = Record<string, string | string[] | undefined>;

export function parseListParams<S extends string>(raw: RawParams, options: { sorts: readonly S[]; defaultSort: S; filters?: readonly string[]; limit?: number }): ListParams<S> {
  const one = (key: string) => {
    const value = raw[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const limit = options.limit ?? 20;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one("page"), 10) || 1));
  const sortValue = one("sort") as S;
  const filters: Record<string, string> = {};
  for (const key of options.filters ?? []) {
    const value = one(key);
    if (value && value.length <= 60) filters[key] = value;
  }
  return {
    page,
    limit,
    skip: (page - 1) * limit,
    search: one("q").slice(0, 100),
    sort: options.sorts.includes(sortValue) ? sortValue : options.defaultSort,
    filters,
  };
}
