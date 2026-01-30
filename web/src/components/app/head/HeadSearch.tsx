import React from "react"
import Search from "../Search";
import { Loading } from "@/components/loader";
import { RiSendPlaneLine } from "@remixicon/react";

export default function HeadSearch({
    loading,
    onSubmit,
}: {
    loading: boolean,
    onSubmit: (e: React.FormEvent<HTMLFormElement>, search: string) => Promise<void> | void,
}) {
    const [search, setSearch] = React.useState<string>("")

    return (
        <div>
            <form className="w-full flex gap-2 h-full" onSubmit={(e) => onSubmit(e, search)}>
                <Search
                    value={search}
                    onChange={(e) => setSearch(e)}
                />
                <button
                    type="submit"
                    className="bg-blue-500 hover:bg-blue-600 ripple cursor-pointer transition rounded-lg w-20 flex items-center justify-center text-white shadow-md border border-transparent">
                    {loading ? <Loading className="h-4" /> : <RiSendPlaneLine className="h-4" />}
                </button>
            </form>
        </div>
    )
}
