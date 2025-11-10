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

// Конфигурация
const CONFIG = {
    EXTERNAL_BOT: 'GH_800_bot', // Бот для получения данных
    YOUR_ACCOUNT: 'rusbuddda'   // Ваш аккаунт
};

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
    
    // Проверить поддержку камеры
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showCameraError('Ваш браузер не поддерживает камеру');
    }
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
        // Отправляем запрос внешнему боту через ваш аккаунт
        showLoading(true);
        const vehicleInfo = await requestFromExternalBot(plateNumber);
        
        if (vehicleInfo && vehicleInfo.success) {
            showVehicleInfo(plateNumber, vehicleInfo.data);
        } else {
            showErrorResult(plateNumber, vehicleInfo?.error || 'Не удалось получить данные от бота');
        }
        
    } catch (error) {
        console.error('Ошибка получения данных:', error);
        showErrorResult(plateNumber, 'Ошибка при получении информации от бота');
    } finally {
        showLoading(false);
    }
}

// Запрос к внешнему боту через ваш аккаунт
async function requestFromExternalBot(plateNumber) {
    return new Promise((resolve) => {
        // Имитация запроса к боту @GH_800_bot через ваш аккаунт
        setTimeout(() => {
            try {
                // Здесь будет реальная логика получения данных от бота
                // Пока используем демо-данные, соответствующие формату бота
                
                const botResponse = simulateBotGH800Response(plateNumber);
                
                if (botResponse) {
                    resolve({
                        success: true,
                        data: botResponse,
                        source: 'Бот @GH_800_bot'
                    });
                } else {
                    resolve({
                        success: false,
                        error: 'Бот не ответил на запрос'
                    });
                }
                
            } catch (error) {
                resolve({
                    success: false,
                    error: 'Ошибка связи с ботом'
                });
            }
        }, 3000);
    });
}

// Имитация ответа от бота @GH_800_bot
function simulateBotGH800Response(plateNumber) {
    // Демо-данные в формате, который ожидается от бота @GH_800_bot
    const botResponses = {
        'А123БВ777': {
            brand: 'Toyota',
            model: 'Camry',
            year: '2020',
            vin: 'XTA210990Y2766389',
            engineVolume: '2.5 л',
            enginePower: '181 л.с.',
            color: 'Черный',
            category: 'B',
            owner: 'Физическое лицо',
            registration: 'Зарегистрирован',
            accidents: 'Не участвовал',
            restrictions: 'Нет ограничений'
        },
        'О777ОО177': {
            brand: 'BMW',
            model: 'X5',
            year: '2019',
            vin: 'XW8AN2NE4J0002055',
            engineVolume: '3.0 л',
            enginePower: '249 л.с.',
            color: 'Белый',
            category: 'B',
            owner: 'Юридическое лицо',
            registration: 'Зарегистрирован',
            accidents: 'Не участвовал',
            restrictions: 'Нет ограничений'
        },
        'Е001КХ777': {
            brand: 'Mercedes-Benz',
            model: 'E-Class',
            year: '2021',
            vin: 'Z94CB41BAER324899',
            engineVolume: '2.0 л',
            enginePower: '194 л.с.',
            color: 'Серый',
            category: 'B',
            owner: 'Физическое лицо',
            registration: 'Зарегистрирован',
            accidents: '1 ДТП в 2022',
            restrictions: 'Нет ограничений'
        },
        'В567ТУ777': {
            brand: 'Hyundai',
            model: 'Solaris',
            year: '2018',
            vin: 'MMBJNK7404D202333',
            engineVolume: '1.6 л',
            enginePower: '123 л.с.',
            color: 'Красный',
            category: 'B',
            owner: 'Физическое лицо',
            registration: 'Зарегистрирован',
            accidents: 'Не участвовал',
            restrictions: 'Залог'
        },
        'С321ХА777': {
            brand: 'Lada',
            model: 'Vesta',
            year: '2022',
            vin: 'VF7XBRHVC9M031844',
            engineVolume: '1.6 л',
            enginePower: '106 л.с.',
            color: 'Синий',
            category: 'B',
            owner: 'Физическое лицо',
            registration: 'Зарегистрирован',
            accidents: 'Не участвовал',
            restrictions: 'Нет ограничений'
        }
    };
    
    // Возвращаем данные для конкретного номера или случайные
    return botResponses[plateNumber] || generateRandomBotResponse(plateNumber);
}

// Генерация случайного ответа для неизвестных номеров
function generateRandomBotResponse(plateNumber) {
    const brands = ['Toyota', 'Hyundai', 'Kia', 'Lada', 'Renault', 'Skoda', 'BMW', 'Mercedes'];
    const models = ['Camry', 'Solaris', 'Rio', 'Vesta', 'Logan', 'Octavia', 'X5', 'E-Class'];
    const colors = ['Черный', 'Белый', 'Серый', 'Красный', 'Синий', 'Зеленый'];
    const owners = ['Физическое лицо', 'Юридическое лицо'];
    const restrictions = ['Нет ограничений', 'Залог', 'Арест', 'Розыск'];
    
    return {
        brand: brands[Math.floor(Math.random() * brands.length)],
        model: models[Math.floor(Math.random() * models.length)],
        year: (2015 + Math.floor(Math.random() * 8)).toString(),
        vin: 'XTA' + Math.random().toString(36).substr(2, 14).toUpperCase(),
        engineVolume: (1.0 + Math.random() * 2.0).toFixed(1) + ' л',
        enginePower: (90 + Math.floor(Math.random() * 150)) + ' л.с.',
        color: colors[Math.floor(Math.random() * colors.length)],
        category: 'B',
        owner: owners[Math.floor(Math.random() * owners.length)],
        registration: 'Зарегистрирован',
        accidents: Math.random() > 0.7 ? '1 ДТП' : 'Не участвовал',
        restrictions: restrictions[Math.floor(Math.random() * restrictions.length)]
    };
}

// Показ начального результата
function showInitialResult(plateNumber, source) {
    document.getElementById('recognized-plate').innerHTML = `
        <div class="result-item">
            <strong>Номер ${source}:</strong> ${plateNumber}
        </div>
        <div class="result-item">
            <p>📤 <strong>Отправляем запрос боту @GH_800_bot через @${CONFIG.YOUR_ACCOUNT}</strong></p>
            <p>Ожидаем ответа...</p>
        </div>
    `;
    
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <div class="loading">
                <div class="spinner"></div>
                <p>🔍 <strong>Запрашиваем информацию у бота...</strong></p>
                <p>Запрос отправлен через ваш аккаунт</p>
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
                    <span class="info-label">Автомобиль:</span>
                    <span class="info-value">${vehicleInfo.brand} ${vehicleInfo.model}</span>
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
                    <span class="info-label">Объем двигателя:</span>
                    <span class="info-value">${vehicleInfo.engineVolume}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Мощность:</span>
                    <span class="info-value">${vehicleInfo.enginePower}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Цвет:</span>
                    <span class="info-value">${vehicleInfo.color}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Категория:</span>
                    <span class="info-value">${vehicleInfo.category}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Владелец:</span>
                    <span class="info-value">${vehicleInfo.owner}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Регистрация:</span>
                    <span class="info-value">${vehicleInfo.registration}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">ДТП:</span>
                    <span class="info-value">${vehicleInfo.accidents}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Ограничения:</span>
                    <span class="info-value ${vehicleInfo.restrictions !== 'Нет ограничений' ? 'status-error' : 'status-success'}">
                        ${vehicleInfo.restrictions}
                    </span>
                </div>
            </div>
            
            <div style="margin-top: 15px; padding: 10px; background: #e8f5e8; border-radius: 8px;">
                <small>Данные получены от бота @${CONFIG.EXTERNAL_BOT} через @${CONFIG.YOUR_ACCOUNT} • ${new Date().toLocaleString('ru-RU')}</small>
            </div>
        </div>
        
        <div class="result-item">
            <button class="btn primary" onclick="openBotWithPlate('${plateNumber}')">
                📱 Открыть полный отчет в боте
            </button>
            <button class="btn secondary" onclick="resetScanner()">
                🔄 Новый поиск
            </button>
        </div>
    `;
}

// Открыть бота с номером
function openBotWithPlate(plateNumber) {
    const url = `https://t.me/${CONFIG.EXTERNAL_BOT}?start=${plateNumber}`;
    
    // Открываем бота
    tg.openTelegramLink(url);
    
    // Закрываем мини-приложение
    setTimeout(() => {
        tg.close();
    }, 1000);
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
                <button class="btn primary" onclick="openBotWithPlate('${plateNumber}')">
                    📱 Попробовать в боте @${CONFIG.EXTERNAL_BOT}
                </button>
                <button class="btn secondary" onclick="resetScanner()">
                    🔄 Новый поиск
                </button>
            </div>
        </div>
    `;
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
