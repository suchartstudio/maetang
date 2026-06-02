import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot, collection, addDoc, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่าที่อยู่ของไฟล์สื่อบน GitHub
const GITHUB_BASE_URL = ""; 

const currentPlaylist = [
    { name: "slide1.jpg", type: "image", url: GITHUB_BASE_URL + "slide1.jpg" },
    { name: "slide2.jpg", type: "image", url: GITHUB_BASE_URL + "slide2.jpg" },
    { name: "slide3.jpg", type: "image", url: GITHUB_BASE_URL + "slide3.jpg" },
    { name: "video.mp4", type: "video", url: GITHUB_BASE_URL + "video.mp4" }
];
// ==========================================

const firebaseConfig = {
  apiKey: "AIzaSyCypw3-0kmRKQCtMuVakq4dL-IfQ3UIAG4",
  authDomain: "goldshop-d5860.firebaseapp.com",
  projectId: "goldshop-d5860",
  storageBucket: "goldshop-d5860.firebasestorage.app",
  messagingSenderId: "15818908224",
  appId: "1:15818908224:web:17fc243d2aa671660075a5",
  measurementId: "G-9FP9640SQH"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const branchId = urlParams.get('branch') || '1';

let currentMediaIndex = 0;
let imageTimer = null;

const IMAGE_DURATION = 10000; 
const FADE_DURATION = 1000;   

// ==========================================
// 2. ระบบจัดการประวัติราคา (สำหรับ Dashboard)
// ==========================================
let lastRecordedPrice = null;

async function initLastRecordedPrice() {
    try {
        const q = query(collection(db, "price_history"), orderBy("timestamp", "desc"), limit(1));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            lastRecordedPrice = snapshot.docs[0].data().buyPrice;
        }
    } catch (e) {
        console.error("ไม่สามารถดึงประวัติราคาล่าสุดได้:", e);
    }
}
initLastRecordedPrice();

async function checkAndRecordPrice(currentBuyPrice) {
    if (!currentBuyPrice || isNaN(currentBuyPrice)) return;
    
    if (lastRecordedPrice === null || currentBuyPrice !== lastRecordedPrice) {
        try {
            await addDoc(collection(db, "price_history"), {
                buyPrice: currentBuyPrice,
                timestamp: new Date()
            });
            lastRecordedPrice = currentBuyPrice;
        } catch (error) {
            console.error("บันทึกประวัติราคาล้มเหลว:", error);
        }
    }
}

function formatToIntegerPrice(priceStr) {
    if (!priceStr) return "-";
    const cleanStr = priceStr.toString().replace(/,/g, '');
    const num = Math.round(parseFloat(cleanStr));
    return isNaN(num) ? "-" : num.toLocaleString('en-US');
}

// ==========================================
// 3. ฟังก์ชันดึงราคาใหม่จาก "ฮั่วเซ่งเฮง"
// ==========================================
async function fetchHuaSengHengPrice() {
    try {
        const targetUrl = 'https://apicheckpricev3.huasengheng.com/api/Values/GetPrice';
        let data = null;

        try {
            // 1. ลองดึงข้อมูลจากฮั่วเซ่งเฮงโดยตรง
            const res = await fetch(targetUrl, { cache: "no-store" });
            data = await res.json();
        } catch (e) {
            // 2. หากเบราว์เซอร์บล็อกความปลอดภัย (CORS) ให้สลับไปผ่านระบบ Proxy อัตโนมัติ
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&cb=${Date.now()}`;
            const res = await fetch(proxyUrl);
            const proxyData = await res.json();
            data = JSON.parse(proxyData.contents);
        }

        if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error("ไม่สามารถอ่านข้อมูลจากฮั่วเซ่งเฮงได้");
        }

        // โครงสร้างข้อมูลฮั่วเซ่งเฮง: Array[0] มักจะเป็นทองแท่ง, Array[1] มักจะเป็นทองรูปพรรณ
        const barData = data[0];
        const ornData = data.length > 1 ? data[1] : data[0];

        return {
            rawBarBuy: parseFloat(barData.Buy.toString().replace(/,/g, '')), 
            barBuy: formatToIntegerPrice(barData.Buy),
            barSell: formatToIntegerPrice(barData.Sell),
            ornamentBuy: formatToIntegerPrice(ornData.Buy),
            ornamentSell: formatToIntegerPrice(ornData.Sell),
            updateTime: barData.StrTimeUpdate || `อัพเดทราคาล่าสุด: วันที่ ${new Date().toLocaleDateString('th-TH')}`
        };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงราคาจาก ฮั่วเซ่งเฮง:", error);
        return null; 
    }
}

function updateTextData(data) {
    if(data.barBuy !== undefined) document.getElementById('bar-buy').innerText = data.barBuy;
    if(data.barSell !== undefined) document.getElementById('bar-sell').innerText = data.barSell;
    if(data.ornamentBuy !== undefined) document.getElementById('ornament-buy').innerText = data.ornamentBuy;
    if(data.ornamentSell !== undefined) document.getElementById('ornament-sell').innerText = data.ornamentSell;
    if (data.marquee !== undefined) document.getElementById('marquee-text').innerText = data.marquee;
    if (data.updateTime !== undefined) document.getElementById('update-time').innerText = data.updateTime;
}

function playCurrentMedia() {
    const mediaContainer = document.getElementById('media-container');

    if (currentPlaylist.length === 0) {
        mediaContainer.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#333; color:#fff; font-size:2vw;">ไม่พบไฟล์สื่อ...</div>`;
        return;
    }
    
    clearTimeout(imageTimer);
    if (currentMediaIndex >= currentPlaylist.length) currentMediaIndex = 0; 
    const currentFile = currentPlaylist[currentMediaIndex];

    if (currentFile.type === 'video') {
        mediaContainer.innerHTML = ''; 
        const videoEl = document.createElement('video');
        videoEl.src = currentFile.url;
        videoEl.autoplay = true;
        videoEl.muted = true;      
        videoEl.playsInline = true;
        videoEl.style.cssText = "width: 100%; height: 100%; object-fit: fill; background-color: #000;";

        videoEl.onended = () => { currentMediaIndex++; playCurrentMedia(); };
        videoEl.onerror = () => { currentMediaIndex++; playCurrentMedia(); };

        mediaContainer.appendChild(videoEl);
        let playPromise = videoEl.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => { currentMediaIndex++; playCurrentMedia(); });
        }
    } 
    else {
        if (mediaContainer.style.position !== 'relative') mediaContainer.style.position = 'relative';
        const existingImg = mediaContainer.querySelector('img.active-fader-img');
        const nextImg = document.createElement('img');
        nextImg.src = currentFile.url;
        nextImg.className = "fader-img"; 
        nextImg.style.cssText = `position: absolute; top:0; left:0; width: 100%; height: 100%; object-fit: fill; opacity: 0; transition: opacity ${FADE_DURATION}ms ease-in-out;`;

        nextImg.onload = () => {
            if (existingImg) {
                nextImg.style.zIndex = "1";
                mediaContainer.appendChild(nextImg);
                existingImg.style.zIndex = "1";
                nextImg.style.zIndex = "2";
                void nextImg.offsetWidth; 
                nextImg.style.opacity = "1";
                existingImg.style.opacity = "0";
                existingImg.classList.remove('active-fader-img');
                nextImg.classList.add('active-fader-img');
                setTimeout(() => { existingImg.remove(); }, FADE_DURATION);
            } else {
                mediaContainer.innerHTML = ''; 
                nextImg.style.opacity = "1";
                nextImg.classList.add('active-fader-img');
                mediaContainer.appendChild(nextImg);
            }
            imageTimer = setTimeout(() => { currentMediaIndex++; playCurrentMedia(); }, IMAGE_DURATION); 
        };
        nextImg.onerror = () => { currentMediaIndex++; playCurrentMedia(); };
    }
}

playCurrentMedia();
let autoFetchInterval = null;

onSnapshot(doc(db, "branches", branchId), async (docSnap) => {
    if (docSnap.exists()) {
        const config = docSnap.data();
        if (autoFetchInterval) clearInterval(autoFetchInterval);

        if (config.isAutoMode) {
            const goldPrice = await fetchHuaSengHengPrice(); // เรียกใช้ API ใหม่
            if (goldPrice && goldPrice.barBuy !== "-") {
                updateTextData({ ...config, ...goldPrice }); 
                checkAndRecordPrice(goldPrice.rawBarBuy); 
            } else {
                updateTextData(config); 
            }

            autoFetchInterval = setInterval(async () => {
                const freshPrice = await fetchHuaSengHengPrice(); // ตรวจสอบราคาทุกนาที
                if (freshPrice && freshPrice.barBuy !== "-") {
                    updateTextData(freshPrice);
                    checkAndRecordPrice(freshPrice.rawBarBuy);
                }
            }, 60000);

        } else {
            const manualConfig = { ...config };
            if (manualConfig.barBuy) {
                const rawManualPrice = parseFloat(manualConfig.barBuy.toString().replace(/,/g, ''));
                checkAndRecordPrice(rawManualPrice);
                manualConfig.barBuy = formatToIntegerPrice(manualConfig.barBuy);
            }
            if (manualConfig.barSell) manualConfig.barSell = formatToIntegerPrice(manualConfig.barSell);
            if (manualConfig.ornamentBuy) manualConfig.ornamentBuy = formatToIntegerPrice(manualConfig.ornamentBuy);
            if (manualConfig.ornamentSell) manualConfig.ornamentSell = formatToIntegerPrice(manualConfig.ornamentSell);
            
            if (config.updatedAt) {
                const d = config.updatedAt.toDate();
                const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
                const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
                manualConfig.updateTime = `อัพเดทราคาล่าสุด (กำหนดเอง): วันที่ ${dateStr} เวลา ${timeStr}`;
            } else {
                manualConfig.updateTime = `อัพเดทราคาล่าสุด (กำหนดเอง): -`;
            }

            updateTextData(manualConfig);
        }
    }
});
