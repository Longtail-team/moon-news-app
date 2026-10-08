import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 주소에 접속 링크(?k=)가 남아 있으므로, 다른 사이트(인스타 등)로 나갈 때 주소를 넘기지 않는다
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default nextConfig;
