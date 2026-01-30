import React, { useMemo } from 'react';
import { UserContext } from './context/user';
import useUser from '@/lib/api/hooks/auth/useUser';
import { AnimatePresence } from 'framer-motion';
import LoadingScreen from '@/components/LoadingScreen';
import TagsModal from '@/components/app/modals/TagsModal';
import FoldersModal from '@/components/app/modals/FoldersModal';
import AddEmailModal from '@/components/app/modals/AddEmailModal';
import useRoles from '@/lib/api/hooks/app/admin/roles/useRoles';
import useTimezones from '@/lib/api/hooks/app/useTimezones';
import type { AppError } from '@/lib/api/client/normalizeError';

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
    const user = useUser();
    const access = useRoles();
    const timezones = useTimezones();

    const [tagsEdit, setTagsEdit] = React.useState<boolean>(false);
    const [foldersEdit, setFoldersEdit] = React.useState<boolean>(false);
    const [addEmail, setAddEmail] = React.useState<boolean>(false);

    const error = useMemo(() => {
        const err = user.error ?? access.error ?? timezones.error;
        if (err) {
            const myerr = err as unknown as AppError;
            return {
                title: `${myerr.error}${myerr.status ? ` (${myerr.status})` : ""}`,
                message: myerr.message,
            }
        }
    }, [user.error, access.error, timezones.error])

    return (
        <>
            {(user.data && access.data && timezones.data) &&
                <UserContext.Provider value={{
                    user: user.data,
                    access: access.data,
                    timezones: timezones.data,
                    tagsEdit, setTagsEdit,
                    foldersEdit,
                    setFoldersEdit,
                    addEmail,
                    setAddEmail
                }}>
                    {children}
                    <TagsModal />
                    <FoldersModal />
                    <AddEmailModal />
                </UserContext.Provider>
            }
            <AnimatePresence>
                {!user.data && <LoadingScreen
                    errorTitle={error?.title}
                    errorMessage={error?.message}
                />}
            </AnimatePresence>
        </>
    );
};


