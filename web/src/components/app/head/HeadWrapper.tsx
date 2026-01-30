import type React from "react";

export default function HeadWrapper({
    children,
}: {
    children: React.ReactNode,
}) {
    return (
        <div className="flex justify-between w-full gap-2">
            {children}
        </div>
    )
}
