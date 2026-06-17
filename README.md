# Web Annotation Floating Pen

Chrome 일반 웹페이지 위에 필기할 수 있는 Manifest V3 확장 프로그램입니다. 웹페이지 위에 떠 있는 작은 펜 버튼을 눌러 도구막대를 열고, 펜/지우개/형광펜으로 문서 위치 기준 필기를 할 수 있습니다.

## 주요 기능

- Chrome Extension Manifest V3
- 일반 `http`, `https`, `file` 웹페이지 지원
- Chrome 확장 프로그램 아이콘 팝업에서 전체 ON/OFF
- OFF 시 필기 UI와 Canvas를 완전히 종료하고 현재 필기 데이터 삭제
- 다시 ON 시 저장된 도구 설정과 도구막대 위치만 복원
- 여러 창과 여러 탭에 ON/OFF 상태 즉시 반영
- 접힌 원형 펜 버튼과 펼친 도구막대
- 도구막대 드래그 이동 및 위치 저장
- 도구막대 크기 설정: 작게, 보통, 크게
- 화면 가장자리에서 펼침 방향 자동 전환
- Shadow DOM 기반 UI로 웹페이지 CSS 충돌 방지
- 문서 좌표 기준 필기: 스크롤해도 필기가 원래 웹페이지 위치에 유지
- devicePixelRatio 대응 Canvas 렌더링
- ResizeObserver, MutationObserver 기반 문서 크기 변화 대응

## 도구

도구막대에는 다음 기능이 있습니다.

- 실행 취소
- 다시 실행
- 현재 펜 버튼
- 펜 종류 선택
- 색상 선택
- 굵기 선택
- 펜 세부 설정
- 지우개
- 지우개 설정 메뉴
- 탐색 모드
- 도구막대 접기

펜 종류:

- 만년필
- 볼펜
- 붓펜

지우개 설정:

- 작게: 12px
- 보통: 24px
- 크게: 48px
- 사용자 지정: 5px~100px
- 전체 지우기

## 설치 방법

1. Chrome 주소창에 `chrome://extensions`를 입력합니다.
2. 오른쪽 위의 `개발자 모드`를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 클릭합니다.
4. 이 프로젝트 폴더를 선택합니다.

```text
c:\Users\User\Desktop\chorm_meno
```

## 사용 방법

### 확장 프로그램 팝업

Chrome 확장 프로그램 아이콘을 클릭하면 작은 팝업이 열립니다.

팝업에서 할 수 있는 일:

- 확장 프로그램 ON/OFF
- 도구막대 크기 선택: 작게, 보통, 크게
- 도구 위치 초기화
- 현재 페이지 지원 여부 확인

OFF를 누르면 단순히 숨기는 것이 아니라 현재 페이지의 필기 프로그램을 종료합니다.

OFF 시 삭제되는 것:

- 현재 필기 데이터
- undo 스택
- redo 스택
- 현재 그리는 중인 선
- Canvas
- 도구막대
- 접힌 펜 버튼
- 팝오버
- 지우개 미리보기
- 관련 이벤트 리스너와 Observer

OFF 후 다른 페이지로 이동해도 자동으로 다시 나타나지 않습니다. 다시 ON으로 켜면 빈 필기 상태로 새로 시작합니다.

유지되는 설정:

- 마지막 선택 펜
- 펜 색상
- 펜 굵기
- 지우개 크기
- 도구막대 위치
- 도구막대 크기

### 도구막대

- 접힌 원형 펜 버튼을 누르면 도구막대가 펼쳐집니다.
- 펼친 도구막대 끝의 접기 버튼을 누르면 다시 접힙니다.
- 도구막대 상단 손잡이를 드래그해서 위치를 이동할 수 있습니다.
- 접힌 원형 버튼도 드래그해서 위치를 이동할 수 있습니다.
- 위치는 화면 크기 대비 비율로 `chrome.storage.local`에 저장됩니다.
- 화면 밖으로 나가지 않도록 8px 여백 기준으로 보정됩니다.

### 필기 모드와 탐색 모드

필기 모드:

- Canvas가 포인터 입력을 받습니다.
- 웹페이지 링크나 버튼 클릭은 막힙니다.
- 마우스 휠 스크롤은 가능합니다.

탐색 모드:

- 필기는 보이지만 입력은 받지 않습니다.
- 웹페이지 링크, 버튼, 영상 등을 조작할 수 있습니다.

`Esc` 키를 누르면 탐색 모드로 전환됩니다.

## 단축키

- `Esc`: 탐색 모드
- `Ctrl+Z`: 실행 취소
- `Ctrl+Shift+Z`: 다시 실행
- `Ctrl+Y`: 다시 실행

입력창, textarea, select, contenteditable 요소에 포커스가 있을 때는 웹페이지 기본 단축키를 방해하지 않습니다.

## 저장 방식

현재 필기 데이터는 메모리에서만 관리합니다.

- 탭이나 브라우저를 닫으면 필기는 사라집니다.
- 새로고침 후 필기 복원은 현재 목표가 아닙니다.
- OFF 시 현재 필기 데이터는 즉시 삭제됩니다.

`chrome.storage.local`에 저장되는 값:

- `settings.globalEnabled`
- `settings.uiSettings.toolbarScale`
- `toolbarPosition`
- `penSettings`
- `selectedPenType`
- `recentColors`
- `eraserSettings`

예시:

```js
{
  settings: {
    globalEnabled: true,
    siteSettings: {},
    uiSettings: {
      toolbarScale: 1
    }
  },
  eraserSettings: {
    size: 24
  },
  toolbarPosition: {
    xRatio: 0.9,
    yRatio: 0.5
  }
}
```

필기 데이터 구조는 내부적으로 다음과 같은 벡터 형태를 사용합니다.

```json
{
  "tool": "pen",
  "penType": "ballpoint",
  "color": "#111111",
  "width": 3,
  "opacity": 1,
  "points": [
    { "x": 100, "y": 500, "pressure": 0.5, "time": 123456789 }
  ]
}
```

## 파일 구조

```text
.
├─ manifest.json
├─ README.md
├─ icons/
│  ├─ icon16.png
│  ├─ icon48.png
│  └─ icon128.png
├─ popup/
│  ├─ popup.html
│  ├─ popup.css
│  └─ popup.js
└─ src/
   ├─ utils.js
   ├─ storage-manager.js
   ├─ canvas-manager.js
   ├─ drawing-manager.js
   ├─ toolbar.js
   ├─ content.css
   └─ content.js
```

## 현재 제한사항

- 첫 버전은 document 전체 스크롤을 우선 지원합니다.
- 개별 내부 스크롤 컨테이너 기준 필기는 아직 지원하지 않습니다.
- iframe 내부 필기는 페이지 구조와 브라우저 보안 정책에 따라 제한될 수 있습니다.
- Chrome 내장 PDF 뷰어에서는 정상 작동하지 않을 수 있습니다.
- Chrome 내부 페이지, Chrome Web Store, 확장 프로그램 관리 페이지에서는 content script가 차단됩니다.
- `file://` 주소에서 사용하려면 Chrome 확장 프로그램 세부정보에서 `파일 URL에 대한 액세스 허용`을 켜야 합니다.

## 추후 개발 아이디어

- 내부 스크롤 컨테이너 선택 지원
- iframe 필기 지원
- 필기 데이터 내보내기와 가져오기
- 페이지별 필기 목록 관리
- SVG 또는 이미지로 내보내기
- 사이트별 설정
