import { RiSearchLine } from "@remixicon/react";

export default function Search({value, onChange}:{value: string, onChange: (v: string) => void}){
    return (
        <div className="bg-white w-full h-full sm:max-w-sm flex px-3 gap-1 items-center shadow-md border border-gray-200 rounded-md">
            <RiSearchLine className="w-5 shrink-0 text-gray-500"/>
            <input 
            className="text-gray-600 grow font-sans outline-none py-1.5"
            placeholder="Search..."
            value={value} onChange={(e) => onChange(e.target.value)}
            />
        </div>
    )
}