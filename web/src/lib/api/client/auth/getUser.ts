import type User from "../../models/auth/User";
import Request from "../Request";

export default async function getUser(): Promise<User> {
    return await Request<User>({
        method: "GET",
        url: "/auth/me",
        authorization: true,
    })
}
