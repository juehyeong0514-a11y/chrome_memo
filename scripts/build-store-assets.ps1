Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$OutDir = Join-Path $Root "store-assets"
$RefDir = "C:\Users\User\.codex\attachments\00dfea1a-41f2-494d-bfc0-a9a62524bdac"
$IconPath = Join-Path $Root "icons\icon128.png"
$ToolbarPath = Join-Path $RefDir "image-2.png"
$QuickPath = Join-Path $RefDir "image-3.png"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Color($hex) {
  return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function Brush($hex) {
  return [System.Drawing.SolidBrush]::new((Color $hex))
}

function PenObj($hex, $width = 1) {
  $pen = [System.Drawing.Pen]::new((Color $hex), [single]$width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function FontObj($size, $style = [System.Drawing.FontStyle]::Regular) {
  return [System.Drawing.Font]::new("Malgun Gothic", [single]$size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function RoundedPath($x, $y, $w, $h, $r) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function FillRound($g, $x, $y, $w, $h, $r, $hex) {
  $path = RoundedPath $x $y $w $h $r
  $brush = Brush $hex
  $g.FillPath($brush, $path)
  $brush.Dispose()
  $path.Dispose()
}

function StrokeRound($g, $x, $y, $w, $h, $r, $hex, $width = 1) {
  $path = RoundedPath $x $y $w $h $r
  $pen = PenObj $hex $width
  $g.DrawPath($pen, $path)
  $pen.Dispose()
  $path.Dispose()
}

function DrawText($g, $text, $x, $y, $size, $hex, $style = [System.Drawing.FontStyle]::Regular, $w = 900, $h = 120) {
  $font = FontObj $size $style
  $brush = Brush $hex
  $format = [System.Drawing.StringFormat]::new()
  $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
  $rect = [System.Drawing.RectangleF]::new([single]$x, [single]$y, [single]$w, [single]$h)
  $g.DrawString($text, $font, $brush, $rect, $format)
  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function DrawCenteredText($g, $text, $x, $y, $w, $h, $size, $hex, $style = [System.Drawing.FontStyle]::Regular) {
  $font = FontObj $size $style
  $brush = Brush $hex
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = [System.Drawing.RectangleF]::new([single]$x, [single]$y, [single]$w, [single]$h)
  $g.DrawString($text, $font, $brush, $rect, $format)
  $format.Dispose()
  $brush.Dispose()
  $font.Dispose()
}

function LoadCleanImage($path) {
  $src = [System.Drawing.Bitmap]::FromFile($path)
  $bmp = [System.Drawing.Bitmap]::new($src.Width, $src.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  for ($y = 0; $y -lt $src.Height; $y++) {
    for ($x = 0; $x -lt $src.Width; $x++) {
      $p = $src.GetPixel($x, $y)
      if ($p.R -lt 4 -and $p.G -lt 4 -and $p.B -lt 4) {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
      } else {
        $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $p.R, $p.G, $p.B))
      }
    }
  }
  $src.Dispose()
  return $bmp
}

function NewCanvas($w, $h) {
  $bmp = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  $g.Clear((Color "#f8fafc"))
  return @{ Bitmap = $bmp; Graphics = $g }
}

function DrawBackdrop($g, $w, $h) {
  $rect = [System.Drawing.Rectangle]::new(0, 0, [int]$w, [int]$h)
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, (Color "#eff6ff"), (Color "#f8fafc"), [single]35)
  $g.FillRectangle($brush, $rect)
  $brush.Dispose()
  FillRound $g -120 560 440 260 80 "#dbeafe"
  FillRound $g 960 -120 420 260 80 "#e0f2fe"
  FillRound $g 980 600 240 120 60 "#dcfce7"
}

function DrawBrowserMock($g, $x, $y, $w, $h) {
  FillRound $g $x $y $w $h 26 "#ffffff"
  StrokeRound $g $x $y $w $h 26 "#cbd5e1" 2
  FillRound $g ($x + 1) ($y + 1) ($w - 2) 58 26 "#f1f5f9"
  $dotY = $y + 24
  foreach ($i in 0..2) {
    $b = Brush @("#ef4444", "#f59e0b", "#22c55e")[$i]
    $g.FillEllipse($b, $x + 24 + ($i * 22), $dotY, 11, 11)
    $b.Dispose()
  }
  FillRound $g ($x + 110) ($y + 17) ($w - 150) 25 12 "#ffffff"
  DrawText $g "article.example.com/research-note" ($x + 132) ($y + 20) 12 "#94a3b8" ([System.Drawing.FontStyle]::Regular) ($w - 180) 22
}

function DrawArticle($g, $x, $y, $w, $h) {
  DrawText $g "Long web article" ($x + 44) ($y + 88) 22 "#0f172a" ([System.Drawing.FontStyle]::Bold) 520 38
  foreach ($i in 0..7) {
    $lineW = if ($i % 3 -eq 0) { 520 } elseif ($i % 3 -eq 1) { 455 } else { 500 }
    FillRound $g ($x + 44) ($y + 138 + ($i * 30)) $lineW 12 6 "#e2e8f0"
  }
  FillRound $g ($x + $w - 270) ($y + 98) 190 240 18 "#eef2ff"
  StrokeRound $g ($x + $w - 270) ($y + 98) 190 240 18 "#c7d2fe" 2
  DrawCenteredText $g "PAGE`nCONTENT" ($x + $w - 250) ($y + 170) 150 80 20 "#6366f1" ([System.Drawing.FontStyle]::Bold)
}

function DrawInk($g, $dx = 0, $dy = 0, $scale = 1) {
  $blue = PenObj "#2563eb" (8 * $scale)
  $yellow = PenObj "#facc15" (18 * $scale)
  $red = PenObj "#ef4444" (6 * $scale)
  $pts1 = @(
    [System.Drawing.PointF]::new(432 * $scale + $dx, 296 * $scale + $dy),
    [System.Drawing.PointF]::new(500 * $scale + $dx, 276 * $scale + $dy),
    [System.Drawing.PointF]::new(574 * $scale + $dx, 302 * $scale + $dy),
    [System.Drawing.PointF]::new(650 * $scale + $dx, 284 * $scale + $dy)
  )
  $pts2 = @(
    [System.Drawing.PointF]::new(308 * $scale + $dx, 236 * $scale + $dy),
    [System.Drawing.PointF]::new(382 * $scale + $dx, 232 * $scale + $dy),
    [System.Drawing.PointF]::new(462 * $scale + $dx, 236 * $scale + $dy)
  )
  $pts3 = @(
    [System.Drawing.PointF]::new(368 * $scale + $dx, 392 * $scale + $dy),
    [System.Drawing.PointF]::new(510 * $scale + $dx, 438 * $scale + $dy),
    [System.Drawing.PointF]::new(654 * $scale + $dx, 410 * $scale + $dy)
  )
  $g.DrawCurve($blue, $pts1)
  $g.DrawCurve($yellow, $pts2)
  $g.DrawCurve($red, $pts3)
  $blue.Dispose(); $yellow.Dispose(); $red.Dispose()
}

function DrawToolbarImage($g, $img, $x, $y, $scale = 1.0) {
  $w = [int]($img.Width * $scale)
  $h = [int]($img.Height * $scale)
  $shadow = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(35, 15, 23, 42))
  FillRound $g ($x + 12) ($y + 18) $w $h 20 "#dbeafe"
  $g.DrawImage($img, $x, $y, $w, $h)
  $shadow.Dispose()
}

function DrawQuickImage($g, $img, $x, $y, $scale = 1.0) {
  $w = [int]($img.Width * $scale)
  $h = [int]($img.Height * $scale)
  FillRound $g ($x + 12) ($y + 18) $w $h 18 "#dbeafe"
  $g.DrawImage($img, $x, $y, $w, $h)
}

function DrawBadge($g, $text, $x, $y, $w) {
  FillRound $g $x $y $w 42 21 "#0f172a"
  DrawCenteredText $g $text $x $y $w 42 17 "#ffffff" ([System.Drawing.FontStyle]::Bold)
}

function SavePng($bmp, $name) {
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host $path
}

$icon = [System.Drawing.Bitmap]::FromFile($IconPath)
$toolbar = LoadCleanImage $ToolbarPath
$quick = LoadCleanImage $QuickPath

function BuildScreenshot1 {
  $c = NewCanvas 1280 800; $g = $c.Graphics
  DrawBackdrop $g 1280 800
  $g.DrawImage($icon, 86, 86, 76, 76)
  DrawText $g "Web Annotation Floating Pen" 180 88 26 "#1e3a8a" ([System.Drawing.FontStyle]::Bold) 600 40
  DrawText $g "켜는 순간 바로 필기" 86 170 58 "#0f172a" ([System.Drawing.FontStyle]::Bold) 620 150
  DrawText $g "웹페이지 위에 바로 쓰고, 강조하고, 저장." 90 322 25 "#475569" ([System.Drawing.FontStyle]::Regular) 520 70
  DrawBadge $g "펜 모드 자동 시작" 90 420 190
  DrawBadge $g "페이지별 자동 저장" 300 420 190
  DrawBrowserMock $g 620 115 560 500
  DrawArticle $g 620 115 560 500
  DrawInk $g 270 0 1
  DrawToolbarImage $g $toolbar 650 580 0.92
  SavePng $c.Bitmap "screenshot-1-instant-pen.png"
  $g.Dispose(); $c.Bitmap.Dispose()
}

function BuildScreenshot2 {
  $c = NewCanvas 1280 800; $g = $c.Graphics
  DrawBackdrop $g 1280 800
  DrawText $g "그리기 모드에서도 휠로 이동" 88 90 52 "#0f172a" ([System.Drawing.FontStyle]::Bold) 660 140
  DrawText $g "긴 문서와 내부 스크롤 영역에서도 필기가 화면에 맞춰 함께 움직입니다." 92 236 25 "#475569" ([System.Drawing.FontStyle]::Regular) 650 90
  DrawBrowserMock $g 720 80 420 620
  DrawArticle $g 720 80 420 620
  DrawInk $g 245 20 0.88
  $pen = PenObj "#2563eb" 5
  $pen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
  $g.DrawLine($pen, 600, 360, 695, 360)
  $g.DrawLine($pen, 600, 430, 695, 430)
  $pen.Dispose()
  DrawCenteredText $g "휠 스크롤" 430 340 150 52 21 "#2563eb" ([System.Drawing.FontStyle]::Bold)
  DrawCenteredText $g "필기 위치 유지" 410 412 190 52 21 "#16a34a" ([System.Drawing.FontStyle]::Bold)
  DrawToolbarImage $g $toolbar 92 560 0.85
  SavePng $c.Bitmap "screenshot-2-scroll-while-drawing.png"
  $g.Dispose(); $c.Bitmap.Dispose()
}

function BuildScreenshot3 {
  $c = NewCanvas 1280 800; $g = $c.Graphics
  DrawBackdrop $g 1280 800
  DrawText $g "필요한 도구만 빠르게" 86 84 54 "#0f172a" ([System.Drawing.FontStyle]::Bold) 620 120
  DrawText $g "펜, 형광펜, 지우개, 텍스트, 캡처, 선택 이동까지 작은 툴바 안에 담았습니다." 90 220 24 "#475569" ([System.Drawing.FontStyle]::Regular) 620 90
  DrawToolbarImage $g $toolbar 92 360 1.5
  DrawQuickImage $g $quick 750 160 1.45
  DrawBadge $g "Quick change" 760 545 160
  DrawBadge $g "색상·굵기 즉시 변경" 940 545 220
  SavePng $c.Bitmap "screenshot-3-toolbar-and-quick-tools.png"
  $g.Dispose(); $c.Bitmap.Dispose()
}

function BuildScreenshot4 {
  $c = NewCanvas 1280 800; $g = $c.Graphics
  DrawBackdrop $g 1280 800
  DrawText $g "캡처·저장·복원" 82 86 50 "#0f172a" ([System.Drawing.FontStyle]::Bold) 700 120
  DrawText $g "전체 화면과 선택 영역을 PNG로 저장하고, 페이지별 주석은 자동 복원됩니다." 86 214 24 "#475569" ([System.Drawing.FontStyle]::Regular) 610 90
  FillRound $g 760 115 350 440 28 "#ffffff"
  StrokeRound $g 760 115 350 440 28 "#cbd5e1" 2
  DrawCenteredText $g "PNG`nCAPTURE" 815 205 240 110 32 "#2563eb" ([System.Drawing.FontStyle]::Bold)
  FillRound $g 815 380 240 58 14 "#2563eb"
  DrawCenteredText $g "저장 / 복사" 815 380 240 58 24 "#ffffff" ([System.Drawing.FontStyle]::Bold)
  DrawBrowserMock $g 100 350 550 260
  $yellow = PenObj "#facc15" 14
  $blue = PenObj "#2563eb" 7
  $red = PenObj "#ef4444" 6
  $g.DrawLine($yellow, 180, 486, 420, 480)
  $g.DrawCurve($blue, @([System.Drawing.PointF]::new(170,520),[System.Drawing.PointF]::new(260,492),[System.Drawing.PointF]::new(370,522),[System.Drawing.PointF]::new(470,498)))
  $g.DrawCurve($red, @([System.Drawing.PointF]::new(115,405),[System.Drawing.PointF]::new(215,448),[System.Drawing.PointF]::new(350,430)))
  $yellow.Dispose(); $blue.Dispose(); $red.Dispose()
  SavePng $c.Bitmap "screenshot-4-capture-and-save.png"
  $g.Dispose(); $c.Bitmap.Dispose()
}

function BuildScreenshot5 {
  $c = NewCanvas 1280 800; $g = $c.Graphics
  DrawBackdrop $g 1280 800
  DrawText $g "가볍고 개인적인 웹 메모" 86 84 54 "#0f172a" ([System.Drawing.FontStyle]::Bold) 670 120
  DrawText $g "페이지별로 저장하고, 필요할 때 전체 지우기. 복잡한 가입 과정 없이 브라우저 안에서 바로 사용합니다." 90 220 24 "#475569" ([System.Drawing.FontStyle]::Regular) 650 100
  $items = @(
    @("자동 저장", "URL별 필기와 텍스트 복원"),
    @("빠른 초기화", "현재 페이지 주석 전체 지우기"),
    @("깔끔한 UI", "페이지 CSS와 충돌하지 않는 UI")
  )
  for ($i=0; $i -lt $items.Count; $i++) {
    $y = 380 + ($i * 105)
    FillRound $g 100 $y 500 78 18 "#ffffff"
    StrokeRound $g 100 $y 500 78 18 "#dbeafe" 2
    DrawText $g $items[$i][0] 130 ($y + 15) 23 "#1d4ed8" ([System.Drawing.FontStyle]::Bold) 180 32
    DrawText $g $items[$i][1] 275 ($y + 17) 19 "#475569" ([System.Drawing.FontStyle]::Regular) 290 35
  }
  DrawQuickImage $g $quick 760 265 1.3
  DrawToolbarImage $g $toolbar 705 530 0.95
  SavePng $c.Bitmap "screenshot-5-save-and-clean-ui.png"
  $g.Dispose(); $c.Bitmap.Dispose()
}

function BuildSmallPromo {
  $c = NewCanvas 440 280; $g = $c.Graphics
  DrawBackdrop $g 440 280
  $g.DrawImage($icon, 32, 32, 52, 52)
  DrawText $g "웹 위에 바로 필기" 98 32 30 "#0f172a" ([System.Drawing.FontStyle]::Bold) 300 45
  DrawText $g "켜면 바로 펜 모드" 100 80 17 "#475569" ([System.Drawing.FontStyle]::Regular) 260 28
  DrawToolbarImage $g $toolbar 45 160 0.62
  $pen = PenObj "#2563eb" 5
  $g.DrawCurve($pen, @([System.Drawing.PointF]::new(90,130),[System.Drawing.PointF]::new(160,110),[System.Drawing.PointF]::new(230,132),[System.Drawing.PointF]::new(315,112)))
  $pen.Dispose()
  SavePng $c.Bitmap "promo-small-440x280.png"
  $g.Dispose(); $c.Bitmap.Dispose()
}

function BuildMarquee {
  $c = NewCanvas 1400 560; $g = $c.Graphics
  DrawBackdrop $g 1400 560
  $g.DrawImage($icon, 80, 82, 78, 78)
  DrawText $g "Web Annotation Floating Pen" 178 88 28 "#1e3a8a" ([System.Drawing.FontStyle]::Bold) 620 40
  DrawText $g "웹페이지 위에 바로 쓰는 플로팅 펜" 82 180 56 "#0f172a" ([System.Drawing.FontStyle]::Bold) 650 140
  DrawText $g "펜 · 형광펜 · 지우개 · 텍스트 · 캡처를 한 번에" 86 328 26 "#475569" ([System.Drawing.FontStyle]::Regular) 650 55
  DrawBadge $g "켜면 바로 펜 모드" 88 410 190
  DrawBadge $g "휠 스크롤 지원" 300 410 175
  DrawBrowserMock $g 790 70 480 370
  DrawArticle $g 790 70 480 370
  DrawInk $g 300 -20 0.9
  DrawToolbarImage $g $toolbar 790 455 0.85
  SavePng $c.Bitmap "promo-marquee-1400x560.png"
  $g.Dispose(); $c.Bitmap.Dispose()
}

BuildScreenshot1
BuildScreenshot2
BuildScreenshot3
BuildScreenshot4
BuildScreenshot5
BuildSmallPromo
BuildMarquee

$icon.Dispose()
$toolbar.Dispose()
$quick.Dispose()

