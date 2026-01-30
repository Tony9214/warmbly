import type React from "react";

export default function HeadMenu({
    children,
}: {
    children: React.ReactNode,
}) {
    return (
        <div className="flex gap-5">
            {children}
        </div>
    )
}
