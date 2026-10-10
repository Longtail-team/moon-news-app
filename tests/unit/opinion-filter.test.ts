import { describe, expect, it } from "vitest";
import { checkOpinion } from "@/lib/moderation/filter";

describe("친구 의견 거르기", () => {
  it("보통 의견은 그대로", () => {
    for (const t of ["팬만 가는 전시가 될까 봐 고민돼요.", "Parents should be able to call their kids.", "사람이 너무 몰릴 것 같아요", "It is a good way to share art with many people.", "class assistant passes 12 classes", "고양이 새끼가 귀여워요", "닥치는 대로 모으면 안 돼요"])
      expect(checkOpinion(t)).toEqual({ hide: false, why: null });
  });

  it("욕설은 띄어쓰기·기호를 넣어도 걸린다", () => {
    expect(checkOpinion("이건 시 발 같은 생각").why).toBe("word");
    expect(checkOpinion("ㅅㅂ 몰라").why).toBe("word");
    expect(checkOpinion("You are s.t.u.p.i.d").why).toBe("word");
    expect(checkOpinion("what the fuck").why).toBe("word");
    expect(checkOpinion("wtf is this").why).toBe("word");
  });

  it("연락처·계정·링크는 숨긴다", () => {
    expect(checkOpinion("나한테 연락해 010-1234-5678").why).toBe("contact");
    expect(checkOpinion("01012345678").why).toBe("contact");
    expect(checkOpinion("메일 kid@example.com").why).toBe("contact");
    expect(checkOpinion("팔로우 @my_insta_id").why).toBe("contact");
    expect(checkOpinion("www.youtube.com 보세요").why).toBe("contact");
    expect(checkOpinion("카톡 아이디 알려줄게").why).toBe("contact");
    expect(checkOpinion("178 artworks, 142 from RM").hide).toBe(false); // 기사 속 숫자는 괜찮음
  });
});
