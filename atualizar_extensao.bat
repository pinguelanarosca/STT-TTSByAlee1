@echo off
chcp 65001 >nul
title Atualizador Automatico - STT e TTS de Satiro
echo ================================================================
echo       STT & TTS de Satiro - Atualizador do Repositorio GitHub
echo ================================================================
echo.
echo [1/3] Verificando conexao com o GitHub (pinguelanarosca/STT-TTSByAlee)...
echo.

where git >nul 2>nul
if %errorlevel% == 0 (
    echo [2/3] Executando git pull para atualizar os arquivos...
    git pull origin main
    if %errorlevel% neq 0 (
        git pull origin master
    )
) else (
    echo [2/3] Git nao detectado no PATH do Windows.
    echo Baixando e extraindo arquivos atualizados via PowerShell...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $repo = 'pinguelanarosca/STT-TTSByAlee'; Write-Host 'Conectando ao GitHub...'; Invoke-WebRequest -Uri ('https://github.com/' + $repo + '/archive/refs/heads/main.zip') -OutFile 'update_temp.zip'; Expand-Archive -Path 'update_temp.zip' -DestinationPath 'temp_ext' -Force; Get-ChildItem -Path 'temp_ext\*' | ForEach-Object { Copy-Item -Path ($_.FullName + '\*') -Destination '.' -Recurse -Force }; Remove-Item 'update_temp.zip' -Force; Remove-Item 'temp_ext' -Recurse -Force; Write-Host '✓ Arquivos substituidos com sucesso!'"
)

echo.
echo [3/3] Atualizacao concluida com sucesso!
echo ================================================================
echo Proximo passo:
echo  1. Abra o Google Chrome.
echo  2. Clique no icone do STT & TTS de Satiro.
echo  3. Na aba 'Atualizacao', clique em '3. Recarregar Extensao'.
echo ================================================================
echo.
pause
