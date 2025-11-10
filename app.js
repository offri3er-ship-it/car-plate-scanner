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
function processPlateNumber(plateNumber, fromCamera) {
    const source = fromCamera ? 'распознан камерой' : 'введен вручную';
    
    // Показываем начальный результат
    showInitialResult(plateNumber, source);
    
    // 1. Сначала отправляем сообщение боту
    sendMessageToBot(plateNumber);
    
    // 2. Показываем информацию о том, что сообщение отправлено
    showMessageSentInfo(plateNumber);
}

// Отправка сообщения боту через ваш аккаунт
function sendMessageToBot(plateNumber) {
    // Создаем ссылку для отправки сообщения боту
    const botUrl = `https://t.me/${CONFIG.EXTERNAL_BOT}?start=${encodeURIComponent(plateNumber)}`;
    
    // Открываем бота в Telegram (сообщение отправится через ваш аккаунт)
    tg.openTelegramLink(botUrl);
    
    console.log(`Сообщение с номером ${plateNumber} отправлено боту @${CONFIG.EXTERNAL_BOT}`);
}

// Показ информации об отправке сообщения
function showMessageSentInfo(plateNumber) {
    document.getElementById('vehicle-info').innerHTML = `
        <div class="result-item">
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 3rem; margin-bottom: 15px;">📤</div>
                <h4>Сообщение отправлено!</h4>
                <p>Госномер <strong>${plateNumber}</strong> отправлен боту @${CONFIG.EXTERNAL_BOT}</p>
                <p>Через ваш аккаунт: @${CONFIG.YOUR_ACCOUNT}</p>
                
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p><strong>Что происходит:</strong></p>
                    <p>1. 📨 Сообщение отправлено боту</p>
                    <p>2. ⏳ Бот обрабатывает запрос</p>
                    <p>3. 📊 Получаем отчет об автомобиле</p>
                </div>
                
                <p><em>Перейдите в чат с ботом чтобы увидеть полный отчет</em></p>
            </div>
        </div>
        
        <div class="result-item">
            <button class="btn primary" onclick="openBotChat()">
                💬 Перейти в чат с ботом
            </button>
            <button class="btn secondary" onclick="resetScanner()">
                🔄 Проверить другой номер
            </button>
        </div>
    `;
    
    // Закрываем Mini App через 5 секунд
    setTimeout(() => {
        tg.close();
    }, 5000);
}

// Открыть чат с ботом
function openBotChat() {
    const url = `https://t.me/${CONFIG.EXTERNAL_BOT}`;
    tg.openTelegramLink(url);
    tg.close();
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
                <p>📤 <strong>Отправляем запрос боту...</strong></p>
                <p>Госномер: <strong>${plateNumber}</strong></p>
            </div>
        </div>
    `;
    
    showResultContainer();
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
