import { useQuery } from "@tanstack/react-query";
import getTimezones from "../../client/app/getTimezones";

export default function useTimezones() {
    return useQuery({
        queryKey: ["timezones"],
        queryFn: () => getTimezones(),
    })
}
