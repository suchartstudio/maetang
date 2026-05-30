import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

window.checkLogin = function() {
    const pass = document.getElementById('password').value;
    if (pass === "987654321") {
        document.getElementById('login-section').style.display = "none";
        document.getElementById('admin-section').style.display = "block";
        loadCurrentSettings();
    } else {
        alert("รหัสผ่านไม่ถูกต้อง");
    }
};

window.toggleMode = function() {
    const mode = document.getElementById('mode-select').value;
    document.getElementById('manual-inputs').style.display = (mode === 'manual') ? 'block' : 'none';
};

window.saveSettings = async function() {
    const branchId = document.getElementById('branch-select').value;
    const mode = document.getElementById('mode-select').value;
    const isAutoMode = (mode === 'auto');
    const marqueeText = document.getElementById('marquee-input').value;
    const mediaInput = document.getElementById('media-input').value; 
    const saveBtn = document.getElementById('save-btn');
    
    saveBtn.innerText = "กำลังบันทึกข้อมูล...";
    saveBtn.disabled = true;

    try {
        const dataToSave = {
            isAutoMode: isAutoMode,
            marquee: marqueeText,
            mediaUrl: mediaInput,
            updatedAt: new Date()
        };

        if (!isAutoMode) {
            dataToSave.barBuy = document.getElementById('bar-buy-input').value;
            dataToSave.barSell = document.getElementById('bar-sell-input').value;
            dataToSave.ornamentBuy = document.getElementById('orn-buy-input').value;
            dataToSave.ornamentSell = document.getElementById('orn-sell-input').value;
        }

        await setDoc(doc(db, "branches", branchId), dataToSave, { merge: true });
        alert(`บันทึกข้อมูลสาขา ${branchId} เรียบร้อยแล้ว!`);
        
    } catch (error) {
        console.error("Error: ", error);
        alert("เกิดข้อผิดพลาด: " + error.message);
    } finally {
        saveBtn.innerText = "บันทึกและอัปเดตหน้าจอ";
        saveBtn.disabled = false;
    }
};

window.loadCurrentSettings = async function() {
    const branchId = document.getElementById('branch-select').value;
    const docSnap = await getDoc(doc(db, "branches", branchId));

    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('mode-select').value = data.isAutoMode ? "auto" : "manual";
        window.toggleMode();
        
        document.getElementById('marquee-input').value = data.marquee || "";
        document.getElementById('media-input').value = data.mediaUrl || "";
        
        if (!data.isAutoMode) {
            document.getElementById('bar-buy-input').value = data.barBuy || "";
            document.getElementById('bar-sell-input').value = data.barSell || "";
            document.getElementById('orn-buy-input').value = data.ornamentBuy || "";
            document.getElementById('orn-sell-input').value = data.ornamentSell || "";
        }
    } else {
        document.getElementById('marquee-input').value = "";
        document.getElementById('media-input').value = "";
    }
}

document.getElementById('branch-select').addEventListener('change', loadCurrentSettings);