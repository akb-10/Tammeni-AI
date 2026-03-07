let currentLang = 'ar';
const API_URL = 'http://127.0.0.1:5000';

// العناصر الأساسية
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const welcomeCard = document.getElementById('welcomeCard');
const langBtn = document.getElementById('langBtn');
const langText = document.getElementById('langText');

// 1. نظام تبديل اللغة الاحترافي
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('tammeni-lang', lang);
    
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    langText.textContent = lang === 'ar' ? 'EN' : 'عربي';

    // تحديث كل العناصر التي تحتوي على data-ar و data-en
    document.querySelectorAll('[data-ar][data-en]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });

    // تحديث الـ Placeholder
    const placeholder = messageInput.getAttribute(`data-placeholder-${lang}`);
    messageInput.placeholder = placeholder;
}

// 2. إرسال الرسائل والملفات
async function handleAction(type, content) {
    if (welcomeCard) welcomeCard.style.display = 'none';
    const loadingId = showLoading();

    try {
        let response;
        if (type === 'chat') {
            addMessage(content, 'user');
            response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: content, language: currentLang })
            });
        } else {
            const formData = new FormData();
            formData.append('file', content);
            formData.append('language', currentLang);
            addMessage(currentLang === 'ar' ? "جاري تحليل الملف..." : "Analyzing file...", 'user');
            response = await fetch(`${API_URL}/analyze`, { method: 'POST', body: formData });
        }

        const data = await response.json();
        removeLoading(loadingId);
        if (data.response) addMessage(data.response, 'assistant');
    } catch (e) {
        removeLoading(loadingId);
        addMessage(currentLang === 'ar' ? "تعذر الاتصال بالسيرفر" : "Server connection failed", 'assistant');
    }
}

// 3. المستمعات (Event Listeners)
langBtn.onclick = () => setLanguage(currentLang === 'ar' ? 'en' : 'ar');

document.getElementById('sendBtn').onclick = () => {
    const text = messageInput.value.trim();
    if (text) { handleAction('chat', text); messageInput.value = ''; }
};

document.getElementById('attachBtn').onclick = () => document.getElementById('fileInput').click();

document.getElementById('fileInput').onchange = (e) => {
    if (e.target.files[0]) handleAction('upload', e.target.files[0]);
};

// تفعيل الأزرار المقترحة (Quick Actions)
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.onclick = () => {
        const msg = btn.getAttribute(`data-message-${currentLang}`);
        handleAction('chat', msg);
    };
});

// دالة إضافة الرسائل والتنسيق
function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    div.innerHTML = `<div class="message-content">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoading() {
    const id = 'load-' + Date.now();
    const div = document.createElement('div');
    div.id = id; div.className = 'message assistant';
    div.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(div);
    return id;
}

function removeLoading(id) { document.getElementById(id)?.remove(); }

// تهيئة اللغة عند الفتح
setLanguage(localStorage.getItem('tammeni-lang') || 'ar');