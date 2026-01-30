"use client"

import { RiEyeCloseLine, RiEyeLine } from "@remixicon/react"
import React from "react"

export const Input = ({onChange, placeholder, value, id, name}: {onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, value?: string, id?: string, name?: string}) => {
    return <>
        <input className="block bg-gray-50 border border-gray-300 text-gray-900 text-md rounded-lg focus:border-blue-500 w-full px-4 py-3" type="text" onChange={onChange} placeholder={placeholder} value={value} id={id} name={name}/>
    </>
}

export const InputSecret = ({onChange, placeholder, value, id, name}: {onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder?: string, value?: string, id?: string, name?: string}) => {
    const [eye, setEye] = React.useState<boolean>(false);
    return <div className="relative w-full">
        <input className="block bg-gray-50 border border-gray-300 text-gray-900 text-md rounded-lg focus:border-blue-500 w-full pl-4 pr-15 py-3" type={eye ? "text":"password"} onChange={onChange} placeholder={placeholder} value={value} id={id} name={name}/>
        <div className="absolute right-3 top-[50%] -translate-y-[50%] w-9 h-8 cursor-pointer hover:bg-gray-200 rounded-lg flex items-center justify-center transition-all text-gray-800">
            {eye ? <RiEyeLine className="w-4" onClick={() => setEye(false)}/>:<RiEyeCloseLine className="w-4" onClick={() => setEye(true)}/>}
        </div>
    </div>
}

export const Checkbox = ({id, value, onChange, children}: {id: string, value: boolean, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, children?: React.ReactNode}) => {
    return <div className="flex items-center">
        <input id={id} checked={value} type="checkbox" onChange={onChange} className="w-4.5 h-4.5 text-blue-600 bg-gray-100 border-gray-300 rounded-[1px] focus:ring-blue-500 focus:ring-2"/>
        <label htmlFor={id} className="ms-2 text-sm font-sans text-gray-900">{children}</label>
    </div>
}

export const TextArea = ({onChange, placeholder, value, id, name}: {onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void, placeholder?: string, value?: string, id?: string, name?: string}) => {
    return <>
        <textarea className="block bg-gray-50 border border-gray-300 text-gray-900 text-md rounded-lg focus:border-blue-500 w-full px-4 py-3" onChange={onChange} placeholder={placeholder} value={value} id={id} name={name}/>
    </>
}