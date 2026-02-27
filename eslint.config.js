import { defineConfig } from "eslint/config";
import rg from "eslint-config-reverentgeek";

export default defineConfig( {
	extends: [ rg.configs["node-esm"] ],
	rules: {
	}
} );
