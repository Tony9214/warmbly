import { AnimatePresence, motion } from "framer-motion"

export default function LoadingScreen({
    errorTitle,
    errorMessage,
}: {
    errorTitle?: string,
    errorMessage?: string,
}) {
    return (
        <motion.div
            key="loader"
            className="fixed inset-0 z-50 bg-white flex items-center justify-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
        >
            {!(errorTitle && errorMessage) &&
                <motion.svg
                    className="animate-spin border-indigo-300"
                    xmlns="http://www.w3.org/2000/svg"
                    width="30"
                    height="30"
                    viewBox="0 0 30 30"
                    fill="none"
                    initial={{ scale: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <path
                        d="M0 15C0 16.9698 0.387987 18.9204 1.14181 20.7403C1.89563 22.5601 3.00052 24.2137 4.3934 25.6066C5.78628 26.9995 7.43987 28.1044 9.25975 28.8582C11.0796 29.612 13.0302 30 15 30L15 15H0Z"
                        fill="#4F46E5"
                    />
                    <path
                        d="M30 15C30 13.0302 29.612 11.0796 28.8582 9.25975C28.1044 7.43986 26.9995 5.78628 25.6066 4.3934C24.2137 3.00052 22.5601 1.89563 20.7402 1.14181C18.9204 0.387985 16.9698 -1.48355e-06 15 -1.31134e-06L15 15L30 15Z"
                        fill="#4F46E5"
                    />
                    <path
                        d="M15 30C16.9698 30 18.9204 29.612 20.7403 28.8582C22.5601 28.1044 24.2137 26.9995 25.6066 25.6066C26.9995 24.2137 28.1044 22.5601 28.8582 20.7403C29.612 18.9204 30 16.9698 30 15L15 15L15 30Z"
                        fill="#EEF2FF"
                    />
                    <path
                        d="M15 1.96701e-06C13.0302 2.22532e-06 11.0796 0.38799 9.25974 1.14181C7.43986 1.89563 5.78627 3.00052 4.39339 4.3934C3.00052 5.78628 1.89563 7.43987 1.1418 9.25975C0.387985 11.0796 -2.22532e-06 13.0302 -1.96701e-06 15L15 15L15 1.96701e-06Z"
                        fill="#EEF2FF"
                    />
                </motion.svg>
            }


            <AnimatePresence mode="wait">
                {(errorTitle || errorMessage) && (
                    <motion.div
                        key="mailbox"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="relative w-full"
                    >
                        <svg
                            viewBox="0 0 160 120"
                            className="w-full h-36"
                            aria-label="Error mailbox"
                        >
                            {/* Post */}
                            <rect x="72" y="60" width="16" height="60" fill="#6b7280" />

                            {/* Box body */}
                            <rect x="40" y="40" width="80" height="50" rx="4" fill="#d1d5db" />

                            {/* Door */}
                            <motion.rect
                                x="40"
                                y="40"
                                width="80"
                                height="50"
                                rx="4"
                                fill="#9ca3af"
                                style={{ transformOrigin: "80px 65px" }}
                                animate={{ rotateX: 0 }}
                                initial={{ rotateX: -90 }}
                                transition={{ delay: 0.3, duration: 0.4 }}
                            />

                            {/* Flag */}
                            <motion.g
                                style={{ transformOrigin: "125px 50px" }}
                                initial={{ rotate: -45 }}
                                animate={{ rotate: 0 }}
                                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                            >
                                <rect x="125" y="40" width="4" height="18" fill="#6b7280" />
                                <path d="M129 40l14-9v18z" fill="#ef4444" />
                            </motion.g>
                        </svg>
                        <motion.h1
                            animate={{ translateY: 0, opacity: 1 }}
                            initial={{ translateY: -20, opacity: 0 }}
                            transition={{ delay: 0.5, duration: 0.4 }}
                            className="text-red-500 text-3xl text-center mt-8"
                        >
                            {errorTitle}
                        </motion.h1>
                        <motion.p
                            animate={{ translateY: 0, opacity: 1 }}
                            initial={{ translateY: -20, opacity: 0 }}
                            transition={{ delay: 0.6, duration: 0.4 }}
                            className="text-slate-600 mx-auto w-full max-w-120 text-md text-center mt-4"
                        >
                            {errorMessage}
                        </motion.p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    )
}
