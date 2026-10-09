# 라즈베리파이 로컬 모델 제거

2026-10-09부터 기록 대화는 UI만 유지한다. 앱의 대화 API, 임베딩, 메모리 동기화 코드는 제거했다. 다음 절차는 SSH로 접속한 라즈베리파이에서 직접 실행한다. 모델 파일 삭제 후 다시 사용하려면 다운로드해야 한다. 활동, 사진, 하루기록 등 Supabase 원천 데이터에는 영향을 주지 않는다.

## 1. 설치 경로 확인

이전 배포 가이드의 공식 Linux 설치 스크립트로 설치한 환경을 기준으로 한다.

```bash
command -v ollama
sudo systemctl cat ollama
sudo systemctl show ollama -p Environment -p User
sudo du -sh /usr/share/ollama /usr/local/lib/ollama /usr/lib/ollama "$HOME/.ollama" 2>/dev/null
```

`OLLAMA_MODELS`에 별도 경로를 지정했다면 그 경로를 기록한다. 아래 기본 경로 삭제로는 사용자 지정 모델 저장소가 지워지지 않는다. Docker로 설치했다면 아래 systemd 절차 대신 해당 Ollama 컨테이너와 전용 모델 볼륨을 정리한다.

## 2. 서비스 중지 및 제거

```bash
sudo systemctl stop ollama
sudo systemctl disable ollama
sudo rm -f /etc/systemd/system/ollama.service
sudo rm -rf /etc/systemd/system/ollama.service.d
sudo systemctl daemon-reload
sudo systemctl reset-failed
```

## 3. 모델과 실행 파일 제거

아래 경로는 모두 Ollama 전용 경로다. `/usr/lib`나 프로젝트 폴더 전체를 삭제하지 않는다.

```bash
sudo rm -f /usr/local/bin/ollama /usr/bin/ollama
sudo rm -rf /usr/local/lib/ollama /usr/lib/ollama /usr/share/ollama
rm -rf "$HOME/.ollama"
if id ollama >/dev/null 2>&1; then sudo userdel ollama; fi
if getent group ollama >/dev/null; then sudo groupdel ollama; fi
```

`OLLAMA_MODELS`가 기본 경로와 달랐다면 앞서 확인한 **모델 전용 디렉터리**를 별도로 제거한다. 다른 PC에 설치한 Ollama는 이 절차로 제거되지 않는다.

## 4. 앱 환경 변수 정리

실제 프로젝트 위치로 이동한다. 기존 배포 가이드 기준 위치는 `~/dailyOS`다.

```bash
cd ~/dailyOS
sed -i -E '/^[[:space:]]*(export[[:space:]]+)?(MEMORY_[A-Z0-9_]*|OLLAMA_[A-Z0-9_]*|LOCAL_CHAT_MODEL|LOCAL_EMBEDDING_MODEL|GEMINI_[A-Z0-9_]*)[[:space:]]*=/d' .env.local
```

Supabase와 Naver 설정은 유지한다. 셸 설정에도 모델 변수를 추가했다면 `.bashrc`, `.profile`, PM2 환경 설정에서 해당 줄을 제거한다.

## 5. 정리된 앱 배포

이 작업은 로컬 커밋까지만 진행했다. 아래 업데이트는 사용자가 정리 브랜치를 원격에 푸시하고 서버의 배포 브랜치에 반영한 뒤 실행한다.

```bash
cd ~/dailyOS
git pull --ff-only
npm ci
npm run build
pm2 restart dailyos --update-env
pm2 save
pm2 logs dailyos --lines 30 --nostream
```

## 6. 확인

```bash
command -v ollama || echo "Ollama 실행 파일 제거됨"
systemctl is-active ollama
sudo ss -ltnp '( sport = :11434 )'
df -h
```

서비스 상태가 `inactive` 또는 `unknown`이고 11434 포트의 리스너가 없어야 한다. 다른 Ollama 인스턴스가 남아 있다면 표시된 프로세스를 확인한다.

## Supabase 메모리 데이터

이미 적용한 메모리 스키마와 마이그레이션 이력은 보존했다. 앱은 이 테이블이나 RPC를 호출하지 않는다. `memory_documents`, `memory_summaries`, `memory_conversations`, `memory_messages`와 관련 RPC의 실제 삭제는 데이터 삭제 승인 후 별도 작업으로 진행한다. 원천 기록 테이블과 `vector` 확장은 임의로 삭제하지 않는다.

공식 제거 절차: [Ollama Linux uninstall](https://docs.ollama.com/linux#uninstall).
