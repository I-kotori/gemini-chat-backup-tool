import { chromium, Page, ElementHandle } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as cliProgress from 'cli-progress'; // ✨ 상태바 라이브러리 추가

// ============================================================================
// ⚙️ [환경 설정 / CONFIG]
// ============================================================================
interface ConfigSelectors {
    chatRoom: string;
    menuBtn: string;
    canvasPanel: string;
    userClass: string;
    modelClass: string;
}

interface Config {
    selectors: ConfigSelectors;
}

const CONFIG: Config = {
    selectors: {
        chatRoom: '.conversation-title',
        menuBtn: '[data-test-id="side-nav-menu-button"], [aria-label*="메뉴"], [aria-label*="menu" i]',
        canvasPanel: 'immersive-panel', 
        userClass: 'query-text-line', 
        modelClass: 'markdown-main-panel'
    }
};

async function extractAllChats(): Promise<void> {
    console.log("🚀 로컬 브라우저 디버깅 세션에 연결 중...");
    
    const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
    const contexts = browser.contexts();
    
    const page: Page | undefined = contexts[0].pages().find(p => p.url().includes('gemini.google.com'));
    
    if (!page) {
        console.log("❌ Gemini 탭을 찾을 수 없습니다.");
        await browser.close();
        return;
    }

    console.log("🛡️ 캔버스 패널 팝업을 차단합니다...");
    await page.addStyleTag({
        content: `
            ${CONFIG.selectors.canvasPanel} { 
                display: none !important; 
            }
        `
    });

    const outputDir: string = path.join(__dirname, 'exports');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    let i: number = 0;
    let endOfListCount: number = 0;

    // 초기 대화방 개수 파악
    const initialLinks = await page.$$(CONFIG.selectors.chatRoom);
    
    // ✨ 프로그레스 바 생성 (디자인 커스텀)
    console.log("📦 대화 기록 추출을 시작합니다...\n");
    const progressBar = new cliProgress.SingleBar({
        format: '진행률 | {bar} | {percentage}% | {value}/{total} 개의 대화방 | ETA: {eta}초',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true,
        clearOnComplete: false
    });

    // 상태바 시작 (초기 개수로 세팅)
    progressBar.start(initialLinks.length, 0);

    while (true) {
        let currentLinks = await page.$$(CONFIG.selectors.chatRoom);
        
        // 동적 스크롤 로직
        if (i >= currentLinks.length) {
            progressBar.stop(); // 화면 깨짐 방지를 위해 스크롤 중에는 바를 잠깐 멈춤
            console.log("\n⬇️ 사이드바 끝에 도달했습니다. 추가 대화방을 로딩합니다...");
            
            await page.evaluate((sel: string) => {
                const links = document.querySelectorAll(sel);
                if (links.length > 0) {
                    links[links.length - 1].scrollIntoView();
                }
            }, CONFIG.selectors.chatRoom);
            
            await page.waitForTimeout(2500); 
            currentLinks = await page.$$(CONFIG.selectors.chatRoom); 
            
            if (i >= currentLinks.length) {
                endOfListCount++;
                if (endOfListCount >= 3) {
                    console.log("🛑 3회 연속 추가 대화방이 발견되지 않았습니다. 바닥에 도달했습니다.\n");
                    break; 
                }
                progressBar.start(currentLinks.length, i); // 바 다시 시작
                continue; 
            } else {
                endOfListCount = 0; 
                // ✨ 새 대화방이 로딩되면 전체(total) 개수를 업데이트하고 다시 시작
                progressBar.start(currentLinks.length, i); 
            }
        }
        
        let success: boolean = false;
        let retryCount: number = 0;

        while (retryCount < 5 && !success) {
            try {
                const checkLinks = await page.$$(CONFIG.selectors.chatRoom);
                let isSidebarOpen: boolean = false;
                
                if (checkLinks.length > 0) {
                    isSidebarOpen = await checkLinks[0].isVisible();
                }

                if (!isSidebarOpen) {
                    const menuBtn: ElementHandle<SVGElement | HTMLElement> | null = await page.$(CONFIG.selectors.menuBtn);
                    if (menuBtn) {
                        await menuBtn.click();
                        await page.waitForTimeout(2000); 
                    }
                }

                const safeLinks = await page.$$(CONFIG.selectors.chatRoom);
                if (safeLinks[i]) {
                    await safeLinks[i].click({ timeout: 30000 });
                    await page.waitForTimeout(2000); 
                }

                const selector: string = `.${CONFIG.selectors.userClass}, .${CONFIG.selectors.modelClass}`;

                try {
                    await page.waitForSelector(selector, { state: 'attached', timeout: 15000 });
                } catch (err) {
                    throw new Error("채팅 요소 로딩 시간 초과.");
                }

                let previousCount: number = 0;
                let scrollAttempts: number = 0;
                
                while (true) {
                    const currentCount: number = await page.$$eval(selector, els => els.length);
                    
                    if (previousCount === currentCount) {
                        scrollAttempts++;
                        if (scrollAttempts > 3) break;
                    } else {
                        scrollAttempts = 0;
                    }

                    try {
                        await page.evaluate((sel: string) => {
                            const msgs = document.querySelectorAll(sel);
                            if (msgs.length > 0) {
                                msgs[0].scrollIntoView({ behavior: 'instant', block: 'start' });
                                window.scrollBy(0, -5000); 
                            }
                        }, selector);
                    } catch (scrollErr) {
                        // 무시
                    }

                    await page.waitForTimeout(1500); 
                    previousCount = currentCount;
                }
                
                const finalMessages = await page.$$(selector);
                let chatText: string = "";
                
                for (let j = 0; j < finalMessages.length; j++) {
                    const className: string | null = await finalMessages[j].getAttribute('class');
                    const text: string = await finalMessages[j].innerText();
                    
                    if (text && className) {
                        if (className.includes(CONFIG.selectors.userClass)) {
                            chatText += `### 👤 User\n${text.trim()}\n\n`;
                        } else {
                            chatText += `### 🤖 Gemini\n${text.trim()}\n\n---\n\n`;
                        }
                    }
                }

                if (chatText.trim() === "") {
                    throw new Error("추출된 텍스트가 0자입니다.");
                }

                const fileName: string = `Gemini_Chat_${String(i).padStart(3, '0')}.md`;
                fs.writeFileSync(path.join(outputDir, fileName), chatText);
                
                // ✨ 에러 없이 성공하면 상태바 1칸 올리기
                progressBar.update(i + 1);
                success = true; 

            } catch (e: any) {
                retryCount++;
                const errorMessage = e instanceof Error ? e.message.split('\n')[0] : '알 수 없는 에러';
                
                // 상태바가 깨지지 않게 로그를 잠시 내림
                progressBar.stop();
                console.log(`\n⚠️ 에러 발생 (${retryCount}/5 재시도 중...): ${errorMessage}`);
                
                if (retryCount >= 5) {
                    console.log(`❌ ${i + 1}번 채팅방은 실패. 다음으로 넘어갑니다.\n`);
                } else {
                    await page.waitForTimeout(3000); 
                }
                // 로그 찍고 다시 바 시작
                progressBar.start(currentLinks.length, i);
            }
        }
        
        i++; 
    }

    // ✨ 모든 작업이 끝나면 상태바 종료
    progressBar.stop();
    console.log("🎉 모든 대화 기록 추출이 완료되었습니다! (exports/ 폴더 확인)");
    await browser.close();
}

extractAllChats().catch(console.error);