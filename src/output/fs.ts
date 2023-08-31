export const encodeBase64 = (str: string) => {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16))
    }));
}

export const decodeBase64 = (str: string) => {
    return decodeURIComponent(atob(str).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

export const readFile = async (filename: string) => {
    return new Promise<string>((res) => {
        fs.readFile(filename, "base64", (err, data) => res(data));
    });
}

export const writeFile = async (filename: string, datastr: string) => {
    return new Promise<void>((res) => {
        fs.writeFile(filename, datastr, "base64", res);
    });
}
