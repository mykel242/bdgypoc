import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Use base path only for production builds
const dev = process.env.NODE_ENV === 'development';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),

	kit: {
		// Use static adapter for deployment to nginx
		adapter: adapter({
			// Default options for static adapter
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		}),
		// Set base path only for production (deployed to /budgie-v2/)
		// In development, use no base path (serve from root)
		paths: {
			base: dev ? '' : '/budgie-v2'
		}
	}
};

export default config;
