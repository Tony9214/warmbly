import { Loading } from "@/components/loader";
import { RiAddLine, RiFolderLine } from "@remixicon/react";
import { AnimatePresence } from "framer-motion";
import React from "react";
import { twColors } from "tailwindv4-colors";
import { useUserProfile } from "@/hooks/context/user";
import ModalBase from "./components/ModalBase";
import ModalSplit from "./components/ModalSplit";
import ModalDnd from "./components/ModalDnd";
import toast from "react-hot-toast";
import { CREATED, CREATING, SAVING, SUCCESS } from "@/lib/information";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import ModalBox from "./components/ModalBox";
import ModalAddBox from "./components/ModalAddBox";
import useMoveTag from "@/lib/api/hooks/app/tags/useMoveTag";
import useDeleteTag from "@/lib/api/hooks/app/tags/useDeleteTag";
import useUpdateTag from "@/lib/api/hooks/app/tags/useUpdateTag";
import type Tag from "@/lib/api/models/app/Tag";
import useCreateTag from "@/lib/api/hooks/app/tags/useCreateTag";

export default function TagsModal() {
    const user = useUserProfile();
    const createTag = useCreateTag();

    const [load, setLoad] = React.useState<boolean>(false);
    const [expandedFolderId, setExpandedFolderId] = React.useState<string | null>(null);

    const moveTag = useMoveTag();

    return (
        <AnimatePresence>
            {user && user.tagsEdit && (
                <ModalBase close={() => user.setTagsEdit(false)}>
                    <ModalSplit icon={<RiFolderLine className='w-15 h-15 text-slate-400' />}>
                        <ModalDnd
                            items={user.user.folders.map((t) => t.id)}
                            title="Email Tags"
                            description="Add or remove tags to organize your email accounts for campaigns. Use descriptive tags to group accounts by purpose, region, or audience (e.g., “VIP Clients”, “EU Outreach”, “Newsletter”)."
                            onMove={(id, new_position) => moveTag.mutateAsync({
                                id,
                                new_position,
                            })}
                        >
                            {user.user.tags.sort((a, b) => a.position - b.position).map((tag) => {
                                return (<TagItem
                                    disabled={load}
                                    key={tag.id}
                                    tag={tag}
                                    expanded={expandedFolderId === tag.id}
                                    onExpand={() =>
                                        setExpandedFolderId(
                                            expandedFolderId === tag.id ? null : tag.id
                                        )
                                    }
                                />
                                )
                            })}
                        </ModalDnd>
                        {user.user.tags.length < 50 && (
                            <ModalAddBox
                                placeholder="Tag Name"
                                load={load}
                                onSubmit={async (title: string) => {
                                    setLoad(true)
                                    try {
                                        await toast.promise(
                                            createTag.mutateAsync(title),
                                            {
                                                loading: CREATING,
                                                success: CREATED,
                                                error: (err: AppError) => buildError(err),
                                            }
                                        )
                                    } finally {
                                        setLoad(false);
                                    }
                                }}
                            >
                                {load ? <Loading className='h-4' color={twColors.slate[600]} /> : <>
                                    <RiAddLine className='w-4' />
                                    New Tag
                                </>}
                            </ModalAddBox>
                        )}
                    </ModalSplit>
                </ModalBase>
            )}
        </AnimatePresence>
    )
}

const TagItem = ({
    tag,
    disabled,
    expanded,
    onExpand,
}: {
    tag: Tag,
    disabled: boolean,
    expanded: boolean,
    onExpand: () => void,
}) => {
    const updateTag = useUpdateTag(tag.id);
    const deleteTag = useDeleteTag(tag.id);

    const [color, setColor] = React.useState<string>(tag.color);
    const [title, setTitle] = React.useState<string>(tag.title);
    const [saveLoad, setSaveLoad] = React.useState<boolean>(false);
    const [deleteLoad, setDeleteLoad] = React.useState<boolean>(false);

    return (
        <ModalBox
            id={tag.id}
            title={title}
            setTitle={setTitle}
            color={color}
            setColor={setColor}
            onExpand={onExpand}
            onSave={async () => {
                setSaveLoad(true)
                try {
                    const data = {
                        ...(title !== tag.title && { title: title }),
                        ...(color !== tag.color && { color: color })
                    }
                    await toast.promise(
                        updateTag.mutateAsync(data),
                        {
                            loading: SAVING,
                            success: SUCCESS,
                            error: (err: AppError) => buildError(err),
                        }
                    )
                } finally {
                    setSaveLoad(false)
                }
            }}
            onDelete={async () => {
                setDeleteLoad(true)
                try {
                    await toast.promise(
                        deleteTag.mutateAsync(),
                        {
                            loading: SAVING,
                            success: SUCCESS,
                            error: (err: AppError) => buildError(err),
                        }
                    );
                } finally {
                    setSaveLoad(false)
                }
            }}
            deleteLoad={deleteLoad}
            saveLoad={saveLoad}
            expanded={expanded}
            isChanged={color !== tag.color || title !== tag.title}
            disabled={disabled}
        />
    );
}
