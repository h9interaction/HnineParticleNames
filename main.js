import { originWords } from './words.js';
import { originTexts } from './words.js';
import { Particle } from './particle.js';

/**
 * words, texts를 같은 순서로 함께 섞는 유틸 함수
 */
function shuffleWordsAndTexts(wordsArr, textsArr) {
    if (wordsArr.length !== textsArr.length) {
        console.error("words와 texts의 길이가 다릅니다!");
        return { newWords: wordsArr, newTexts: textsArr };
    }
    const length = wordsArr.length;
    const indices = Array.from({ length }, (_, i) => i);
    // Fisher-Yates Shuffle
    for (let i = length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const newWords = [];
    const newTexts = [];
    for (let i = 0; i < length; i++) {
        newWords[i] = wordsArr[indices[i]];
        newTexts[i] = textsArr[indices[i]];
    }
    return { newWords, newTexts };
}

/**
 * CanvasManager: 한 개의 <canvas>에서
 * 배경 이미지 + 텍스트 파티클 애니메이션을 실행하는 클래스
 */
class CanvasManager {
    /**
     * @param {string} canvasId - 사용할 canvas 엘리먼트 id
     * @param {string[]} words - 전역(셔플된) words
     * @param {string[]} texts - 전역(셔플된) texts
     * @param {number} managerId - 0,1,2,3 (각 매니저별 인덱스 오프셋)
     * @param {string} imagesPath - 이미지 폴더 경로
     */
    constructor(canvasId, words, texts, managerId, imagesPath) {
        // 캔버스 컨텍스트 설정
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // 가로 폭을 1/4, 세로 풀 높이
        this.canvas.width = window.innerWidth / 4;
        this.canvas.height = window.innerHeight;

        // 공통 데이터
        this.words = words;
        this.texts = texts;
        this.imagesPath = imagesPath;
        this.validExtensions = ["png", "jpg", "jpeg", "JPG"];

        // 각 매니저의 시작 인덱스: 0번 매니저=0, 1번=1, 2번=2, 3번=3
        // => 이후 toggle할 때 +=4
        this.managerId = managerId;
        this.wordIndex = managerId;

        // 상태들
        this.particles = [];
        this.explosionTriggered = false;

        // 페이드 관련
        this.fadeOpacity = 0;
        this.fadingOut = false;
        this.fadeDuration = 3000; // ms

        // 이미지 관련
        this.availableImages = [];
        this.currentBackgroundImage = null;
        this.processedBackgroundCanvas = null;
        this.invertedBackgroundImage = null;
        this.nextImageLoaded = false;

        // 파티클 생성 간격
        this.pixelSteps = 4;

        // 텍스트 모드 지속 시간 (원 예시에서 12초)
        this.modeDurations = { text: 12000 };

        // 폰트 스타일
        this.rightMargin = 200;
        this.bottomMargin = 50;
        this.fontSize = 140;
        this.letterSpacing = -5;
        this.fontLineHeight = 0.9;
        this.fontName = "Pretendard";
        this.fontWeight = 700;
        // -90도 회전이라 textBaseline을 "bottom"으로
        this.textBaseline = "bottom";

        // 폭발 시 트리거 후 해제까지 시간
        this.explosionDuration = 1000; // 1초

        // 이미지 밝기/대비 조정 파라미터
        this.maskImgBrightness = 1.4;
        this.contrastFactor = 0.6;
        this.minBrightness = 60;

        // 애니메이션 타이밍
        this.lastTime = 0;
        this.lastModeScheduleTime = 0;
        this.scheduleInterval = this.modeDurations.text; // 12000ms

        // 초기화
        this.initialize();
    }

    // 초기화
    async initialize() {
        // 이미지 목록을 fetch
        await this.fetchAvailableImages();

        // 현재 wordIndex( managerId )에 해당하는 단어/텍스트 로드
        const word = this.words[this.wordIndex];
        const text = this.texts[this.wordIndex];

        // 첫 배경 로드 → 파티클 업데이트
        this.loadBackgroundImage(word, () => {
            this.updateParticlesToText(text);
        });

        // 애니메이션 시작
        requestAnimationFrame((t) => this.animate(t));
    }

    // 이미지 목록 fetch
    async fetchAvailableImages() {
        try {
            const response = await fetch(`${this.imagesPath}images.json`);
            if (!response.ok) {
                console.error("Failed to fetch image list:", response.status, response.statusText);
                return;
            }
            const files = await response.json();
            this.availableImages = files.filter((file) =>
                this.validExtensions.some((ext) => file.endsWith(`.${ext}`))
            );
        } catch (error) {
            console.error("Error fetching image list:", error);
        }
    }

    // 단어 -> 파일명 매칭 보조
    normalizeText(text) {
        return text.normalize("NFC");
    }
    findMatchingImage(word) {
        const normalizedWord = this.normalizeText(word.toLowerCase());
        return this.availableImages.find((file) => {
            const normalizedFile = this.normalizeText(file.toLowerCase());
            return this.validExtensions.some((ext) => file.endsWith(`.${ext}`)) &&
                normalizedFile.includes(normalizedWord);
        });
    }

    // 배경이미지 로드 + 대비/밝기 처리
    loadBackgroundImage(word, callback) {
        const matchingImage = this.findMatchingImage(word);
        const fallbackImage = "hnine.jpg"; // 매칭 실패 시

        // 최종적으로 로드 시도할 파일
        const finalImage = matchingImage || fallbackImage;

        const img = new Image();
        img.src = `${this.imagesPath}${finalImage}`;

        img.onload = () => {
            this.fadeOpacity = 0;
            this.currentBackgroundImage = img;

            // 배경 대비/밝기 조정 캔버스
            this.processedBackgroundCanvas = this.adjustBrightnessAndContrast(
                this.currentBackgroundImage,
                this.contrastFactor,
                this.minBrightness
            );
            // 파티클용 이미지 생성
            this.createDarkenedBackgroundImage();

            this.nextImageLoaded = true;
            if (callback) callback();
        };

        img.onerror = () => {
            console.error(`Failed to load image: ${finalImage}`);
            this.currentBackgroundImage = null;
            this.invertedBackgroundImage = null;
            this.processedBackgroundCanvas = null;
            if (callback) callback();
        };
    }


    // 대비/밝기 조정 → 별도 캔버스
    adjustBrightnessAndContrast(image, contrastFactor, minBrightness) {
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");

        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        const imgAspectRatio = image.width / image.height;
        const canvasAspectRatio = this.canvas.width / this.canvas.height;

        let drawWidth, drawHeight, offsetX, offsetY;
        if (canvasAspectRatio > imgAspectRatio) {
            drawWidth = this.canvas.width;
            drawHeight = this.canvas.width / imgAspectRatio;
            offsetX = 0;
            offsetY = (this.canvas.height - drawHeight) / 2;
        } else {
            drawWidth = this.canvas.height * imgAspectRatio;
            drawHeight = this.canvas.height;
            offsetX = (this.canvas.width - drawWidth) / 2;
            offsetY = 0;
        }

        // 원본 그리기
        tempCtx.drawImage(
            image,
            0, 0, image.width, image.height,
            offsetX, offsetY, drawWidth, drawHeight
        );

        // 픽셀 데이터
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        const average = 128;
        for (let i = 0; i < data.length; i += 4) {
            // R
            data[i] = Math.max(minBrightness, average + (data[i] - average) * contrastFactor);
            // G
            data[i + 1] = Math.max(minBrightness, average + (data[i + 1] - average) * contrastFactor);
            // B
            data[i + 2] = Math.max(minBrightness, average + (data[i + 2] - average) * contrastFactor);
            // A는 그대로
        }

        tempCtx.putImageData(imageData, 0, 0);
        return tempCanvas;
    }

    // 파티클용 어둡게 처리된 이미지 생성
    createDarkenedBackgroundImage() {
        if (!this.currentBackgroundImage) return;

        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");

        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        const imgAspectRatio = this.currentBackgroundImage.width / this.currentBackgroundImage.height;
        const canvasAspectRatio = this.canvas.width / this.canvas.height;

        let drawWidth, drawHeight, offsetX, offsetY;
        if (canvasAspectRatio > imgAspectRatio) {
            drawWidth = this.canvas.width;
            drawHeight = this.canvas.width / imgAspectRatio;
            offsetX = 0;
            offsetY = (this.canvas.height - drawHeight) / 2;
        } else {
            drawWidth = this.canvas.height * imgAspectRatio;
            drawHeight = this.canvas.height;
            offsetX = (this.canvas.width - drawWidth) / 2;
            offsetY = 0;
        }

        // 배경 그린 뒤 픽셀 조정
        tempCtx.drawImage(
            this.currentBackgroundImage,
            0, 0, this.currentBackgroundImage.width, this.currentBackgroundImage.height,
            offsetX, offsetY, drawWidth, drawHeight
        );

        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        // maskImgBrightness 적용
        for (let i = 0; i < data.length; i += 4) {
            data[i] *= this.maskImgBrightness; // R
            data[i + 1] *= this.maskImgBrightness; // G
            data[i + 2] *= this.maskImgBrightness; // B
        }
        tempCtx.putImageData(imageData, 0, 0);

        // Image 객체로 만들어서 파티클에 할당
        this.invertedBackgroundImage = new Image();
        this.invertedBackgroundImage.onload = () => {
            this.particles.forEach((p) => {
                p.invertedBackgroundImage = this.invertedBackgroundImage;
            });
        };
        this.invertedBackgroundImage.src = tempCanvas.toDataURL();
    }

    // 텍스트 -> 파티클 타겟 매핑
    updateParticlesToText(word) {
        const tempCanvas = document.createElement("canvas");
        const tempCtx = tempCanvas.getContext("2d");
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;

        // 배경
        tempCtx.fillStyle = "black";
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

        // 폰트 설정
        tempCtx.font = `${this.fontWeight} ${this.fontSize}px ${this.fontName}`;
        tempCtx.textBaseline = this.textBaseline;
        tempCtx.fillStyle = "white";

        // 줄바꿈
        const upperWord = word.toUpperCase();
        const lines = this.wrapText(tempCtx, upperWord, this.canvas.width * 0.8);
        const lineHeight = this.fontSize * this.fontLineHeight;

        // ------------------------
        // (1) 우측 하단 + 마진
        // ------------------------
        const marginRight = this.rightMargin;
        const marginBottom = this.bottomMargin;
        tempCtx.save();
        tempCtx.translate(
            tempCanvas.width - marginRight,
            tempCanvas.height - marginBottom
        );
        // -90도 회전: 위로 텍스트
        tempCtx.rotate(-Math.PI / 2);

        // ------------------------
        // (2) 글자별 렌더링
        // ------------------------
        let currentY = 0; // 회전좌표계에서 y 증가 => 실제론 왼쪽으로 이동
        for (let line of lines) {
            let currentX = 0; // x 증가 => 실제론 화면 위쪽 이동
            for (let char of line) {
                tempCtx.fillText(char, currentX, currentY);
                // 글자 폭 + letterSpacing
                currentX += tempCtx.measureText(char).width + this.letterSpacing;
            }
            currentY += lineHeight;
        }

        // 회전/이동 해제
        tempCtx.restore();

        // ------------------------
        // (3) 파티클 추출
        // ------------------------
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        const targets = [];
        for (let y = 0; y < tempCanvas.height; y += this.pixelSteps) {
            for (let x = 0; x < tempCanvas.width; x += this.pixelSteps) {
                const index = (y * tempCanvas.width + x) * 4;
                if (data[index] > 200) {
                    targets.push({ x, y });
                }
            }
        }
        targets.sort((a, b) => b.y - a.y);

        for (let i = 0; i < targets.length; i++) {
            if (this.particles[i]) {
                this.particles[i].target = targets[i];
                this.particles[i].exploding = false;
            } else {
                const p = new Particle(
                    Math.random() * this.canvas.width,
                    Math.random() * this.canvas.height,
                    this.canvas.width,
                    this.canvas.height,
                    this.invertedBackgroundImage
                );
                p.target = targets[i];
                this.particles.push(p);
            }
            this.particles[i].spawnDelay = i * 5;
        }
        this.particles.length = targets.length;
    }

    // 텍스트 줄바꿈
    wrapText(ctx, text, maxWidth) {
        const words = text.split(" ");
        const lines = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(`${currentLine} ${word}`).width;
            if (width < maxWidth) {
                currentLine += ` ${word}`;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    // 폭발 트리거
    triggerExplosion() {
        this.explosionTriggered = true;
        this.particles.forEach((p) => {
            p.exploding = true;
            p.setExplosionVelocity();
            p.elapsedTime = 0;
        });
        // 폭발 해제 타이머
        setTimeout(() => {
            this.explosionTriggered = false;
        }, this.explosionDuration);
    }

    // 다음 모드(배경+텍스트)로 전환
    toggleMode() {
        if (!this.explosionTriggered) {
            this.triggerExplosion();

            // 폭발 후 페이드 아웃 + 다음 단어/이미지 로드
            setTimeout(() => {
                this.fadingOut = true;
                this.nextImageLoaded = false;

                // ★★★ 여기서 wordIndex를 += 4 (배열 길이 초과 시 wrap-around) ★★★
                this.wordIndex += 4;
                // 만약 length가 4의 배수가 아닐 때도 자연스럽게 회전:
                while (this.wordIndex >= this.words.length) {
                    this.wordIndex -= this.words.length;
                }

                // 새 단어/텍스트 로드
                const word = this.words[this.wordIndex];
                const text = this.texts[this.wordIndex];
                this.loadBackgroundImage(word, () => {
                    this.updateParticlesToText(text);
                });
            }, 1000);
        }
    }

    // 매 프레임 실행
    animate(timestamp) {
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // 페이드 인/아웃
        if (this.fadingOut) {
            this.fadeOpacity -= 1 / (this.fadeDuration / deltaTime);
            if (this.fadeOpacity <= 0 && this.nextImageLoaded) {
                this.fadingOut = false;
                this.fadeOpacity = 0;
            }
        } else if (this.fadeOpacity < 1) {
            this.fadeOpacity += 1 / (this.fadeDuration / deltaTime);
            if (this.fadeOpacity >= 1) this.fadeOpacity = 1;
        }

        // 배경 그리기
        this.drawBackgroundWithFade();

        // 파티클 업데이트
        this.particles.forEach((p) => {
            p.move(deltaTime);
            p.updateSize();
            p.draw(this.ctx);
        });

        // 일정 시간마다 toggleMode 스케줄링
        if (timestamp - this.lastModeScheduleTime >= this.scheduleInterval) {
            setTimeout(() => this.toggleMode(), this.scheduleInterval - 3000);
            this.lastModeScheduleTime = timestamp;
        }

        requestAnimationFrame((t) => this.animate(t));
    }

    // 가공된 배경이미지를 그리기
    drawBackgroundWithFade() {
        if (this.processedBackgroundCanvas) {
            this.ctx.globalAlpha = this.fadeOpacity;
            this.ctx.filter = "blur(10px)";
            this.ctx.drawImage(this.processedBackgroundCanvas, 0, 0);
            this.ctx.filter = "none";
            this.ctx.globalAlpha = this.fadeOpacity;
        } else {
            this.ctx.fillStyle = `rgba(1, 1, 1, ${this.fadeOpacity})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    /**
     * 키 눌림에 따라 margin, fontSize, pixelSteps를 변경하고
     * 즉시 updateParticlesToText()로 재렌더링
     */
    handleKeyDown(e) {
        switch (e.key) {
            case "ArrowRight":
                // 질문 내용 그대로: this.rightMargin 10씩 감소
                this.rightMargin -= 10;
                break;
            case "ArrowLeft":
                // 질문 내용 그대로: this.rightMargin 10씩 감소
                this.rightMargin += 10;
                break;
            case "ArrowUp":
                // 위쪽 키 => bottomMargin 10씩 증가
                this.bottomMargin += 10;
                break;
            case "ArrowDown":
                // 아래쪽 키 => bottomMargin 10씩 감소
                this.bottomMargin -= 10;
                break;
            case "=":
                // '=' 키 => fontSize 10씩 증가
                this.fontSize += 10;
                break;
            case "-":
                // '-' 키 => fontSize 10씩 감소
                this.fontSize -= 10;
                break;
            case ".":
                // '.' 키 => pixelSteps 1씩 증가
                this.pixelSteps += 1;
                break;
            case ",":
                // ',' 키 => pixelSteps 1씩 감소
                if (this.pixelSteps > 1) {
                    this.pixelSteps -= 1;
                }
                break;
            default:
                return;
        }

        // 변경 즉시 텍스트 갱신
        const word = this.words[this.wordIndex];
        const text = this.texts[this.wordIndex];
        this.updateParticlesToText(text);
    }
}

// ---------------------------------------------------
// 전역에서 words, texts 셔플 후, 4개의 CanvasManager 생성
// ---------------------------------------------------
let words = originWords;
let texts = originTexts;

// 1) 전역 words/texts 셔플 (한 번만)
const { newWords, newTexts } = shuffleWordsAndTexts(words, texts);
words = newWords;
texts = newTexts;

// 2) 4개의 CanvasManager 생성
//    managerId = 0,1,2,3
const manager1 = new CanvasManager("particleCanvas1", words, texts, 0, "./images/");
const manager2 = new CanvasManager("particleCanvas2", words, texts, 1, "./images/");
const manager3 = new CanvasManager("particleCanvas3", words, texts, 2, "./images/");
const manager4 = new CanvasManager("particleCanvas4", words, texts, 3, "./images/");

// ------------------------------------------
// 3) 전역으로 키 이벤트 등록 → 각 매니저에 전달
// ------------------------------------------
window.addEventListener("keydown", (e) => {
    manager1.handleKeyDown(e);
    manager2.handleKeyDown(e);
    manager3.handleKeyDown(e);
    manager4.handleKeyDown(e);
});
