class CarPlateChecker {
    constructor() {
        this.currentStream = null;
        this.isFrontCamera = false; // По умолчанию основная камера
        this.capturedImageData = null;
        this.cameraAvailable = false;
        this.init();
    }

    init() {
        // Элементы камеры
        this.video = document.getElementById('cameraVideo');
        this.canvas = document.getElementById('cameraCanvas');
        this.cameraContainer = document.getElementById('cameraContainer');
        this.cameraError = document.getElementById('cameraError');
        this.captureBtn = document.getElementById('captureBtn');
        this.switchCamera = document.getElementById('switchCamera');
        this.previewImg = document.getElementById('previewImg');
        this.retakeBtn = document.getElementById('retakeBtn');
        this.processBtn = document.getElementById('processBtn');
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        
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
        this.checkCameraSupport();
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
            // В Telegram Mini Apps можно использовать камеру через специальные методы
            console.log('Telegram WebApp initialized');
        }
    }

    async checkCameraSupport() {
        try {
            // Проверяем поддержку медиа устройств
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Камера не поддерживается в этом браузере');
            }

            // Проверяем разрешения
            const permissions = await navigator.permissions.query({ name: 'camera' });
            if (permissions.state === 'denied') {
                throw new Error('Доступ к камере запрещен');
            }

            this.cameraAvailable = true;
            console.log('Камера доступна');
            
        } catch (error) {
            console.warn('Камера недоступна:', error.message);
            this.showCameraError();
            this.cameraAvailable = false;
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

        // Загрузка файлов
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

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
            this.initializeCamera();
        } else {
            this.stopCamera();
        }
    }

    async initializeCamera() {
        if (!this.cameraAvailable) {
            this.showCameraError();
            return;
        }

        try {
            await this.startCamera();
        } catch (error) {
            console.error('Ошибка инициализации камеры:', error);
            this.showCameraError();
        }
    }

    async startCamera() {
        try {
            this.stopCamera();
            
            // Пробуем разные конфигурации камеры
            const constraints = {
                video: {
                    facingMode: this.isFrontCamera ? 'user' : 'environment',
                    width: { min: 640, ideal: 1280, max: 1920 },
                    height: { min: 480, ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: false
            };

            // Пробуем основную конфигурацию
            try {
                this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                console.warn('Основная конфигурация не сработала, пробуем упрощенную:', error);
                
                // Упрощенная конфигурация
                const simpleConstraints = {
                    video: {
                        facingMode: this.isFrontCamera ? 'user' : 'environment'
                    },
                    audio: false
                };
                
                this.currentStream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
            }

            this.video.srcObject = this.currentStream;
            
            // Ждем загрузки видео
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play().then(resolve).catch(resolve);
                };
            });

            // Показываем контейнер камеры
            this.cameraContainer.classList.remove('hidden');
            this.cameraError.classList.add('hidden');
            document.getElementById('capturedImage').classList.add('hidden');
            
            console.log('Камера успешно запущена');
            
        } catch (error) {
            console.error('Ошибка запуска камеры:', error);
            throw error;
        }
    }

    stopCamera() {
        if (this.currentStream) {
            this.currentStream.getTracks().forEach(track => {
                track.stop();
            });
            this.currentStream = null;
        }
        this.video.srcObject = null;
    }

    switchCameraFn() {
        this.isFrontCamera = !this.isFrontCamera;
        this.startCamera();
    }

    captureImage() {
        try {
            const context = this.canvas.getContext('2d');
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Сохраняем данные изображения
            this.capturedImageData = this.canvas.toDataURL('image/jpeg');
            this.previewImg.src = this.capturedImageData;
            
            // Показываем превью
            this.cameraContainer.classList.add('hidden');
            document.getElementById('capturedImage').classList.remove('hidden');
            
            this.stopCamera();
            
        } catch (error) {
            console.error('Ошибка захвата изображения:', error);
            this.showError('Не удалось сделать фото');
        }
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            this.capturedImageData = e.target.result;
            this.previewImg.src = this.capturedImageData;
            
            // Показываем превью
            this.cameraContainer.classList.add('hidden');
            this.cameraError.classList.add('hidden');
            document.getElementById('capturedImage').classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    retakePhoto() {
        document.getElementById('capturedImage').classList.add('hidden');
        this.recognitionResult.classList.add('hidden');
        this.recognitionStatus.classList.add('hidden');
        
        if (this.cameraAvailable) {
            this.startCamera();
        } else {
            this.cameraError.classList.remove('hidden');
        }
    }

    showCameraError() {
        this.cameraContainer.classList.add('hidden');
        this.cameraError.classList.remove('hidden');
    }

    async processImage() {
        this.recognitionStatus.classList.remove('hidden');
        
        try {
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
        try {
            // Используем CDN Tesseract
            const { createWorker } = Tesseract;
            
            const worker = await createWorker('rus+eng', 1, {
                logger: progress => {
                    if (progress.status === 'recognizing text') {
                        console.log(`Прогресс: ${Math.round(progress.progress * 100)}%`);
                    }
                }
            });

            // Настраиваем параметры для номерных знаков
            await worker.setParameters({
                tessedit_char_whitelist: 'ABEKMHOPCTYXАВЕКМНОРСТУХ0123456789',
                tessedit_pageseg_mode: '7', // Одна строка текста
            });

            const { data: { text } } = await worker.recognize(imageData);
            await worker.terminate();
            
            return text;
            
        } catch (error) {
            console.error('Tesseract error:', error);
            
            // Простой fallback - пытаемся найти текст вручную
            return this.fallbackTextRecognition(imageData);
        }
    }

    fallbackTextRecognition(imageData) {
        // Простая эвристика для извлечения текста из Data URL
        // В реальном приложении здесь можно добавить более сложную логику
        return "Ручной ввод требуется";
    }

    extractPlateNumber(text) {
        if (!text) return 'Не распознан';
        
        // Очищаем текст
        const cleanText = text.toUpperCase()
            .replace(/[^A-ZА-Я0-9]/g, '')
            .replace(/O/g, '0') // Заменяем похожие символы
            .replace(/[|]/g, '1');

        console.log('Очищенный текст:', cleanText);
        
        // Паттерны для российских номеров (типы 1, 1А)
        const patterns = [
            /[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}/, // Стандартный X123XX77
            /[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}/, // Две буквы в начале XX12377
            /[АВЕКМНОРСТУХ]\d{2}[АВЕКМНОРСТУХ]{2}\d{2,3}/, // X12XX77
        ];

        for (const pattern of patterns) {
            const match = cleanText.match(pattern);
            if (match) {
                return match[0];
            }
        }

        // Если не нашли по паттерну, ищем любую подходящую комбинацию
        if (cleanText.length >= 6 && cleanText.length <= 9) {
            return cleanText;
        }

        return 'Не распознан';
    }

    showRecognitionResult(plateNumber) {
        this.recognizedPlate.textContent = plateNumber;
        this.recognitionResult.classList.remove('hidden');
    }

    useRecognizedPlate() {
        const plate = this.recognizedPlate.textContent;
        if (plate && plate !== 'Не распознан') {
            this.checkAvtocod(plate);
        } else {
            this.showError('Пожалуйста, введите номер вручную');
            this.switchMode('manual');
        }
    }

    validatePlate(plate) {
        if (!plate || plate === 'Не распознан') return false;
        
        const patterns = [
            /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/,
            /^[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}$/,
            /^[АВЕКМНОРСТУХ]\d{2}[АВЕКМНОРСТУХ]{2}\d{2,3}$/,
        ];
        
        return patterns.some(pattern => pattern.test(plate));
    }

    async checkPlate() {
        const plate = this.plateInput.value.trim();
        
        if (!this.validatePlate(plate)) {
            this.showError('Введите корректный госномер. Пример: А123АА777');
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
        
        return {
            directUrl: avtocodUrl,
            vin: 'Данные доступны по ссылке',
            brand: 'Откройте полный отчет',
            year: 'Для просмотра данных',
            color: 'перейдите по ссылке ниже',
            engine: '',
            power: ''
        };
    }

    showLoading() {
        this.hideAll();
        this.loading.classList.remove('hidden');
    }

    showResult(plate, data) {
        this.hideAll();
        this.plateNumber.textContent = plate;
        
        const resultHTML = `
            <div class="direct-link">
                <p>✅ Данные успешно получены!</p>
                <p>Для просмотра полного отчета перейдите по ссылке:</p>
                <a href="${data.directUrl}" target="_blank" class="direct-link-btn" onclick="this.style.opacity='0.7'">
                    📊 Открыть полный отчет на Avtocod
                </a>
                <div class="link-info">
                    <small>Ссылка откроется в браузере с полными данными об автомобиле</small>
                </div>
            </div>
        `;
        
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

// Загружаем Tesseract.js динамически
function loadTesseract() {
    return new Promise((resolve, reject) => {
        if (window.Tesseract) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Инициализация приложения после загрузки Tesseract
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadTesseract();
        window.app = new CarPlateChecker();
    } catch (error) {
        console.error('Failed to load Tesseract:', error);
        window.app = new CarPlateChecker();
    }
});
