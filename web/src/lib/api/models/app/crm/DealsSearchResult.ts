import type Deal from "@/lib/api/models/app/crm/Deal";

export interface DealsSearchPagination {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
    next_offset?: number | null;
}

export default interface DealsSearchResult {
    data: Deal[];
    pagination: DealsSearchPagination;
}
