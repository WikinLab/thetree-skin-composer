# thetree-skin-composer

the tree의 데스크톱·모바일 스킨 슬롯을 결합하는 엔진 중립 컴포저입니다. 자식 저장소는 읽기 전용 입력이며 수정하거나 컴포저 소스에 복사하지 않습니다. Composer 자체는 MIT이고 생성 번들을 배포하지 않는 source-only bootstrap 방식을 사용합니다.

## 조합판 사용자

이 저장소의 기본 조합은 Vector Legacy 데스크톱 + Minerva 모바일입니다. 자식 저장소를 따로 클론할 필요는 없습니다.

```sh
git clone https://github.com/WikinLab/thetree-skin-composer.git
cd thetree-skin-composer
npm run bootstrap
```

`bootstrap`이 `COMPOSITION.json`에 선언된 두 저장소 ref의 최신 커밋을 가져오고 필요한 자식 준비 과정까지 실행합니다. 그 뒤에는 이 폴더를 하나의 더트리 스킨으로 취급하여 기존과 같은 엔진 빌드 과정을 실행합니다.

모바일 슬롯 전환에는 [`thetree-plugin-mobilefrontend`](https://github.com/WikinLab/thetree-plugin-mobilefrontend)가 필요합니다. 플러그인이 없거나 데스크톱 요청이면 데스크톱 슬롯, 플러그인이 전달한 `thetree-mobilefrontend/v1` 신호가 `mobile`이면 모바일 슬롯을 사용합니다.

업데이트할 때도 같은 명령을 사용합니다. `bootstrap`을 실행할 때마다 슬롯 ref의 최신 커밋을 다시 확인합니다.

```sh
git pull
npm run bootstrap
```

## 새 조합판 제작

`COMPOSITION.json`에는 수정하지 않을 원본 저장소와 ref를 적습니다. `contract`는 타사 저장소처럼 self-description을 추가할 수 없을 때만 지정하는 선택적 외부 계약입니다.

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
      "ref": "refs/heads/main",
      "contract": "contracts/third-party/mobile.json"
    }
  }
}
```

`ref`는 브랜치나 태그처럼 `git ls-remote`로 단일 Git 객체를 해석할 수 있어야 합니다. 컴포저는 매 `bootstrap` 시작 시 각 ref를 한 번 해석하고, 그 실행 동안에는 해석된 정확한 커밋으로 슬롯을 준비합니다. 실제 사용한 저장소·ref·커밋은 생성 결과인 `.skin-composer/generated/composition-resolution.json`에서 확인할 수 있습니다.

슬롯 계약은 다음 우선순위로 결정됩니다.

1. `COMPOSITION.json`의 `contract`: 조합 저장소가 소유하는 외부 계약이며 자식 저장소를 수정하지 않습니다.
2. 자식의 선택적 `COMPOSABLE-SKIN.json`: 스킨 작성자가 제공하는 self-description입니다. 단독 빌드에서는 import되지 않으므로 단독 동작에 영향이 없습니다.
3. 둘 다 없음: build-ready 네이티브 스킨으로 보고 `layout.vue`, 준비 명령 없음, config namespace 없음으로 추론합니다.

## bootstrap 없는 네이티브 스킨

자식 저장소에는 파일을 추가하지 않습니다. 일반적인 `layout.vue`가 있고 별도 준비 과정이 없다면 외부 계약도 생략할 수 있습니다. 명시적인 entry나 config namespace가 필요할 때만 조합 저장소가 소유하는 외부 계약을 둡니다.

```json
{
  "schema": "thetree-skin-slot-contract/v1",
  "id": "example-native-skin",
  "entry": "layout.vue",
  "contentSurface": "host",
  "configNamespaces": [],
  "sharedConfigKeys": [],
  "license": "MIT"
}
```

`entry`는 클론된 자식 저장소 기준 경로이며 더트리 본문을 위한 `<nuxt/>`를 보존해야 합니다.

## 준비 과정이 있는 스킨

원본에서 파일을 생성해야 하는 포팅 스킨은 외부 슬롯 계약에 인자 배열로 준비 명령을 선언합니다. 명령은 자식 저장소를 클론한 뒤 그 저장소 안에서 실행되고, entry 존재 여부는 준비가 끝난 뒤 검사됩니다.

```json
{
  "schema": "thetree-skin-slot-contract/v1",
  "id": "generated-skin",
  "entry": "components/GeneratedLayout.vue",
  "contentSurface": "host",
  "configNamespaces": ["skin.generated"],
  "sharedConfigKeys": ["wiki.lang", "wiki.dir"],
  "license": "GPL-2.0-or-later",
  "prepare": ["npm", "run", "bootstrap"]
}
```

직접 entry로 사용할 수 없는 저장소는 `entry` 대신 조합 저장소가 소유하는 `adapter` 경로를 선언할 수 있습니다. 어댑터는 `adapters/`처럼 경계가 드러나는 위치에 두며 자식 소스는 수정하지 않습니다.

## config와 본문 경계

- 자식의 `skin.*` 키는 폴더명이 아니라 `configNamespaces`에 선언한 안정적인 논리 namespace로 받습니다.
- MobileFrontend 플러그인의 내부 bridge가 생성된 runtime 계약을 읽고 선언된 `skin.*` 값만 전달합니다.
- 조합판 자체 키는 엔진이 활성 폴더명으로 제공하는 `skin.<폴더명>.*`이며, 폴더명을 빌드 결과에 하드코딩하지 않습니다.
- 폴더명이 자식 namespace와 같을 수 있으므로 조합 전용 키는 `skin.<폴더명>.composition.*` 아래에 두는 것을 권장합니다.
- `configNamespaces`는 스킨의 안정적인 논리 키 영역입니다. 같은 스킨 계열을 두 슬롯에 넣는 경우 같은 영역을 함께 선언할 수 있으며, 두 슬롯 모두 같은 값을 받습니다.
- `sharedConfigKeys`는 `wiki.lang`처럼 의도적으로 함께 읽는 공개 `wiki.*` 정확한 키입니다. prefix 전체가 아니라 키별 allowlist이므로 선언되지 않은 설정은 플러그인 경계를 통과하지 않습니다.
- 스킨과 어댑터는 크롬을 소유하고 `<nuxt/>`의 더트리 본문을 보존합니다. 본문 Projection은 별도 계층의 책임입니다.

## 소스 설치와 배포 번들

엔진을 수정하지 않고 자식 소스와 생성 결과를 저장소에 커밋하지 않으므로, 설치하거나 슬롯을 갱신할 때는 엔진 빌드 전에 `npm run bootstrap`이 필요합니다. 생성 번들은 배포하지 않습니다. `.skin-composer/slots/`의 관리 checkout은 같은 저장소이면 재사용하므로 반복 bootstrap 때 자식의 의존성·업스트림 빌드 캐시가 유지됩니다.

컴포저는 모든 자식 준비 명령에 `.skin-composer/cache/`를 가리키는 `THETREE_BOOTSTRAP_CACHE_ROOT`도 제공합니다. 이를 지원하는 자식은 저장소 이름이 아니라 잠긴 커밋·빌드 선언·도구 잠금의 콘텐츠 지문으로만 산출물을 공유합니다. 지원하지 않는 타사 스킨은 환경 변수를 무시해도 되며 별도 대응 코드가 필요하지 않습니다.

## 라이선스

컴포저 자체는 MIT입니다. 결합 결과의 배포 조건은 선택한 자식 스킨과 어댑터의 라이선스에 따릅니다. bootstrap은 `.skin-composer/generated/license-inventory.json`에 슬롯별 라이선스를 기록합니다.
