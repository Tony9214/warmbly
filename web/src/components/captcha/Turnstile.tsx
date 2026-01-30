import * as TurnstileObj from "react-turnstile";

interface Props {
    setToken: (token: string) => void;
}

export default function Turnstile({setToken}: Props) {
    return <>
        <TurnstileObj.default
            sitekey={process.env.NEXT_PUBLIC_TURNSTILE_KEY!}
            onVerify={(token: string) => setToken(token)}
            onExpire={() => setToken("")}
            theme={"light"}
        />
    </>
}