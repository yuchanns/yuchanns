import { SearchPlugin } from "vitepress-plugin-search"
import { defineConfig } from "vite"
import visualizer from "rollup-plugin-visualizer"
import Segment from 'segment'

// issue: https://github.com/emersonbottero/vitepress-plugin-search/issues/11#issuecomment-1328150584
const segment = new Segment()
segment.useDefault()

const options = {
  encode: (str: String) => {
    return segment.doSegment(str, { simple: true })
  },
  tokenize: "forward"
};

export default defineConfig({
  plugins: [
    SearchPlugin(options),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
});
