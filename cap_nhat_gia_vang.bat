@echo off
chcp 65001 >nul
title Cap Nhat Gia Vang The Gioi & Viet Nam (SJC, 9999)
echo ========================================================================
echo   DANG CAP NHAT DU LIEU GIA VANG THE GIOI, SJC, 9999 & VI MO THUC TE
echo ========================================================================
cd /d "%~dp0"
python scripts/update_gold_data.py
echo.
echo [HOAN TAT] Du lieu moi nhat da duoc luu vao data\gold_data.json va data\gold_data.js
echo Ban co the mo ngay file index.html tren trinh duyet de xem bieu do & du bao!
pause

