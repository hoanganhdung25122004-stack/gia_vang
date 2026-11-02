@echo off
chcp 65001 >nul
title Day Code Len GitHub - Aurum Quant
echo ========================================================================
echo          DANG TIEN HANH DAY DU LIEU LEN REPOSITORY GITHUB
echo   https://github.com/hoanganhdung25122004-stack/gia_vang
echo ========================================================================
echo.
cd /d "%~dp0"

echo [1/4] Dang kiem tra va dong goi cac thay doi moi nhat...
git add -A
git diff --staged --quiet
if %ERRORLEVEL% neq 0 (
    echo [2/4] Dang tao ban ghi commit du lieu va chien luoc 3 chan troi...
    git commit -m "feat: cap nhat chien luoc 3 chan troi dau tu vang va dong bo he thong"
) else (
    echo [2/4] Khong co file moi can commit, tiep tuc kiem tra dong bo...
)

echo.
echo [3/4] Dang kiem tra va hop nhat ban ghi tu dong tu GitHub Actions...
git pull --no-rebase -s ort -X ours origin main --no-edit

echo.
echo [4/4] Dang day toan bo ma nguon va du lieu len GitHub (main)...
git push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================================
    echo  [THANH CONG] Toan bo ma nguon, 3 chan troi dau tu va bo hen gio 4 lan/ngay
    echo  da duoc dong bo len GitHub thanh cong!
    echo ========================================================================
) else (
    echo ========================================================================
    echo  [CHU Y] Neu xuat hien hop thoai dang nhap, ban hay bam 'Sign in with browser'.
    echo ========================================================================
)
echo.
pause
