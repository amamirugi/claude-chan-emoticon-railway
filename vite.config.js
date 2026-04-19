import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  root: "app",
  build: {
    rollupOptions: { input: "app/index.html" },
    outDir: "../dist",
    emptyOutDir: true,
    assetsInlineLimit: 1024 * 1024, // 이미지를 base64로 인라인
  },
});
