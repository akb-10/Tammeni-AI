import os
import base64
import fitz  # PyMuPDF
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from azure.ai.inference import ChatCompletionsClient
from azure.ai.inference.models import (
    SystemMessage, UserMessage, TextContentItem, ImageContentItem
)
from azure.core.credentials import AzureKeyCredential

load_dotenv()

app = Flask(__name__, static_folder='.')

# التحديث: حماية الخادم وتقييد الوصول لموقعك فقط (والمحلي للتطوير)
CORS(app, resources={r"/*": {"origins": ["https://akb-10.github.io", "http://localhost:5000", "http://127.0.0.1:5000"]}})

GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')

if not GITHUB_TOKEN:
    print("❌ تنبيه: لم يتم العثور على التوكن في ملف .env")
else:
    print("✅ تم تحميل التوكن بنجاح من الملف السري!")

client = ChatCompletionsClient(
    endpoint="https://models.inference.ai.azure.com", 
    credential=AzureKeyCredential(GITHUB_TOKEN if GITHUB_TOKEN else "")
)

# التحديث: هندسة أوامر طبية احترافية لتنظيم الردود
PROMPTS = {
    "ar": """أنت 'طمني'، مساعد طبي ذكي ومحترف. مهمتك قراءة التقارير الطبية وتبسيطها للمريض.
التزم بالقواعد التالية بصرامة:
1. استخرج اسم التحليل، النتيجة الحالية، والمعدل الطبيعي (Reference Range).
2. اشرح النتيجة بلغة بسيطة جداً يسهل على الشخص العادي فهمها، واستخدم النقاط والخط الغامق للتنظيم.
3. لا تقدم أي تشخيص طبي قاطع أو تصف أدوية.
4. اختتم إجابتك دائماً بعبارة: 'تنبيه: هذه القراءة لا تغني عن استشارة الطبيب المعالج.'""",
    
    "en": """You are 'Tammeni', a professional smart medical assistant. Your task is to read medical reports and simplify them.
Strict Rules:
1. Extract the test name, current result, and reference range.
2. Explain the result in very simple, layman's terms. Use bullet points and bold text for a clean structure.
3. Do not provide a definitive medical diagnosis or prescribe medication.
4. Always conclude with: 'Disclaimer: This reading does not replace consulting your doctor.'"""
}

@app.route('/')
def home(): 
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_proxy(path): 
    return send_from_directory('.', path)

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
        if 'file' not in request.files:
            return jsonify({'error': 'لم يتم العثور على ملف' }), 400
            
        file = request.files['file']
        lang = request.form.get('language', 'ar')
        
        # التحديث: حماية الذاكرة (منع الملفات الأكبر من 5 ميجابايت)
        file_bytes = file.read()
        if len(file_bytes) > 5 * 1024 * 1024:
            error_msg = "حجم الملف يتجاوز الحد المسموح به (5MB)" if lang == 'ar' else "File size exceeds the 5MB limit"
            return jsonify({'error': error_msg}), 400

        user_content = [TextContentItem(text="Analyze this medical report:" if lang == 'en' else "قم بتحليل هذا التقرير الطبي:")]
        
        if file.filename.lower().endswith('.pdf'):
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            for p in range(min(len(doc), 5)):
                img = doc[p].get_pixmap(matrix=fitz.Matrix(2,2)).tobytes("jpg")
                user_content.append(ImageContentItem(image_url={"url": f"data:image/jpeg;base64,{base64.encodebytes(img).decode()}"}))
            doc.close()
        else:
            user_content.append(ImageContentItem(image_url={"url": f"data:image/jpeg;base64,{base64.b64encode(file_bytes).decode()}"}))
        
        res = client.complete(
            messages=[SystemMessage(content=PROMPTS[lang]), UserMessage(content=user_content)], 
            model="gpt-4o"
        )
        return jsonify({'response': res.choices[0].message.content})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)
