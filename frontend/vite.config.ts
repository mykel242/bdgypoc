import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	// Dev server configuration
	server: {
		// Match production base path in dev mode
		base: '/budgie-v2'
	}
});
