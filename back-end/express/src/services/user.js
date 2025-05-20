import { all } from "../repositories/user.js";

export const getAll = async () => {
    try {
        const users = await all();
        return users;
    } catch (error) {
        throw new Error("Error fetching users");
    }
};
