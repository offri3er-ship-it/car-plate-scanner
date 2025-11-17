class LicensePlateRecognizer {
    constructor() {
        this.worker = null;
        this.uploadedImage = null;
        this.originalImage = null;
        this.startTime = null;
        this.isInitialized = false;
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.initTelegram();
        this.initTesseract();
    }

    initializeElements() {
        // Элементы загрузки
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        
        // Элементы предпросмотра
        this.previewSection = document.getElementById('previewSection');
        this.previewImg = document.getElementById('previewImg');
        this.processedCanvas = document.getElementById('processedCanvas');
        this.changePhoto = document.getElementById('changePhoto');
        this.recognizeBtn = document.getElementById('recognizeBtn');
        this.enhanceImage = document.getElementById('enhanceImage');
        this.detectRegion = document.getElementById('detectRegion');
        
        // Элементы обработки
        this.processing = document.getElementById('processing');
        this.processingStatus = document.getElementById('processingStatus');
        this.processingProgress = document.getElementById('processingProgress');
        this.progressSteps = document.querySelectorAll('.progress-step');
        
        // Элементы результатов
        this.result = document.getElementById('result');
        this.recognizedPlate = document.getElementById('recognizedPlate');
        this.plateConfidence = document.getElementById('plateConfidence');
        this.confidenceValue = document.getElementById('confidenceValue');
        this.processingTime = document.getElementById('processingTime');
        this.plateSize = document.getElementById('plateSize');
        this.imageQuality = document.getElementById('imageQuality');
        this.plateCanvas = document.getElementById('plateCanvas');
        this.rawText = document.getElementById('rawText');
        this.checkAvtocodBtn = document.getElementById('checkAvtocod');
        this.newRecognition = document.getElementById('newRecognition');
        this.saveResult = document.getElementById('saveResult');
        
        // Элементы ошибок
        this.error = document.getElementById('error');
        this.errorTitle = document.getElementById('errorTitle');
        this.errorMessage = document.getElementById('errorMessage');
        this.errorSuggestions = document.getElementById('errorSuggestions');
        this.retryButton = document.getElementById('retryButton');
        this.uploadNew = document.getElementById('uploadNew');
        
        // Ручной ввод
        this.manualToggle = document.getElementById('manualToggle');
        this.manualInput = document.getElementById('manualInput');
        this.manualPlateInput = document.getElementById('manualPlateInput');
        this.manualCheckBtn = document.getElementById('manualCheckBtn');
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
        }
    }

    async initTesseract() {
        try {
            this.updateProcessingStatus('Загрузка нейросети Tesseract...');
            
            console.log('Initializing Tesseract...');
            
            // Инициализируем Tesseract worker с более простыми настройками
            this.worker = await Tesseract.createWorker('eng+rus', 1, {
                logger: progress => {
                    console.log('Tesseract progress:', progress);
                    this.handleTesseractProgress(progress);
                },
                errorHandler: err => {
                    console.error('Tesseract error:', err);
                },
                // Более простые настройки для лучшей совместимости
                gzip: false
            });

            console.log('Tesseract worker created');

            // Упрощенные настройки для номерных знаков
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABEKMHOPCTYXАВЕКМНОРСТУХ0123456789',
                tessedit_pageseg_mode: '7', // SINGLE_TEXT_LINE
                tessedit_ocr_engine_mode: '1', // OEM_LSTM_ONLY
            });

            console.log('Tesseract parameters set');
            this.isInitialized = true;
            console.log('Tesseract initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Tesseract:', error);
            this.isInitialized = false;
            this.showError(
                'Ошибка инициализации',
                'Не удалось загрузить нейросеть для распознавания текста. Обновите страницу и попробуйте снова.'
            );
        }
    }

    bindEvents() {
        // Загрузка файла
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        
        // Предпросмотр
        this.changePhoto.addEventListener('click', () => this.changePhotoHandler());
        this.recognizeBtn.addEventListener('click', () => this.recognizePlate());
        
        // Результаты
        this.checkAvtocodBtn.addEventListener('click', () => this.checkAvtocod());
        this.newRecognition.addEventListener('click', () => this.resetToUpload());
        this.saveResult.addEventListener('click', () => this.saveResults());
        
        // Ошибки
        this.retryButton.addEventListener('click', () => this.retryRecognition());
        this.uploadNew.addEventListener('click', () => this.resetToUpload());
        
        // Ручной ввод
        this.manualToggle.addEventListener('click', () => this.toggleManualInput());
        this.manualCheckBtn.addEventListener('click', () => this.checkManualPlate());
        this.manualPlateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkManualPlate();
        });
        this.manualPlateInput.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            e.target.value = value;
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showError('Ошибка', 'Пожалуйста, выберите файл изображения');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError('Ошибка', 'Файл слишком большой. Максимальный размер: 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImage = e.target.result;
            this.originalImage = e.target.result;
            this.previewImg.src = this.uploadedImage;
            
            this.uploadArea.style.display = 'none';
            this.previewSection.classList.remove('hidden');
            
            this.hideAll();
            
            // Показываем оригинальное изображение
            this.drawProcessedImage();
        };
        reader.readAsDataURL(file);
    }

    drawProcessedImage() {
        const canvas = this.processedCanvas;
        const ctx = canvas.getContext('2d');
        const img = this.previewImg;
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
    }

    async recognizePlate() {
        if (!this.uploadedImage) {
            this.showError('Ошибка', 'Сначала загрузите фото номерного знака');
            return;
        }

        if (!this.isInitialized || !this.worker) {
            this.showError('Ошибка', 'Нейросеть еще не загружена. Подождите немного.');
            return;
        }

        this.startTime = Date.now();
        this.showProcessing();
        
        try {
            // Шаг 1: Предобработка изображения
            await this.updateProgressStep(1, true);
            this.updateProcessingStatus('Улучшение качества изображения...');
            const processedImage = await this.preprocessImage(this.uploadedImage);
            
            // Шаг 2: Поиск области номера
            await this.updateProgressStep(2, true);
            this.updateProcessingStatus('Поиск номерной пластины...');
            const plateRegion = this.detectRegion.checked ? 
                await this.detectPlateRegion(processedImage) : 
                { image: processedImage, boundingBox: null };
            
            // Шаг 3: Распознавание текста
            await this.updateProgressStep(3, true);
            this.updateProcessingStatus('Распознавание текста нейросетью...');
            const recognitionResult = await this.recognizeText(plateRegion.image);
            
            // Шаг 4: Валидация результата
            await this.updateProgressStep(4, true);
            this.updateProcessingStatus('Проверка результата...');
            const validatedResult = this.validateRecognitionResult(recognitionResult);
            
            // Шаг 5: Показ результата
            await this.updateProgressStep(5, true);
            this.showRecognitionResult(validatedResult, plateRegion);
            
        } catch (error) {
            console.error('Recognition error:', error);
            this.showRecognitionError(error);
        }
    }

    async preprocessImage(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                
                // Рисуем оригинальное изображение
                ctx.drawImage(img, 0, 0);
                
                if (this.enhanceImage.checked) {
                    // Применяем улучшения качества
                    this.enhanceImageQuality(ctx, canvas);
                }
                
                // Обновляем canvas с обработанным изображением
                const processedCtx = this.processedCanvas.getContext('2d');
                this.processedCanvas.width = canvas.width;
                this.processedCanvas.height = canvas.height;
                processedCtx.drawImage(canvas, 0, 0);
                
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.src = imageData;
        });
    }

    enhanceImageQuality(ctx, canvas) {
        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Увеличиваем контраст и яркость
            const contrast = 1.3;
            const brightness = 20;
            
            for (let i = 0; i < data.length; i += 4) {
                // Яркость
                data[i] = Math.min(255, Math.max(0, data[i] + brightness));
                data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness));
                data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness));
                
                // Контраст
                data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrast + 128));
                data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrast + 128));
                data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrast + 128));
            }
            
            ctx.putImageData(imageData, 0, 0);
            
        } catch (error) {
            console.error('Image enhancement error:', error);
        }
    }

    async detectPlateRegion(imageData) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Упрощенный алгоритм - берем центральную часть изображения
                const plateWidth = Math.min(img.width * 0.8, 400);
                const plateHeight = Math.min(img.height * 0.4, 100);
                const plateX = (img.width - plateWidth) / 2;
                const plateY = (img.height - plateHeight) / 2;
                
                canvas.width = plateWidth;
                canvas.height = plateHeight;
                ctx.drawImage(
                    img,
                    plateX, plateY, plateWidth, plateHeight,
                    0, 0, plateWidth, plateHeight
                );
                
                // Рисуем bounding box на основном canvas
                const mainCtx = this.processedCanvas.getContext('2d');
                mainCtx.strokeStyle = '#00ff00';
                mainCtx.lineWidth = 3;
                mainCtx.strokeRect(plateX, plateY, plateWidth, plateHeight);
                mainCtx.fillStyle = '#00ff00';
                mainCtx.font = '16px Arial';
                mainCtx.fillText('Область номера', plateX, plateY - 5);
                
                resolve({
                    image: canvas.toDataURL('image/jpeg', 0.9),
                    boundingBox: { x: plateX, y: plateY, width: plateWidth, height: plateHeight }
                });
            };
            img.src = imageData;
        });
    }

    async recognizeText(imageData) {
        try {
            console.log('Starting text recognition...');
            
            const result = await this.worker.recognize(imageData, {
                rectangle: { top: 0, left: 0, width: 100, height: 100 }
            });
            
            console.log('Recognition result:', result);
            
            return {
                text: result.data.text ? result.data.text.trim() : '',
                confidence: result.data.confidence || 0,
                words: result.data.words || []
            };
            
        } catch (error) {
            console.error('Text recognition error:', error);
            throw new Error('Ошибка при распознавании текста: ' + error.message);
        }
    }

    validateRecognitionResult(result) {
        const cleanedText = result.text.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
        
        console.log('Original text:', result.text);
        console.log('Cleaned text:', cleanedText);
        
        // Более гибкие паттерны для российских номеров
        const patterns = [
            /^[АВЕКМНОРСТУХP]\d{3}[АВЕКМНОРСТУХP]{2}\d{2,3}$/, // Стандартный A123AA777
            /^[АВЕКМНОРСТУХP]{2}\d{3}\d{2,3}$/, // Две буквы AA12377
            /^[АВЕКМНОРСТУХP]\d{2}[АВЕКМНОРСТУХP]{2}\d{2,3}$/, // A12AA77
            /^[АВЕКМНОРСТУХP]\d{3}[АВЕКМНОРСТУХP]{2}$/, // Без региона A123AA
            /^[АВЕКМНОРСТУХP]{2}\d{4,6}$/, // Две буквы + цифры
        ];

        let bestMatch = null;
        let matchedPattern = null;
        
        for (const pattern of patterns) {
            const match = cleanedText.match(pattern);
            if (match && match[0].length >= 5) { // Минимум 5 символов
                bestMatch = match[0];
                matchedPattern = pattern;
                break;
            }
        }

        // Если не нашли по паттерну, но текст выглядит как номер
        if (!bestMatch && cleanedText.length >= 5 && cleanedText.length <= 9) {
            const hasLetters = /[A-ZА-Я]/.test(cleanedText);
            const hasNumbers = /\d/.test(cleanedText);
            if (hasLetters && hasNumbers) {
                bestMatch = cleanedText;
            }
        }

        return {
            originalText: result.text,
            cleanedText: cleanedText,
            recognizedPlate: bestMatch,
            confidence: result.confidence,
            isValid: !!bestMatch,
            words: result.words,
            matchedPattern: matchedPattern
        };
    }

    showRecognitionResult(result, plateRegion) {
        const processingTime = Date.now() - this.startTime;
        
        if (result.recognizedPlate) {
            this.recognizedPlate.textContent = result.recognizedPlate;
            this.recognizedPlate.style.color = '#28a745';
            this.plateConfidence.textContent = `Уверенность: ${Math.round(result.confidence)}%`;
            this.confidenceValue.textContent = `${Math.round(result.confidence)}%`;
        } else {
            this.recognizedPlate.textContent = 'Не распознано';
            this.recognizedPlate.style.color = '#dc3545';
            this.plateConfidence.textContent = 'Требуется ручной ввод';
            this.confidenceValue.textContent = '0%';
        }
        
        this.processingTime.textContent = `${(processingTime / 1000).toFixed(1)}с`;
        this.rawText.textContent = result.originalText || 'Текст не распознан';
        
        // Определяем качество изображения
        const quality = result.confidence > 80 ? 'Отличное' : 
                       result.confidence > 60 ? 'Хорошее' : 
                       result.confidence > 40 ? 'Среднее' : 'Плохое';
        this.imageQuality.textContent = quality;
        
        // Отображаем область номера если есть
        if (plateRegion && plateRegion.boundingBox) {
            const plateCtx = this.plateCanvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                this.plateCanvas.width = img.width;
                this.plateCanvas.height = img.height;
                plateCtx.drawImage(img, 0, 0);
            };
            img.src = plateRegion.image;
            
            this.plateSize.textContent = `${plateRegion.boundingBox.width}x${plateRegion.boundingBox.height}`;
        } else {
            this.plateSize.textContent = 'Весь кадр';
        }

        this.hideAll();
        this.result.classList.remove('hidden');
        
        // Если номер не распознан, показываем подсказки
        if (!result.recognizedPlate) {
            setTimeout(() => {
                this.showError(
                    'Номер не распознан',
                    'Автоматическое распознавание не дало результата',
                    [
                        'Попробуйте другое фото с лучшим освещением',
                        'Убедитесь, что номер занимает большую часть кадра',
                        'Избегайте бликов и теней',
                        'Или введите номер вручную ниже'
                    ]
                );
            }, 1000);
        }
    }

    handleTesseractProgress(progress) {
        if (progress.status === 'recognizing text') {
            const percent = Math.round(progress.progress * 100);
            this.updateProcessingStatus(`Распознавание: ${percent}%`);
            this.updateProcessingProgress(percent);
        } else {
            this.updateProcessingStatus(this.getStatusText(progress.status));
        }
    }

    getStatusText(status) {
        const statusMap = {
            'loading tesseract core': 'Загрузка ядра Tesseract',
            'initializing tesseract': 'Инициализация Tesseract',
            'loading language traineddata': 'Загрузка языковых данных',
            'initializing api': 'Инициализация API',
            'recognizing text': 'Распознавание текста'
        };
        return statusMap[status] || status;
    }

    updateProcessingStatus(status) {
        if (this.processingStatus) {
            this.processingStatus.textContent = status;
        }
    }

    updateProcessingProgress(percent) {
        if (this.processingProgress) {
            this.processingProgress.textContent = `${percent}%`;
        }
    }

    async updateProgressStep(stepNumber, completed = false) {
        return new Promise(resolve => {
            setTimeout(() => {
                const step = this.progressSteps[stepNumber - 1];
                if (step) {
                    if (completed) {
                        step.classList.add('completed');
                    } else {
                        step.classList.add('active');
                    }
                }
                resolve();
            }, 800);
        });
    }

    showProcessing() {
        this.hideAll();
        this.processing.classList.remove('hidden');
        
        // Сбрасываем шаги прогресса
        this.progressSteps.forEach(step => {
            if (step) {
                step.classList.remove('active', 'completed');
            }
        });
        
        if (this.progressSteps[0]) {
            this.progressSteps[0].classList.add('active');
        }
    }

    showRecognitionError(error) {
        console.error('Recognition error details:', error);
        this.showError(
            'Ошибка распознавания',
            'Произошла ошибка при обработке изображения',
            [
                'Проверьте подключение к интернету',
                'Попробуйте фото меньшего размера',
                'Убедитесь, что фото четкое и хорошо освещенное',
                'Обновите страницу и попробуйте снова'
            ]
        );
    }

    showError(title, message, suggestions = []) {
        this.errorTitle.textContent = title;
        this.errorMessage.textContent = message;
        
        if (suggestions.length > 0) {
            this.errorSuggestions.innerHTML = `
                <ul>
                    ${suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                </ul>
            `;
            this.errorSuggestions.style.display = 'block';
        } else {
            this.errorSuggestions.style.display = 'none';
        }
        
        this.hideAll();
        this.error.classList.remove('hidden');
    }

    hideAll() {
        this.processing.classList.add('hidden');
        this.result.classList.add('hidden');
        this.error.classList.add('hidden');
    }

    changePhotoHandler() {
        this.fileInput.value = '';
        this.uploadArea.style.display = 'block';
        this.previewSection.classList.add('hidden');
        this.hideAll();
    }

    resetToUpload() {
        this.hideAll();
        this.changePhotoHandler();
    }

    retryRecognition() {
        this.hideAll();
        this.previewSection.classList.remove('hidden');
        setTimeout(() => {
            this.recognizePlate();
        }, 500);
    }

    toggleManualInput() {
        this.manualInput.classList.toggle('hidden');
        this.manualToggle.classList.toggle('active');
    }

    checkManualPlate() {
        const plate = this.manualPlateInput.value.trim();
        if (this.validatePlate(plate)) {
            this.checkAvtocod(plate);
        } else {
            this.showError('Ошибка', 'Введите корректный госномер. Пример: А123АА777');
        }
    }

    validatePlate(plate) {
        if (!plate) return false;
        
        const patterns = [
            /^[АВЕКМНОРСТУХP]\d{3}[АВЕКМНОРСТУХP]{2}\d{2,3}$/,
            /^[АВЕКМНОРСТУХP]{2}\d{3}\d{2,3}$/,
            /^[АВЕКМНОРСТУХP]\d{2}[АВЕКМНОРСТУХP]{2}\d{2,3}$/,
        ];
        
        return patterns.some(pattern => pattern.test(plate));
    }

    checkAvtocod(plate = null) {
        const plateNumber = plate || this.recognizedPlate.textContent;
        if (plateNumber && plateNumber !== 'Не распознано') {
            const avtocodUrl = `https://avtocod.ru/proverkaavto/${plateNumber}`;
            window.open(avtocodUrl, '_blank');
        } else {
            this.showError('Ошибка', 'Сначала распознайте номер или введите его вручную');
        }
    }

    saveResults() {
        // В реальном приложении здесь бы сохраняли результаты
        const plate = this.recognizedPlate.textContent;
        if (plate && plate !== 'Не распознано') {
            const text = `Распознанный номер: ${plate}\nВремя: ${new Date().toLocaleString()}`;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `номер_${plate}_${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        } else {
            alert('Нет данных для сохранения');
        }
    }

    async destroy() {
        if (this.worker) {
            await this.worker.terminate();
        }
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.recognizer = new LicensePlateRecognizer();
});

// Обработка ошибок Tesseract
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});
