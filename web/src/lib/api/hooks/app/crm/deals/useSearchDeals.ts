import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import type SearchDeals from "@/lib/api/models/app/crm/SearchDeals";
import type DealsSearchResult from "@/lib/api/models/app/crm/DealsSearchResult";
import searchDeals from "@/lib/api/client/app/crm/deals/searchDeals";

interface UseSearchDealsProps {
    filters: SearchDeals;
    limit?: number;
    enabled?: boolean;
}

// Cross-pipeline deals fetch. Offset-paginated (the backend uses offset rather
// than a keyset cursor so nullable value/close-date sorts don't drop rows), so
// the page param is the next offset. Pages flatten into a single `deals` list
// and `total` comes straight off the server so the UI can show "N of M".
export default function useSearchDeals({ filters, limit = 50, enabled = true }: UseSearchDealsProps) {
    const queryResult = useInfiniteQuery<
        DealsSearchResult,
        Error,
        InfiniteData<DealsSearchResult, number>,
        [string, string, string, SearchDeals, number],
        number
    >({
        queryKey: ["crm", "deals", "search", filters, limit],
        queryFn: async ({ pageParam }) => searchDeals(filters, pageParam, limit),
        initialPageParam: 0,
        getNextPageParam: (lastPage) =>
            lastPage.pagination.has_more ? (lastPage.pagination.next_offset ?? undefined) : undefined,
        staleTime: 30_000,
        enabled,
    });

    const deals = queryResult.data?.pages
        .flatMap((p) => p.data ?? [])
        .filter((d): d is NonNullable<typeof d> => d != null);

    const total = queryResult.data?.pages[0]?.pagination.total ?? 0;

    return { ...queryResult, deals, total };
}
