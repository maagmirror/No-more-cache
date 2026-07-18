Add-Type -AssemblyName System.Drawing

$dir = $PSScriptRoot
$sizes = 16, 32, 48, 128

foreach ($size in $sizes) {
  $s = $size / 128.0
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.Clear([System.Drawing.Color]::Transparent)

  # rounded background
  $r = 28 * $s
  $bg = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $size
  $bg.AddArc(0, 0, 2*$r, 2*$r, 180, 90)
  $bg.AddArc($d-2*$r, 0, 2*$r, 2*$r, 270, 90)
  $bg.AddArc($d-2*$r, $d-2*$r, 2*$r, 2*$r, 0, 90)
  $bg.AddArc(0, $d-2*$r, 2*$r, 2*$r, 90, 90)
  $bg.CloseFigure()
  $g.FillPath((New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0x12,0x15,0x1c))), $bg)

  # green refresh arc
  $green = [System.Drawing.Color]::FromArgb(0x3f,0xb9,0x50)
  $penG = New-Object System.Drawing.Pen($green, [float](11*$s))
  $penG.StartCap = 'Round'; $penG.EndCap = 'Round'
  $cx = 64*$s; $cy = 64*$s; $rad = 34*$s
  $g.DrawArc($penG, $cx-$rad, $cy-$rad, 2*$rad, 2*$rad, -25, 300)

  # arrowhead (triangle) at arc opening, top-right
  $tri = @(
    (New-Object System.Drawing.PointF((74*$s), (30*$s))),
    (New-Object System.Drawing.PointF((100*$s), (36*$s))),
    (New-Object System.Drawing.PointF((90*$s), (60*$s)))
  )
  $g.FillPolygon((New-Object System.Drawing.SolidBrush($green)), $tri)

  # red no-cache slash
  $red = [System.Drawing.Color]::FromArgb(0xf8,0x51,0x49)
  $penR = New-Object System.Drawing.Pen($red, [float](10*$s))
  $penR.StartCap = 'Round'; $penR.EndCap = 'Round'
  $g.DrawLine($penR, 34*$s, 94*$s, 94*$s, 34*$s)

  $g.Dispose()
  $out = Join-Path $dir "icon$size.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  "wrote $out"
}
