# dailyOS Raspberry Pi 5 배포 가이드

dailyOS는 Next.js + Supabase 기반 PWA입니다. 라즈베리파이는 앱 서버를 상시 실행하고, 데이터와 파일은 Supabase에 저장합니다.

## 1. 라즈베리파이 준비

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y git curl build-essential
```

Node.js는 20 이상을 권장합니다.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 2. 프로젝트 설치

```bash
cd ~
git clone <YOUR_REPOSITORY_URL> dailyOS
cd dailyOS
npm ci
```

`.env.local`을 생성하고 로컬 개발 환경과 같은 값을 넣습니다.

```bash
nano .env.local
```

필수 값:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=
NAVER_MAPS_API_KEY_ID=
NAVER_MAPS_API_KEY=
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

## 2-1. 로컬 LLM/Ollama 준비

dailyOS의 기록 대화는 기본적으로 상용 LLM API 없이 Ollama를 사용한다. 라즈베리파이에서 직접 실행하려면 메모리 여유를 봐야 한다. Pi 5 8GB 기준으로는 작은 모델부터 시작하고, 품질을 더 올리고 싶으면 같은 네트워크의 더 강한 PC/GPU 서버에서 Ollama를 띄운 뒤 `OLLAMA_BASE_URL`만 그 서버 주소로 바꾸는 구성이 가장 좋다.

라즈베리파이에 Ollama 설치:

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama --version
```

Pi에서 시작하기 좋은 모델:

```bash
ollama pull nomic-embed-text
ollama pull qwen3:4b
```

더 좋은 품질을 원하고 메모리/속도가 괜찮으면:

```bash
ollama pull qwen3:8b
```

Ollama 상태 확인:

```bash
systemctl status ollama
curl http://localhost:11434/api/tags
```

`.env.local`에 로컬 전용 메모리 설정을 추가한다.

```env
MEMORY_EMBEDDING_PROVIDER=ollama
MEMORY_CHAT_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_CHAT_MODEL=qwen3:4b
```

같은 네트워크의 더 강한 PC에서 Ollama를 돌리는 경우:

```env
OLLAMA_BASE_URL=http://192.168.0.10:11434
OLLAMA_CHAT_MODEL=qwen3:8b
```

이 경우 PC의 Ollama 서버가 외부 접속을 받도록 설정되어 있어야 한다.

## 3. 빌드와 실행

```bash
npm run build
npm run start
```

같은 와이파이의 휴대폰/PC에서 접속합니다.

```bash
hostname -I
```

예시:

```text
http://192.168.0.25:3000
```

## 4. PM2 상시 실행

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

`pm2 startup`이 출력하는 명령어를 그대로 한 번 더 실행합니다.

운영 명령:

```bash
pm2 status
pm2 logs dailyos
pm2 restart dailyos
pm2 stop dailyos
```

## 5. 업데이트 배포

```bash
cd ~/dailyOS
git pull
npm ci
npm run build
pm2 restart dailyos
```

로컬 모델 설정을 바꾼 뒤에는 Next 서버를 재시작해야 한다.

```bash
pm2 restart dailyos
pm2 logs dailyos
```

## 6. PWA 설치

브라우저에서 dailyOS에 접속한 뒤 홈 화면에 추가합니다.

- iPhone: Safari 공유 버튼 → 홈 화면에 추가
- Android: Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가

외부 접속까지 필요하면 포트포워딩보다 Tailscale을 권장합니다. dailyOS는 개인 생애 데이터가 모이는 서비스라 공개 인터넷에 직접 노출하지 않는 편이 안전합니다.

## 7. 백업 루틴

앱의 `설정 > 데이터 관리 > 데이터 내보내기`로 JSON 백업을 내려받습니다. 사진 원본은 Supabase Storage `life-media` 버킷에 있으므로 주기적으로 별도 백업하는 것을 권장합니다.
