/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@shadergradient/react",
    "@react-three/fiber",
    "three",
    "three-stdlib",
    "camera-controls"
  ]
};

export default nextConfig;
