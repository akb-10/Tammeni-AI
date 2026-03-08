import os
import base64
import fitz  # PyMuPDF
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv # 1. استيراد المكتبة

# مكتبات GitHub Models
from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import (
    SystemMessage, UserMessage, TextContentItem, ImageContentItem, ImageDetailLevel
)
from azure.core.credentials import AzureKeyCredential

# 2. تحميل المتغيرات من ملف .env
load_dotenv()

app = Flask(__name__, static_folder='.')
CORS(app)

# 3. جلب التوكن من البيئة (Environment)
GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

# اختبار بسيط للتأكد من أن السيرفر قرأ التوكن
if not GITHUB_TOKEN:
    print("❌ تنبيه: لم يتم العثور على التوكن في ملف .env")
else:
    print("✅ تم تحميل التوكن بنجاح من الملف السري!")

client = ChatCompletionsClient(
    endpoint="https://models.inference.ai.azure.com", 
    credential=AzureKeyCredential(GITHUB_TOKEN if GITHUB_TOKEN else "")
)

PROMPTS = {
    "ar": "أنت 'طمني'، مساعد طبي ذكي. حلل التقارير بدقة وباللغة العربية.",
    "en": "You are 'Tammeni', a smart medical assistant. Analyze reports accurately in English."
}

@app.route('/')
def home(): return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path): return send_from_directory('.', path)

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        lang = data.get('language', 'ar')
        res = client.complete(
            messages=[SystemMessage(content=PROMPTS[lang]), UserMessage(content=data['message'])], 
            model="gpt-4o-mini"
        )
        return jsonify({'response': res.choices[0].message.content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        file = request.files['file']
        lang = request.form.get('language', 'ar')
        user_content = [TextContentItem(text="Analyze report:" if lang == 'en' else "حلل هذا التقرير:")]
        
        if file.filename.lower().endswith('.pdf'):
            doc = fitz.open(stream=file.read(), filetype="pdf")
            for p in range(min(len(doc), 5)):
                # تحويل صفحات PDF إلى صور بجودة عالية للقراءة
                img = doc[p].get_pixmap(matrix=fitz.Matrix(2,2)).tobytes("jpg")
                user_content.append(ImageContentItem(image_url={"url": f"data:image/jpeg;base64,{base64.encodebytes(img).decode()}"}))
            doc.close()
        else:
            user_content.append(ImageContentItem(image_url={"url": f"data:image/jpeg;base64,{base64.b64encode(file.read()).decode()}"}))
        
        res = client.complete(messages=[SystemMessage(content=PROMPTS[lang]), UserMessage(content=user_content)], model="gpt-4o")
        return jsonify({'response': res.choices[0].message.content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # الحصول على المنفذ من Render أو استخدام 5000 كافتراضي
    port = int(os.environ.get("PORT", 5000))
    # التغيير الأهم: الربط بالعنوان 0.0.0.0
    app.run(host='0.0.0.0', port=port)
