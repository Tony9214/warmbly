import AuthButton from "@/components/auth/button";
import { TurnstileModal } from "@/components/captcha/TurnstileModal";
import DefaultHref from "@/components/default-link";
import { Checkbox, Input, InputSecret } from "@/components/input";
import { WEBSITE_URL } from "@/lib/information";
import { useTurnstile as useTurnstileL } from "react-turnstile";
import React from "react";
import { useNavigate } from "react-router-dom";
import useRegister from "@/lib/api/hooks/auth/useRegister";
import toast from "react-hot-toast";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";

function Label({ htmlFor, children }: { htmlFor: string, children: React.ReactNode }) {
    return <label htmlFor={htmlFor} className="block mb-2 text-md font-sans font-bold text-gray-600">
        {children}
    </label>
}

export default function RegisterPage() {
    const navigate = useNavigate();

    const register = useRegister();
    const turnstile = useTurnstileL();

    const [mail, setMail] = React.useState<string>("");
    const [password, setPassword] = React.useState<string>("");
    const [password2, setPassword2] = React.useState<string>("");
    const [acceptTerms, setAcceptTerms] = React.useState<boolean>(false);

    const [turnstileToken, setTurnstileToken] = React.useState<string>("");
    const [captcha, setCaptcha] = React.useState<boolean>(false);

    const [pending, setPending] = React.useState<boolean>(false);

    const TurnstileUse = () => {
        setTurnstileToken("");
        turnstile.reset();
    }

    const submit = async () => {
        if (pending) {
            return
        } else if (!acceptTerms) {
            toast.error("Please accept the Terms of Service and Privacy Policy to continue.")
        } else if (turnstileToken === "") {
            setCaptcha(true);
        } else if (password !== password2) {
            toast.error("Passwords don’t match. Please make sure you type the same password twice.")
        } else {
            setPending(true);
            try {
                const resp = await toast.promise(
                    register.mutateAsync({
                        email: mail,
                        password,
                        turnstile: turnstileToken,
                    }),
                    {
                        loading: "Loading...",
                        error: (err: AppError) => buildError(err),
                    }
                )

                navigate(`/auth/register/confirm?session=${resp.session}&to=${mail}`)
            } finally {
                setPending(false);
                TurnstileUse();
            }
        }
    }

    const submitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        await submit()
    }



    return <>
        <form onSubmit={submitForm}>
            <div className="flex gap-5 flex-col">
                <div>
                    <Label htmlFor="email">Email</Label>
                    <Input onChange={(e) => setMail(e.target.value)} id="email" placeholder="Enter your email" />
                </div>
                <div>
                    <Label htmlFor="password">Password</Label>
                    <InputSecret onChange={(e) => setPassword(e.target.value)} value={password} id="password" placeholder="Enter your Password" />
                </div>
                <div>
                    <Label htmlFor="password2">Confirm Password</Label>
                    <InputSecret onChange={(e) => setPassword2(e.target.value)} value={password2} id="password2" placeholder="Confirm your Password" />
                </div>
            </div>
            <div className="flex gap-5 justify-between mt-9 items-center">
                <Checkbox id="termsandservice" value={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}>Accept our <DefaultHref href={`${WEBSITE_URL}/terms`}>Terms of Service</DefaultHref> and <DefaultHref href={`${WEBSITE_URL}/privacy`}>Privacy Policy</DefaultHref></Checkbox>
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
            <div className="mt-10">
                <AuthButton loading={captcha || pending}>
                    Register
                </AuthButton>
            </div>
        </form>
    </>
}
