import dotenv from "dotenv";
import app from "./src/app.js";
import logger from "./src/utils/logger.js";

dotenv.config();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`);
});
