let sizeMin = 0.2;
let sizeMax = 6;
export class Particle {
    constructor(x, y, canvasWidth, canvasHeight, invertedBackgroundImage) {
        // 초기 좌표: (파티클 생성 시) 무작위 위치
        this.pos = {
            x: Math.random() * canvasWidth,
            y: Math.random() * canvasHeight
        };
        this.vel = { x: 0, y: 0 };
        this.acc = { x: 0, y: 0 };
        // 텍스트 픽셀의 목표 위치
        this.target = { x, y };

        // 파티클 크기 및 크기 변화 속도
        this.size = Math.random() * sizeMin + sizeMax;
        this.sizeVel = (Math.random() * 0.5 - 0.1);

        // 폭발 관련
        this.exploding = false;
        this.explosionVelocity = { x: 0, y: 0 };
        this.elapsedTime = 0;

        // ──────────────────────────────────────────────
        // 1) 폭발 지속 시간도 파티클마다 다르게
        //    (예: 1.5초 ~ 4초 사이)
        // ──────────────────────────────────────────────
        this.totalExplosionDuration = 1000;//(Math.random() * 1000 +  1100);

        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.invertedBackgroundImage = invertedBackgroundImage;

        // updateParticlesToText()에서 설정하는 지연 (아래->위 등장)
        this.spawnDelay = 0;
        this.activationTime = 0;

        // ─────────────────────────────────────────
        // 파티클별 서로 다른 투명도 설정 (0.3 ~ 1.0 등)
        // ─────────────────────────────────────────
        this.opacity = Math.random() * 0.8 + 0.2;
    }

    // ──────────────────────────────────────────────
    // 2) 폭발 속도도 파티클마다 다른 범위
    //    + 약간의 회전, 난수화
    // ──────────────────────────────────────────────
    setExplosionVelocity() {
        const angle = Math.random() * Math.PI * 2;
        // 화면 크기에 비례하되, 기존보다 작게 제한
        // 예: maxWH / 10 + 30 정도로 '최대 폭발 속도' 줄이기
        const maxWH = Math.max(this.canvasWidth, this.canvasHeight);
        const speedMin = 30;
        // 기존보다 더 작은 상한값 예시 (너무 크게 잡지 않음)
        const speedMax = maxWH / 10 + 30;
        const speed = speedMin + Math.random() * (speedMax - speedMin);

        this.explosionVelocity = {
            x: Math.cos(angle) * speed,
            y: Math.sin(angle) * speed,
        };
    }


    /**
     * 메인 루프(animate)에서 매 프레임마다 호출.
     * currentTime(= requestAnimationFrame의 timestamp)와 
     * deltaTime을 받아서 파티클의 상태를 갱신.
     */
    update(deltaTime, currentTime) {
        // spawnDelay만큼 대기 후에 움직이기 시작
        if (this.activationTime === 0) {
            this.activationTime = currentTime + this.spawnDelay;
        }

        // 아직 활성화 전이면 (currentTime < activationTime), 움직임X
        if (currentTime < this.activationTime) {
            return;
        }

        // 활성화가 되었으면 move 로직 수행
        this.move(deltaTime);
        this.updateSize();
    }

    move(deltaTime) {
        if (this.exploding) {
            // 폭발 중
            this.elapsedTime += deltaTime;

            // t: 0 ~ 1
            const t = Math.min(this.elapsedTime / this.totalExplosionDuration, 1);

            // ──────────────────────────────────────────────
            // 3) 이징 함수를 좀 더 강하게 적용
            //    (기존: ease-out-cubic) → 여기서는 더 강렬하게, 예: ease-out-quint
            //    혹은 expo, bounce 등으로 바꿔볼 수도 있음
            // ──────────────────────────────────────────────
            // const easing = 1 - Math.pow(1 - t, 10); // 원래 예시
            // 더 강렬한 quint:
            const easing = 1 - Math.pow(1 - t, 3);

            // 점차 속도가 줄어들며 퍼져 나감
            this.pos.x += this.explosionVelocity.x * (1 - easing);
            this.pos.y += this.explosionVelocity.y * (1 - easing);

            // 폭발 시간 끝나면 초기화
            if (this.elapsedTime >= this.totalExplosionDuration) {
                this.exploding = false;
                this.elapsedTime = 0;
            }
        } else {
            // 폭발 전 → 기본 움직임(텍스트 타겟으로)
            const dx = this.target.x - this.pos.x;
            const dy = this.target.y - this.pos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const maxSpeed = 14;
            const maxForce = 1.0;
            const proximityMult = distance < 50 ? distance / 50 : 1;

            const force = {
                x: (dx / distance) * maxSpeed * proximityMult - this.vel.x,
                y: (dy / distance) * maxSpeed * proximityMult - this.vel.y,
            };

            this.acc.x += Math.min(Math.max(force.x, -maxForce), maxForce);
            this.acc.y += Math.min(Math.max(force.y, -maxForce), maxForce);

            this.vel.x += this.acc.x;
            this.vel.y += this.acc.y;

            this.pos.x += this.vel.x;
            this.pos.y += this.vel.y;

            this.acc.x = 0;
            this.acc.y = 0;
        }
    }

    updateSize() {
        this.size += this.sizeVel;
        // 크기가 일정 범위를 벗어나면 반전
        if (this.size < sizeMin * 2 || this.size > sizeMax * 2) {
            this.sizeVel *= -1;
        }
    }

    draw(ctx) {
        if (!this.invertedBackgroundImage) return;

        const sx = this.pos.x - this.size / 2;
        const sy = this.pos.y - this.size / 2;
        const sWidth = this.size;
        const sHeight = this.size;

        // 1) globalAlpha 적용
        ctx.save();
        ctx.globalAlpha = this.opacity;

        ctx.drawImage(
            this.invertedBackgroundImage,
            sx, sy, sWidth, sHeight,
            sx, sy, sWidth, sHeight
        );

        ctx.restore();
    }
}
