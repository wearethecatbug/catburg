# TimeTag Troubleshooting

## Error: Cannot find module 'ts-node/register'

### Проблема
При запуске приложения вы можете столкнуться с ошибкой:
```
Error: Cannot find module 'ts-node/register'
Require stack:
- internal/preload
```

### Причина
Эта ошибка возникает когда в переменной окружения `NODE_OPTIONS` установлен флаг `--require ts-node/register`, но модуль `ts-node` не установлен или не требуется для этого проекта.

### Решение
Проект уже настроен для автоматической очистки `NODE_OPTIONS` с помощью пакета `cross-env`:

```json
"scripts": {
  "dev": "cross-env NODE_OPTIONS='' next dev --turbopack --port 3003",
  "build": "cross-env NODE_OPTIONS='' next build"
}
```

Просто запустите:
```bash
pnpm dev
```

### Если проблема сохраняется

1. Проверьте переменные окружения:
```powershell
# PowerShell
[Environment]::GetEnvironmentVariable('NODE_OPTIONS', 'User')
[Environment]::GetEnvironmentVariable('NODE_OPTIONS', 'Machine')

# Bash/WSL
echo $NODE_OPTIONS
```

2. Если переменная установлена глобально, очистите её:
```powershell
# PowerShell (пользовательская)
[Environment]::SetEnvironmentVariable('NODE_OPTIONS', $null, 'User')

# PowerShell (системная, требует admin)
[Environment]::SetEnvironmentVariable('NODE_OPTIONS', $null, 'Machine')
```

3. Перезапустите терминал после очистки переменных окружения.

## Port Already in Use (EADDRINUSE)

Если порт 3003 уже занят:

```powershell
# PowerShell - убить процесс на порту 3003
Get-NetTCPConnection -LocalPort 3003 | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force }

# Или запустите на другом порту
pnpm exec next dev --turbopack --port 3004
```

