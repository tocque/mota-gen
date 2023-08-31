import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vueJSX from "@vitejs/plugin-vue-jsx";
import path from "path";

const FSHOST = 'http://localhost:1552';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJSX(),
    // monacoEditorPlugin({}),
  ],
  server: {
    proxy: {
      "/readFile": FSHOST,
      "/writeFile": FSHOST,
      "/writeMultiFiles": FSHOST,
      "/listFile": FSHOST,
      "/makeDir": FSHOST,
      "/moveFile": FSHOST,
      "/deleteFile": FSHOST,
    }
  },
  resolve: {
    alias: {
        "@": path.resolve(__dirname, 'src'), // 路径别名
    },
    extensions: ['.js', '.json', '.ts', '.tsx'],
  }
})
