export const createLogger = (output: (str: string) => void) => {
    let isInGroup = false;
    
    const logger = (str: string) => {
        if (isInGroup) {
            output(`|   ${str}`);
        } else {
            output(str);
        }
    };

    logger.group = (str: string) => {
        output(`# ${str}`);
        isInGroup = true;
    }

    logger.groupEnd = (str: string) => {
        output(`- ${str}`);
        isInGroup = false;
    }

    return logger;
};