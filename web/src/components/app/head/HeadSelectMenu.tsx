import useClickOutside from "@/hooks/useClickOutside";
import React from "react";
import SelectMenu from "../popup/select/SelectMenu";

export default function HeadSelectMenu({
    children,
    icon,
    title,
}: {
    children: React.ReactNode,
    icon: React.ReactNode,
    title: string,
}) {
    const [show, setShow] = React.useState<boolean>(false);
    const ref = React.useRef<HTMLDivElement>(null);

    useClickOutside(ref, () => setShow(false))

    React.useEffect(() => {
        setShow(false);
    }, [title])

    return (

        <div className="relative" ref={ref}>
            <div onClickCapture={() => setShow(true)} className="ripple w-60 px-4 py-2 cursor-pointer shadow-md rounded-md font-sans transition text-gray-500 border border-gray-200 flex item-center gap-2 bg-white hover:bg-gray-100">
                {icon}
                <div>{title}</div>
            </div>
            <SelectMenu show={show}>
                {children}
            </SelectMenu>
        </div>
    )
}
