import axios from "axios";

export interface AppError {
    error: string;
    message: string;
    status?: number;
}

export function normalizeError(error: unknown): AppError {
    if (axios.isAxiosError(error)) {
        if (!error.response) {
            // network, CORS, or timeout
            return {
                error: "Network Error",
                message: "Please check your connection.",
            };
        }

        const status = error.response.status;
        const data = error.response.data;

        return {
            error: data.error || "Unknown Error",
            message: data.message || "Unexpected error occured.",
            status,
        }
    }

    return {
        error: "Unknown Error",
        message: "Unexpected error occurred.",
    };
}

