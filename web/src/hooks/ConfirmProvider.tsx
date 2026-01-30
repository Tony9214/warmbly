import React from "react";
import { ConfirmContext } from "./context/confirm";

function Title({ children }: { children: React.ReactNode }) {
    return <h1 className="text-xl font-medium font-sans text-center text-red-500">
        {children}
    </h1>
}

export default function ConfirmProvider({ children }: { children: React.ReactNode }) {
    const [visible, setVisible] = React.useState<boolean>(false);
    const [loading, setLoading] = React.useState<boolean>(false);
    const s = React.useRef<() => void | Promise<void>>(null)
    const [text, setText] = React.useState<string>("");

    const show = (text: string, onSubmit: () => void | Promise<void>) => {
        setVisible(true);
        setText(text);
        s.current = onSubmit;
    }

    const [mouseDownOnButton, setMouseDownOnButton] = React.useState(false);
    const handleMouseDown = () => setMouseDownOnButton(true);
    const handleMouseUp = () => {
        if (mouseDownOnButton) {
            setVisible(false)
        }
        setMouseDownOnButton(false);
    };

    return <>
        <ConfirmContext.Provider value={{ show, setShow: setVisible, setLoading }}>
            {children}
            <div className={`bg-black/30 fixed flex inset-0 z-101 items-center justify-center p-1 transition ${visible ? "opacity-100 visible" : "opacity-0 invisible"}`} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp}>
                <div className={`bg-white max-w-xl w-full flex flex-col gap-5 p-5 rounded-md transition ease-bezier duration-300 ${visible ? "scale-100" : "scale-90"}`} onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
                    <Title>Warning</Title>
                    <p className="text-center text-slate-500 font-inter">{text}</p>
                    <div className="flex justify-end mt-2 gap-2">
                        <button onClick={() => setVisible(false)} className="ripple bg-gray-200 hover:bg-gray-300 transition text-gray-500 h-11 px-8 rounded-md cursor-pointer">
                            Cancel
                        </button>
                        <button onClick={loading ? undefined : s.current ?? undefined} className={`ripple ${loading ? "bg-red-600" : "bg-red-500 hover:bg-red-600"} text-white h-11 w-32 rounded-md cursor-pointer transition`}>
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </ConfirmContext.Provider>
    </>
}

