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
Проект уже настроен для автоматической очистки `NODE_OPTIONS`:

```json
{
  "scripts": {
    "dev": "node ./scripts/dev.mjs",
    "build": "node ./scripts/build.mjs"
  }
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
pnpm dev -- --port 3004
```

## Internal Server Error in dev after edits / hot reload

### Symptoms

- Browser shows `Internal Server Error`
- Dev/build output may contain errors like:

```text
ENOENT: no such file or directory, open '.next\\server\\app\\page\\app-build-manifest.json'
ENOENT: no such file or directory, open '.next\\static\\development\\_buildManifest.js.tmp...'
Cannot find module '../chunks/ssr/[turbopack]_runtime.js'
```

### Cause

On Windows with Turbopack, stale `.next` artifacts can break both dev reloads and later builds.

### Current default behavior

- `pnpm dev` runs through `scripts/dev.mjs`
- `pnpm build` runs through `scripts/build.mjs`

- On Windows, both `pnpm dev` and `pnpm build` remove the local `.next` directory before starting.
- On other platforms, both commands keep the cache by default for faster incremental runs.

### Recommended commands

```powershell
pnpm dev
pnpm build
```

To use another dev port:

```powershell
pnpm dev -- --port 3004
```

To force a clean dev/build start on macOS/Linux too:

```powershell
$env:TIMETAG_CLEAN_NEXT="1"
pnpm dev
pnpm build
```

### Manual recovery

If you are running raw Next.js commands and still hit this state:

```powershell
Remove-Item -Recurse -Force .next
pnpm exec next dev --turbopack --port 3003
```

