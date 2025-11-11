class CarPlateChecker {
    constructor() {
        this.currentStream = null;
        this.isFrontCamera = true;
        this.capturedImageData = null;
        this.init();
    }

    init() {
        // Элементы камеры
        this.video = document.getElementById('cameraVideo');
        this.canvas = document.getElementById('cameraCanvas');
        this.captureBtn = document.getElementById('captureBtn');
        this.switchCamera = document.getElementById('switchCamera');
        this.previewImg = document.getElementById('previewImg');
        this.retakeBtn = document.getElementById('retakeBtn');
        this.processBtn = document.getElementById('processBtn');
        
        // Элементы режимов
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.cameraMode = document.getElementById('cameraMode');
        this.manualMode = document.getElementById('manualMode');
        
        // Элементы распознавания
        this.recognitionStatus = document.getElementById('recognitionStatus');
        this.recognitionResult = document.getElementById('recognitionResult');
        this.recognizedPlate = document.getElementById('recognizedPlate');
        this.useRecognized = document.getElementById('useRecognized');
        this.tryAgain = document.getElementById('tryAgain');
        
        // Элементы ручного ввода
        this.plateInput = document.getElementById('plateInput');
        this.checkButton = document.getElementById('checkButton');
        
        // Элементы результатов
        this.loading = document.getElementById('loading');
        this.result = document.getElementById('result');
        this.error = document.getElementById('error');
        this.screenshotContainer = document.getElementById('screenshotContainer');
        this.plateNumber = document.getElementById('plateNumber');
        this.newCheckButton = document.getElementById('newCheck');
        this.retryButton = document.getElementById('retryButton');

        this.bindEvents();
        this.initTelegram();
        this.startCamera();
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
        }
    }

    bindEvents() {
        // Переключение режимов
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Камера
        this.captureBtn.addEventListener('click', () => this.captureImage());
        this.switchCamera.addEventListener('click', () => this.switchCameraFn());
        this.retakeBtn.addEventListener('click', () => this.retakePhoto());
        this.processBtn.addEventListener('click', () => this.processImage());

        // Распознавание
        this.useRecognized.addEventListener('click', () => this.useRecognizedPlate());
        this.tryAgain.addEventListener('click', () => this.retakePhoto());

        // Ручной ввод
        this.checkButton.addEventListener('click', () => this.checkPlate());
        this.plateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkPlate();
        });
        
        this.plateInput.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            e.target.value = value;
        });

        // Общие
        this.newCheckButton.addEventListener('click', () => this.resetForm());
        this.retryButton.addEventListener('click', () => this.resetForm());
    }

    switchMode(mode) {
        // Обновляем активные кнопки
        this.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Показываем соответствующий контент
        this.cameraMode.classList.toggle('active', mode === 'camera');
        this.manualMode.classList.toggle('active', mode === 'manual');

        if (mode === 'camera') {
            this.startCamera();
        } else {
            this.stopCamera();
        }
    }

    async startCamera() {
        try {
            this.stopCamera();
            
            const constraints = {
                video: {
                    facingMode: this.isFrontCamera ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.currentStream;
            
            // Показываем контейнер камеры
            document.getElementById('cameraContainer').classList.remove('hidden');
            document.getElementById('capturedImage').classList.add('hidden');
            
        } catch (error) {
            console.error('Ошибка камеры:', error);
            this.showError('Не удалось подключить камеру');
        }
    }

    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => track.stop());
            this.currentStream = null;
        }
    }

    switchCameraFn() {
        this.isFrontCamera = !this.isFrontCamera;
        this.startCamera();
    }

    captureImage() {
        const context = this.canvas.getContext('2d');
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        context.drawImage(this.video, 0, 0);
        
        // Сохраняем данные изображения
        this.capturedImageData = this.canvas.toDataURL('image/jpeg');
        this.previewImg.src = this.capturedImageData;
        
        // Показываем превью
        document.getElementById('cameraContainer').classList.add('hidden');
        document.getElementById('capturedImage').classList.remove('hidden');
        
        this.stopCamera();
    }

    retakePhoto() {
        document.getElementById('capturedImage').classList.add('hidden');
        this.recognitionResult.classList.add('hidden');
        this.recognitionStatus.classList.add('hidden');
        this.startCamera();
    }

    async processImage() {
        this.recognitionStatus.classList.remove('hidden');
        
        try {
            // Используем Tesseract.js для распознавания текста
            const recognizedText = await this.recognizeWithTesseract(this.capturedImageData);
            const plateNumber = this.extractPlateNumber(recognizedText);
            
            this.showRecognitionResult(plateNumber);
            
        } catch (error) {
            console.error('Ошибка распознавания:', error);
            this.showRecognitionResult('Не удалось распознать');
        } finally {
            this.recognitionStatus.classList.add('hidden');
        }
    }

    async recognizeWithTesseract(imageData) {
        // Динамически загружаем Tesseract
        const { createWorker } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js');
        
        const worker = await createWorker('rus', 1, {
            logger: m => console.log(m)
        });

        try {
            const { data: { text } } = await worker.recognize(imageData);
            await worker.terminate();
            return text;
        } catch (error) {
            await worker.terminate();
            throw error;
        }
    }

    extractPlateNumber(text) {
        // Очищаем текст и ищем российские номера
        const cleanText = text.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
        
        // Паттерны для российских номеров
        const patterns = [
            /[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}/, // Стандартный
            /[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}/, // Две буквы в начале
            /\d{4}[АВЕКМНОРСТУХ]{2}\d{2,3}/  // Номера прицепов
        ];

        for (const pattern of patterns) {
            const match = cleanText.match(pattern);
            if (match) {
                return match[0];
            }
        }

        // Если не нашли по паттерну, пытаемся найти любую комбинацию из 6-9 символов
        const potentialPlate = cleanText.match(/[A-ZА-Я0-9]{6,9}/);
        return potentialPlate ? potentialPlate[0] : 'Не распознан';
    }

    showRecognitionResult(plateNumber) {
        this.recognizedPlate.textContent = plateNumber;
        this.recognitionResult.classList.remove('hidden');
    }

    useRecognizedPlate() {
        const plate = this.recognizedPlate.textContent;
        if (plate && plate !== 'Не распознан') {
            this.checkAvtocod(plate);
        }
    }

    validatePlate(plate) {
        if (!plate) return false;
        
        const patterns = [
            /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/,
            /^[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}$/,
            /^[АВЕКМНОРСТУХ]{2}\d{4}\d{2,3}$/,
            /^\d{4}[АВЕКМНОРСТУХ]{2}\d{2,3}$/
        ];
        
        return patterns.some(pattern => pattern.test(plate));
    }

    async checkPlate() {
        const plate = this.plateInput.value.trim();
        
        if (!this.validatePlate(plate)) {
            this.showError('Введите корректный госномер');
            return;
        }

        this.checkAvtocod(plate);
    }

    async checkAvtocod(plate) {
        this.showLoading();
        
        try {
            const result = await this.getAvtocodData(plate);
            this.showResult(plate, result);
        } catch (error) {
            console.error('Error:', error);
            this.showError('Не удалось получить данные. Попробуйте позже.');
        }
    }

    async getAvtocodData(plate) {
        const avtocodUrl = `https://avtocod.ru/proverkaavto/${plate}`;
        
        try {
            // Используем CORS proxy
            const proxyUrl = 'https://api.allorigins.win/raw?url=';
            const targetUrl = encodeURIComponent(avtocodUrl);
            
            const response = await fetch(proxyUrl + targetUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const html = await response.text();
            return this.extractDataFromHTML(html, plate);
            
        } catch (error) {
            console.warn('Proxy failed, showing direct link');
            return {
                directUrl: avtocodUrl,
                data: null
            };
        }
    }

    extractDataFromHTML(html, plate) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const carData = {
            directUrl: `https://avtocod.ru/proverkaavto/${plate}`,
            vin: this.extractVIN(doc),
            brand: this.extractBrand(doc),
            year: this.extractYear(doc),
            color: this.extractColor(doc),
            engine: this.extractEngine(doc),
            power: this.extractPower(doc)
        };

        return carData;
    }

    extractVIN(doc) {
        return doc.querySelector('[data-vin]')?.getAttribute('data-vin') || 
               doc.querySelector('.vin-code')?.textContent?.trim() ||
               'Не найден';
    }

    extractBrand(doc) {
        return doc.querySelector('.car-brand')?.textContent?.trim() ||
               doc.querySelector('[class*="brand"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractYear(doc) {
        return doc.querySelector('.car-year')?.textContent?.trim() ||
               doc.querySelector('[class*="year"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractColor(doc) {
        return doc.querySelector('.car-color')?.textContent?.trim() ||
               doc.querySelector('[class*="color"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractEngine(doc) {
        return doc.querySelector('.car-engine')?.textContent?.trim() ||
               doc.querySelector('[class*="engine"]')?.textContent?.trim() ||
               'Не указан';
    }

    extractPower(doc) {
        return doc.querySelector('.car-power')?.textContent?.trim() ||
               doc.querySelector('[class*="power"]')?.textContent?.trim() ||
               'Не указан';
    }

    showLoading() {
        this.hideAll();
        this.loading.classList.remove('hidden');
    }

    showResult(plate, data) {
        this.hideAll();
        this.plateNumber.textContent = plate;
        
        let resultHTML = '';
        
        if (data.directUrl && !data.vin) {
            resultHTML = `
                <div class="direct-link">
                    <p>Данные успешно получены с Avtocod!</p>
                    <p>Для просмотра полного отчета перейдите по ссылке:</p>
                    <a href="${data.directUrl}" target="_blank" class="direct-link-btn">
                        📊 Открыть полный отчет на Avtocod
                    </a>
                    <div class="link-info">
                        <small>Ссылка откроется в браузере с полными данными об автомобиле</small>
                    </div>
                </div>
            `;
        } else {
            resultHTML = `
                <div class="parsed-data">
                    <div class="data-grid">
                        <div class="data-item">
                            <span class="label">VIN:</span>
                            <span class="value">${data.vin}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Марка:</span>
                            <span class="value">${data.brand}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Год:</span>
                            <span class="value">${data.year}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Цвет:</span>
                            <span class="value">${data.color}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Двигатель:</span>
                            <span class="value">${data.engine}</span>
                        </div>
                        <div class="data-item">
                            <span class="label">Мощность:</span>
                            <span class="value">${data.power}</span>
                        </div>
                    </div>
                    <div class="full-report">
                        <a href="${data.directUrl}" target="_blank" class="direct-link-btn">
                            📊 Полный отчет на Avtocod
                        </a>
                    </div>
                </div>
            `;
        }
        
        this.screenshotContainer.innerHTML = resultHTML;
        this.result.classList.remove('hidden');
    }

    showError(message) {
        this.hideAll();
        this.error.querySelector('p').textContent = message;
        this.error.classList.remove('hidden');
    }

    hideAll() {
        this.loading.classList.add('hidden');
        this.result.classList.add('hidden');
        this.error.classList.add('hidden');
        this.recognitionStatus.classList.add('hidden');
        this.recognitionResult.classList.add('hidden');
    }

    resetForm() {
        this.hideAll();
        this.plateInput.value = '';
        this.switchMode('camera');
    }
}

// Добавляем стили для данных
const additionalStyles = `
    .direct-link {
        text-align: center;
        padding: 20px;
    }
    
    .direct-link-btn {
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        text-decoration: none;
        font-weight: 600;
        margin: 15px 0;
        transition: all 0.3s ease;
    }
    
    .direct-link-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
    }
    
    .link-info {
        margin-top: 10px;
    }
    
    .parsed-data {
        padding: 10px;
    }
    
    .data-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
        margin-bottom: 20px;
    }
    
    .data-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: #f8f9fa;
        border-radius: 8px;
    }
    
    .data-item .label {
        font-weight: 600;
        color: #666;
    }
    
    .data-item .value {
        font-weight: 500;
        color: #333;
    }
    
    .full-report {
        text-align: center;
        border-top: 1px solid #e1e5e9;
        padding-top: 20px;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    new CarPlateChecker();
});
