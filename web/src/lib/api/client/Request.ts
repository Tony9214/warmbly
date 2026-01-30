import type { AxiosRequestConfig } from "axios"
import Client from "./Client"
import getToken from "@/lib/helper/getToken"
import isExpired from "@/lib/helper/isExpired";
import { NoToken, SessionExpired } from "@/lib/errors/auth";
import refreshToken from "./auth/refreshToken";
import setToken from "@/lib/helper/setToken";
import reviveDates from "@/lib/helper/reviveDates";

interface AuthRequestConfig extends AxiosRequestConfig {
    authorization?: boolean
}

export default async function Request<T>(config: AuthRequestConfig): Promise<T> {
    if (config.authorization) {
        let token = getToken();
        if (!token) {
            throw NoToken
        }
        if (!token.access_token || isExpired(token.access_token_expires_at)) {
            if (token.refresh_token && !isExpired(token.refresh_token_expires_at)) {
                token = await refreshToken(token.refresh_token)
                setToken(token)
            } else {
                throw SessionExpired
            }
        }

        config.headers = {
            ...config.headers,
            Authorization: `Bearer ${token.access_token}`,
        }
    }

    const res = await Client.request(config)
    return reviveDates(res.data)
}
