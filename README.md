# thetree-skin-composer

the tree에서 서로 다른 데스크톱 스킨과 모바일 스킨을 하나의 스킨으로 사용하는 범용 컴포저입니다.

## 주요 기능

- 선택한 데스크톱·모바일 스킨 슬롯 결합
- 모바일 요청에 따른 슬롯 자동 전환
- 슬롯 저장소 자동 설치와 업데이트
- 각 슬롯 스킨의 설정 키 전달
- the tree 네이티브 스킨 지원

## 요구 사항

- the tree 관리자 계정의 `developer` 권한
- Node.js 20.19.1 이상과 npm 10.8.2 이상
- Git이 설치되어 있고 GitHub에 접속할 수 있는 서버
- the tree 설치 서버의 명령줄 접근 권한
- [`thetree-plugin-mobilefrontend`](https://github.com/WikinLab/thetree-plugin-mobilefrontend)

## 설치

1. 이 저장소를 포크하거나 복사하여 사용할 조합 저장소를 만듭니다.
2. 조합 저장소의 `COMPOSITION.json`에 데스크톱·모바일 스킨 저장소를 지정합니다.

   ```json
   {
     "schema": "thetree-skin-composition/v1",
     "slots": {
       "desktop": {
         "repository": "https://github.com/example/desktop-skin.git",
         "ref": "refs/heads/main"
       },
       "mobile": {
         "repository": "https://github.com/example/mobile-skin.git",
         "ref": "refs/heads/main"
       }
     }
   }
   ```

3. MobileFrontend 플러그인을 설치하고 the tree 엔진을 다시 시작합니다.
4. the tree에서 **관리자 → 개발자 설정 → 스킨**으로 이동합니다.
5. 원하는 스킨 이름과 조합 저장소 URL을 입력하고 **추가**를 누릅니다.
6. the tree 설치 디렉터리에서 다음 명령을 실행합니다.

   ```sh
   cd frontend/skins/설치한-스킨-이름
   npm run bootstrap
   ```

7. 관리자 화면에서 해당 스킨의 **빌드**를 누릅니다.
8. 관리자 설정에서 기본 스킨으로 지정하거나 사용자 설정에서 선택합니다.

## 설정

각 슬롯 스킨의 README에 명시된 설정 키를 그대로 사용합니다.

## 업데이트

1. **관리자 → 개발자 설정 → 스킨 → 설치한 이름**에서 **업데이트**를 누릅니다.
2. 해당 스킨 폴더에서 `npm run bootstrap`을 실행합니다.
3. 같은 화면에서 **빌드**를 누릅니다.

`npm run bootstrap`은 `COMPOSITION.json`에 지정된 두 슬롯 저장소의 최신 커밋을 반영합니다.

## 문제 해결

- 모바일 슬롯 전환 확인 순서: MobileFrontend 플러그인 설치 경로 확인 → the tree 엔진 재시작
- 슬롯 준비가 중간에 실패하면 `.skin-composer` 폴더를 삭제하고 `npm run bootstrap`을 다시 실행합니다.
- 자식 스킨의 준비 명령과 진입점은 해당 스킨 또는 조합 저장소의 슬롯 설정에서 확인합니다.
- Windows에서 `Filename too long` 오류가 나오면 관리자 권한 터미널에서 `git config --system core.longpaths true`를 실행합니다.

## 면책

이 소프트웨어를 사용하면서 발생하는 문제에 대해서는 책임지지 않습니다.

## 개발 도구

이 프로젝트의 개발에는 OpenAI ChatGPT가 사용되었습니다.

## 버전과 라이선스

현재 버전은 `package.json`에서 확인할 수 있습니다.

Composer 자체는 MIT로 배포됩니다. 결합된 스킨의 배포 조건은 선택한 슬롯 스킨과 어댑터의 라이선스를 따릅니다.
