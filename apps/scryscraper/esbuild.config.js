import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const distDir = './dist';

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Build configuration
const buildConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  outfile: 'dist/index.js',
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  minify: true,
  sourcemap: false,
  external: [],
};

// Build
try {
  console.log('Building Lambda function with esbuild...');
  await esbuild.build(buildConfig);
  console.log('Build completed successfully!');
  console.log(`Output: ${path.resolve(buildConfig.outfile)}`);
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
