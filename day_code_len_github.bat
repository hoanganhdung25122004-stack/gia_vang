@echo off
chcp 65001 >nul
title Day Code Len GitHub - Aurum Quant
echo ========================================================================
echo          DANG TIEN HANH DAY DU LIEU LEN REPOSITORY GITHUB
echo   https://github.com/hoanganhdung25122004-stack/gia_vang
echo ========================================================================
echo.
cd /d "%~dp0"

echo [1/3] Dang kiem tra va dong goi cac thay doi moi nhat...
git add -A
git diff --staged --quiet
if %ERRORLEVEL% neq 0 (
    echo [2/3] Dang tao ban ghi commit du lieu va thuat toan 6 moc du bao...
    git commit -m "feat(forecast): nang cap 6 moc du bao, tin tuc thoi gian thuc va toi uu bieu do 60fps"
) else (
    echo [2/3] Khong co file moi can commit, tiep tuc kiem tra dong bo...
)

echo.
echo [3/3] Dang day toan bo du lieu va bo hen gio tu dong len GitHub (main)...
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================================
    echo  [THANH CONG] Toan bo ma nguon, 6 moc du bao va bo hen gio 4 lan/ngay
    echo  da duoc dong bo len GitHub thanh cong!
    echo ========================================================================
) else (
    echo ========================================================================
    echo  [CHU Y] Neu xuat hien hop thoai dang nhap, ban hay bam 'Sign in with browser'.
    echo ========================================================================
)
echo.
pause
