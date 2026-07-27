import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import { componentTagger } from "lovable-tagger";

const normalizePath = (value: string) => value.replace(/\\/g, "/");

const rejectMockModules = (enabled: boolean): Plugin => ({
  name: "reject-mock-modules-in-protected-builds",
  apply: "build",
  generateBundle(_options, bundle) {
    if (!enabled) return;

    const offenders = new Set<string>();

    for (const output of Object.values(bundle)) {
      if (output.type !== "chunk") continue;

      for (const moduleId of Object.keys(output.modules)) {
        const normalizedModuleId = normalizePath(moduleId);

        if (
          normalizedModuleId.includes("/src/mocks/") ||
          normalizedModuleId.includes("/src/demo/")
        ) {
          offenders.add(
            normalizePath(path.relative(process.cwd(), moduleId)),
          );
        }
      }
    }

    if (offenders.size > 0) {
      this.error(
        [
          "Protected build rejected: demo or mock modules are present in the output.",
          "Replace these imports with production API-backed data before deployment:",
          ...[...offenders].sort().map((file) => `  - ${file}`),
          "Use `npm run build:demo` only for a clearly labelled demo artifact.",
        ].join("\n"),
      );
    }
  },
});

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const mockAllowed = command === "serve" || mode === "demo";
  const protectedBuild = command === "build" && mode !== "demo";
  const dataSource =
    env.VITE_DATA_SOURCE?.trim().toLowerCase() ||
    (mockAllowed ? "mock" : "api");

  if (!new Set(["mock", "api"]).has(dataSource)) {
    throw new Error("VITE_DATA_SOURCE must be either `mock` or `api`.");
  }

  if (protectedBuild && dataSource !== "api") {
    throw new Error(
      "Protected build rejected: VITE_DATA_SOURCE must be `api` for non-demo builds.",
    );
  }

  if (protectedBuild && !env.VITE_API_BASE_URL?.trim()) {
    throw new Error(
      "Protected build rejected: VITE_API_BASE_URL is required for production/staging builds.",
    );
  }

  const demoUiEnabled =
    mode === "demo" ||
    (command === "serve" && dataSource === "mock");

  return {
    server: {
      host: "127.0.0.1",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      command === "serve" &&
        mode === "development" &&
        componentTagger(),
      rejectMockModules(protectedBuild),
    ].filter(Boolean),
    resolve: {
      alias: [
        {
          find: "@/demo-entry",
          replacement: path.resolve(
            __dirname,
            demoUiEnabled
              ? "./src/demo/DemoModeBanner.tsx"
              : "./src/demo-entry.tsx",
          ),
        },
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
  };
});
