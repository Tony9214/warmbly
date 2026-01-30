import ExternalLogin from "@/components/auth/external";
import { Link, Outlet } from "react-router-dom";

export default function LoginLayout() {
    return <>
        <h1 className="font-bold text-4xl text-gray-700 mb-6 font-poppins">Log in to Your Account</h1>
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
                New here? Create an account 👉 <Link className="text-blue-500 not-hover:underline" to={"/auth/register"}>Sign up</Link>
            </p>
        </div>
    </>
}
