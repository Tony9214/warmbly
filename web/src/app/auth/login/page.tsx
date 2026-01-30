import AuthButton from "@/components/auth/button";
import { TurnstileModal } from "@/components/captcha/TurnstileModal";
import { Input, InputSecret } from "@/components/input";
import { RiArrowRightSLine } from "@remixicon/react";
import { useTurnstile as useTurnstileL } from "react-turnstile";
import React from "react";
import toast from "react-hot-toast";
import useLogin from "@/lib/api/hooks/auth/useLogin";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useNavigate, useParams, Link } from "react-router-dom";

function Label({ htmlFor, children }: { htmlFor: string, children: React.ReactNode }) {
    return <label htmlFor={htmlFor} className="block mb-2 text-md font-sans font-bold text-gray-600">
        {children}
    </label>
}

export default function LoginPage() {
    const searchParams = useParams();
    const turnstile = useTurnstileL();
    const navigate = useNavigate();

    const actionType = searchParams["action"] ?? ""

    const [mail, setMail] = React.useState<string>("");
    const [password, setPassword] = React.useState<string>("");

    const [turnstileToken, setTurnstileToken] = React.useState<string>("");
    const [captcha, setCaptcha] = React.useState<boolean>(false);

    const [pending, setPending] = React.useState<boolean>(false);

    const login = useLogin();

    const TurnstileUse = () => {
        setTurnstileToken("");
        turnstile.reset();
    }

    async function submit() {
        if (turnstileToken === "") {
            setCaptcha(true);
        } else {
            setPending(true);
            try {
                const resp = await toast.promise(
                    login.mutateAsync({
                        email: mail,
                        password,
                        turnstile: turnstileToken,
                    }),
                    {
                        loading: "Loading...",
                        error: (err: AppError) => buildError(err),
                    }
                )
                navigate(`/auth/login/confirm?session=${resp.session}&to=${mail}`);
            } finally {
                setPending(false);
                TurnstileUse();
            }
        }
    }

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pending) return;

        await submit()
    }


    return <>
        {(actionType === "0" || actionType === "1") && <p className="text-green-600 mb-6 text-lg">
            {actionType === "0" ? "Account successfully registered." : "Password has been successfully changed."}
        </p>}
        <form onSubmit={submitForm}>
            <div className="flex gap-5 flex-col">
                <div>
                    <Label htmlFor="email">Email</Label>
                    <Input onChange={(e) => setMail(e.target.value)} id="email" placeholder="Enter your email" />
                </div>
                <div>
                    <Label htmlFor="password">Password</Label>
                    <InputSecret onChange={(e) => setPassword(e.target.value)} id="password" placeholder="Enter your Password" />
                </div>
            </div>
            <div className="flex gap-5 justify-end my-6 items-center">
                <div>
                    <Link to={"/auth/forgot-password"} className="text-blue-500 hover:underline flex gap-4 items-center text-md">
                        Forgot password? <RiArrowRightSLine className="w-5" />
                    </Link>
                </div>
            </div>
            <TurnstileModal
                visible={captcha}
                onToken={(t) => {
                    setTurnstileToken(t);
                    if (captcha) {
                        setCaptcha(false);
                        if (turnstileToken) {
                            submit();
                        }
                    }
                }}
            />
            <AuthButton loading={captcha || pending}>
                Sign in
            </AuthButton>
        </form>
    </>
}
