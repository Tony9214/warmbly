import AuthButton from "@/components/auth/button";
import { TurnstileModal } from "@/components/captcha/TurnstileModal";
import { Input } from "@/components/input";
import { RiArrowRightSLine, RiCheckLine } from "@remixicon/react";
import { useTurnstile as useTurnstileL } from "react-turnstile";
import React from "react";
import useResetPassword from "@/lib/api/hooks/auth/useResetPassword";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { Link } from "react-router-dom";
import Label from "@/components/app/text/Label";

export default function ResetPasswordPage() {
    const turnstile = useTurnstileL();

    const resetPassword = useResetPassword();

    const [mail, setMail] = React.useState<string>("");

    const [turnstileToken, setTurnstileToken] = React.useState<string>("");
    const [captcha, setCaptcha] = React.useState<boolean>(false);

    const [pending, setPending] = React.useState<boolean>(false);


    const [sent, setSent] = React.useState<boolean>(false);

    const TurnstileUse = () => {
        setTurnstileToken("");
        turnstile.reset();
    }

    const submit = async () => {
        if (turnstileToken === "") {
            setCaptcha(true);
        } else {
            setPending(true);
            try {
                await toast.promise(
                    resetPassword.mutateAsync({
                        email: mail,
                        turnstile: turnstileToken,
                    }),
                    {
                        loading: "Loading...",
                        success: "Email successfully sent.",
                        error: (err: AppError) => buildError(err),
                    }
                )
                setSent(true);
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
        {!sent ? <>
            <form onSubmit={submitForm}>
                <div className="flex gap-5 flex-col">
                    <div>
                        <Label htmlFor="email">Email</Label>
                        <Input onChange={(e) => setMail(e.target.value)} id="email" placeholder="Enter your email" />
                    </div>
                </div>
                <div className="flex gap-5 justify-end my-6 items-center">
                    <div>
                        <Link to={"/auth/login"} className="text-blue-500 hover:underline flex gap-4 items-center text-md">
                            Back to Login <RiArrowRightSLine className="w-5" />
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
                                submit()
                            }
                        }
                    }}
                />
                <AuthButton loading={captcha || pending}>
                    Send Link
                </AuthButton>
            </form>
        </> : <>
            <div className="flex flex-col items-center justify-center">
                <div className="bg-green-500/30 px-5 py-4 rounded-full">
                    <RiCheckLine className="w-5 text-green-700" />
                </div>
                <p className="text-green-500 text-lg mt-7">Email has been successfully sent to your address (<b>{mail}</b>)</p>
            </div>
        </>}
    </>
}
