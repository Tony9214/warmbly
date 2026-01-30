import React from "react";
import { Loading } from "../loader";

export default function AuthButton({children, loading}:{children: React.ReactNode, loading: boolean}) {
    return <button type="submit" className="bg-blue-500 flex justify-center items-center text-gray-50 w-full rounded-lg text-lg font-sans h-12 hover:bg-blue-600 cursor-pointer transition-bg">
        {!loading ? children: <>
            <Loading className="h-7 text-white"/>
        </>}
    </button>
}