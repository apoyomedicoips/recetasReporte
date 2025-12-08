# Script para subir datos a GitHub
# Generado automáticamente - IPS Analytics

Write-Host "🚀 Iniciando subida a GitHub..." -ForegroundColor Cyan

# Cambiar al directorio del repositorio
$repoPath = "J:\Mi unidad\GitHub\ApoyoMedico\recetasReporte"
Set-Location $repoPath

# Agregar archivos
Write-Host "`n📁 Agregando archivos..." -ForegroundColor Green
git add docs/data/*
git add docs/data_avanzado/*

# Commit
$commitMessage = "📊 Actualización automática 2025-12-08 07:18"
Write-Host "`n💾 Commit: $commitMessage" -ForegroundColor Yellow
git commit -m $commitMessage

# Push
Write-Host "`n📤 Subiendo cambios..." -ForegroundColor Cyan
git push origin main

Write-Host "`n✅ ¡Subida completada!" -ForegroundColor Green
Write-Host "🌐 URL: https://github.com/apoyomedicoips/recetasReporte/tree/main/docs/data" -ForegroundColor Blue
