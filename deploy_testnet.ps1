# Deploy to Movement Testnet
# Usage: .\deploy_testnet.ps1

Write-Output "=== Movement Testnet Deployment Helper ==="

# Check CLI
$AptosPath = "aptos"
if (Test-Path ".\aptos-cli\aptos.exe") {
    $AptosPath = Resolve-Path ".\aptos-cli\aptos.exe"
} elseif (Test-Path "..\aptos-cli\aptos.exe") {
    $AptosPath = Resolve-Path "..\aptos-cli\aptos.exe"
}

if (-not (Get-Command $AptosPath -ErrorAction SilentlyContinue) -and -not (Test-Path $AptosPath)) {
    Write-Error "Aptos CLI is not installed or not in PATH."
    exit 1
}

$RPC_URL = "https://testnet.movementnetwork.xyz/v1"
$FAUCET_URL = "https://faucet.testnet.movementnetwork.xyz" 

# Create a temporary profile for deployment
Write-Output "Initializing temporary profile..."
$tempDirName = "temp_deploy_profile_testnet"
if (Test-Path $tempDirName) {
    Remove-Item -Path $tempDirName -Recurse -Force
}
$tempDir = New-Item -ItemType Directory -Path $tempDirName -Force
$env:APTOS_CONFIG_DIR = $tempDir.FullName
Write-Output "Created temp dir: $($tempDir.FullName)"

# Init new account
try {
    # Generate new key
    Write-Output "Running aptos init..."
    
    # Store current location
    $currentLoc = Get-Location
    Set-Location $tempDir.FullName
    
    try {
        & $AptosPath init --network custom --rest-url $RPC_URL --faucet-url $FAUCET_URL --assume-yes
    } finally {
        Set-Location $currentLoc
    }
    
    # Get address
    $configPath = "$($tempDir.FullName)\.aptos\config.yaml"
    if (-not (Test-Path $configPath)) {
        $configPath = "$($tempDir.FullName)\config.yaml"
    }
    
    if (Test-Path $configPath) {
        $configContent = Get-Content $configPath | Out-String
        
        if ($configContent -match 'account: "?(0x)?([a-fA-F0-9]+)"?') {
             $address = "0x" + $matches[2]
        }
        
        if ($configContent -match 'private_key: "?(ed25519-priv-)?(0x)?([a-fA-F0-9]+)"?') {
             $privateKey = "0x" + $matches[3]
        }
        
        Write-Output "Generated Address: $address"
        Write-Output "Private Key: $privateKey"
    } else {
        Write-Output "Files in temp dir:"
        Get-ChildItem -Path $tempDir.FullName -Recurse | Select-Object FullName
        Write-Error "Config file not found at $configPath"
        exit 1
    }
    
} catch {
    Write-Error "Failed to initialize profile."
    Write-Error $_
    exit 1
}

# Publish
Write-Output "Publishing Contracts (Mines, MoveFeedV3)..."
Set-Location "move"

try {
    # Copy .aptos config to move directory so CLI can find it
    if (Test-Path ".\.aptos") {
        Remove-Item -Path ".\.aptos" -Recurse -Force
    }
    Copy-Item -Path "$($tempDir.FullName)\.aptos" -Destination "." -Recurse -Force

    # Deploy to Movement
    & $AptosPath move publish --named-addresses mines=$address --url $RPC_URL --assume-yes

    # Initialize the contract
    Write-Output "Initializing contract..."
    & $AptosPath move run --function-id "${address}::move_feed_v13::initialize" --url $RPC_URL --assume-yes

    # Clean up .aptos in move directory
    Remove-Item -Path ".\.aptos" -Recurse -Force
    
    Write-Output ""
    Write-Output "✅ Deployment Successful!"
    Write-Output "Please update src/lib/movement.ts with:"
    Write-Output "moduleAddress: ""$address"""
    Write-Output "minesAddress: ""$address"""
} catch {
    Write-Error "Deployment failed."
    Write-Error $_
}

# Cleanup
Set-Location ..
# Remove-Item -Path $tempDir -Recurse -Force
$env:APTOS_CONFIG_DIR = ""

Write-Output "Done."
