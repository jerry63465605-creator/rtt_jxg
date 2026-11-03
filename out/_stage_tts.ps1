$src = 'c:/Users/24968/Desktop/rtt/out/cards_sliced'
$dst = 'c:/Users/24968/Desktop/rtt/server-official/public/quartermaster-sub-wars/cards_tts'
New-Item -ItemType Directory -Force -Path $dst | Out-Null

# id -> (sheet,row,col) 由 TTS CardID 解码得出（可能个别错位，需人工核对）
$map = @{
  15349 = 'sheet153_r4_c8'
  15350 = 'sheet153_r4_c9'
  15351 = 'sheet153_r5_c0'
  15352 = 'sheet153_r5_c1'
  15353 = 'sheet153_r5_c2'
  15354 = 'sheet153_r5_c3'
  17851 = 'sheet178_r5_c0'
  17852 = 'sheet178_r5_c1'
  17853 = 'sheet178_r5_c2'
  17854 = 'sheet178_r5_c3'
  17855 = 'sheet178_r5_c4'
}

foreach ($id in $map.Keys) {
  $s = Join-Path $src ($map[$id] + '.png')
  $d = Join-Path $dst ($id.ToString() + '.png')
  if (Test-Path $s) {
    Copy-Item $s $d -Force
    Write-Output ("OK  " + $id + " <- " + $map[$id] + " (" + (Get-Item $d).Length + "B)")
  } else {
    Write-Output ("MISSING source " + $map[$id] + " for " + $id)
  }
}
Write-Output "STAGE_DONE"
