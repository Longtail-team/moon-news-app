import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 뉴스북 PDF는 서버에서 만든다: 한글 서체 파일을 함수에 함께 싣는다
  outputFileTracingIncludes: { "/record/book/pdf": ["./lib/pdf/fonts/*.ttf"] },
  serverExternalPackages: ["@react-pdf/renderer"],
  // 주소에 접속 링크(?k=)가 남아 있으므로, 다른 사이트(인스타 등)로 나갈 때 주소를 넘기지 않는다
  async headers() {
    return [{ source: "/:path*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] }];
  },
};

export default nextConfig;
