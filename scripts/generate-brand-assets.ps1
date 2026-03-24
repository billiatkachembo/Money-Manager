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

function Draw-WalletMark([System.Drawing.Graphics]$graphics, [float]$canvasSize, [bool]$showBackground) {
  $creamLight = Get-Color '#FFF8F1'
  $creamDark = Get-Color '#F1E3D3'
  $coralTop = Get-Color '#FF835F'
  $coralBottom = Get-Color '#F05A3D'
  $navy = Get-Color '#1E3552'
  $peach = Get-Color '#FFD8C7'
  $shadow = Get-Color '#122033' 32
  $softShadow = Get-Color '#122033' 18
  $cardHighlight = Get-Color '#FFFFFF' 72
  $accentLine = Get-Color '#FFF2E9' 220
  $badgeFill = Get-Color '#16324D'

  $scale = $canvasSize / 1024.0

  if ($showBackground) {
    $backgroundRect = New-Object System.Drawing.RectangleF(0, 0, $canvasSize, $canvasSize)
    $backgroundBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      $backgroundRect,
      $creamLight,
      $creamDark,
      55
    )
    try {
      $graphics.FillRectangle($backgroundBrush, $backgroundRect)
    } finally {
      $backgroundBrush.Dispose()
    }

    Fill-GlowEllipse $graphics (-140 * $scale) (-110 * $scale) (640 * $scale) (640 * $scale) (Get-Color '#FFE7D7' 170)
    Fill-GlowEllipse $graphics (510 * $scale) (560 * $scale) (520 * $scale) (360 * $scale) (Get-Color '#FFFFFF' 120)

    $outerPen = New-Object System.Drawing.Pen((Get-Color '#FFFFFF' 70), (4 * $scale))
    try {
      Draw-RoundedRect $graphics $outerPen (18 * $scale) (18 * $scale) ($canvasSize - 36 * $scale) ($canvasSize - 36 * $scale) (220 * $scale)
    } finally {
      $outerPen.Dispose()
    }
  }

  $walletX = 190 * $scale
  $walletY = 322 * $scale
  $walletWidth = 644 * $scale
  $walletHeight = 392 * $scale
  $walletRadius = 106 * $scale

  $strapX = 590 * $scale
  $strapY = 250 * $scale
  $strapWidth = 190 * $scale
  $strapHeight = 136 * $scale
  $strapRadius = 48 * $scale

  $shadowBrush = New-Object System.Drawing.SolidBrush($shadow)
  $softShadowBrush = New-Object System.Drawing.SolidBrush($softShadow)
  try {
    Fill-RoundedRect $graphics $softShadowBrush ($walletX + 18 * $scale) ($walletY + 34 * $scale) $walletWidth $walletHeight $walletRadius
    Fill-RoundedRect $graphics $shadowBrush ($walletX + 10 * $scale) ($walletY + 20 * $scale) $walletWidth $walletHeight $walletRadius
    Fill-RoundedRect $graphics $softShadowBrush ($strapX + 8 * $scale) ($strapY + 16 * $scale) $strapWidth $strapHeight $strapRadius
  } finally {
    $shadowBrush.Dispose()
    $softShadowBrush.Dispose()
  }

  $walletRect = New-Object System.Drawing.RectangleF($walletX, $walletY, $walletWidth, $walletHeight)
  $walletBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($walletRect, $coralTop, $coralBottom, 90)
  try {
    Fill-RoundedRect $graphics $walletBrush $walletX $walletY $walletWidth $walletHeight $walletRadius
  } finally {
    $walletBrush.Dispose()
  }

  $walletPen = New-Object System.Drawing.Pen($cardHighlight, (6 * $scale))
  try {
    Draw-RoundedRect $graphics $walletPen $walletX $walletY $walletWidth $walletHeight $walletRadius
  } finally {
    $walletPen.Dispose()
  }

  $strapRect = New-Object System.Drawing.RectangleF($strapX, $strapY, $strapWidth, $strapHeight)
  $strapBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($strapRect, (Get-Color '#284764'), $badgeFill, 90)
  try {
    Fill-RoundedRect $graphics $strapBrush $strapX $strapY $strapWidth $strapHeight $strapRadius
  } finally {
    $strapBrush.Dispose()
  }

  $slotBrush = New-Object System.Drawing.SolidBrush((Get-Color '#FFF7F1' 180))
  try {
    Fill-RoundedRect $graphics $slotBrush (290 * $scale) (402 * $scale) (222 * $scale) (22 * $scale) (11 * $scale)
  } finally {
    $slotBrush.Dispose()
  }

  $badgeShadowBrush = New-Object System.Drawing.SolidBrush((Get-Color '#122033' 24))
  try {
    $graphics.FillEllipse($badgeShadowBrush, 640 * $scale, 332 * $scale, 118 * $scale, 118 * $scale)
  } finally {
    $badgeShadowBrush.Dispose()
  }

  $badgeBrush = New-Object System.Drawing.SolidBrush((Get-Color '#FFF5ED'))
  try {
    $graphics.FillEllipse($badgeBrush, 632 * $scale, 318 * $scale, 118 * $scale, 118 * $scale)
  } finally {
    $badgeBrush.Dispose()
  }

  $badgeInnerBrush = New-Object System.Drawing.SolidBrush($badgeFill)
  try {
    $graphics.FillEllipse($badgeInnerBrush, 655 * $scale, 341 * $scale, 72 * $scale, 72 * $scale)
  } finally {
    $badgeInnerBrush.Dispose()
  }

  $badgeLinePen = New-Object System.Drawing.Pen($peach, (10 * $scale))
  $badgeLinePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $badgeLinePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  try {
    $graphics.DrawLine($badgeLinePen, 675 * $scale, 392 * $scale, 695 * $scale, 370 * $scale)
    $graphics.DrawLine($badgeLinePen, 695 * $scale, 370 * $scale, 710 * $scale, 382 * $scale)
    $graphics.DrawLine($badgeLinePen, 710 * $scale, 382 * $scale, 730 * $scale, 352 * $scale)
  } finally {
    $badgeLinePen.Dispose()
  }

  $barBrush = New-Object System.Drawing.SolidBrush($accentLine)
  try {
    Fill-RoundedRect $graphics $barBrush (300 * $scale) (530 * $scale) (62 * $scale) (96 * $scale) (20 * $scale)
    Fill-RoundedRect $graphics $barBrush (408 * $scale) (462 * $scale) (62 * $scale) (164 * $scale) (20 * $scale)
    Fill-RoundedRect $graphics $barBrush (516 * $scale) (390 * $scale) (62 * $scale) (236 * $scale) (20 * $scale)
  } finally {
    $barBrush.Dispose()
  }

  $trendPen = New-Object System.Drawing.Pen($navy, (18 * $scale))
  $trendPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trendPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $trendPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  try {
    $graphics.DrawLines($trendPen, @(
      [System.Drawing.PointF]::new(326 * $scale, 566 * $scale),
      [System.Drawing.PointF]::new(438 * $scale, 505 * $scale),
      [System.Drawing.PointF]::new(548 * $scale, 444 * $scale),
      [System.Drawing.PointF]::new(652 * $scale, 372 * $scale)
    ))
  } finally {
    $trendPen.Dispose()
  }

  $nodeBrush = New-Object System.Drawing.SolidBrush($navy)
  try {
    foreach ($point in @(
      [System.Drawing.PointF]::new(326 * $scale, 566 * $scale),
      [System.Drawing.PointF]::new(438 * $scale, 505 * $scale),
      [System.Drawing.PointF]::new(548 * $scale, 444 * $scale),
      [System.Drawing.PointF]::new(652 * $scale, 372 * $scale)
    )) {
      $graphics.FillEllipse($nodeBrush, $point.X - 14 * $scale, $point.Y - 14 * $scale, 28 * $scale, 28 * $scale)
    }
  } finally {
    $nodeBrush.Dispose()
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
  Draw-WalletMark $iconCanvas.Graphics 1024 $true
  Save-Png $iconCanvas.Bitmap (Join-Path $assetsPath 'icon.png')
} finally {
  $iconCanvas.Graphics.Dispose()
  $iconCanvas.Bitmap.Dispose()
}

$adaptiveCanvas = New-Canvas 1408
try {
  Draw-WalletMark $adaptiveCanvas.Graphics 1408 $false
  Save-Png $adaptiveCanvas.Bitmap (Join-Path $assetsPath 'adaptive-icon.png')
} finally {
  $adaptiveCanvas.Graphics.Dispose()
  $adaptiveCanvas.Bitmap.Dispose()
}

$splashCanvas = New-Canvas 512
try {
  Draw-WalletMark $splashCanvas.Graphics 512 $false
  Save-Png $splashCanvas.Bitmap (Join-Path $assetsPath 'splash-icon.png')
} finally {
  $splashCanvas.Graphics.Dispose()
  $splashCanvas.Bitmap.Dispose()
}

$iconImage = [System.Drawing.Image]::FromFile((Join-Path $assetsPath 'icon.png'))
try {
  $favicon = New-Object System.Drawing.Bitmap 64, 64
  $faviconGraphics = [System.Drawing.Graphics]::FromImage($favicon)
  try {
    Set-GraphicsQuality $faviconGraphics
    $faviconGraphics.DrawImage($iconImage, 0, 0, 64, 64)
    Save-Png $favicon (Join-Path $assetsPath 'favicon.png')
  } finally {
    $faviconGraphics.Dispose()
    $favicon.Dispose()
  }
} finally {
  $iconImage.Dispose()
}

Write-Host 'Brand assets generated.'