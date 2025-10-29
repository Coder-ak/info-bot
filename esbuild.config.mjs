import esbuild from 'esbuild';
import { cleanPlugin } from 'esbuild-clean-plugin';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'dist');
let serverProcess = null;

const startServer = () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  serverProcess = spawn('node', [path.join(outDir, 'server.js')], {
    stdio: 'inherit',
    shell: true,
  });
};

const serverRunner = {
  name: 'dev-server-runner',
  setup(build) {
    build.onEnd(() => {
      startServer();
    });
  },
};

const build = async (watch = false) => {
  const entryPoints = await glob('src/**/*.ts', {
    ignore: ['src/types/**/*'],
  });

  console.log('GLOB', entryPoints);

  const options = {
    entryPoints,
    bundle: false,
    minify: !watch,
    platform: 'node',
    format: 'esm',
    outdir: outDir,
    metafile: true,
    plugins: [cleanPlugin(), ...(watch ? [serverRunner] : [])],
  };

  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();

    console.log('Watching for changes...');
  } else {
    await esbuild.build(options);
    console.log('Build finished.');
  }
};

const args = process.argv.slice(2);
const watch = args.includes('--watch');

build(watch);
