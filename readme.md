# 🤖 Gemini Chat Exporter

> **당신의 Gemini 대화 기록은 구글 서버 어딘가에 갇혀 있다. 이 툴은 그걸 꺼내온다.**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Playwright](https://img.shields.io/badge/Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=for-the-badge)](https://opensource.org/licenses/ISC)

---

## 뭐 하는 툴인가

Gemini 웹 UI에는 대화 내보내기 기능이 없다. 구글은 당신의 데이터를 볼모로 잡고 있고, 당신은 그냥 당하고 있었다.

이 스크립트는 **당신이 이미 로그인된 Chrome 브라우저에 몰래 붙어서**, 사이드바의 모든 대화를 긁어 로컬 `.md` 파일로 저장한다. 무한 스크롤도 뚫고, 갑자기 튀어나오는 Canvas 패널도 씹고, DOM이 느리게 뜨는 것도 기다려 가면서.

---

## 왜 다른 스크래퍼들과 다른가

| 문제 상황 | 일반 스크래퍼 | 이 툴 |
|---|---|---|
| 사이드바가 닫혀있을 때 | 💀 크래시 | ✅ 햄버거 버튼 눌러서 직접 열음 |
| Canvas 패널이 마우스 탈취 | 💀 클릭 먹통 | ✅ CSS로 패널 강제 `display: none` |
| 무한 스크롤로 100개만 보임 | 💀 100개만 저장 | ✅ 바닥 찍을 때까지 스크롤 추적 |
| 동적 렌더링으로 DOM 지연 | 💀 빈 파일 저장 | ✅ 요소 붙을 때까지 대기 후 파싱 |
| 특정 채팅방 로딩 실패 | 💀 전체 중단 | ✅ 5회 재시도 후 스킵, 계속 진행 |
| 진행 상황 파악 불가 | 🤷 로그만 주르륵 | ✅ CLI 프로그레스 바 + ETA |

---

## 준비물

- **Node.js** v18 이상
- **Chrome 또는 Chromium** 브라우저
- Gemini에 **이미 로그인**된 상태

---

## 설치

```bash
git clone https://github.com/YOUR_USERNAME/gemini-chat-exporter.git
cd gemini-chat-exporter
npm install
```

---

## 실행 방법

### Step 1 — Chrome을 디버깅 모드로 켠다

> ⚠️ **기존에 열린 Chrome 창을 모두 완전히 닫고** 아래 명령어를 실행한다.

**Windows (PowerShell)**
```powershell
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
```

**macOS**
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
```

**Linux**
```bash
google-chrome --remote-debugging-port=9222
```

### Step 2 — Gemini에 로그인한다

새로 열린 Chrome에서 [gemini.google.com](https://gemini.google.com)에 접속하고 구글 계정으로 로그인.

### Step 3 — 스크립트를 실행한다

```bash
npx ts-node scraper.ts
```

터미널에 프로그레스 바가 뜨면서 추출이 시작된다. 끝나면 `exports/` 폴더에 파일들이 쌓여있다.

---

## 출력 결과물

```
exports/
├── Gemini_Chat_000.md
├── Gemini_Chat_001.md
├── Gemini_Chat_002.md
└── ...
```

각 파일의 형식:

```markdown
### 👤 User
오늘 저녁 뭐 먹지?

### 🤖 Gemini
김치찌개 어떠세요? 간단하고 맛있습니다.

---

### 👤 User
...
```

---

## 설정 커스터마이징

구글이 UI를 업데이트해서 파싱이 깨졌다면 `scraper.ts` 상단의 `CONFIG`만 수정하면 된다. 전체 코드를 뒤질 필요 없음.

```typescript
const CONFIG: Config = {
    selectors: {
        chatRoom: '.conversation-title',      // 사이드바 대화방 제목 엘리먼트
        menuBtn: '[data-test-id="side-nav-menu-button"]', // 햄버거 메뉴 버튼
        canvasPanel: 'immersive-panel',       // 우측 Canvas 패널 태그명
        userClass: 'query-text-line',         // 사용자 질문 래퍼 클래스
        modelClass: 'markdown-main-panel'     // AI 답변 래퍼 클래스
    }
};
```

> **Tip:** `ng-tns-` 나 `ng-star-inserted` 같은 Angular 자동생성 난수 클래스는 빌드마다 바뀐다. 무조건 `data-test-id` 또는 고정 태그명을 타겟팅할 것.

개발자 도구(F12) → Elements 탭에서 해당 요소 우클릭 → Copy → Copy selector로 새 셀렉터를 바로 확인할 수 있다.

---

## 기술 스택

```
Playwright  →  CDP로 기존 Chrome 세션에 직접 붙음 (로그인 우회 필요 없음)
TypeScript  →  strict 모드로 런타임 에러 사전 차단
cli-progress →  터미널 프로그레스 바 + ETA
```

---

## 주의사항

- 이 툴은 **본인의 데이터를 본인이 백업하는 용도**로만 제작되었다.
- 구글의 UI가 전면 개편되면 `CONFIG` 셀렉터 수정이 필요할 수 있다.
- 대화가 수백 개라면 꽤 오래 걸린다. 걱정 말고 기다려라, ETA 보여준다.
- 실패한 채팅방은 5회 재시도 후 자동으로 스킵되고 다음 채팅방을 이어서 처리한다.

---

## License

ISC