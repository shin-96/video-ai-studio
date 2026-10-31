/** @type {import('next').NextConfig} */
const nextConfig = {
  // Media generation calls can take minutes (Veo polling happens server-side).
  experimental: { serverActions: { bodySizeLimit: "32mb" } },
};
export default nextConfig;
