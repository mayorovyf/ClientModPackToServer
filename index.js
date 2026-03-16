const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ═══════════════════════════════════════════════════════════
//  CLIENT TO SERVER
//  Создатель: F_aN | Алексей
//  Телеграм: t.me/F_aN_N
// ═══════════════════════════════════════════════════════════

const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

// Пути
const scriptDir = __dirname;
const blockListPath = path.join(scriptDir, 'block.txt');
const historyDir = path.join(scriptDir, 'history');

// Функция для получения текущей даты и времени в формате для папки
function getDateTimeString() {
    const now = new Date();
    
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `client-${day}.${month}.${year}-${hours}.${minutes}.${seconds}`;
}

// Функция для чтения списка клиентских модов
function loadBlockList() {
    try {
        const content = fs.readFileSync(blockListPath, 'utf-8');
        const mods = content
            .split('\n')
            .map(line => line.trim().toLowerCase())
            .filter(line => line.length > 0 && !line.startsWith('#'));
        
        console.log(`${colors.cyan}[INFO]${colors.reset} Загружено ${colors.green}${mods.length}${colors.reset} клиентских модов из block.txt`);
        
        return mods;
    } catch (error) {
        console.log(`${colors.red}[ОШИБКА]${colors.reset} Не удалось прочитать block.txt`);
        console.log(`${colors.yellow}[ПОДСКАЗКА]${colors.reset} Убедитесь, что файл block.txt находится рядом со скриптом`);
        process.exit(1);
    }
}

// Функция экранирования специальных символов для RegExp
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Функция проверки, является ли файл клиентским модом
function isClientMod(fileName, blockList) {
    const lowerFileName = fileName.toLowerCase();
    
    for (const modName of blockList) {
        if (lowerFileName.startsWith(modName + '-')) {
            return modName;
        }
        
        if (lowerFileName.startsWith(modName + '_')) {
            return modName;
        }
        
        if (lowerFileName.startsWith(modName + '.')) {
            return modName;
        }
        
        if (lowerFileName === modName + '.jar') {
            return modName;
        }
        
        const patterns = [
            new RegExp(`^${escapeRegex(modName)}[-_.]`, 'i'),
            new RegExp(`[-_\\[]${escapeRegex(modName)}[-_.]`, 'i'),
            new RegExp(`^\\[.*\\]${escapeRegex(modName)}[-_.]`, 'i'),
        ];
        
        for (const pattern of patterns) {
            if (pattern.test(lowerFileName)) {
                return modName;
            }
        }
    }
    return null;
}

// Функция создания папки history если её нет
function ensureHistoryDir() {
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir);
        console.log(`${colors.green}[СОЗДАНО]${colors.reset} Папка history`);
    }
}

// Функция обработки папки с модами
function processModsFolder(modsPath, blockList) {
    console.log('');
    console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  Сканирование папки...${colors.reset}`);
    console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}`);
    console.log('');
    
    // Проверяем существование папки
    if (!fs.existsSync(modsPath)) {
        console.log(`${colors.red}[ОШИБКА]${colors.reset} Папка не найдена: ${modsPath}`);
        return;
    }
    
    // Проверяем, что это папка
    const stats = fs.statSync(modsPath);
    if (!stats.isDirectory()) {
        console.log(`${colors.red}[ОШИБКА]${colors.reset} Указанный путь не является папкой`);
        return;
    }
    
    // Создаём папку history если её нет
    ensureHistoryDir();
    
    // Создаём папку с датой в history
    const dateTimeFolder = getDateTimeString();
    const historyClientFolder = path.join(historyDir, dateTimeFolder);
    
    // Читаем содержимое папки
    const files = fs.readdirSync(modsPath);
    const jarFiles = files.filter(file => file.toLowerCase().endsWith('.jar'));
    
    console.log(`${colors.cyan}[INFO]${colors.reset} Найдено .jar файлов: ${jarFiles.length}`);
    console.log('');
    
    let movedCount = 0;
    
    for (const file of jarFiles) {
        const matchedMod = isClientMod(file, blockList);
        
        if (matchedMod) {
            const sourcePath = path.join(modsPath, file);
            
            // Создаём папку истории только если нашли хотя бы один мод
            if (movedCount === 0) {
                fs.mkdirSync(historyClientFolder);
                console.log(`${colors.green}[СОЗДАНО]${colors.reset} Папка истории: ${dateTimeFolder}`);
                console.log('');
            }
            
            const destPathHistory = path.join(historyClientFolder, file);
            
            try {
                // Перемещаем в history (не копируем, а именно перемещаем!)
                fs.renameSync(sourcePath, destPathHistory);
                
                console.log(`${colors.green}[УДАЛЁН]${colors.reset} ${file} ${colors.magenta}(${matchedMod})${colors.reset}`);
                movedCount++;
            } catch (error) {
                console.log(`${colors.red}[ОШИБКА]${colors.reset} Не удалось переместить ${file}: ${error.message}`);
            }
        }
    }
    
    console.log('');
    console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  Результат:${colors.reset}`);
    console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.green}  Удалено клиентских модов:${colors.reset} ${movedCount}`);
    console.log(`${colors.cyan}  Серверных модов осталось:${colors.reset} ${jarFiles.length - movedCount}`);
    
    if (movedCount > 0) {
        console.log('');
        console.log(`${colors.magenta}  История сохранена:${colors.reset} history/${dateTimeFolder}`);
    } else {
        console.log('');
        console.log(`${colors.yellow}  Клиентских модов не найдено${colors.reset}`);
    }
    
    console.log('');
}

// Функция очистки пути
function cleanPath(inputPath) {
    return inputPath
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/\\ /g, ' ')
        .trim();
}

// Главная функция
async function main() {
    console.log('');
    console.log(`${colors.magenta}╔═══════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.magenta}║         CLIENT TO SERVER                  ║${colors.reset}`);
    console.log(`${colors.magenta}║   Создатель: F_aN │ Алексей               ║${colors.reset}`);
    console.log(`${colors.magenta}║   Телеграм: t.me/F_aN_N                   ║${colors.reset}`);
    console.log(`${colors.magenta}╚═══════════════════════════════════════════╝${colors.reset}`);
    console.log('');
    
    // Загружаем список клиентских модов
    const blockList = loadBlockList();
    
    // Создаём интерфейс для ввода
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    console.log('');
    console.log(`${colors.yellow}[ПОДСКАЗКА]${colors.reset} Перетащите папку с модами в это окно`);
    console.log(`${colors.yellow}[ПОДСКАЗКА]${colors.reset} или введите путь вручную`);
    console.log('');
    
    rl.question(`${colors.cyan}Укажите путь до папки с модами:${colors.reset} `, (answer) => {
        const modsPath = cleanPath(answer);
        
        if (!modsPath) {
            console.log(`${colors.red}[ОШИБКА]${colors.reset} Путь не указан`);
            rl.close();
            return;
        }
        
        console.log(`${colors.cyan}[INFO]${colors.reset} Путь: ${modsPath}`);
        
        processModsFolder(modsPath, blockList);
        
        rl.close();
    });
}

main();