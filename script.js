let currentLang = 'ar';
const API_URL = 'https://tammeni-ai.onrender.com';

// العناصر الأساسية
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const welcomeCard = document.getElementById('welcomeCard');
const langBtn = document.getElementById('langBtn');
const langText = document.getElementById('langText');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');

// 1. نظام تبديل اللغة الاحترافي
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('tammeni-lang', lang);
    
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    langText.textContent = lang === 'ar' ? 'EN' : 'عربي';

    // تحديث كل العناصر
    document.querySelectorAll('[data-ar][data-en]').forEach(el => {
        el.textContent = el.getAttribute(`data-${lang}`);
    });

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
            addMessage(currentLang === 'ar' ? "جاري تحليل التقرير الطبي..." : "Analyzing medical report...", 'user');
            response = await fetch(`${API_URL}/analyze`, { method: 'POST', body: formData });
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        removeLoading(loadingId);
        
        if (data.response) {
            addMessage(data.response, 'assistant');
        } else if (data.error) {
            addMessage(`عذراً، حدث خطأ: ${data.error}`, 'assistant');
        }

    } catch (e) {
        removeLoading(loadingId);
        addMessage(currentLang === 'ar' ? "عذراً، تعذر الاتصال بالخادم. يرجى المحاولة مرة أخرى." : "Server connection failed. Please try again.", 'assistant');
        console.error("Fetch Error:", e);
    }
}

// 3. المستمعات (Event Listeners)
langBtn.onclick = () => setLanguage(currentLang === 'ar' ? 'en' : 'ar');

// التحديث: دعم نموذج Form وزر الإرسال
document.getElementById('chatForm').onsubmit = (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (text) { 
        handleAction('chat', text); 
        messageInput.value = ''; 
    }
};

// التحديث: الإرسال باستخدام زر Enter (و Shift+Enter لسطر جديد)
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('sendBtn').click();
    }
});

attachBtn.onclick = () => document.getElementById('fileInput').click();

document.getElementById('fileInput').onchange = (e) => {
    if (e.target.files[0]) {
        handleAction('upload', e.target.files[0]);
        e.target.value = ''; // تصفير الحقل ليقبل نفس الملف لاحقاً
    }
};

// تفعيل الأزرار المقترحة
document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.onclick = () => {
        const msg = btn.getAttribute(`data-message-${currentLang}`);
        handleAction('chat', msg);
    };
});

// دوال إدارة واجهة المحادثة
function addMessage(text, role) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    // تحويل العلامات ** إلى نص غامق والأسطر الجديدة
    let formattedText = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    div.innerHTML = `<div class="message-content">${formattedText}</div>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showLoading() {
    // التحديث: تعطيل الأزرار لمنع الإرسال المتكرر
    messageInput.disabled = true;
    sendBtn.disabled = true;
    attachBtn.disabled = true;

    const id = 'load-' + Date.now();
    const div = document.createElement('div');
    div.id = id; 
    div.className = 'message assistant';
    div.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return id;
}

function removeLoading(id) { 
    // التحديث: إعادة تفعيل الأزرار
    messageInput.disabled = false;
    sendBtn.disabled = false;
    attachBtn.disabled = false;
    messageInput.focus();

    document.getElementById(id)?.remove(); 
}

// تهيئة اللغة عند الفتح
setLanguage(localStorage.getItem('tammeni-lang') || 'ar');
