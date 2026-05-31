# PowerShell example — Code Scavenge test file

function Get-Clamp {
    param([float]$Value, [float]$Min, [float]$Max)
    [Math]::Max($Min, [Math]::Min($Max, $Value))
}

function Invoke-Lerp {
    param([float]$A, [float]$B, [float]$T)
    $A + ($B - $A) * $T
}

function Get-Slugified {
    param([string]$Text)
    $Text.ToLower() -replace '[^a-z0-9]+', '-'
}

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "[$timestamp][$Level] $Message"
}

function Invoke-Retry {
    param([scriptblock]$Action, [int]$Times = 3, [int]$DelayMs = 500)
    for ($i = 0; $i -lt $Times; $i++) {
        try   { return & $Action }
        catch { if ($i -eq $Times - 1) { throw } Start-Sleep -Milliseconds $DelayMs }
    }
}

enum Direction {
    North = 0
    South = 1
    East  = 2
    West  = 3
}

class Vec2 {
    [float] $X
    [float] $Y

    Vec2([float]$x, [float]$y) { $this.X = $x; $this.Y = $y }

    [Vec2] Add([Vec2]$other) {
        return [Vec2]::new($this.X + $other.X, $this.Y + $other.Y)
    }

    [float] Dot([Vec2]$other) {
        return $this.X * $other.X + $this.Y * $other.Y
    }

    [float] Length() {
        return [Math]::Sqrt($this.X * $this.X + $this.Y * $this.Y)
    }
}

class Logger {
    [string] $Prefix

    Logger([string]$prefix) { $this.Prefix = $prefix }

    [void] Info([string]$msg)  { Write-Host "[$($this.Prefix)][INFO] $msg" }
    [void] Warn([string]$msg)  { Write-Host "[$($this.Prefix)][WARN] $msg" }
    [void] Error([string]$msg) { Write-Host "[$($this.Prefix)][ERROR] $msg" }
}
