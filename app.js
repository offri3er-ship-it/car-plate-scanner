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
        // Элементы переключения режимов
        this.modeBtns = document.querySelectorAll('.mode-btn');
        this.photoMode = document.getElementById('photoMode');
        this.manualMode = document.getElementById('manualMode');
        
        // Элементы режима фото
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.previewSection = document.getElementById('previewSection');
        this.previewImg = document.getElementById('previewImg');
        this.changePhoto = document.getElementById('changePhoto');
        this.recognizeBtn = document.getElementById('recognizeBtn');
        this.detectionOverlay = document.getElementById('detectionOverlay');
        
        // Элементы ручного ввода
        this.manualPlateInput = document.getElementById('manualPlateInput');
        this.manualCheckBtn = document.getElementById('manualCheckBtn');
        
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
        
        // Fallback ручной ввод
        this.manualFallback = document.getElementById('manualFallback');
        this.fallbackPlateInput = document.getElementById('fallbackPlateInput');
        this.fallbackCheckBtn = document.getElementById('fallbackCheckBtn');
        
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
        // Переключение режимов
        this.modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Режим фото
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.changePhoto.addEventListener('click', () => this.changePhotoHandler());
        this.recognizeBtn.addEventListener('click', () => this.recognizePlate());
        
        // Ручной ввод (основной)
        this.manualCheckBtn.addEventListener('click', () => this.checkManualPlate());
        this.manualPlateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkManualPlate();
        });
        this.manualPlateInput.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            e.target.value = value;
        });
        
        // Ручной ввод (fallback)
        this.fallbackCheckBtn.addEventListener('click', () => this.checkFallbackPlate());
        this.fallbackPlateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.checkFallbackPlate();
        });
        this.fallbackPlateInput.addEventListener('input', (e) => {
            let value = e.target.value.toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
            e.target.value = value;
        });
        
        // Кнопки результатов
        this.checkAvtocodBtn.addEventListener('click', () => this.useRecognizedPlate());
        this.tryAnother.addEventListener('click', () => this.resetToUpload());
        
        // Общие кнопки
        this.newCheckButton.addEventListener('click', () => this.resetToMain());
        this.retryButton.addEventListener('click', () => this.retryRecognition());
    }

    switchMode(mode) {
        // Обновляем активные кнопки
        this.modeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Показываем соответствующий контент
        this.photoMode.classList.toggle('active', mode === 'photo');
        this.manualMode.classList.toggle('active', mode === 'manual');

        // Сбрасываем состояние при переключении
        this.hideAll();
        
        if (mode === 'photo') {
            this.resetPhotoMode();
        } else {
            this.resetManualMode();
        }
    }

    resetPhotoMode() {
        this.uploadArea.style.display = 'block';
        this.previewSection.classList.add('hidden');
        this.fileInput.value = '';
        this.uploadedImage = null;
    }

    resetManualMode() {
        this.manualPlateInput.value = '';
        this.manualPlateInput.focus();
    }

    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.showError('Пожалуйста, выберите изображение');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            this.showError('Файл слишком большой. Максимальный размер: 10MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.uploadedImage = e.target.result;
            this.previewImg.src = this.uploadedImage;
            
            this.uploadArea.style.display = 'none';
            this.previewSection.classList.remove('hidden');
            
            this.hideAll();
        };
        reader.readAsDataURL(file);
    }

    changePhotoHandler() {
        this.resetPhotoMode();
    }

    async recognizePlate() {
        if (!this.uploadedImage) {
            this.showError('Сначала загрузите фото');
            return;
        }

        this.showProcessing();
        
        try {
            // Демо-режим: показываем случайный номер для тестирования
            const demoPlates = ['А123АА777', 'Х970ХУ777', 'P594KC99', 'ЕКХ777', 'Т123ТТ777'];
            const randomPlate = demoPlates[Math.floor(Math.random() * demoPlates.length)];
            
            setTimeout(() => {
                const plateData = {
                    plateNumber: randomPlate,
                    confidence: 0.85 + Math.random() * 0.1
                };
                this.showRecognitionResult(plateData);
            }, 2000);
            
        } catch (error) {
            console.error('Ошибка распознавания:', error);
            this.showManualFallback();
        } finally {
            this.hideProcessing();
        }
    }

    showProcessing() {
        this.hideAll();
        this.processing.classList.remove('hidden');
        
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
        
        this.croppedPlate.src = this.uploadedImage;
        
        this.recognitionResult.classList.remove('hidden');
    }

    showManualFallback() {
        this.manualFallback.classList.remove('hidden');
        this.fallbackPlateInput.focus();
    }

    checkManualPlate() {
        const plate = this.manualPlateInput.value.trim();
        if (this.validatePlate(plate)) {
            this.checkAvtocod(plate);
        } else {
            this.showError('Введите корректный госномер. Пример: А123АА777');
        }
    }

    checkFallbackPlate() {
        const plate = this.fallbackPlateInput.value.trim();
        if (this.validatePlate(plate)) {
            this.checkAvtocod(plate);
        } else {
            this.showError('Введите корректный госномер. Пример: А123АА777');
        }
    }

    validatePlate(plate) {
        if (!plate) return false;
        
        const patterns = [
            /^[АВЕКМНОРСТУХP]\d{3}[АВЕКМНОРСТУХP]{2}\d{2,3}$/, // Стандартный
            /^[АВЕКМНОРСТУХP]{2}\d{3}\d{2,3}$/, // Две буквы в начале
            /^[АВЕКМНОРСТУХP]\d{2}[АВЕКМНОРСТУХP]{2}\d{2,3}$/, // X12XX77
            /^[АВЕКМНОРСТУХ]{1,2}\d{3,4}\d{2,3}$/, // Разные варианты
            /^[A-Z]{2}\d{6}$/ // Международные форматы
        ];
        
        return patterns.some(pattern => pattern.test(plate));
    }

    useRecognizedPlate() {
        const plate = this.recognizedPlate.textContent;
        if (plate) {
            this.checkAvtocod(plate);
        }
    }

    async checkAvtocod(plate) {
        this.showLoading();
        
        // Имитация загрузки данных
        setTimeout(() => {
            try {
                const result = this.getAvtocodData(plate);
                this.showResult(plate, result);
            } catch (error) {
                console.error('Error:', error);
                this.showError('Не удалось получить данные с Avtocod');
            }
        }, 1500);
    }

    getAvtocodData(plate) {
        const avtocodUrl = `https://avtocod.ru/proverkaavto/${plate}`;
        
        // Демо-данные для разных номеров
        const demoData = {
            'А123АА777': {
                vin: 'XTA210990Y1234567',
                brand: 'LADA VESTA',
                year: '2022',
                color: 'Белый',
                engine: '1.6 л',
                power: '106 л.с.'
            },
            'Х970ХУ777': {
                vin: 'Z94CB41BAGR323456',
                brand: 'HYUNDAI SOLARIS',
                year: '2020',
                color: 'Серый',
                engine: '1.6 л',
                power: '123 л.с.'
            },
            'P594KC99': {
                vin: 'MMBJRCFU2HJ123456',
                brand: 'MERCEDES-BENZ',
                year: '2023',
                color: 'Черный',
                engine: '2.0 л',
                power: '184 л.с.'
            },
            'ЕКХ777': {
                vin: 'X9FPXXEEBDM123456',
                brand: 'FORD FOCUS',
                year: '2021',
                color: 'Синий',
                engine: '1.5 л',
                power: '150 л.с.'
            }
        };

        const data = demoData[plate] || {
            vin: 'Данные доступны по ссылке',
            brand: 'Откройте полный отчет',
            year: 'Для просмотра данных',
            color: 'перейдите по ссылке ниже',
            engine: '',
            power: ''
        };

        return {
            directUrl: avtocodUrl,
            ...data
        };
    }

    showLoading() {
        this.hideAll();
        this.loading.classList.remove('hidden');
    }

    showResult(plate, data) {
        this.hideAll();
        this.plateNumber.textContent = plate;
        
        let resultHTML = '';
        
        if (data.vin && data.vin !== 'Данные доступны по ссылке') {
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
        } else {
            resultHTML = `
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
        }
        
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
        this.resetPhotoMode();
    }

    resetToMain() {
        this.hideAll();
        this.switchMode('photo');
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
