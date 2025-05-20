const logger = {
    info: (msg) => {
        console.log(`INFO: ${new Date().toISOString()} : ${msg}`);
    },
    error: (msg) => {
        console.log(`ERROR: ${new Date().toISOString()} : ${msg}`);
    },
};

export default logger;