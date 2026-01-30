import { useQuery } from "@tanstack/react-query";
import getRoles from "@/lib/api/client/app/admin/roles/getRoles";

export default function useRoles() {
    return useQuery({
        queryKey: ["admin", "roles"],
        queryFn: () => getRoles(),
    })
}
