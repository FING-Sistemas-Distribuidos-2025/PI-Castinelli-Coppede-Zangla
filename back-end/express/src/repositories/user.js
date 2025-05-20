export const all = async () => {
    try {
        const users = [
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
        ];
        return users;
    } catch (error) {
        throw new Error("Error fetching users");
    }
};
