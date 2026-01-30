"use client";

import AuthButton from "@/components/auth/button";
import OTPInput from "@/components/auth/OTP";
import { TurnstileModal } from "@/components/captcha/TurnstileModal";
import { saveTokens } from "@/lib/auth";
import { useTurnstile as useTurnstileL } from "react-turnstile";
import React from "react";
import useLoginConfirm from "@/lib/api/hooks/auth/useLoginConfirm";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import { useNavigate, useParams } from "react-router-dom";

export default function LoginConfirmPage() {
    const searchParams = useParams();
    const navigate = useNavigate();
    const turnstile = useTurnstileL();

    const loginConfirm = useLoginConfirm();

    const mail = searchParams["to"] ?? ""
    const token = searchParams["session"] ?? ""

    const [otp, setOtp] = React.useState<string[]>(Array(6).fill(""));

    const [turnstileToken, setTurnstileToken] = React.useState<string>("");
    const [captcha, setCaptcha] = React.useState<boolean>(false);

    const [pending, setPending] = React.useState(false);

    const TurnstileUse = () => {
        setTurnstileToken("");
        turnstile.reset();
    }

    async function submit() {
        if (pending) {
            return
        } else if (turnstileToken === "") {
            setCaptcha(true);
        } else {
            setPending(true);
            try {
                const resp = await toast.promise(
                    loginConfirm.mutateAsync({
                        session: token,
                        code: otp.map((val) => (val === "" ? "0" : val)).join(""),
                        turnstile: turnstileToken,
                    }),
                    {
                        loading: "Loading...",
                        success: "Successfully authorized.",
                        error: (err: AppError) => buildError(err),
                    }
                )
                saveTokens(Object.fromEntries(
                    Object.entries(resp).map(([key, value]) => [key, String(value)])
                ));
                navigate("/app/emails")
            } finally {
                setPending(false)
                TurnstileUse();
            }
        }
    }

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        await submit()
    }

    return <form onSubmit={submitForm}>
        <p className="mb-9 text-green-600">Email sent to <b>{mail}</b>, please enter the verification code.</p>
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
        <div className="mb-3 flex justify-between">
            <OTPInput value={otp} setValue={setOtp} />
        </div>
        <AuthButton loading={captcha || pending}>
            Sign in
        </AuthButton>
    </form>
}
