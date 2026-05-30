import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 1. ตั้งค่าที่อยู่ของไฟล์สื่อบน GitHub
// หากไฟล์อยู่ในโฟลเดอร์เดียวกับโค้ด สามารถระบุเป็นค่าว่าง "" ได้เลย (ระบบจะอ่านแบบ Relative Path)
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

// ==========================================
// 2. การตั้งค่าสไลด์ภาพนิ่ง
const IMAGE_DURATION = 10000; // เวลาแสดงรูปภาพ (10 วินาที)
const FADE_DURATION = 1000;   // เวลาในการเฟดเลือนหาย (1 วินาที)
// ==========================================

// ฟังก์ชันแปลงตัวเลขเป็นจำนวนเต็มพร้อมใส่ลูกน้ำ
function formatToIntegerPrice(priceStr) {
    if (!priceStr) return "-";
    const cleanStr = priceStr.toString().replace(/,/g, '');
    const num = Math.round(parseFloat(cleanStr));
    return isNaN(num) ? "-" : num.toLocaleString('en-US');
}

// ฟังก์ชันดึงราคาและจัดการวันที่จาก API
async function fetchGoldTradersPrice() {
    try {
        const response = await fetch('https://api.chnwt.dev/thai-gold-api/latest');
        const data = await response.json();
        if (data.status !== "success") throw new Error("ไม่สามารถดึงข้อมูลจาก API ได้");

        const prices = data.response.price;
        
        let updateDate = data.response.date;
        if (!updateDate || updateDate === "undefined") {
            const today = new Date();
            updateDate = today.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        } else {
            const d = new Date(updateDate);
            if (!isNaN(d)) updateDate = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        
        const updateTime = data.response.update_time || new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        return {
            barBuy: formatToIntegerPrice(prices.gold_bar.buy),
            barSell: formatToIntegerPrice(prices.gold_bar.sell),
            ornamentBuy: formatToIntegerPrice(prices.gold.buy),
            ornamentSell: formatToIntegerPrice(prices.gold.sell),
            updateTime: `อัพเดทราคาล่าสุด: วันที่ ${updateDate} เวลา ${updateTime}`
        };
    } catch (error) {
        console.error("เกิดข้อผิดพลาดในการดึงราคาจาก API:", error);
        return null; 
    }
}

// ฟังก์ชันอัปเดตข้อความบนหน้าจอ
function updateTextData(data) {
    if(data.barBuy !== undefined) document.getElementById('bar-buy').innerText = data.barBuy;
    if(data.barSell !== undefined) document.getElementById('bar-sell').innerText = data.barSell;
    if(data.ornamentBuy !== undefined) document.getElementById('ornament-buy').innerText = data.ornamentBuy;
    if(data.ornamentSell !== undefined) document.getElementById('ornament-sell').innerText = data.ornamentSell;
    if (data.marquee !== undefined) document.getElementById('marquee-text').innerText = data.marquee;
    if (data.updateTime !== undefined) document.getElementById('update-time').innerText = data.updateTime;
}

// ฟังก์ชันหลักในการเล่นสื่อ วนลูปรูปภาพและวิดีโอ
function playCurrentMedia() {
    const mediaContainer = document.getElementById('media-container');

    if (currentPlaylist.length === 0) {
        mediaContainer.innerHTML = `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#333; color:#fff; font-size:2vw;">ไม่พบไฟล์สื่อ...</div>`;
        return;
    }
    
    // เคลียร์ Timer ของรูปภาพเดิมทุกครั้งที่มีการเปลี่ยนไฟล์ (ป้องกันการขัดจังหวะการเล่นวิดีโอ)
    clearTimeout(imageTimer);
    
    if (currentMediaIndex >= currentPlaylist.length) {
        currentMediaIndex = 0; 
    }

    const currentFile = currentPlaylist[currentMediaIndex];

    // ==========================================
    // [โหมดวิดีโอ] บังคับให้เล่นจนจบไฟล์ร้อยเปอร์เซ็นต์
    // ==========================================
    if (currentFile.type === 'video') {
        mediaContainer.innerHTML = ''; // ล้างรูปสไลด์เก่าออกเพื่อเตรียมพื้นที่ให้วิดีโอเต็มจอ

        const videoEl = document.createElement('video');
        videoEl.id = 'signage-video';
        videoEl.src = currentFile.url;
        videoEl.autoplay = true;
        videoEl.muted = true;      // จำเป็นต้องเปิดไว้เพื่อให้ระบบเบราว์เซอร์ยอมรับการ Autoplay
        videoEl.playsInline = true;
        videoEl.style.cssText = "width: 100%; height: 100%; object-fit: fill; background-color: #000;";

        // ฟังก์ชันเมื่อวิดีโอเล่นจบไฟล์อย่างสมบูรณ์
        videoEl.onended = () => {
            currentMediaIndex++;
            playCurrentMedia(); // เรียกคิวถัดไปมารันต่อ
        };

        // ในกรณีที่ไฟล์วิดีโอเสีย หรือโหลดไม่ผ่าน ให้ข้ามไปสไลด์ถัดไปทันที (ป้องกันหน้าจอค้างคิว)
        videoEl.onerror = () => {
            console.error(`ข้ามไฟล์วิดีโอเนื่องจากไม่สามารถโหลดได้: ${currentFile.name}`);
            currentMediaIndex++;
            playCurrentMedia();
        };

        mediaContainer.appendChild(videoEl);

        // สั่ง Execute เล่นวิดีโอ
        let playPromise = videoEl.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error("การเล่นวิดีโออัตโนมัติถูกปิดกั้นโดยระบบรักษาความปลอดภัยเบราว์เซอร์:", error);
                // หากโดนบล็อกการเล่นอัตโนมัติ ให้ทำการข้ามไปเล่นไฟล์ถัดไปทันทีเพื่อไม่ให้จอหน้าร้านมืดค้าง
                currentMediaIndex++;
                playCurrentMedia();
            });
        }
    } 
    // ==========================================
    // [โหมดรูปภาพ] ตั้งเวลาทำงานตาม IMAGE_DURATION (10 วินาที)
    // ==========================================
    else {
        if (mediaContainer.style.position !== 'relative') {
            mediaContainer.style.position = 'relative';
        }

        const existingImg = mediaContainer.querySelector('img.active-fader-img');

        const nextImg = document.createElement('img');
        nextImg.src = currentFile.url;
        nextImg.alt = "Signage Media";
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

                setTimeout(() => {
                    existingImg.remove();
                }, FADE_DURATION);

            } else {
                mediaContainer.innerHTML = ''; 
                nextImg.style.opacity = "1";
                nextImg.classList.add('active-fader-img');
                mediaContainer.appendChild(nextImg);
            }

            // ตั้งเวลาถอยหลัง 10 วินาทีสำหรับรูปภาพนิ่งก่อนจะขยับสไลด์ต่อไป
            imageTimer = setTimeout(() => {
                currentMediaIndex++;
                playCurrentMedia();
            }, IMAGE_DURATION); 
        };
        
        nextImg.onerror = () => {
            console.error(`ข้ามไฟล์ภาพเนื่องจากไม่สามารถโหลดได้: ${currentFile.name}`);
            currentMediaIndex++;
            playCurrentMedia();
        };
    }
}

// เริ่มต้นเล่นสื่อทันทีเมื่อเปิดเบราว์เซอร์
playCurrentMedia();

let autoFetchInterval = null;

// เชื่อมต่อระบบ Firebase Firestore เพื่อสตรีมข้อมูลข้อความตัววิ่งและราคาทองแบบเรียลไทม์
onSnapshot(doc(db, "branches", branchId), async (docSnap) => {
    if (docSnap.exists()) {
        const config = docSnap.data();
        
        if (autoFetchInterval) clearInterval(autoFetchInterval);

        if (config.isAutoMode) {
            const goldPrice = await fetchGoldTradersPrice();
            if (goldPrice && goldPrice.barBuy !== "-") {
                updateTextData({ ...config, ...goldPrice }); 
            } else {
                updateTextData(config); 
            }

            autoFetchInterval = setInterval(async () => {
                const freshPrice = await fetchGoldTradersPrice();
                if (freshPrice && freshPrice.barBuy !== "-") {
                    updateTextData(freshPrice);
                }
            }, 60000);

        } else {
            const manualConfig = { ...config };
            if (manualConfig.barBuy) manualConfig.barBuy = formatToIntegerPrice(manualConfig.barBuy);
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
