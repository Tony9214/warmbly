"use client";

import Close from '@/components/icons/Close';
import Warning from '@/components/icons/Warning';
import React, { createContext, useContext } from 'react';
import { APP_URL, GOOGLE_BOX_AUTH, OUTLOOK_BOX_AUTH, PopupCenter } from "@/lib/information";
import { RiAddLine, RiArrowRightLine, RiArrowRightSLine, RiCloseLine, RiDownloadLine, RiInbox2Line, RiInformationLine, RiMailAddLine, RiMailLine, RiMailSendLine, RiSearch2Line, RiSearchLine, RiUploadCloud2Line } from "@remixicon/react";
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

interface InboxContextType {
  emails: Inbox[] | null;
  search: string;
  setSearch: (value: string) => void;
  setView: (value: string) => void;
  GetAddresses: (query: string, page: number) => Promise<void>;
}

export const InboxContext = createContext<InboxContextType | undefined>(undefined);

export interface InboxRaw {
  id: string;
  email: string;
  name: string;
  signature_plain: string;
  signature_html: string;
  provider: string;
  status: string;
  last_synced_at: string;
  last_id?: number | null;
  campaign_limit: number;
  min_wait_time: number;
  tracking_domain: string;
  warmup?: string | null;
  warmup_base: number;
  warmup_max: number;
  warmup_increase: number;
  created_at: string;
  updated_at: string;
}

export interface Inbox extends Omit<InboxRaw, 'last_synced_at' | 'warmup' | 'created_at' | 'updated_at'> {
  lastSyncedAt: Date;
  warmup?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const inbox1: Inbox = {
  id: 'inbox_01hr7k9',
  email: 'sales@acme.io',
  name: 'ACME Sales',
  signature_plain: 'Best,\nJohn from ACME',
  signature_html: '<p>Best,<br>John from <strong>ACME</strong></p>',
  provider: 'smtp_imap',
  status: 'active',
  lastSyncedAt: new Date('2024-08-04T12:00:00Z'),
  last_id: 12345,
  campaign_limit: 200,
  min_wait_time: 60,
  tracking_domain: 'track.acme.io',
  warmup: new Date('2024-08-03T09:30:00Z'),
  warmup_base: 10,
  warmup_max: 50,
  warmup_increase: 5,
  createdAt: new Date('2024-07-10T08:00:00Z'),
  updatedAt: new Date('2024-08-04T11:55:00Z'),
};

const inbox2: Inbox = {
  id: 'inbox_02xyz',
  email: 'support@example.com',
  name: 'Support',
  signature_plain: 'Cheers,\nSupport team',
  signature_html: '<p>Cheers,<br>Support team</p>',
  provider: 'outlook',
  status: 'paused',
  lastSyncedAt: new Date('2024-08-03T22:00:00Z'),
  last_id: null,
  campaign_limit: 100,
  min_wait_time: 90,
  tracking_domain: 'mail.example.com',
  warmup: null,
  warmup_base: 5,
  warmup_max: 30,
  warmup_increase: 3,
  createdAt: new Date('2024-07-15T10:00:00Z'),
  updatedAt: new Date('2024-08-03T21:45:00Z'),
};

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

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
    const [emails, setEmails] = React.useState<Inbox[] | null>([inbox1, inbox2]);
    const [search, setSearch] = React.useState<string>("");
    const [view, setView] = React.useState<string>("");

    const GetAddresses = async (query: string, page: number) => {
        
    }

    return (
        <InboxContext.Provider value={{emails, search, setSearch, setView, GetAddresses}}>
            {children}
        </InboxContext.Provider>
    );
};


export function useInbox() {
  return useContext(InboxContext);
}

export default SocketProvider;