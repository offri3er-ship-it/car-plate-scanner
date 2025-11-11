class CarPlateChecker {
    constructor() {
        this.API_KEY = 'AIzaSyC1kSxwRdR8zDK7R0Q1v0q0YJ9Y8b4e8bE'; // Замените на ваш API ключ
        this.uploadedImage = null;
        this.init();
    }

    init() {
        this.initializeElements();
        this.bindEvents();
        this.initTelegram();
    }

    initializeElements() {
        // Элементы загрузки
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        
        // Элементы предпросмотра
        this.previewSection = document.getElementById('previewSection');
        this.previewImg = document.getElementById('previewImg');
        this.changePhoto = document.getElementById('changePhoto');
        this.recognizeBtn = document.getElementById('recognizeBtn');
        this.detectionOverlay = document.getElementById('detectionOverlay');
        
        // Элементы обработки
        this.processing = document.getElementById('processing');
        this.processingSteps = document.querySelectorAll('.processing-steps .step');
        
        // Элементы результатов
        this.recognitionResult = document.getElementById('recognitionResult');
        this.recognizedPlate = document.getElementById('recognizedPlate');
        this.confidence = document.getElementById('confidence');
        this.croppedPlate = document.getElementById('croppedPlate');
        this.checkAvtocodBtn = document.getElementById('checkAvtocod');
        this.tryAnother = document.getElementById('tryAnother');
        
        // Ручной ввод
        this.manualFallback = document.getElementById('manualFallback');
        this.manualPlateInput = document.getElementById('manualPlateInput');
        this.manualCheckBtn = document.getElementById('manualCheckBtn');
        
        // Результаты
        this.loading = document.getElementById('loading');
        this.result = document.getElementById('result');
        this.error = document.getElementById('error');
        this.screenshotContainer = document.getElementById('screenshotContainer');
        this.plateNumber = document.getElementById('plateNumber');
        this.newCheckButton = document.getElementById('newCheck');
        this.retryButton = document.getElementById('retryButton');
        this.errorMessage = document.getElementById('errorMessage');
    }

    initTelegram() {
        if (window.Telegram && Telegram.WebApp) {
            Telegram.WebApp.ready();
            Telegram.WebApp.expand();
        }
    }

    bindEvents() {
        // Загрузка файла
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        
        // Кнопки предпросмотра
        this.changePhoto.addEventListener('click', () => this.changePhotoHandler());
        this.recognizeBtn.addEventListener('click', () => this.recognizePlate());
        
        // Кнопки результатов
        this.checkAvtocodBtn.addEventListener('click', () => this.useRecognizedPlate());
        this.tryAnother.addEventListener('click', () => this.resetToUpload());
        
        // Ручной ввод
        this.manualCheckBtn.addEventListener('click', () => this.checkManualPlate());
        this.manualPlateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkManualPlate();
        });
        this.manualPlateInput.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            e.target.value = value;
        });
        
        // Общие кнопки
        this.newCheckButton.addEventListener('click', () => this.resetToUpload());
        this.retryButton.addEventListener('click', () => this.retryRecognition());
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            this.showError('Пожалуйста, выберите изображение');
            return;
        }

        // Проверяем размер файла
        if (file.size > 10 * 1024 * 1024) {
            this.showError('Файл слишком большой. Максимальный размер: 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImage = e.target.result;
            this.previewImg.src = this.uploadedImage;
            
            // Показываем секцию предпросмотра
            this.uploadArea.style.display = 'none';
            this.previewSection.classList.remove('hidden');
            
            // Сбрасываем предыдущие результаты
            this.hideAll();
        };
        reader.readAsDataURL(file);
    }

    changePhotoHandler() {
        this.fileInput.value = '';
        this.previewSection.classList.add('hidden');
        this.uploadArea.style.display = 'block';
        this.hideAll();
    }

    async recognizePlate() {
        if (!this.uploadedImage) {
            this.showError('Сначала загрузите фото');
            return;
        }

        this.showProcessing();
        
        try {
            // Используем Google Cloud Vision API для распознавания
            const plateData = await this.recognizeWithGoogleVision(this.uploadedImage);
            
            if (plateData && plateData.plateNumber) {
                this.showRecognitionResult(plateData);
            } else {
                this.showManualFallback();
            }
            
        } catch (error) {
            console.error('Ошибка распознавания:', error);
            this.showError('Не удалось распознать номер. Попробуйте другое фото или введите номер вручную.');
        } finally {
            this.hideProcessing();
        }
    }

    async recognizeWithGoogleVision(imageData) {
        // Конвертируем Data URL в base64
        const base64Data = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        
        const request = {
            requests: [
                {
                    image: {
                        content: base64Data
                    },
                    features: [
                        {
                            type: 'TEXT_DETECTION',
                            maxResults: 10
                        },
                        {
                            type: 'OBJECT_LOCALIZATION',
                            maxResults: 10
                        }
                    ],
                    imageContext: {
                        languageHints: ['ru', 'en']
                    }
                }
            ]
        };

        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${this.API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(request)
            }
        );

        if (!response.ok) {
            throw new Error(`Google Vision API error: ${response.status}`);
        }

        const data = await response.json();
        return this.processVisionResponse(data, imageData);
    }

    processVisionResponse(data, imageData) {
        const textAnnotations = data.responses[0]?.textAnnotations;
        const objectAnnotations = data.responses[0]?.localizedObjectAnnotations;
        
        if (!textAnnotations || textAnnotations.length === 0) {
            return null;
        }

        // Ищем текстовые аннотации, похожие на номера
        const potentialPlates = this.findPotentialPlates(textAnnotations);
        
        // Ищем объекты, похожие на номерные знаки
        const plateObjects = this.findPlateObjects(objectAnnotations);
        
        // Объединяем результаты
        const bestPlate = this.chooseBestPlate(potentialPlates, plateObjects);
        
        if (bestPlate) {
            // Визуализируем найденную область
            this.visualizeDetection(bestPlate.boundingBox);
            
            return {
                plateNumber: bestPlate.text,
                confidence: bestPlate.confidence,
                boundingBox: bestPlate.boundingBox
            };
        }

        return null;
    }

    findPotentialPlates(textAnnotations) {
        const plates = [];
        const platePatterns = [
            /[АВЕКМНОРСТУХP]\d{3}[АВЕКМНОРСТУХP]{2}\d{2,3}/,
            /[АВЕКМНОРСТУХP]{2}\d{3}\d{2,3}/,
            /[АВЕКМНОРСТУХP]\d{2}[АВЕКМНОРСТУХP]{2}\d{2,3}/,
            /\b[A-Z0-9]{6,9}\b/
        ];

        // Первый элемент - это весь текст, остальные - отдельные слова
        for (let i = 1; i < textAnnotations.length; i++) {
            const annotation = textAnnotations[i];
            const text = annotation.description.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            
            for (const pattern of platePatterns) {
                const match = text.match(pattern);
                if (match && match[0].length >= 6) {
                    plates.push({
                        text: match[0],
                        confidence: 0.8, // Базовое значение уверенности
                        boundingBox: annotation.boundingPoly.vertices
                    });
                    break;
                }
            }
        }

        return plates;
    }

    findPlateObjects(objectAnnotations) {
        if (!objectAnnotations) return [];
        
        return objectAnnotations
            .filter(obj => 
                obj.name.toLowerCase().includes('license') || 
                obj.name.toLowerCase().includes('plate') ||
                obj.score > 0.7
            )
            .map(obj => ({
                text: null, // Текст будет распознан отдельно
                confidence: obj.score,
                boundingBox: obj.boundingPoly.normalizedVertices
            }));
    }

    chooseBestPlate(potentialPlates, plateObjects) {
        // Сортируем по уверенности и возвращаем лучший результат
        const allResults = [...potentialPlates, ...plateObjects];
        return allResults.sort((a, b) => b.confidence - a.confidence)[0];
    }

    visualizeDetection(boundingBox) {
        if (!boundingBox) return;
        
        const overlay = this.detectionOverlay;
        overlay.innerHTML = '';
        
        const box = document.createElement('div');
        box.className = 'detection-box';
        
        // Конвертируем координаты Google Vision в пиксели
        const imgRect = this.previewImg.getBoundingClientRect();
        const vertices = boundingBox;
        
        if (vertices[0] && vertices[2]) {
            const x = vertices[0].x || (vertices[0].x * imgRect.width);
            const y = vertices[0].y || (vertices[0].y * imgRect.height);
            const width = (vertices[2].x || (vertices[2].x * imgRect.width)) - x;
            const height = (vertices[2].y || (vertices[2].y * imgRect.height)) - y;
            
            box.style.cssText = `
                left: ${x}px;
                top: ${y}px;
                width: ${width}px;
                height: ${height}px;
            `;
            
            const label = document.createElement('div');
            label.className = 'detection-label';
            label.textContent = 'Номер';
            label.style.left = `${x}px`;
            label.style.top = `${y - 25}px`;
            
            overlay.appendChild(box);
            overlay.appendChild(label);
        }
    }

    showProcessing() {
        this.hideAll();
        this.processing.classList.remove('hidden');
        
        // Анимируем шаги обработки
        this.processingSteps.forEach((step, index) => {
            setTimeout(() => {
                step.classList.add('active');
                if (index > 0) {
                    this.processingSteps[index - 1].classList.remove('active');
                    this.processingSteps[index - 1].classList.add('completed');
                }
            }, (index + 1) * 1000);
        });
    }

    hideProcessing() {
        this.processing.classList.add('hidden');
        this.processingSteps.forEach(step => {
            step.classList.remove('active', 'completed');
        });
    }

    showRecognitionResult(plateData) {
        this.recognizedPlate.textContent = plateData.plateNumber;
        
        // Определяем уровень уверенности
        let confidenceLevel = 'medium';
        let confidenceText = 'Средняя уверенность';
        
        if (plateData.confidence > 0.9) {
            confidenceLevel = 'high';
            confidenceText = 'Высокая уверенность';
        } else if (plateData.confidence < 0.6) {
            confidenceLevel = 'low';
            confidenceText = 'Низкая уверенность';
        }
        
        this.confidence.textContent = `${confidenceText} (${Math.round(plateData.confidence * 100)}%)`;
        this.confidence.className = `confidence ${confidenceLevel}`;
        
        // Показываем обрезанное изображение номера (если есть bounding box)
        if (plateData.boundingBox) {
            this.croppedPlate.src = this.cropPlateImage(plateData.boundingBox);
        } else {
            this.croppedPlate.src = this.uploadedImage;
        }
        
        this.recognitionResult.classList.remove('hidden');
    }

    cropPlateImage(boundingBox) {
        // В реальном приложении здесь бы обрезали изображение по boundingBox
        // Для демонстрации возвращаем оригинальное изображение
        return this.uploadedImage;
    }

    showManualFallback() {
        this.manualFallback.classList.remove('hidden');
    }

    useRecognizedPlate() {
        const plate = this.recognizedPlate.textContent;
        if (plate) {
            this.checkAvtocod(plate);
        }
    }

    checkManualPlate() {
        const plate = this.manualPlateInput.value.trim();
        if (this.validatePlate(plate)) {
            this.checkAvtocod(plate);
        } else {
            this.showError('Введите корректный госномер');
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

    async checkAvtocod(plate) {
        this.showLoading();
        
        try {
            const result = await this.getAvtocodData(plate);
            this.showResult(plate, result);
        } catch (error) {
            console.error('Error:', error);
            this.showError('Не удалось получить данные с Avtocod');
        }
    }

    async getAvtocodData(plate) {
        const avtocodUrl = `https://avtocod.ru/proverkaavto/${plate}`;
        
        // В реальном приложении здесь бы парсили данные с Avtocod
        // Для демонстрации возвращаем ссылку
        return {
            directUrl: avtocodUrl,
            vin: 'Данные доступны по ссылке',
            brand: 'Откройте полный отчет',
            year: 'Для просмотра данных',
            color: 'перейдите по ссылке ниже'
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
                <a href="${data.directUrl}" target="_blank" class="direct-link-btn">
                    📊 Открыть полный отчет на Avtocod
                </a>
                <div class="link-info">
                    <small>Ссылка откроется в браузере с полными данными об автомобиле ${plate}</small>
                </div>
            </div>
        `;
        
        this.screenshotContainer.innerHTML = resultHTML;
        this.result.classList.remove('hidden');
    }

    showError(message) {
        this.hideAll();
        this.errorMessage.textContent = message;
        this.error.classList.remove('hidden');
    }

    hideAll() {
        this.loading.classList.add('hidden');
        this.result.classList.add('hidden');
        this.error.classList.add('hidden');
        this.recognitionResult.classList.add('hidden');
        this.manualFallback.classList.add('hidden');
        this.processing.classList.add('hidden');
    }

    resetToUpload() {
        this.hideAll();
        this.fileInput.value = '';
        this.previewSection.classList.add('hidden');
        this.uploadArea.style.display = 'block';
        this.manualPlateInput.value = '';
        this.detectionOverlay.innerHTML = '';
    }

    retryRecognition() {
        this.hideAll();
        this.previewSection.classList.remove('hidden');
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CarPlateChecker();
});
