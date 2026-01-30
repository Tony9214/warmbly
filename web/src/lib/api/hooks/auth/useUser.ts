import { useQuery } from "@tanstack/react-query";
import getUser from "../../client/auth/getUser";

export default function useUser() {
    return useQuery({
        queryKey: ["auth", "me"],
        queryFn: () => getUser(),
    })
}
