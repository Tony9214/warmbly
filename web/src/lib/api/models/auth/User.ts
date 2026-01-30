import type Tag from "../app/Tag";
import type Category from "../app/Category";
import type Folder from "../app/Folder";

export default interface User {
    email: string;

    tags: Tag[];
    categories: Category[];
    folders: Folder[];
    roles: string[];

    updated_at: Date;
    created_at: Date;
}
