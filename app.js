class LicensePlateRecognizer {
    constructor() {
        this.worker = null;
        this.uploadedImage = null;
        this.originalImage = null;
        this.startTime = null;
        this.isInitialized = false;
        this.isInitializing = false;
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.initTelegram();
        this.showInitializationProgress();
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

        // Статус инициализации
        this.initStatus = document.getElementById('initStatus');
        this.initProgress = document.getElementById('initProgress');
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
        }
    }

    showInitializationProgress() {
        // Показываем статус загрузки нейросети
        this.updateProcessingStatus('🔄 Загружаем нейросеть...');
        this.updateProcessingProgress(10);
    }

    async initTesseract() {
        if (this.isInitializing) return;
        
        this.isInitializing = true;
        
        try {
            console.log('🚀 Starting Tesseract initialization...');
            this.updateProcessingStatus('Загрузка ядра Tesseract...');
            this.updateProcessingProgress(20);

            // Используем более легковесную конфигурацию
            this.worker = await Tesseract.createWorker('eng', 1, {
                logger: progress => {
                    console.log('Tesseract progress:', progress);
                    this.handleInitProgress(progress);
                },
                errorHandler: err => {
                    console.error('Tesseract init error:', err);
                }
            });

            this.updateProcessingStatus('Настройка параметров...');
            this.updateProcessingProgress(70);

            // Минимальные настройки для номерных знаков
            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABEKMHOPCTYX0123456789',
                tessedit_pageseg_mode: '7', // SINGLE_TEXT_LINE
                tessedit_ocr_engine_mode: '1',
            });

            this.updateProcessingStatus('Добавление русского языка...');
            this.updateProcessingProgress(80);

            // Добавляем русский язык отдельно
            await this.worker.loadLanguage('rus');
            await this.worker.initialize('rus+eng');

            this.updateProcessingStatus('Финальная настройка...');
            this.updateProcessingProgress(90);

            await this.worker.setParameters({
                tessedit_char_whitelist: 'ABEKMHOPCTYXАВЕКМНОРСТУХ0123456789',
            });

            this.isInitialized = true;
            this.isInitializing = false;
            
            console.log('✅ Tesseract initialized successfully');
            this.updateProcessingStatus('✅ Нейросеть готова к работе!');
            this.updateProcessingProgress(100);

            // Прячем индикатор загрузки через 2 секунды
            setTimeout(() => {
                this.hideAll();
            }, 2000);

        } catch (error) {
            console.error('❌ Failed to initialize Tesseract:', error);
            this.isInitialized = false;
            this.isInitializing = false;
            
            this.showError(
                'Ошибка загрузки',
                'Нейросеть не загрузилась. Пожалуйста, обновите страницу.',
                [
                    'Проверьте подключение к интернету',
                    'Обновите страницу (Ctrl+F5)',
                    'Используйте ручной ввод номера'
                ]
            );
        }
    }

    handleInitProgress(progress) {
        const statusMap = {
            'loading tesseract core': 'Загрузка ядра...',
            'initializing tesseract': 'Инициализация...', 
            'loading language traineddata': 'Загрузка языковых данных...',
            'initializing api': 'Настройка API...',
            'recognizing text': 'Готово!'
        };

        const statusText = statusMap[progress.status] || progress.status;
        this.updateProcessingStatus(statusText);

        // Примерный прогресс на основе статуса
        if (progress.status === 'loading tesseract core') {
            this.updateProcessingProgress(30);
        } else if (progress.status === 'initializing tesseract') {
            this.updateProcessingProgress(50);
        } else if (progress.status === 'loading language traineddata') {
            this.updateProcessingProgress(70);
        } else if (progress.status === 'initializing api') {
            this.updateProcessingProgress(85);
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

        if (file.size > 5 * 1024 * 1024) {
            this.showError('Ошибка', 'Файл слишком большой. Максимальный размер: 5MB');
            return;
        }

        // Проверяем готовность нейросети
        if (!this.isInitialized) {
            this.showError(
                'Нейросеть не готова', 
                'Подождите завершения загрузки нейросети',
                ['Нейросеть все еще загружается...', 'Попробуйте через несколько секунд']
            );
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

        if (!this.isInitialized) {
            this.showError(
                'Нейросеть не готова', 
                'Подождите завершения загрузки нейросети',
                ['Нейросеть все еще загружается...', 'Попробуйте через несколько секунд']
            );
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
            
            // Простое увеличение контраста
            const factor = 1.3;
            const brightness = 10;
            
            for (let i = 0; i < data.length; i += 4) {
                // Яркость
                data[i] = Math.min(255, data[i] + brightness);
                data[i + 1] = Math.min(255, data[i + 1] + brightness);
                data[i + 2] = Math.min(255, data[i + 2] + brightness);
                
                // Контраст
                data[i] = Math.min(255, (data[i] - 128) * factor + 128);
                data[i + 1] = Math.min(255, (data[i + 1] - 128) * factor + 128);
                data[i + 2] = Math.min(255, (data[i + 2] - 128) * factor + 128);
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
                
                // Берем центральную часть изображения
                const plateWidth = Math.min(img.width * 0.7, 400);
                const plateHeight = Math.min(img.height * 0.3, 100);
                const plateX = (img.width - plateWidth) / 2;
                const plateY = (img.height - plateHeight) / 2;
                
                canvas.width = plateWidth;
                canvas.height = plateHeight;
                ctx.drawImage(
                    img,
                    plateX, plateY, plateWidth, plateHeight,
                    0, 0, plateWidth, plateHeight
                );
                
                // Рисуем bounding box
                const mainCtx = this.processedCanvas.getContext('2d');
                mainCtx.strokeStyle = '#00ff00';
                mainCtx.lineWidth = 2;
                mainCtx.strokeRect(plateX, plateY, plateWidth, plateHeight);
                
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
            console.log('Starting OCR...');
            
            const result = await this.worker.recognize(imageData);
            
            console.log('OCR result:', result.data);
            
            return {
                text: result.data.text || '',
                confidence: result.data.confidence || 0,
                words: result.data.words || []
            };
            
        } catch (error) {
            console.error('OCR error:', error);
            throw new Error('Ошибка распознавания: ' + error.message);
        }
    }

    validateRecognitionResult(result) {
        const cleanedText = result.text.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
        
        console.log('Raw text:', result.text);
        console.log('Cleaned text:', cleanedText);
        
        // Паттерны для номеров
        const patterns = [
            /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/,
            /^[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}$/,
            /^[АВЕКМНОРСТУХ]\d{2}[АВЕКМНОРСТУХ]{2}\d{2,3}$/,
        ];

        let bestMatch = null;
        
        for (const pattern of patterns) {
            const match = cleanedText.match(pattern);
            if (match) {
                bestMatch = match[0];
                break;
            }
        }

        // Fallback: если не нашли по паттерну, но текст похож на номер
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
            words: result.words
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
        this.imageQuality.textContent = result.confidence > 70 ? 'Хорошее' : 'Среднее';
        
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
        }

        this.hideAll();
        this.result.classList.remove('hidden');
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
                    }
                    step.classList.add('active');
                }
                resolve();
            }, 500);
        });
    }

    showProcessing() {
        this.hideAll();
        this.processing.classList.remove('hidden');
        
        this.progressSteps.forEach(step => {
            step.classList.remove('active', 'completed');
        });
    }

    showRecognitionError(error) {
        this.showError(
            'Ошибка распознавания',
            'Не удалось обработать изображение',
            [
                'Попробуйте другое фото',
                'Убедитесь в хорошем освещении',
                'Номер должен быть четко виден'
            ]
        );
    }

    showError(title, message, suggestions = []) {
        this.errorTitle.textContent = title;
        this.errorMessage.textContent = message;
        
        if (suggestions.length > 0) {
            this.errorSuggestions.innerHTML = `
                <ul>
                    ${suggestions.map(s => `<li>${s}</li>`).join('')}
                </ul>
            `;
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
        setTimeout(() => this.recognizePlate(), 500);
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
        return /^[АВЕКМНОРСТУХ]\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/.test(plate) ||
               /^[АВЕКМНОРСТУХ]{2}\d{3}\d{2,3}$/.test(plate);
    }

    checkAvtocod(plate = null) {
        const plateNumber = plate || this.recognizedPlate.textContent;
        if (plateNumber && plateNumber !== 'Не распознано') {
            window.open(`https://avtocod.ru/proverkaavto/${plateNumber}`, '_blank');
        }
    }

    saveResults() {
        const plate = this.recognizedPlate.textContent;
        if (plate && plate !== 'Не распознано') {
            const text = `Номер: ${plate}\nВремя: ${new Date().toLocaleString()}`;
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `номер_${plate}.txt`;
            a.click();
            URL.revokeObjectURL(url);
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting application...');
    window.recognizer = new LicensePlateRecognizer();
});
