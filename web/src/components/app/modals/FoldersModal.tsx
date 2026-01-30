import { Loading } from "@/components/loader";
import type Folder from "@/lib/api/models/app/Folder";
import { RiAddLine, RiFolderLine } from "@remixicon/react";
import { AnimatePresence } from "framer-motion";
import React from "react";
import { twColors } from "tailwindv4-colors";
import { useUserProfile } from "@/hooks/context/user";
import ModalBase from "./components/ModalBase";
import ModalSplit from "./components/ModalSplit";
import ModalDnd from "./components/ModalDnd";
import useMoveFolder from "@/lib/api/hooks/app/folders/useMoveFolder";
import toast from "react-hot-toast";
import useUpdateFolder from "@/lib/api/hooks/app/folders/useUpdateFolder";
import useDeleteFolder from "@/lib/api/hooks/app/folders/useDeleteFolder";
import { CREATED, CREATING, SAVING, SUCCESS } from "@/lib/information";
import type { AppError } from "@/lib/api/client/normalizeError";
import buildError from "@/lib/helper/buildError";
import ModalBox from "./components/ModalBox";
import ModalAddBox from "./components/ModalAddBox";
import useCreateFolder from "@/lib/api/hooks/app/folders/useCreateFolder";

export default function FoldersModal() {
    const user = useUserProfile();
    const createFolder = useCreateFolder();

    const [load, setLoad] = React.useState<boolean>(false);
    const [expandedFolderId, setExpandedFolderId] = React.useState<string | null>(null);

    const moveFolder = useMoveFolder();

    return (
        <AnimatePresence>
            {user && user.foldersEdit && (
                <ModalBase close={() => user.setFoldersEdit(false)}>
                    <ModalSplit icon={<RiFolderLine className='w-15 h-15 text-slate-400' />}>
                        <ModalDnd
                            items={user.user.folders.map((t) => t.id)}
                            title="Campaign Folders"
                            description="Create folders to organize and manage your campaigns more effectively. Group campaigns by goal, audience, or region (e.g., “Product Launches”, “Customer Retention”, “US Market”). Folders make it easier to find, track, and analyze campaigns without clutter."
                            onMove={(id, new_position) => moveFolder.mutateAsync({
                                id,
                                new_position,
                            })}
                        >
                            {user.user.folders.sort((a, b) => a.position - b.position).map((folder) => {
                                return (<FolderItem
                                    disabled={load}
                                    key={folder.id}
                                    folder={folder}
                                    expanded={expandedFolderId === folder.id}
                                    onExpand={() =>
                                        setExpandedFolderId(
                                            expandedFolderId === folder.id ? null : folder.id
                                        )
                                    }
                                />
                                )
                            })}
                        </ModalDnd>
                        {user.user.folders.length < 50 && (
                            <ModalAddBox
                                placeholder="Folder Name"
                                load={load}
                                onSubmit={async (title: string) => {
                                    setLoad(true)
                                    try {
                                        await toast.promise(
                                            createFolder.mutateAsync(title),
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
                                    New Folder
                                </>}
                            </ModalAddBox>
                        )}
                    </ModalSplit>
                </ModalBase>
            )}
        </AnimatePresence >
    )
}


const FolderItem = ({
    folder,
    disabled,
    expanded,
    onExpand,
}: {
    folder: Folder,
    disabled: boolean,
    expanded: boolean,
    onExpand: () => void,
}) => {
    const updateFolder = useUpdateFolder(folder.id);
    const deleteFolder = useDeleteFolder(folder.id);

    const [color, setColor] = React.useState<string>(folder.color);
    const [title, setTitle] = React.useState<string>(folder.title);
    const [saveLoad, setSaveLoad] = React.useState<boolean>(false);
    const [deleteLoad, setDeleteLoad] = React.useState<boolean>(false);

    return (
        <ModalBox
            id={folder.id}
            title={title}
            setTitle={setTitle}
            color={color}
            setColor={setColor}
            onExpand={onExpand}
            onSave={async () => {
                setSaveLoad(true)
                try {
                    const data = {
                        ...(title !== folder.title && { title: title }),
                        ...(color !== folder.color && { color: color })
                    }
                    await toast.promise(
                        updateFolder.mutateAsync(data),
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
                        deleteFolder.mutateAsync(),
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
            isChanged={color !== folder.color || title !== folder.title}
            disabled={disabled}
        />
    );
}
