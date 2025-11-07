import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'


// ⚠️ Wichtig: base auf deinen Repo-Namen setzen, z. B. '/dlr-react-pp/'
export default defineConfig({
base: '/dlr-react-pp/',
plugins: [react(), viteSingleFile()],
build: {
target: 'es2018',
cssTarget: 'es2018'
}
})
