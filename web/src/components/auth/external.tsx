"use client";

import { RiGithubFill } from "@remixicon/react";
import { Google } from "../svg";
import { API_URL, PopupCenter } from "@/lib/information";


export default function ExternalLogin() {
    return <div className="grid sm:grid-cols-2 gap-3 mt-8">
        <div onClick={() => PopupCenter(`${API_URL}/auth/google/login`, "Google Login")} className="grow border border-gray-300 rounded-lg py-4 px-5 bg-gray-50 flex gap-5 items-center cursor-pointer hover:brightness-98 transition-[brightness]">
            <Google className="w-5" />
            <h1 className="font-medium text-gray-800 font-sans">Sign in with Google</h1>
        </div>
        <div onClick={() => PopupCenter(`${API_URL}/auth/github/login`, "Github Login")} className="grow border border-gray-300 rounded-lg py-4 px-5 bg-gray-50 flex gap-5 items-center cursor-pointer hover:brightness-98 transition-[brightness]">
            <RiGithubFill className="w-5" />
            <h1 className="font-medium text-gray-800 font-sans">Sign in with Github</h1>
        </div>
    </div>
}
