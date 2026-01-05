Set-Location "$PSScriptRoot\move_new"
Write-Host "Deploying Move modules from move_new directory..."
aptos move publish --profile mines_v12 --assume-yes
Read-Host -Prompt "Press Enter to exit"
