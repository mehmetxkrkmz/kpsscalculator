#!/bin/bash
cd /home/mehmet/.gemini/antigravity/scratch/kpss-takip

# Olası git hatalarını engellemek için kimlik bilgilerini yerel olarak tanımlıyoruz
git config --global user.email "kullanici@example.com"
git config --global user.name "Mehmet"

# Git'i başlat
git init

# Dosyaları ekle ve kaydet
git add .
git commit -m "İlk yükleme"

# Dalı ana (main) dal yap
git branch -M main

# Eski origin varsa sil ve yenisini ekle
git remote remove origin 2>/dev/null || true
git remote add origin https://github.com/mehmetxkrkmz/kpsscalculator.git

# Kodu GitHub'a gönder
git push -u origin main
