# thetree-skin-composer

the tree의 데스크톱·모바일 스킨 슬롯을 결합하는 엔진 중립 컴포저입니다. 컴포저 구현은 특정 스킨 이름이나 DOM을 알지 못하며, `COMPOSABLE-SKIN.json` 계약을 제공하는 두 저장소만 조합합니다.

## 동작

- 플러그인 신호가 없거나 `desktop`이면 데스크톱 슬롯을 사용합니다.
- `thetree-mobilefrontend/v1`의 `mobile` 신호가 있으면 모바일 슬롯을 사용합니다.
- 각 자식 스킨이 `<nuxt/>`로 더트리 본문을 보존해야 합니다. 본문 투영은 컴포저 책임이 아닙니다.
- 두 자식은 동일한 전역 `config` 객체를 받습니다. 각 스킨은 고유 네임스페이스(예: `skin.foo.*`)를 선언하며, `wiki.lang` 같은 공유 키만 명시적으로 함께 사용합니다.

`COMPOSITION.json`의 `repository`와 `ref`를 원하는 두 스킨으로 바꾼 뒤 실행합니다.

```sh
npm run refresh
```

최초 실행 또는 `refresh`는 원격 ref를 정확한 커밋으로 해석해 `COMPOSITION-LOCK.json`에 고정합니다. 일반 `npm run bootstrap`은 그 잠금을 재사용합니다. 자식 소스와 생성 로더는 `.skin-composer/`에만 생성되며 저장소에는 복사해 보관하지 않습니다.

## 라이선스

컴포저 자체는 MIT입니다. 결합된 실행 결과의 배포 조건은 선택한 두 자식 스킨의 라이선스에 따릅니다. 부트스트랩은 `.skin-composer/generated/license-inventory.json`에 자식 라이선스를 기록합니다.
