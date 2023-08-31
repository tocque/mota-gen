/// <reference types="vite/client" />
declare module '*.vue' {
    import type { DefineComponent } from 'vue'
    const component: DefineComponent<{}, {}, any>
    export default component
}

interface Window {
    jsinterface?: any;
}

interface EditorFileSystem {
    readFile(filename: string, encoding: "utf8" | "base64", callback: (err: any, data: string) => void): void
    writeFile(filename: string, datastr: string, encoding: "utf8" | "base64", callback: () => void): void
}

const fs: EditorFileSystem;
