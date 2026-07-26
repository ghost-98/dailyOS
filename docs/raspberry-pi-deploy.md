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
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_NAVER_MAP_CLIENT_ID=
NAVER_MAPS_API_KEY_ID=
NAVER_MAPS_API_KEY=
NAVER_SEARCH_CLIENT_ID=
NAVER_SEARCH_CLIENT_SECRET=
```

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

## 6. PWA 설치

브라우저에서 dailyOS에 접속한 뒤 홈 화면에 추가합니다.

- iPhone: Safari 공유 버튼 → 홈 화면에 추가
- Android: Chrome 메뉴 → 앱 설치 또는 홈 화면에 추가

외부 접속까지 필요하면 포트포워딩보다 Tailscale을 권장합니다. dailyOS는 개인 생애 데이터가 모이는 서비스라 공개 인터넷에 직접 노출하지 않는 편이 안전합니다.

## 7. 백업 루틴

앱의 `설정 > 데이터 관리 > 데이터 내보내기`로 JSON 백업을 내려받습니다. 사진 원본은 Supabase Storage `life-media` 버킷에 있으므로 주기적으로 별도 백업하는 것을 권장합니다.
