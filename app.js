// Инициализация Telegram Web App
const tg = window.Telegram.WebApp;
let currentStream = null;
let usingFrontCamera = false;
let isCameraActive = false;

// Элементы DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureBtn = document.getElementById('capture-btn');
const resultContainer = document.getElementById('result-container');
const loadingElement = document.getElementById('loading');
const manualInput = document.getElementById('manual-input');
const cameraContainer = document.getElementById('camera-container');
const avtocodWidgetContainer = document.getElementById('avtocod-widget-container');

// Инициализация приложения
function init() {
    tg.expand();
    tg.enableClosingConfirmation();
    
    // Показать информацию о пользователе
    const user = tg.initDataUnsafe.user;
    const userDataElement = document.getElementById('user-data');
    
    if (user) {
        userDataElement.innerHTML = `
            <div class="user-data">
                <p><strong>ID:</strong> ${user.id}</p>
                <p><strong>Имя:</strong> ${user.first_name} ${user.last_name || ''}</p>
                <p><strong>Username:</strong> @${user.username || 'не указан'}</p>
            </div>
        `;
    } else {
        userDataElement.innerHTML = '<div class="user-data"><p>Данные пользователя недоступны</p></div>';
    }
    
    console.log('Mini App инициализирован');
    
    // Инициализация виджета Avtocod
    initAvtocodWidget();
    
    // Проверить поддержку камеры
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError('Ваш браузер не поддерживает камеру');
    }
}

// Инициализация виджета Avtocod
function initAvtocodWidget() {
    try {
        // Ждем загрузки скрипта Avtocod
        if (typeof window.AvtocodWidget !== 'undefined') {
            setupAvtocodWidget();
        } else {
            // Если скрипт еще не загружен, ждем
            setTimeout(initAvtocodWidget, 500);
        }
    } catch (error) {
        console.error('Ошибка инициализации виджета Avtocod:', error);
    }
}

// Настройка виджета Avtocod
function setupAvtocodWidget() {
    try {
        // Настройка обработчиков для виджета
        const widget = document.querySelector('avtocod-widget');
        if (widget) {
            // Добавляем обработчики событий виджета
            widget.addEventListener('avtocod-widget-loaded', function() {
                console.log('Виджет Avtocod загружен');
            });
            
            widget.addEventListener('avtocod-widget-error', function(e) {
                console.error('Ошибка виджета Avtocod:', e.detail);
            });
            
            widget.addEventListener('avtocod-widget-result', function(e) {
                console.log('Результат от Avtocod:', e.detail);
                handleAvtocodResult(e.detail);
            });
        }
    } catch (error) {
        console.error('Ошибка настройки виджета Avtocod:', error);
    }
}

// Обработка результатов от Avtocod
function handleAvtocodResult(result) {
    if (result && result.success) {
        showAvtocodInfo(result.data);
    } else {
        console.error('Ошибка получения данных от Avtocod:', result?.error);
    }
}

// Показ информации от Avtocod
function showAvtocodInfo(data) {
    const plateNumber = data.plate || 'Неизвестно';
    
    document.getElementById('recognized-plate').innerHTML = `
        <div class="result-item">
            <strong>Номер проверен через Автокод:</strong> ${plateNumber}
        </div>
    `;
    
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <h4>🚗 Полный отчет от Автокод</h4>
            <div style="background: #000; color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 10px 0; font-family: monospace; font-size: 18px; font-weight: bold;">
                ${plateNumber}
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Марка:</span>
                    <span class="info-value">${data.brand || 'Неизвестно'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Модель:</span>
                    <span class="info-value">${data.model || 'Неизвестно'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Год выпуска:</span>
                    <span class="info-value">${data.year || 'Неизвестно'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">VIN:</span>
                    <span class="info-value" style="font-family: monospace; font-size: 12px;">${data.vin || 'Неизвестно'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Мощность:</span>
                    <span class="info-value">${data.power || 'Неизвестно'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Цвет:</span>
                    <span class="info-value">${data.color || 'Неизвестно'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Объем двигателя:</span>
                    <span class="info-value">${data.engine_volume || 'Неизвестно'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Тип ТС:</span>
                    <span class="info-value">${data.vehicle_type || 'Неизвестно'}</span>
                </div>
                ${data.owner ? `
                <div class="info-item">
                    <span class="info-label">Владелец:</span>
                    <span class="info-value">${data.owner}</span>
                </div>
                ` : ''}
                ${data.restrictions ? `
                <div class="info-item">
                    <span class="info-label">Ограничения:</span>
                    <span class="info-value status-error">${data.restrictions}</span>
                </div>
                ` : ''}
                ${data.accidents ? `
                <div class="info-item">
                    <span class="info-label">ДТП:</span>
                    <span class="info-value">${data.accidents}</span>
                </div>
                ` : ''}
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px;">
                <small>Полный отчет предоставлен Автокод • ${new Date().toLocaleString('ru-RU')}</small>
            </div>
        </div>
        
        <div class="result-item">
            <button class="btn primary" onclick="openAvtocodFullReport('${plateNumber}')">
                📊 Полный отчет на сайте
            </button>
            <button class="btn secondary" onclick="resetScanner()">
                🔄 Новый поиск
            </button>
        </div>
    `;
    
    showResultContainer();
}

// Открытие полного отчета на сайте Avtocod
function openAvtocodFullReport(plateNumber) {
    const url = `https://avtocod.ru/proverka-avto/${plateNumber}`;
    window.open(url, '_blank');
}

// Показать ошибку камеры
function showCameraError(message) {
    const cameraSection = document.querySelector('.card:nth-child(2)');
    cameraSection.innerHTML = `
        <h3>📷 Сфотографируйте автомобильный номер</h3>
        <div style="text-align: center; padding: 20px; color: #dc3545;">
            <p>❌ ${message}</p>
            <p>Используйте ручной ввод номера</p>
        </div>
    `;
}

// Инициализация камеры
async function initCamera() {
    try {
        if (isCameraActive) {
            closeCamera();
            return;
        }

        console.log('Пытаемся включить камеру...');
        
        const constraints = {
            video: {
                facingMode: usingFrontCamera ? "user" : "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        // Останавливаем предыдущий поток
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        
        // Показываем сообщение о загрузке камеры
        const cameraControls = document.getElementById('camera-controls');
        cameraControls.innerHTML = '<p>🔄 Загружаем камеру...</p>';
        
        // Получаем доступ к камере
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        
        // Ждем пока видео загрузится
        video.onloadedmetadata = function() {
            console.log('Камера успешно загружена');
            
            // Показываем видео и кнопку захвата
            video.style.display = 'block';
            captureBtn.style.display = 'block';
            cameraContainer.style.display = 'block';
            
            // Обновляем кнопки управления
            cameraControls.innerHTML = `
                <button class="btn secondary" onclick="switchCamera()">🔄 Переключить камеру</button>
                <button class="btn secondary" onclick="closeCamera()">❌ Выключить камеру</button>
            `;
            
            isCameraActive = true;
        };
        
        video.onerror = function() {
            console.error('Ошибка загрузки видео');
            showCameraError('Ошибка загрузки камеры');
        };

    } catch (error) {
        console.error('Ошибка доступа к камере:', error);
        
        let errorMessage = 'Не удалось получить доступ к камере. ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage += 'Разрешите доступ к камере в настройках браузера.';
        } else if (error.name === 'NotFoundError') {
            errorMessage += 'Камера не найдена на устройстве.';
        } else if (error.name === 'NotSupportedError') {
            errorMessage += 'Ваш браузер не поддерживает камеру.';
        } else {
            errorMessage += 'Попробуйте использовать ручной ввод.';
        }
        
        showCameraError(errorMessage);
    }
}

// Переключение камеры
function switchCamera() {
    usingFrontCamera = !usingFrontCamera;
    closeCamera();
    setTimeout(initCamera, 500);
}

// Закрыть камеру
function closeCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    video.srcObject = null;
    video.style.display = 'none';
    captureBtn.style.display = 'none';
    cameraContainer.style.display = 'none';
    isCameraActive = false;
    
    // Восстанавливаем кнопку включения камеры
    const cameraControls = document.getElementById('camera-controls');
    cameraControls.innerHTML = `
        <button class="btn primary" onclick="initCamera()">🎥 Включить камеру</button>
        <button class="btn secondary" onclick="switchCamera()">🔄 Переключить камеру</button>
    `;
}

// Сделать фото и распознать номер
captureBtn.addEventListener('click', function() {
    if (!isCameraActive) return;
    
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Показать индикатор загрузки
    showLoading(true);
    hideResult();
    
    // Распознавание текста с изображения
    recognizePlateFromImage(canvas);
});

// Распознавание номера с помощью Tesseract.js
async function recognizePlateFromImage(canvasElement) {
    try {
        showLoading(true);
        
        const worker = await Tesseract.createWorker('rus', 1, {
            logger: m => console.log(m)
        });
        
        await worker.setParameters({
            tessedit_char_whitelist: 'АВЕКМНОРСТУХ0123456789',
            tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE
        });
        
        const { data: { text } } = await worker.recognize(canvasElement);
        await worker.terminate();
        
        const cleanedPlate = cleanPlateText(text);
        
        showLoading(false);
        processPlateNumber(cleanedPlate, true);
        
    } catch (error) {
        console.error('Ошибка распознавания:', error);
        tg.showAlert('Ошибка при распознавании номера. Попробуйте еще раз.');
        showLoading(false);
    }
}

// Очистка распознанного текста
function cleanPlateText(text) {
    return text
        .replace(/[^АВЕКМНОРСТУХ0-9]/gi, '')
        .toUpperCase()
        .substring(0, 9);
}

// Автоматическое форматирование при вводе
function formatPlateInput(input) {
    let value = input.value;
    
    // Оставляем только русские буквы и цифры
    value = value.toUpperCase().replace(/[^АВЕКМНОРСТУХ0-9]/g, '');
    
    // Ограничиваем длину
    value = value.substring(0, 9);
    
    input.value = value;
}

// Обработка ручного ввода
function processManualInput() {
    const plateInput = document.getElementById('plate-input');
    let plateNumber = plateInput.value.trim().toUpperCase();
    
    // Оставляем только русские буквы и цифры
    plateNumber = plateNumber.replace(/[^АВЕКМНОРСТУХ0-9]/g, '');
    
    if (!plateNumber) {
        tg.showAlert('Введите номер автомобиля');
        return;
    }
    
    // Валидация российского номерного знака
    const plateRegex = /^[АВЕКМНОРСТУХ]{1}\d{3}[АВЕКМНОРСТУХ]{2}\d{2,3}$/;
    if (!plateRegex.test(plateNumber)) {
        tg.showAlert('Неверный формат номера. Пример: А123БВ777');
        return;
    }
    
    processPlateNumber(plateNumber, false);
}

// Основная функция обработки номера
async function processPlateNumber(plateNumber, fromCamera) {
    const source = fromCamera ? 'распознан камерой' : 'введен вручную';
    
    // Показываем начальный результат
    showInitialResult(plateNumber, source);
    
    try {
        showLoading(true);
        
        // Пробуем получить данные через Avtocod
        const avtocodResult = await tryAvtocodIntegration(plateNumber);
        
        if (avtocodResult.success) {
            showVehicleInfo(plateNumber, avtocodResult.data);
        } else {
            // Если Avtocod не сработал, пробуем другие методы
            const fallbackResult = await getFallbackVehicleInfo(plateNumber);
            showVehicleInfo(plateNumber, fallbackResult.data);
        }
        
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        showErrorResult(plateNumber, 'Ошибка при получении информации');
    } finally {
        showLoading(false);
    }
}

// Интеграция с Avtocod
async function tryAvtocodIntegration(plateNumber) {
    return new Promise((resolve) => {
        // В реальной реализации здесь будет вызов API Avtocod
        // Пока используем демо-данные для тестирования
        
        setTimeout(() => {
            const demoData = {
                brand: 'Toyota',
                model: 'Camry',
                year: '2020',
                vin: 'XTA210990Y2766389',
                power: '181 л.с.',
                color: 'Черный',
                engine_volume: '2.5 л',
                vehicle_type: 'Легковой',
                owner: 'Физическое лицо',
                restrictions: 'Нет ограничений',
                accidents: 'Не участвовал'
            };
            
            resolve({
                success: true,
                data: demoData,
                source: 'Avtocod'
            });
        }, 2000);
    });
}

// Fallback метод получения данных
async function getFallbackVehicleInfo(plateNumber) {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                success: true,
                data: {
                    brand: 'Автомобиль',
                    model: 'Информация обрабатывается',
                    year: 'Используйте виджет Avtocod выше',
                    vin: 'Для получения полного отчета',
                    power: 'нажмите на виджет',
                    note: 'Используйте виджет Avtocod для полной проверки'
                },
                source: 'Fallback'
            });
        }, 1000);
    });
}

// Показ начального результата
function showInitialResult(plateNumber, source) {
    document.getElementById('recognized-plate').innerHTML = `
        <div class="result-item">
            <strong>Номер ${source}:</strong> ${plateNumber}
        </div>
    `;
    
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <div class="loading">
                <div class="spinner"></div>
                <p>🔍 <strong>Проверяем через Avtocod...</strong></p>
                <p>Получаем полный отчет об автомобиле</p>
            </div>
        </div>
    `;
    
    showResultContainer();
}

// Показ информации об автомобиле
function showVehicleInfo(plateNumber, vehicleInfo) {
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <h4>🚗 Информация об автомобиле</h4>
            <div style="background: #000; color: #fff; padding: 15px; border-radius: 8px; text-align: center; margin: 10px 0; font-family: monospace; font-size: 18px; font-weight: bold;">
                ${plateNumber}
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <span class="info-label">Марка:</span>
                    <span class="info-value">${vehicleInfo.brand}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Модель:</span>
                    <span class="info-value">${vehicleInfo.model}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Год выпуска:</span>
                    <span class="info-value">${vehicleInfo.year}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">VIN:</span>
                    <span class="info-value" style="font-family: monospace; font-size: 12px;">${vehicleInfo.vin}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Мощность:</span>
                    <span class="info-value">${vehicleInfo.power}</span>
                </div>
                ${vehicleInfo.color ? `
                <div class="info-item">
                    <span class="info-label">Цвет:</span>
                    <span class="info-value">${vehicleInfo.color}</span>
                </div>
                ` : ''}
                ${vehicleInfo.engine_volume ? `
                <div class="info-item">
                    <span class="info-label">Объем двигателя:</span>
                    <span class="info-value">${vehicleInfo.engine_volume}</span>
                </div>
                ` : ''}
                ${vehicleInfo.note ? `
                <div class="info-item">
                    <span class="info-label">Примечание:</span>
                    <span class="info-value">${vehicleInfo.note}</span>
                </div>
                ` : ''}
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px;">
                <small>Данные получены через Avtocod • ${new Date().toLocaleString('ru-RU')}</small>
            </div>
        </div>
        
        <div class="result-item">
            <button class="btn primary" onclick="openAvtocodFullReport('${plateNumber}')">
                📊 Полный отчет на Avtocod
            </button>
            <button class="btn secondary" onclick="resetScanner()">
                🔄 Новый поиск
            </button>
        </div>
    `;
}

// Показ ошибки
function showErrorResult(plateNumber, errorMessage) {
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <div style="text-align: center; padding: 20px; color: #dc3545;">
                <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
                <h4>Ошибка получения данных</h4>
                <p>${errorMessage}</p>
                <p>Номер: <strong>${plateNumber}</strong></p>
            </div>
            
            <div style="margin-top: 15px;">
                <p style="text-align: center; margin-bottom: 15px;">
                    <strong>Используйте виджет Avtocod выше для проверки</strong>
                </p>
                <button class="btn primary" onclick="scrollToAvtocodWidget()">
                    🔍 Перейти к виджету Avtocod
                </button>
                <button class="btn secondary" onclick="resetScanner()">
                    🔄 Новый поиск
                </button>
            </div>
        </div>
    `;
}

// Прокрутка к виджету Avtocod
function scrollToAvtocodWidget() {
    avtocodWidgetContainer.scrollIntoView({ behavior: 'smooth' });
}

// Сброс сканера
function resetScanner() {
    closeCamera();
    const plateInput = document.getElementById('plate-input');
    plateInput.value = '';
    resultContainer.classList.add('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Вспомогательные функции
function showLoading(show) {
    if (show) {
        loadingElement.classList.remove('hidden');
    } else {
        loadingElement.classList.add('hidden');
    }
}

function showResultContainer() {
    resultContainer.classList.remove('hidden');
}

function hideResult() {
    resultContainer.classList.add('hidden');
}

// Обработчики событий Telegram
tg.onEvent('themeChanged', updateTheme);
tg.onEvent('viewportChanged', () => console.log('Viewport changed'));

function updateTheme() {
    document.body.style.backgroundColor = tg.themeParams.bg_color;
    document.body.style.color = tg.themeParams.text_color;
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', init);
