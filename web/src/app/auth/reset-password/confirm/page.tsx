import AuthButton from "@/components/auth/button";
import { TurnstileModal } from "@/components/captcha/TurnstileModal";
import { Input } from "@/components/input";
import { is64ByteHex } from "@/lib/token";
import { RiArrowRightSLine, RiErrorWarningLine } from "@remixicon/react";
import { useTurnstile as useTurnstileL } from "react-turnstile";
import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import useResetPasswordConfirm from "@/lib/api/hooks/auth/useResetPasswordConfirm";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import Label from "@/components/app/text/Label";

export default function ResetPasswordConfirmPage() {
    const searchParams = useParams();
    const navigate = useNavigate();
    const turnstile = useTurnstileL();

    const token = searchParams["token"] ?? ""

    const resetPasswordConfirm = useResetPasswordConfirm();

    const [password, setPassword] = React.useState<string>("");
    const [password2, setPassword2] = React.useState<string>("");

    const [turnstileToken, setTurnstileToken] = React.useState<string>("");
    const [captcha, setCaptcha] = React.useState<boolean>(false);

    const [pending, setPending] = React.useState<boolean>(false);

    const TurnstileUse = () => {
        setTurnstileToken("");
        turnstile.reset();
    }

    const submit = async () => {
        if (turnstileToken === "") {
            setCaptcha(true);
        } if (password !== password2) {
            toast.error("Passwords don’t match. Please make sure you type the same password twice.")
        } else {
            setPending(true);
            try {
                await toast.promise(
                    resetPasswordConfirm.mutateAsync({
                        token,
                        password,
                        turnstile: turnstileToken,
                    }),
                    {
                        loading: "Loading...",
                        success: "Password successfully changed",
                        error: (err: AppError) => buildError(err),
                    }
                )

                navigate("/auth/login?action=1")
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
        {is64ByteHex(token) ? <>
            <form onSubmit={submitForm}>
                <div className="flex gap-5 flex-col">
                    <div>
                        <Label htmlFor="password">New Password</Label>
                        <Input value={password} onChange={(e) => setPassword(e.target.value)} id="password" placeholder="Enter your password" />
                    </div>
                    <div>
                        <Label htmlFor="password2">Confirm Password</Label>
                        <Input value={password2} onChange={(e) => setPassword2(e.target.value)} id="password2" placeholder="Confirm Password" />
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
                            submit();
                        }
                    }}
                />
                <AuthButton loading={captcha || pending}>
                    Reset Password
                </AuthButton>
            </form>
        </> : <>
            <div className="flex flex-col items-center justify-center">
                <div className="bg-red-500/30 px-5 py-4 rounded-full">
                    <RiErrorWarningLine className="w-5 text-red-700" />
                </div>
                <p className="text-red-500 text-lg mt-7">Reset token must be valid.</p>
            </div>
        </>}
    </>
}
