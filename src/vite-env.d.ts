/// <reference types="vite/client" />

declare module '*.ttf?base64' {
  const base64: string;
  export default base64;
}
