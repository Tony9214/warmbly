"use client";

import Close from '@/components/icons/Close';
import Warning from '@/components/icons/Warning';
import React, { createContext, useContext } from 'react';
import { APP_URL, GOOGLE_BOX_AUTH, OUTLOOK_BOX_AUTH, PopupCenter, TRACKING_DOMAIN } from "@/lib/information";
import { RiAddLine, RiArrowRightLine, RiArrowRightSLine, RiCloseLine, RiDownloadLine, RiFireLine, RiInbox2Line, RiInformationLine, RiMailAddLine, RiMailLine, RiMailSendLine, RiMeteorLine, RiPenNibLine, RiPriceTag3Line, RiSearch2Line, RiSearchLine, RiSendPlaneLine, RiUploadCloud2Line, RiUser3Line, RiUser4Line } from "@remixicon/react";
import Link from "next/link";
import { AddBox, AddBoxFeature, AddBoxFeatures, AddBoxTop, AddBoxTopTitle, BackTop, Step, StepButton } from "../app/app/emails/_add";
import { Google, Logo, Outlook } from "@/components/svg";
import DefaultHref from "@/components/default-link";
import CopyNote from "@/components/app/note";
import { Input, InputSecret } from "@/components/input";
import Papa, { ParseResult } from 'papaparse';
import { AddBoxProvider } from './AddBoxProvider';
import { APIError, Call } from '@/lib/api';
import { useError } from './ErrorProvider';
import MiniInput from '@/components/app/popup/MiniInput';
import EmailEditor from '@/components/app/EmailEditor';
import ColorBox from '@/components/app/colors/ColorBox';
import ColorPanel from '@/components/app/colors/ColorPanel';
import Selector from '@/components/app/popup/select/Selector';
import MiniNumberInput from '@/components/app/popup/MiniNumberInput';
import { Loading } from '@/components/loader';
import { AnimatePresence, motion } from 'framer-motion';
import {twColors} from "tailwindv4-colors"
import TagSelector from '@/components/app/popup/select/TagSelector';

interface InboxContextType {
  emails: Inbox[] | null;
  search: string;
  setSearch: (value: string) => void;
  setView: (value: string) => void;
  GetAddresses: (query: string, page: number) => Promise<void>;
  changeAddress: (email: Inbox) => void;
}

export const InboxContext = createContext<InboxContextType | undefined>(undefined);

export interface InboxRaw {
  id: string;
  email: string;
  name: string;
  signature_plain: string;
  signature_html: string;
  signature_sync: boolean;
  signature_code: boolean;
  tags: string[];
  provider: string;
  status: string;
  last_synced_at: string;
  last_id?: number | null;
  campaign_limit: number;
  min_wait_time: number;
  reply_to: string;
  tracking_domain: string;
  warmup?: string | null;
  warmup_base: number;
  warmup_max: number;
  warmup_increase: number;
  warmup_reply_rate: number;
  created_at: string;
  updated_at: string;
}

export interface Inbox extends Omit<InboxRaw, 'last_synced_at' | 'warmup' | 'created_at' | 'updated_at'> {
  lastSyncedAt: Date;
  warmup?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function parseInbox(raw: InboxRaw): Inbox {
  return {
    ...raw,
    lastSyncedAt: new Date(raw.last_synced_at),
    warmup: raw.warmup ? new Date(raw.warmup) : null,
    createdAt: new Date(raw.created_at),
    updatedAt: new Date(raw.updated_at),
  };
}

export function parseInboxes(raw: InboxRaw[]): Inbox[] {
  return raw.map((i) => parseInbox(i))
}

export function Head({children, icon}:{children: React.ReactNode, icon: React.ReactNode}){
    return <>
        <div className='flex gap-4 items-center mt-6'>
            {icon}
            <h1 className='flex items-center gap-4 font-inter text-[18px]'>{children}</h1>
        </div>
        <hr className='text-gray-200 my-4'/>
    </>
}

export function Title({children}:{children: React.ReactNode}){
    return <h1 className='text-gray-800 font-medium mb-1 text-[18px] font-inter'>
        {children}
    </h1>
}

export function SubTitle({children}: {children: React.ReactNode}){
    return <p className='text-gray-500 text-[14px] font-inter mb-2'>
        {children}
    </p>
}

export const InboxProvider = ({ children }: { children: React.ReactNode }) => {
    const { showError } = useError();
    const [emails, setEmails] = React.useState<Inbox[] | null>(null);
    const [search, setSearch] = React.useState<string>("");
    const [view, setView] = React.useState<string>("");

    const GetAddresses = async (query: string, page: number) => {
        setEmails(null)
        try {
            const resp: InboxRaw[] = await Call("/emails?q="+query)
            const inboxes = parseInboxes(resp)
            setEmails(inboxes)
        } catch (err) {
            if (err instanceof APIError) {
                showError(err.message, err.body.message)
            } else {
                showError("Client Error", `${err}`)
            }
        } finally {
            setEmails(bef => bef === null ? []:bef)
        }
    }

    const [mouseDownOnButton, setMouseDownOnButton] = React.useState(false);
    const handleMouseDown = () => setMouseDownOnButton(true);
    const handleMouseUp = () => {
        if (mouseDownOnButton) {
            setView("")
        }
        setMouseDownOnButton(false);
    };

    const changeAddress = (inbox: Inbox) => {
        setEmails(bef => bef ? bef.map((b) => b.id === inbox.id ? inbox:b):null)
    }

    return (
        <InboxContext.Provider value={{emails, search, setSearch, setView, GetAddresses, changeAddress}}>
            <AddBoxProvider func={async() => {
                setSearch("")
                await GetAddresses("", 0)
            }}>
                {children}
            </AddBoxProvider>
            {(() => {
                const preview = emails?.find((e) => e.id === view)
                const [activeTab, setActiveTab] = React.useState("tab1");
                const [dataLoad, setDataLoad] = React.useState<boolean>(false);
                const [newData, setNewData] = React.useState<Inbox | null>(null)
                const submitRef = React.useRef<() => Promise<void>>(null)
                const [changed, setChanged] = React.useState<boolean>(false);
                
                React.useEffect(() => {
                    if(preview){
                        setNewData(preview)
                    }
                }, [preview])

                const tabData = {
                    ...(preview && newData && {
                        tab1: {
                            title: "Default Settings",
                            content: <DefaultSettings preview={preview} setNewData={setNewData} newData={newData} setChanged={setChanged} setLoad={setDataLoad} submitRef={submitRef}/>,
                        },
                    }),
                };

                return <>
                    <div onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className={`fixed inset-0 z-100 flex justify-end bg-slate-950/45 transition ${preview ? "visible opacity-100":"invisible opacity-0"}`}>
                        <div onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} className={`flex flex-col bg-white relative w-200 max-w-[95%] h-full transition-transform ${preview ? "translate-x-0":"translate-x-100"}`}>
                            {preview && <>
                                <div className='overflow-y-scroll p-10 grow'>
                                    <div className='flex justify-between gap-10'>
                                        <p className='text-gray-400 mb-3 break-all'>ID: {preview.id}</p>
                                        <div onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className='text-gray-300 hover:text-gray-400 cursor-pointer'>
                                            <RiCloseLine className='w-5'/>
                                        </div>
                                    </div>
                                    <h1 className='text-slate-600 font-medium text-lg break-all mb-5'>{preview.email}</h1>
                                    <div className="flex space-x-4 border-b border-gray-200 mb-4">
                                        {Object.keys(tabData).map((key) => (
                                        <button
                                            key={key}
                                            onClick={() => setActiveTab(key)}
                                            className={`pb-2 px-4 font-medium cursor-pointer border-b-2 transition ${activeTab === key ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                                        >
                                            {tabData[key as keyof typeof tabData]?.title}
                                        </button>
                                        ))}
                                    </div>

                                    <div className="mt-4">{tabData[activeTab as keyof typeof tabData]?.content}</div>
                                </div>
                                    <div
                                        className='bg-white relative shrink-0 py-3 px-10 border-t shadow-xl border-gray-200 bottom-0 left-0 w-full h-17 flex gap-2'
                                    >
                                        <button 
                                        onClick={async () => {
                                            if (submitRef.current){
                                                await submitRef.current();
                                            }
                                        }}
                                        className='ripple w-46 cursor-pointer text-blue-500 transition bg-blue-200 hover:bg-blue-300 px-8 py-2 rounded-md'
                                        >
                                            {dataLoad ? <Loading className='h-5' color={twColors.blue[500]}/>:"Save Changes"}
                                        </button>
                                        <button 
                                        onClick={() => {}}
                                        className='ripple cursor-pointer text-slate-500 transition bg-gray-200 hover:bg-gray-300 px-8 py-2.5 rounded-md'
                                        >
                                            Cancel
                                        </button>
                                        <AnimatePresence>
                                            {!changed && (
                                                <motion.div 
                                                 className='absolute inset-0 bg-white/50 cursor-not-allowed'
                                                 transition={{type: "spring", duration: 0.1, bounce: 0.3}}
                                                 initial={{opacity: 0}}
                                                 animate={{opacity: 1}}
                                                 exit={{opacity: 0}}
                                                />
                                            )}
                                        </AnimatePresence>
                                    </div>
                            </>}
                        </div>
                    </div>
                </>
            })()}
        </InboxContext.Provider>
    );
};

const DefaultSettings = ({
        preview, 
        newData, 
        setNewData, 
        setChanged, 
        setLoad,
        submitRef
    }:{
        preview: Inbox, 
        newData: Inbox, 
        setNewData: React.Dispatch<React.SetStateAction<Inbox | null>>, 
        setChanged: React.Dispatch<React.SetStateAction<boolean>>, 
        setLoad: React.Dispatch<React.SetStateAction<boolean>>,
        submitRef: React.RefObject<(() => Promise<void>) | null>
    }
) => {
    const inbox = useInbox();
    const { showError } = useError();
    React.useEffect(() => {
        if (
            newData.name !== preview.name ||
            newData.signature_html !== preview.signature_html ||
            newData.signature_plain !== preview.signature_plain || 
            newData.signature_sync !== preview.signature_sync ||
            newData.signature_code !== preview.signature_code ||
            newData.tags !== preview.tags ||
            newData.campaign_limit !== preview.campaign_limit ||
            newData.min_wait_time !== preview.min_wait_time ||
            newData.reply_to !== preview.reply_to ||
            newData.warmup_base !== preview.warmup_base ||
            newData.warmup_increase !== preview.warmup_increase || 
            newData.warmup_max !== preview.warmup_max || 
            newData.warmup_reply_rate !== preview.warmup_reply_rate
        ) {
            setChanged(true)
        } else {
            setChanged(false)
        }
    }, [preview, newData])

    React.useEffect(() => {
        setNewData(preview)
    }, [preview])

    const [trackLoad, setTrackLoad] = React.useState<boolean>(false);

    submitRef.current = async () => {
        try {
            setLoad(true);
            const data = {
                ...(newData.name !== preview.name && { name: newData.name }),

                ...(newData.signature_plain !== preview.signature_plain && { signature_plain: newData.signature_plain }),
                ...(newData.signature_html !== preview.signature_html && { signature_html: newData.signature_html }),
                ...(newData.signature_sync !== preview.signature_sync && { signature_sync: newData.signature_sync }),
                ...(newData.signature_code !== preview.signature_code && { signature_code: newData.signature_code }),

                ...(newData.campaign_limit !== preview.campaign_limit && { campaign_limit: newData.campaign_limit }),
                ...(newData.min_wait_time !== preview.min_wait_time && { min_wait_time: newData.min_wait_time }),
                ...(newData.reply_to !== preview.reply_to && { reply_to: newData.reply_to }),

                ...(newData.warmup_base !== preview.warmup_base && { warmup_base: newData.warmup_base }),
                ...(newData.warmup_max !== preview.warmup_max && { warmup_max: newData.warmup_max }),
                ...(newData.warmup_increase !== preview.warmup_increase && { warmup_increase: newData.warmup_increase }),
                ...(newData.warmup_reply_rate !== preview.warmup_reply_rate && { warmup_reply_rate: newData.warmup_reply_rate }),

                ...(newData.tags !== preview.tags && { tags: newData.tags }),
            }
            console.log(data, newData.signature_html)
            const resp: InboxRaw = await Call(`/emails/${preview.id}`, "PATCH", data)
            const n = parseInbox(resp)
            inbox?.changeAddress(n)
        } catch (err) {
            if (err instanceof APIError) {
                showError(err.message, err.body.message)
            } else {
                showError("Client Error", `${err}`)
            }
        } finally {
            setLoad(false);
        }
    };

    return (<>
        <div className='grid gap-2'>
            {preview.provider === "smtp_imap" && (
                <>
                    <div>
                        <Head icon={<RiUser3Line className='w-5 h-5'/>}>Sender Profile</Head>
                        <SubTitle>Full Name</SubTitle>
                        <MiniInput value={newData.name} placeholder='"First Name" "Last Name"' onChange={(e) => setNewData(bef => bef ? ({...bef, name: e.target.value}):null)}/>
                    </div>
                </>
            )}
            <div>
                <Head icon={<RiPenNibLine className='w-5 h-5'/>}>Signature</Head>
                <div className='overflow-x-scroll sm:overflow-x-visible pb-1'>
                    <EmailEditor
                        id='inbox-edit-sync'
                        htmlText={newData.signature_html}
                        setHtmlText={(v) => {
                            setNewData((prev) => prev ? ({ ...prev, signature_html: v }):null);
                        }}
                        plainText={newData.signature_plain}
                        setPlainText={(v) => {
                            setNewData((prev) => prev ? ({ ...prev, signature_plain: v }):null);
                        }}
                        sync={newData.signature_sync}
                        setSync={(v) => {
                            setNewData((prev) => prev ? ({ ...prev, signature_sync: v }):null);
                        }}
                        code={newData.signature_code}
                        setCode={(v) => {
                            setNewData((prev) => prev ? ({ ...prev, signature_code: v }):null);
                        }}
                    />
                </div>
            </div>
            <div>
                <Head icon={<RiPriceTag3Line className='w-5 h-5'/>}>Tags</Head>
                <TagSelector 
                 selected={newData.tags} 
                 onAdd={(v) => {
                    setNewData((prev) => prev ? ({...prev, tags: [...prev.tags, v]}):null)
                 }}
                 onRemove={(v) => {
                    setNewData((prev) => prev ? ({...prev, tags: prev.tags.filter((t) => t !== v)}):null)
                 }}
                 />
            </div>
            <div>
                <Head icon={<RiSendPlaneLine className='w-5 h-5'/>}>Campaigns</Head>
                <div className='grid md:grid-cols-2 gap-5'>
                    <div>
                        <Title>Daily Campaign Limit</Title>
                        <SubTitle>Daily sending limit</SubTitle>
                        <div className='flex gap-3 items-center'>
                            <div className='max-w-30'>
                                <MiniNumberInput placeholder='30' value={newData.campaign_limit} onChange={(e) => setNewData(bef => bef ? ({...bef, campaign_limit: e.target.valueAsNumber}):null)}/>
                            </div>
                            <span className='text-slate-600 font-inter text-sm'>email(s)</span>
                        </div>
                    </div>
                    <div>
                        <Title>Minimum Wait Time</Title>
                        <SubTitle>Minimum time gap between emails</SubTitle>
                        <div className='flex gap-3 items-center'>
                            <div className='max-w-30'>
                                <MiniNumberInput placeholder='10' value={newData.min_wait_time} onChange={(e) => setNewData(bef => bef ? ({...bef, min_wait_time: e.target.valueAsNumber}):null)}/>
                            </div>
                            <span className='text-slate-600 font-inter text-sm'>minute(s)</span>
                        </div>
                    </div>
                    <div>
                        <SubTitle>Reply-to</SubTitle>
                        <MiniInput placeholder='support@example.com' value={newData.reply_to} onChange={(e) => setNewData(bef => bef ? ({...bef, reply_to: e.target.value}):null)}/>
                    </div>
                </div>
            </div>
            <div>
                <Head icon={<RiMeteorLine className='w-5 h-5'/>}>
                    Tracking Domain
                    <span className='bg-blue-500 uppercase text-white text-sm py-1 px-2 rounded-md tracking-widest'>Must-have</span>
                </Head>
                <SubTitle>Track open rates, click rates through your own domain</SubTitle>
                <div className='grid gap-2 p-4 rounded-md bg-gray-100 mb-4'>
                    <div><b>Record Type</b>: CNAME</div>
                    <div><b>Host</b>: prox</div>
                    <div><b>Value</b>: {TRACKING_DOMAIN}</div>
                </div>
                <SubTitle>Tracking domain:</SubTitle>
                <MiniInput placeholder='prox.yourdomain.com' value={newData.tracking_domain} onChange={(e) => setNewData(bef => bef ? ({...bef, tracking_domain: e.target.value}):null)}/>
                <button
                 className={`ripple flex items-center justify-center h-10 w-30 transition duration-200 ${preview.tracking_domain === newData.tracking_domain ? "opacity-30 cursor-not-allowed":"hover:bg-blue-200 cursor-pointer"} bg-blue-100 text-blue-500 rounded-lg mt-5`}
                 onClick={() => setTrackLoad(true)}
                >
                    {trackLoad ? (<Loading className='h-5' color={twColors.blue[500]}/>):"Check Status"}
                </button>
            </div>
            <div>
                <Head icon={<RiFireLine className='w-5 h-5'/>}>Email Warmup</Head>
                <div className='grid md:grid-cols-2 gap-y-5 gap-x-15'>
                    <div>
                        <Title>Warmup Start</Title>
                        <SubTitle>Starting amount per day</SubTitle>
                        <div className='flex gap-3 items-center'>
                            <div className='max-w-30'>
                                <MiniNumberInput placeholder='30' value={newData.warmup_base} onChange={(e) => setNewData(bef => bef ? ({...bef, warmup_base: e.target.valueAsNumber}):null)}/>
                            </div>
                            <span className='text-slate-600 font-inter text-sm'>email(s)</span>
                        </div>
                    </div>
                    <div>
                        <Title>Daily Increase</Title>
                        <SubTitle>Warmup limit increase</SubTitle>
                        <div className='flex gap-3 items-center'>
                            <div className='max-w-30'>
                                <MiniNumberInput placeholder='10' value={newData.warmup_increase} onChange={(e) => setNewData(bef => bef ? ({...bef, warmup_increase: e.target.valueAsNumber}):null)}/>
                            </div>
                            <span className='text-slate-600 font-inter text-sm'>minute(s)</span>
                        </div>
                    </div>
                    <div>
                        <Title>Reply Rate %</Title>
                        <SubTitle>Default: 30</SubTitle>
                        <MiniNumberInput placeholder='30' value={newData.warmup_reply_rate} onChange={(e) => setNewData(bef => bef ? ({...bef, warmup_reply_rate: e.target.valueAsNumber}):null)}/>
                    </div>
                    <div>
                        <Title>Daily Warmup limit</Title>
                        <SubTitle>Max emails per day</SubTitle>
                        <div className='flex gap-3 items-center'>
                            <div className='max-w-30'>
                                <MiniNumberInput placeholder='10' value={newData.warmup_max} onChange={(e) => setNewData(bef => bef ? ({...bef, warmup_max: e.target.valueAsNumber}):null)}/>
                            </div>
                            <span className='text-slate-600 font-inter text-sm'>minute(s)</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </>)
}

export function useInbox() {
  return useContext(InboxContext);
}

export default InboxProvider;