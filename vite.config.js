"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("vitest/config");
exports.default = (0, config_1.defineConfig)({
    test: {
        exclude: ["node_modules/**/*", "**/exampleStructure/**/*", "out/**/*", "**/test/**/*"],
    },
});
//# sourceMappingURL=vite.config.js.map