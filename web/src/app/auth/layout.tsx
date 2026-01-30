import { APP_URL } from "@/lib/information";
import React from "react";
import { Outlet, useNavigate } from "react-router-dom";


export default function AuthLayout() {
    const navigate = useNavigate();

    React.useEffect(() => {
        const receiveMessage = (event: MessageEvent) => {
            if (event.origin !== APP_URL) return;

            if (event.data?.type === 'auth') {
                navigate("/app/emails")
            }
        };

        window.addEventListener('message', receiveMessage);

        return () => {
            window.removeEventListener('message', receiveMessage);
        };
    }, [navigate])

    return <>
        <div className="w-full h-screen flex">
            <div className="grow bg-blue-500 rounded-r-4xl mr-5 hidden md:flex overflow-hidden">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-full h-full" viewBox="0 0 300 600" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="flameGrad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#FF5722" />
                            <stop offset="100%" stopColor="#FF9800" />
                        </linearGradient>
                    </defs>
                    <path fill="url(#flameGrad)" d="
                        M0,600 
                        C80,500 60,400 100,300 
                        C130,200 90,100 130,0 
                        L0,0 Z" />
                </svg>
            </div>
            <div className="max-w-5xl w-full bg-white shadow-xl overflow-y-scroll py-20">
                <div className="max-w-lg w-full mx-auto px-5">
                    <Outlet />
                </div>
            </div>
        </div>
    </>
}
