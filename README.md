# claude-chan-emoticon-railway

> **이 리포의 구현은 더 이상 사용되지 않는다. 현재 역할은 감정 에셋 보관소다.**

클로드짱 이모티콘의 구현은 **[`amamirugi/claude-chan-emoticon-vercel`](https://github.com/amamirugi/claude-chan-emoticon-vercel)** 로 이전됐다. 코드 수정·버그 수정·기능 추가는 전부 그쪽에서 한다.

이 리포의 `index.js`와 관련 설정은 참고용 기록이다. 수정해도 어느 곳에도 반영되지 않는다.

## 남아 있는 이유

`assets/`의 webp 41장이 살아 있는 자산이다. Vercel 리포가 이곳에서 에셋을 가져간다.

Vercel 리포의 Actions 탭에 있는 **Import emotion assets** 워크플로가 이 리포를 체크아웃해 복사한다. 바이너리를 GitHub API로 올리면 파일당 base64 46KB 수준의 오버헤드가 생겨 현실적이지 않기 때문이다.

따라서 이 리포를 지우거나 비공개로 돌리면 에셋 동기화가 깨진다.

## 에셋 구성

- 총 41장, 고유 감정 키 31종
- `building` `coding` `reading` `searching` `thinking` 5종은 `_2` `_3` 변형을 가진다
- 나머지 26종은 1장씩

에셋을 새로 추가하거나 교체할 때는 이 리포의 `assets/`에 넣고, Vercel 리포에서 워크플로를 실행해 동기화한다.

## 사용하지 않는 구 구현

참고만 한다. Vercel 판은 이들을 의도적으로 버렸다.

- SSE transport와 process-memory session 맵
- base64 `type: image` 툴 결과 fallback (모델 컨텍스트 오염)
- `__emotion__:` 텍스트 태그를 UI가 파싱하는 방식
- `/img/:emotion` 정적 이미지 라우트
- Railway 전용 배포 설정

또한 `index.js`의 `EMOTIONS` 배열과 `CLAUDE.md` 매핑표는 26종만 다룬다. `building` `coding` `gift` `reading` `searching` 5키와 모든 `_2` `_3` 변형은 에셋만 있고 배선되지 않았었다. Vercel 판에서 41장 전부 사용하도록 복구했다.
