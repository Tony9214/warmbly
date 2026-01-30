import ExternalLogin from "@/components/auth/external";
import DefaultHref from "@/components/default-link";
import { WEBSITE_URL } from "@/lib/information";
import { Outlet } from "react-router-dom";

export default function RegisterLayout() {
    return <>
        <h1 className="font-bold text-4xl text-gray-700 mb-6 font-poppins">Create an Account</h1>
        <p className="text-gray-500 font-sans text-lg mb-9">Welcome back! Choose your preferred sign-in method.</p>
        <Outlet />
        <div className="flex items-center gap-5 mt-8">
            <hr className="grow text-gray-300" />
            <p className="text-gray-400 font-sans">or</p>
            <hr className="grow text-gray-300" />
        </div>
        <ExternalLogin />
        <div className="mt-18">
            <p className="text-center text-gray-500 font-sans">
                By signing in with an external provider, you agree to our <DefaultHref href={`${WEBSITE_URL}/terms`}>Terms of Service</DefaultHref> and <DefaultHref href={`${WEBSITE_URL}/privacy`}>Privacy Policy</DefaultHref>. <br />
                Already have an account? Sign in 👉 <DefaultHref href={"/auth/login"}>Log in</DefaultHref>
            </p>
        </div>
    </>
}
