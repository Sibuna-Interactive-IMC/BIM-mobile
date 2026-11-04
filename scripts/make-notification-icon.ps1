Add-Type -AssemblyName System.Drawing

$root = 'C:\Users\user\Documents\GitHub\BIM-mobile'
$srcPath = Join-Path $root 'assets\images\adaptive-icon.png'
$outPath = Join-Path $root 'assets\images\notification-icon.png'

$src = [System.Drawing.Bitmap]::FromFile($srcPath)

function Get-InkAlpha([System.Drawing.Color]$c) {
	$min = [Math]::Min($c.R, [Math]::Min($c.G, $c.B))
	$a = 255 - $min
	if ($a -lt 0) { return 0 }
	return [int]$a
}

# Bounding box of the orange "BIM" wordmark (the part that stays legible at 24dp).
$minX = $src.Width; $minY = $src.Height; $maxX = -1; $maxY = -1
for ($y = 0; $y -lt $src.Height; $y++) {
	for ($x = 0; $x -lt $src.Width; $x++) {
		$c = $src.GetPixel($x, $y)
		if ($c.A -gt 0 -and $c.R -gt 200 -and $c.G -lt 200 -and $c.B -lt 120) {
			if ($x -lt $minX) { $minX = $x }
			if ($x -gt $maxX) { $maxX = $x }
			if ($y -lt $minY) { $minY = $y }
			if ($y -gt $maxY) { $maxY = $y }
		}
	}
}

$w = $maxX - $minX + 1
$h = $maxY - $minY + 1
$size = 96
$pad = [int]($size * 0.12)
$inner = $size - 2 * $pad
$scale = [Math]::Min($inner / $w, $inner / $h)
$dw = [int]($w * $scale)
$dh = [int]($h * $scale)
$offX = [int](($size - $dw) / 2)
$offY = [int](($size - $dh) / 2)

$dst = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
for ($y = 0; $y -lt $size; $y++) {
	for ($x = 0; $x -lt $size; $x++) {
		$dst.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
	}
}
for ($y = 0; $y -lt $dh; $y++) {
	for ($x = 0; $x -lt $dw; $x++) {
		$sx = [int]($minX + $x * $w / $dw)
		$sy = [int]($minY + $y * $h / $dh)
		$a = Get-InkAlpha $src.GetPixel($sx, $sy)
		if ($a -gt 0) {
			$dst.SetPixel($offX + $x, $offY + $y, [System.Drawing.Color]::FromArgb($a, 255, 255, 255))
		}
	}
}

$dst.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
$dst.Dispose()
$src.Dispose()

Write-Output "wrote $outPath (source ink box ${w}x${h} at $minX,$minY)"
