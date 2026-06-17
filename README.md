# Web Annotation Floating Pen

Chrome 일반 웹페이지 위에 필기할 수 있는 Manifest V3 확장 프로그램입니다. 웹페이지 위에 떠 있는 펜 버튼을 눌러 도구막대를 열고, 펜, 형광펜, 지우개, 텍스트, 화면 캡처 기능을 사용할 수 있습니다.

## 주요 기능

- Chrome Extension Manifest V3
- 일반 `http`, `https`, `file` 웹페이지 지원
- 확장 프로그램 팝업에서 전체 ON/OFF
- 접힌 원형 펜 버튼과 펼친 도구막대
- 도구막대 드래그 이동 및 위치 저장
- 도구막대 오른쪽 아래 모서리 드래그 크기 조절
- 마지막 도구막대 크기와 위치 자동 복원
- 작게, 보통, 크게 단계에 맞춘 반응형 도구막대 UI
- 문서 좌표 기준 필기: 스크롤해도 필기가 원래 웹페이지 위치에 유지
- `devicePixelRatio` 대응 Canvas 렌더링
- Shadow DOM 기반 UI로 웹페이지 CSS 충돌 방지
- 전체 화면 캡처 및 선택 영역 캡처
- PNG 원본 품질을 유지하는 캡처 미리보기, 저장, 클립보드 복사

## 도구막대

도구막대에는 실행 취소, 다시 실행, 펜, 색상, 굵기, 텍스트, 캡처, 지우개, 탐색 모드, 접기 기능이 있습니다.

- 접힌 원형 펜 버튼을 누르면 도구막대가 펼쳐집니다.
- 펼친 도구막대 상단 손잡이를 드래그하면 위치를 이동합니다.
- 접힌 원형 버튼도 드래그해서 위치를 이동할 수 있습니다.
- 펼친 도구막대 오른쪽 아래 모서리를 드래그하면 크기를 조절합니다.
- 크기는 `transform: scale()`이 아니라 CSS 변수 기반 실제 크기값으로 조절합니다.
- 최소/최대 크기 범위는 0.78~1.35 배율입니다.
- 위치와 크기는 `chrome.storage.local`에 저장됩니다.

## 펜 커서

- 캔버스 영역에서만 커서 미리보기가 표시됩니다.
- 메뉴나 도구막대 위에서는 캔버스 커서가 숨겨집니다.
- 펜은 실제 굵기 원과 최소 12px 안내 원을 함께 표시합니다.
- 커서 중앙점이 실제 그리기 시작 위치를 가리킵니다.
- 흰색과 검은색 이중 테두리를 사용해 밝은 배경과 어두운 배경 모두에서 보입니다.
- 형광펜은 실제 폭을 반투명한 둥근 사각형으로 표시합니다.
- 지우개는 실제 지워지는 범위를 원형으로 표시합니다.

## 캡처 품질

- Chrome `tabs.captureVisibleTab`은 PNG 형식으로 캡처합니다.
- 미리보기는 캡처 data URL을 그대로 `<img>`에 넣어 표시합니다.
- 미리보기 크기 조절은 `max-width`, `max-height`, `object-fit: contain` CSS만 사용합니다.
- 미리보기용 작은 Canvas 재생성이나 JPEG 압축을 사용하지 않습니다.
- 선택 영역 캡처는 원본 캡처 해상도 비율로 잘라낸 뒤 PNG Blob으로 생성합니다.
- 저장되는 이미지는 미리보기 표시 크기와 무관하게 원본 해상도와 PNG 품질을 유지합니다.
- 미리보기 로드 시와 저장 직전에 콘솔에 실제 해상도, 표시 크기, 저장 해상도, MIME, DPR을 출력합니다.

콘솔 로그 예:

```js
[WAE capture quality] {
  phase: "preview-loaded",
  previewNaturalResolution: "1920x1080",
  previewDisplaySize: "930x523",
  savedImageResolution: "1920x1080",
  imageMime: "image/png",
  devicePixelRatio: 1
}
```

## 저장 방식

현재 필기 데이터는 메모리에서만 관리합니다.

- 탭이나 브라우저를 닫으면 필기는 사라집니다.
- 새로고침 후 필기 복원은 현재 목표가 아닙니다.
- OFF 시 현재 페이지의 필기 데이터는 즉시 삭제됩니다.

`chrome.storage.local`에 저장되는 값:

- `settings.globalEnabled`
- `settings.uiSettings.toolbarScale`
- `toolbarPosition`
- `penSettings`
- `selectedPenType`
- `recentColors`
- `customColors`
- `eraserSettings`
- `textSettings`

## 설치

1. Chrome 주소창에 `chrome://extensions`를 입력합니다.
2. 오른쪽 위의 개발자 모드를 켭니다.
3. `압축해제된 확장 프로그램을 로드합니다`를 클릭합니다.
4. 이 프로젝트 폴더를 선택합니다.

```text
c:\Users\User\Desktop\chorm_meno
```

## 파일 구조

```text
.
├─ manifest.json
├─ README.md
├─ icons/
├─ popup/
│  ├─ popup.html
│  ├─ popup.css
│  └─ popup.js
└─ src/
   ├─ background.js
   ├─ utils.js
   ├─ storage-manager.js
   ├─ canvas-manager.js
   ├─ drawing-manager.js
   ├─ text-manager.js
   ├─ toolbar.js
   ├─ content.css
   └─ content.js
```

## 제한 사항

- Chrome 내부 페이지, Chrome Web Store, 확장 프로그램 관리 페이지에서는 content script가 차단됩니다.
- iframe 내부 필기는 브라우저 보안 정책과 페이지 구조에 따라 제한될 수 있습니다.
- `file://` 주소에서 사용하려면 Chrome 확장 프로그램 상세 정보에서 파일 URL 접근 권한을 켜야 합니다.
