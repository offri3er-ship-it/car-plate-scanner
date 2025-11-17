class LicensePlateRecognizer {
    constructor() {
        this.worker = null;
        this.uploadedImage = null;
        this.originalImage = null;
        this.startTime = null;
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
            
            // Инициализируем Tesseract worker
            this.worker = await Tesseract.createWorker('rus+eng', 1, {
                logger: progress => {
                    this.handleTesseractProgress(progress);
                },
                errorHandler: err => {
                    console.error('Tesseract error:', err);
                }
            });

            // Настраиваем параметры для номерных знаков
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABEKMHOPCTYXАВЕКМНОРСТУХ0123456789',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
                tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
            });

            console.log('Tesseract initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Tesseract:', error);
            this.showError(
                'Ошибка инициализации',
                'Не удалось загрузить нейросеть для распознавания текста'
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

        if (!this.worker) {
            this.showError('Ошибка', 'Нейросеть еще не загружена. Подождите немного.');
            return;
        }

        this.startTime = Date.now();
        this.showProcessing();
        
        try {
            // Шаг 1: Предобработка изображения
            await this.updateProgressStep(1, true);
            const processedImage = await this.preprocessImage(this.uploadedImage);
            
            // Шаг 2: Поиск области номера
            await this.updateProgressStep(2, true);
            const plateRegion = this.detectRegion.checked ? 
                await this.detectPlateRegion(processedImage) : null;
            
            // Шаг 3: Распознавание текста
            await this.updateProgressStep(3, true);
            const recognitionResult = await this.recognizeText(
                plateRegion ? plateRegion.image : processedImage
            );
            
            // Шаг 4: Валидация результата
            await this.updateProgressStep(4, true);
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
        this.updateProcessingStatus('Улучшение качества изображения...');
        
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
                    this.enhanceImageQuality(ctx, canvas.width, canvas.height);
                }
                
                // Обновляем canvas с обработанным изображением
                const processedCtx = this.processedCanvas.getContext('2d');
                this.processedCanvas.width = canvas.width;
                this.processedCanvas.height = canvas.height;
                processedCtx.drawImage(canvas, 0, 0);
                
                resolve(canvas.toDataURL());
            };
            img.src = imageData;
        });
    }

    enhanceImageQuality(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Увеличиваем контраст
        const contrast = 1.5;
        const brightness = 10;
        
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
        
        // Применяем шумоподавление
        ctx.filter = 'contrast(1.2) brightness(1.1) saturate(1.1)';
    }

    async detectPlateRegion(imageData) {
        this.updateProcessingStatus('Поиск номерной пластины...');
        
        // В реальном приложении здесь будет сложный алгоритм компьютерного зрения
        // Для демонстрации используем упрощенный подход
        
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Предполагаем, что номер занимает центральную часть изображения
                const plateWidth = img.width * 0.7;
                const plateHeight = img.height * 0.3;
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
                    image: canvas.toDataURL(),
                    boundingBox: { x: plateX, y: plateY, width: plateWidth, height: plateHeight }
                });
            };
            img.src = imageData;
        });
    }

    async recognizeText(imageData) {
        this.updateProcessingStatus('Распознавание текста нейросетью...');
        
        const { data: { text, confidence, words } } = await this.worker.recognize(imageData);
        
        return {
            text: text.trim(),
            confidence: confidence,
            words: words
        };
    }

    validateRecognitionResult(result) {
        this.updateProcessingStatus('Проверка результата...');
        
        const cleanedText = result.text.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
        
        // Паттерны для российских номеров
        const patterns = [
            /^[АВЕКМНОРСТУХP]\d{3}[АВЕКМНОРСТУХP]{2}\d{2,3}$/, // Стандартный
            /^[АВЕКМНОРСТУХP]{2}\d{3}\d{2,3}$/, // Две буквы в начале
            /^[АВЕКМНОРСТУХP]\d{2}[АВЕКМНОРСТУХP]{2}\d{2,3}$/, // X12XX77
        ];

        let bestMatch = null;
        
        for (const pattern of patterns) {
            const match = cleanedText.match(pattern);
            if (match) {
                bestMatch = match[0];
                break;
            }
        }

        return {
            originalText: result.text,
            cleanedText: cleanedText,
            recognizedPlate: bestMatch,
            confidence: result.confidence,
            isValid: !!bestMatch,
            words: result.words
        };
    }

    showRecognitionResult(result, plateRegion) {
        const processingTime = Date.now() - this.startTime;
        
        this.recognizedPlate.textContent = result.recognizedPlate || 'Не распознано';
        this.plateConfidence.textContent = `Уверенность: ${Math.round(result.confidence)}%`;
        this.confidenceValue.textContent = `${Math.round(result.confidence)}%`;
        this.processingTime.textContent = `${(processingTime / 1000).toFixed(1)}с`;
        this.rawText.textContent = result.originalText;
        
        // Определяем качество изображения
        const quality = result.confidence > 80 ? 'Отличное' : 
                       result.confidence > 60 ? 'Хорошее' : 
                       result.confidence > 40 ? 'Среднее' : 'Плохое';
        this.imageQuality.textContent = quality;
        
        // Отображаем область номера если есть
        if (plateRegion) {
            const plateCtx = this.plateCanvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                this.plateCanvas.width = img.width;
                this.plateCanvas.height = img.height;
                plateCtx.drawImage(img, 0, 0);
            };
            img.src = plateRegion.image;
            
            this.plateSize.textContent = `${plateRegion.boundingBox.width}x${plateRegion.boundingBox.height}`;
        }

        this.hideAll();
        this.result.classList.remove('hidden');
    }

    handleTesseractProgress(progress) {
        if (progress.status === 'recognizing text') {
            const percent = Math.round(progress.progress * 100);
            this.updateProcessingStatus(`Распознавание: ${percent}%`);
            this.updateProcessingProgress(percent);
        }
    }

    updateProcessingStatus(status) {
        this.processingStatus.textContent = status;
    }

    updateProcessingProgress(percent) {
        this.processingProgress.textContent = `${percent}%`;
    }

    async updateProgressStep(stepNumber, completed = false) {
        return new Promise(resolve => {
            setTimeout(() => {
                const step = this.progressSteps[stepNumber - 1];
                if (completed) {
                    step.classList.add('completed');
                } else {
                    step.classList.add('active');
                }
                resolve();
            }, 500);
        });
    }

    showProcessing() {
        this.hideAll();
        this.processing.classList.remove('hidden');
        
        // Сбрасываем шаги прогресса
        this.progressSteps.forEach(step => {
            step.classList.remove('active', 'completed');
        });
        this.progressSteps[0].classList.add('active');
    }

    showRecognitionError(error) {
        this.showError(
            'Ошибка распознавания',
            'Не удалось распознать номер на изображении',
            [
                'Убедитесь, что номер четко виден и хорошо освещен',
                'Попробуйте сфотографировать номер крупным планом',
                'Избегайте бликов и теней на номере',
                'Держите камеру прямо напротив номера'
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
            this.errorSuggestions.classList.remove('hidden');
        } else {
            this.errorSuggestions.classList.add('hidden');
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
        this.recognizePlate();
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
            this.showError('Ошибка', 'Введите корректный госномер');
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
        }
    }

    saveResults() {
        // В реальном приложении здесь бы сохраняли результаты
        alert('Функция сохранения будет реализована в будущем');
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
