Add-Type -AssemblyName System.Drawing

function Get-Color([string]$hex, [int]$alpha = 255) {
  $base = [System.Drawing.ColorTranslator]::FromHtml($hex)
  return [System.Drawing.Color]::FromArgb($alpha, $base.R, $base.G, $base.B)
}

function Set-GraphicsQuality([System.Drawing.Graphics]$graphics) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
}

function New-RoundedRectPath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2

  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Fill-RoundedRect([System.Drawing.Graphics]$graphics, [System.Drawing.Brush]$brush, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-RoundedRectPath $x $y $width $height $radius
  try {
    $graphics.FillPath($brush, $path)
  } finally {
    $path.Dispose()
  }
}

function Draw-RoundedRect([System.Drawing.Graphics]$graphics, [System.Drawing.Pen]$pen, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-RoundedRectPath $x $y $width $height $radius
  try {
    $graphics.DrawPath($pen, $path)
  } finally {
    $path.Dispose()
  }
}

function Fill-GlowEllipse([System.Drawing.Graphics]$graphics, [float]$x, [float]$y, [float]$width, [float]$height, [System.Drawing.Color]$centerColor) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  try {
    $path.AddEllipse($x, $y, $width, $height)
    $brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
    try {
      $brush.CenterColor = $centerColor
      $brush.SurroundColors = @([System.Drawing.Color]::FromArgb(0, $centerColor))
      $graphics.FillEllipse($brush, $x, $y, $width, $height)
    } finally {
      $brush.Dispose()
    }
  } finally {
    $path.Dispose()
  }
}

function Draw-ModernFinanceMark([System.Drawing.Graphics]$graphics, [float]$canvasSize, [bool]$showBackground) {
  $bgTop = Get-Color '#FBF6EE'
  $bgBottom = Get-Color '#F2E5D6'
  $glow = Get-Color '#FFE9DA' 165
  $outline = Get-Color '#FFFFFF' 78
  $coralTop = Get-Color '#FF7D59'
  $coralBottom = Get-Color '#F25738'
  $navy = Get-Color '#17324D'
  $navySoft = Get-Color '#17324D' 36
  $navyLift = Get-Color '#203E5C'
  $cream = Get-Color '#FFF7F0'
  $creamSoft = Get-Color '#FFE7DA' 190
  $panel = Get-Color '#FFF3EC' 220
  $lineAccent = Get-Color '#FFEADB' 230

  $scale = $canvasSize / 1024.0

  if ($showBackground) {
    $backgroundRect = New-Object System.Drawing.RectangleF(0, 0, $canvasSize, $canvasSize)
    $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($backgroundRect, $bgTop, $bgBottom, 55)
    try {
      $graphics.FillRectangle($backgroundBrush, $backgroundRect)
    } finally {
      $backgroundBrush.Dispose()
    }

    Fill-GlowEllipse $graphics (-130 * $scale) (-120 * $scale) (620 * $scale) (620 * $scale) $glow
    Fill-GlowEllipse $graphics (520 * $scale) (600 * $scale) (400 * $scale) (260 * $scale) (Get-Color '#FFFFFF' 120)

    $framePen = New-Object System.Drawing.Pen($outline, (4 * $scale))
    try {
      Draw-RoundedRect $graphics $framePen (18 * $scale) (18 * $scale) ($canvasSize - 36 * $scale) ($canvasSize - 36 * $scale) (220 * $scale)
    } finally {
      $framePen.Dispose()
    }
  }

  $tileX = 192 * $scale
  $tileY = 250 * $scale
  $tileWidth = 640 * $scale
  $tileHeight = 540 * $scale
  $tileRadius = 170 * $scale

  $baseBrush = New-Object System.Drawing.SolidBrush($navy)
  $baseGlowBrush = New-Object System.Drawing.SolidBrush($navySoft)
  try {
    Fill-RoundedRect $graphics $baseGlowBrush ($tileX + 10 * $scale) ($tileY + 42 * $scale) $tileWidth $tileHeight $tileRadius
    Fill-RoundedRect $graphics $baseBrush ($tileX + 6 * $scale) ($tileY + 24 * $scale) $tileWidth $tileHeight $tileRadius
  } finally {
    $baseBrush.Dispose()
    $baseGlowBrush.Dispose()
  }

  $tileRect = New-Object System.Drawing.RectangleF($tileX, $tileY, $tileWidth, $tileHeight)
  $tileBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($tileRect, $coralTop, $coralBottom, 100)
  try {
    Fill-RoundedRect $graphics $tileBrush $tileX $tileY $tileWidth $tileHeight $tileRadius
  } finally {
    $tileBrush.Dispose()
  }

  $tileBorder = New-Object System.Drawing.Pen((Get-Color '#FFF5EF' 212), (5 * $scale))
  try {
    Draw-RoundedRect $graphics $tileBorder $tileX $tileY $tileWidth $tileHeight $tileRadius
  } finally {
    $tileBorder.Dispose()
  }

  $highlightBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    [System.Drawing.RectangleF]::new($tileX, $tileY, $tileWidth, 180 * $scale),
    (Get-Color '#FFFFFF' 80),
    (Get-Color '#FFFFFF' 0),
    90
  )
  try {
    Fill-RoundedRect $graphics $highlightBrush ($tileX + 24 * $scale) ($tileY + 18 * $scale) ($tileWidth - 48 * $scale) (180 * $scale) (110 * $scale)
  } finally {
    $highlightBrush.Dispose()
  }

  $slotBrush = New-Object System.Drawing.SolidBrush((Get-Color '#FFF4ED' 220))
  try {
    Fill-RoundedRect $graphics $slotBrush (290 * $scale) (352 * $scale) (234 * $scale) (24 * $scale) (12 * $scale)
  } finally {
    $slotBrush.Dispose()
  }

  $tabBrush = New-Object System.Drawing.SolidBrush($navyLift)
  try {
    Fill-RoundedRect $graphics $tabBrush (602 * $scale) (198 * $scale) (188 * $scale) (142 * $scale) (52 * $scale)
  } finally {
    $tabBrush.Dispose()
  }

  $panelBrush = New-Object System.Drawing.SolidBrush($panel)
  try {
    Fill-RoundedRect $graphics $panelBrush (258 * $scale) (424 * $scale) (452 * $scale) (220 * $scale) (72 * $scale)
  } finally {
    $panelBrush.Dispose()
  }

  $panelAccentBrush = New-Object System.Drawing.SolidBrush($creamSoft)
  try {
    Fill-RoundedRect $graphics $panelAccentBrush (278 * $scale) (444 * $scale) (412 * $scale) (78 * $scale) (40 * $scale)
  } finally {
    $panelAccentBrush.Dispose()
  }

  $barBrush = New-Object System.Drawing.SolidBrush($lineAccent)
  try {
    Fill-RoundedRect $graphics $barBrush (306 * $scale) (534 * $scale) (64 * $scale) (76 * $scale) (18 * $scale)
    Fill-RoundedRect $graphics $barBrush (414 * $scale) (488 * $scale) (64 * $scale) (122 * $scale) (18 * $scale)
    Fill-RoundedRect $graphics $barBrush (522 * $scale) (446 * $scale) (64 * $scale) (164 * $scale) (18 * $scale)
  } finally {
    $barBrush.Dispose()
  }

  $trendPen = New-Object System.Drawing.Pen($navy, (16 * $scale))
  $trendPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trendPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trendPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  try {
    $graphics.DrawLines($trendPen, @(
      [System.Drawing.PointF]::new(330 * $scale, 600 * $scale),
      [System.Drawing.PointF]::new(438 * $scale, 554 * $scale),
      [System.Drawing.PointF]::new(528 * $scale, 506 * $scale),
      [System.Drawing.PointF]::new(642 * $scale, 420 * $scale)
    ))
  } finally {
    $trendPen.Dispose()
  }

  $nodeBrush = New-Object System.Drawing.SolidBrush($navy)
  try {
    foreach ($point in @(
      [System.Drawing.PointF]::new(330 * $scale, 600 * $scale),
      [System.Drawing.PointF]::new(438 * $scale, 554 * $scale),
      [System.Drawing.PointF]::new(528 * $scale, 506 * $scale),
      [System.Drawing.PointF]::new(642 * $scale, 420 * $scale)
    )) {
      $graphics.FillEllipse($nodeBrush, $point.X - 13 * $scale, $point.Y - 13 * $scale, 26 * $scale, 26 * $scale)
    }
  } finally {
    $nodeBrush.Dispose()
  }

  $badgeShadowBrush = New-Object System.Drawing.SolidBrush((Get-Color '#17324D' 22))
  try {
    $graphics.FillEllipse($badgeShadowBrush, 628 * $scale, 280 * $scale, 128 * $scale, 128 * $scale)
  } finally {
    $badgeShadowBrush.Dispose()
  }

  $badgeBrush = New-Object System.Drawing.SolidBrush($cream)
  try {
    $graphics.FillEllipse($badgeBrush, 618 * $scale, 264 * $scale, 128 * $scale, 128 * $scale)
  } finally {
    $badgeBrush.Dispose()
  }

  $badgeInnerBrush = New-Object System.Drawing.SolidBrush($navy)
  try {
    $graphics.FillEllipse($badgeInnerBrush, 646 * $scale, 292 * $scale, 72 * $scale, 72 * $scale)
  } finally {
    $badgeInnerBrush.Dispose()
  }

  $sparkPen = New-Object System.Drawing.Pen((Get-Color '#FFDCCF'), (9 * $scale))
  $sparkPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $sparkPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $sparkPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  try {
    $graphics.DrawLines($sparkPen, @(
      [System.Drawing.PointF]::new(663 * $scale, 346 * $scale),
      [System.Drawing.PointF]::new(681 * $scale, 328 * $scale),
      [System.Drawing.PointF]::new(696 * $scale, 340 * $scale),
      [System.Drawing.PointF]::new(716 * $scale, 312 * $scale)
    ))
  } finally {
    $sparkPen.Dispose()
  }
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$path) {
  $directory = Split-Path -Parent $path
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function New-Canvas([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Set-GraphicsQuality $graphics
  $graphics.Clear([System.Drawing.Color]::Transparent)
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

$root = Split-Path -Parent $PSScriptRoot
$assetsPath = Join-Path $root 'assets\images'

$iconCanvas = New-Canvas 1024
try {
  Draw-ModernFinanceMark $iconCanvas.Graphics 1024 $true
  Save-Png $iconCanvas.Bitmap (Join-Path $assetsPath 'icon.png')
} finally {
  $iconCanvas.Graphics.Dispose()
  $iconCanvas.Bitmap.Dispose()
}

$adaptiveCanvas = New-Canvas 1408
try {
  Draw-ModernFinanceMark $adaptiveCanvas.Graphics 1408 $false
  Save-Png $adaptiveCanvas.Bitmap (Join-Path $assetsPath 'adaptive-icon.png')
} finally {
  $adaptiveCanvas.Graphics.Dispose()
  $adaptiveCanvas.Bitmap.Dispose()
}

$splashCanvas = New-Canvas 512
try {
  Draw-ModernFinanceMark $splashCanvas.Graphics 512 $false
  Save-Png $splashCanvas.Bitmap (Join-Path $assetsPath 'splash-icon.png')
} finally {
  $splashCanvas.Graphics.Dispose()
  $splashCanvas.Bitmap.Dispose()
}


Write-Host 'Brand assets generated.'
