#!/usr/bin/env bash
echo "================================================================"
echo "      STT & TTS de Satiro - Atualizador do Repositório GitHub   "
echo "================================================================"
echo ""
echo "[1/3] Verificando repositório GitHub..."
if command -v git &> /dev/null; then
    echo "[2/3] Executando git pull origin main..."
    git pull origin main || git pull origin master
else
    echo "[2/3] Baixando pacote mais recente via curl..."
    curl -L "https://github.com/pinguelanarosca/STT-TTSByAlee/archive/refs/heads/main.zip" -o update_temp.zip
    unzip -o update_temp.zip -d temp_ext
    cp -r temp_ext/*/* .
    rm -rf update_temp.zip temp_ext
fi
echo ""
echo "[3/3] ✓ Extensão atualizada com sucesso!"
echo "Abra o Chrome e clique em 'Recarregar Extensão' no menu da extensão."
