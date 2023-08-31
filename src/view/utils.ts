import { ShallowRef, shallowRef } from "vue";

export const loadImage = async (src: string): Promise<HTMLImageElement> => {
    const img = document.createElement("img");
    return new Promise((res, rej) => {
        img.onload = () => res(img);
        img.onerror = () => rej(src);
        img.src = src;
    });
}

export const useImage = (src: string): ShallowRef<HTMLImageElement | undefined> => {
    const img = shallowRef<HTMLImageElement>();
    loadImage(src).then((_img) => img.value = _img);
    return img;
}

export const downloadTextFile = (filename: string, content: string) => {

    if (window.jsinterface) {
        window.jsinterface.download(filename, content);
        return;
    }

    // // Step 1: 如果是iOS平台，直接不支持
    // if (core.platform.isIOS) {
    //     if (core.copy(content)) {
    //         alert("iOS平台下不支持直接下载文件！\n所有应下载内容已经复制到您的剪切板，请自行创建空白文件并粘贴。");
    //     }
    //     else {
    //         alert("iOS平台下不支持下载操作！");
    //     }
    //     return;
    // }

    // // Step 2: 如果不是PC平台（Android），则只支持chrome
    // if (!core.platform.isPC) {
    //     if (!core.platform.isChrome || core.platform.isQQ || core.platform.isWeChat) { // 检测chrome
    //         if (core.copy(content)) {
    //             alert("移动端只有Chrome浏览器支持直接下载文件！\n所有应下载内容已经复制到您的剪切板，请自行创建空白文件并粘贴。");
    //         }
    //         else {
    //             alert("该平台或浏览器暂不支持下载操作！");
    //         }
    //         return;
    //     }
    // }

    // // Step 3: 如果是Safari浏览器，则提示并打开新窗口
    // if (core.platform.isSafari) {
    //     alert("你当前使用的是Safari浏览器，不支持直接下载文件。\n即将打开一个新窗口为应下载内容，请自行全选复制然后创建空白文件并粘贴。");
    //     var blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
    //     var href = window.URL.createObjectURL(blob);
    //     var opened = window.open(href, "_blank");
    //     window.URL.revokeObjectURL(href);
    //     return;
    // }

    // Step 4: 下载
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    // @ts-ignore
    if (window.navigator.msSaveOrOpenBlob) {
        // @ts-ignore
        window.navigator.msSaveBlob(blob, filename);
    } else {
        const href = window.URL.createObjectURL(blob);
        const elem = document.createElement('a');
        elem.href = href;
        elem.download = filename;
        document.body.appendChild(elem);
        elem.click();
        document.body.removeChild(elem);
        window.URL.revokeObjectURL(href);
    }
}
