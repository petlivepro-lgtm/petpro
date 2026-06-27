import type { Config } from "tailwindcss";
import preset from "@mylivepet/config/tailwind-preset";

const config: Config = {
  presets: [preset as Partial<Config>],
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
};

export default config;
