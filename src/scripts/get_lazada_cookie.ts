import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function getCookie() {
    console.log('🚀 Opening Lazada Login page...');
    console.log('👉 Please LOGIN manually in the opened browser window.');
    console.log('👉 Complete any CAPTCHA or Slider if requested.');

    const browser = await puppeteer.launch({
        headless: false, // Show browser for user interaction
        defaultViewport: null,
        args: ['--window-size=1280,800', '--no-sandbox']
    });

    const page = await browser.newPage();

    // Go to Login page
    try {
        await page.goto('https://member.lazada.vn/user/login', { waitUntil: 'domcontentloaded' });
    } catch (e) {
        console.log('⚠️ Navigation error, but keeping browser open.');
    }

    console.log('⏳ Monitoring cookies... (Cookies will be saved automatically when you login)');

    let lastCookieLength = 0;

    // Monitor loop
    while (true) {
        if (!browser.isConnected()) {
            console.log('❌ Browser closed. Exiting.');
            process.exit(0);
        }

        try {
            const cookies = await page.cookies();
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            // Basic detection of login likely success if we have many cookies and URL is not login
            const currentUrl = page.url();
            const isLoginPage = currentUrl.includes('login') || currentUrl.includes('member.lazada');

            if (cookies.length > 5 && !isLoginPage) {
                fs.writeFileSync('lazada_cookie.txt', cookieString);
                console.log(`✅ Login detected! Cookies saved to 'lazada_cookie.txt' (${cookies.length} cookies).`);
                console.log('🎉 You can close this script and the browser now.');

                // Wait 3s then close
                await new Promise(r => setTimeout(r, 3000));
                await browser.close();
                process.exit(0);
            } else if (cookies.length > 0 && cookieString.length !== lastCookieLength) {
                // Save anyway as interim
                fs.writeFileSync('lazada_cookie.txt', cookieString);
                console.log(`💾 Cookies updated (${cookies.length} cookies)... keep logging in.`);
                lastCookieLength = cookieString.length;
            }

            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            break; // Browser might be closed
        }
    }
}

getCookie();
